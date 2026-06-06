import re
import httpx
from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import List, Optional

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_premium_user
from app.core.feature_flags import flag_on_for
from app.models.user import User
from app.services.scryfall import (
    search_cards, get_card_by_id, get_card_by_name,
    autocomplete_cards, extract_card_summary, get_card_prints, get_card_lang_variant,
    get_card_rulings,
)
from app.services.fx import get_usd_brl

router = APIRouter()


class ScanOcrRequest(BaseModel):
    image: str  # base64 (optionally a data: URL) of the card-name crop


@router.get("/scan-ocr/status")
async def scan_ocr_status():
    """Which recognition providers are configured (so the UI can prefer them)."""
    return {
        "configured": bool(settings.ximilar_api_token),
        "ximilar": bool(settings.ximilar_api_token),
    }


def _clean_line(text: str) -> str:
    """First substantial line of OCR text = the card name."""
    for line in (text or "").splitlines():
        cleaned = re.sub(r"[^A-Za-zÀ-ÿ',\- ]", "", line).strip()
        if len(re.sub(r"[^A-Za-z]", "", cleaned)) >= 3:
            return cleaned
    return ""


def _dig_best_match(node) -> dict:
    """Find the first {'best_match': {...}} anywhere in Ximilar's response."""
    if isinstance(node, dict):
        bm = node.get("best_match")
        if isinstance(bm, dict) and bm:
            return bm
        for v in node.values():
            found = _dig_best_match(v)
            if found:
                return found
    elif isinstance(node, list):
        for v in node:
            found = _dig_best_match(v)
            if found:
                return found
    return {}


async def _ximilar_card(content: str) -> dict:
    """Identify a card (name + set) by image via Ximilar. Returns {} on no match."""
    async with httpx.AsyncClient(timeout=25.0) as client:
        r = await client.post(
            "https://api.ximilar.com/collectibles/v2/process",
            headers={"Authorization": f"Token {settings.ximilar_api_token}"},
            json={"records": [{"_base64": content}]},
        )
    if r.status_code >= 400:
        raise RuntimeError(r.text[:200])
    bm = _dig_best_match(r.json())
    name = bm.get("full_name") or bm.get("name") or bm.get("title") or ""
    return {"name": _clean_line(name) or name.strip(),
            "set": bm.get("set") or bm.get("set_name") or bm.get("set_code")}


@router.post("/scan-ocr")
async def scan_ocr(data: ScanOcrRequest, viewer: User = Depends(get_premium_user), db: AsyncSession = Depends(get_db)):
    """Premium + scanOCR flag: identify a card by image via Ximilar (name + set).
    On no match/error the client falls back to local OCR."""
    if not settings.ximilar_api_token:
        raise HTTPException(status_code=503, detail="Reconhecimento na nuvem não configurado")
    if not await flag_on_for(db, "scanOCR", viewer):
        raise HTTPException(status_code=403, detail="Recurso desativado")
    content = re.sub(r"^data:image/[^;]+;base64,", "", data.image or "")
    if not content:
        raise HTTPException(status_code=400, detail="Imagem vazia")

    # Ximilar — image-based recognition (also returns the set).
    try:
        card = await _ximilar_card(content)
        if card.get("name"):
            return {"name": card["name"], "set": card.get("set"), "source": "ximilar"}
        return {"name": "", "source": "none", "error": "ximilar: sem correspondência"}
    except Exception as e:
        return {"name": "", "source": "none", "error": f"ximilar: {str(e)[:160]}"}


@router.get("/search")
async def search(q: str = Query(..., min_length=2), page: int = 1):
    """Search cards using Scryfall full-text query syntax."""
    try:
        data = await search_cards(q, page)
        cards = [extract_card_summary(c) for c in data.get("data", [])]
        return {
            "cards": cards,
            "total_cards": data.get("total_cards", 0),
            "has_more": data.get("has_more", False),
            "page": page,
        }
    except Exception as e:
        if "404" in str(e):
            return {"cards": [], "total_cards": 0, "has_more": False, "page": page}
        raise HTTPException(status_code=502, detail="Scryfall API error")


@router.get("/autocomplete")
async def autocomplete(q: str = Query(..., min_length=2)):
    """Get card name suggestions."""
    names = await autocomplete_cards(q)
    return {"suggestions": names}


@router.get("/fx/usd-brl")
async def fx_usd_brl():
    """Approximate USD→BRL rate (cached) so the UI can show prices in BRL."""
    return {"usd_brl": await get_usd_brl()}


@router.get("/{scryfall_id}")
async def get_card(scryfall_id: str):
    """Get full card details by Scryfall ID."""
    try:
        card = await get_card_by_id(scryfall_id)
        return extract_card_summary(card)
    except Exception:
        raise HTTPException(status_code=404, detail="Card not found")


@router.get("/{scryfall_id}/prints")
async def card_prints(scryfall_id: str):
    """All printings (editions) of a card, newest first — for the edition selector."""
    try:
        prints = await get_card_prints(scryfall_id)
        return {"prints": [extract_card_summary(c) for c in prints]}
    except Exception:
        raise HTTPException(status_code=404, detail="Card not found")


@router.get("/{scryfall_id}/rulings")
async def card_rulings(scryfall_id: str):
    """Official rulings/interactions for a card."""
    return {"rulings": await get_card_rulings(scryfall_id)}


@router.get("/{scryfall_id}/lang/{lang}")
async def card_lang(scryfall_id: str, lang: str):
    """Same printing in another language (EN/PT/ES). found=false -> use English."""
    if lang not in ("en", "pt", "es"):
        raise HTTPException(status_code=400, detail="Idioma não suportado")
    variant = await get_card_lang_variant(scryfall_id, lang)
    if variant:
        return {"found": True, "card": extract_card_summary(variant)}
    base = await get_card_by_id(scryfall_id)
    if not base:
        raise HTTPException(status_code=404, detail="Card not found")
    return {"found": False, "card": extract_card_summary(base)}


@router.get("/named/{name}")
async def get_by_name(name: str, fuzzy: bool = True):
    """Get card by name."""
    try:
        card = await get_card_by_name(name, fuzzy=fuzzy)
        return extract_card_summary(card)
    except Exception:
        raise HTTPException(status_code=404, detail="Card not found")
