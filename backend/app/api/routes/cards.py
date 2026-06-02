from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional

from app.services.scryfall import (
    search_cards, get_card_by_id, get_card_by_name,
    autocomplete_cards, extract_card_summary
)

router = APIRouter()


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


@router.get("/{scryfall_id}")
async def get_card(scryfall_id: str):
    """Get full card details by Scryfall ID."""
    try:
        card = await get_card_by_id(scryfall_id)
        return extract_card_summary(card)
    except Exception:
        raise HTTPException(status_code=404, detail="Card not found")


@router.get("/named/{name}")
async def get_by_name(name: str, fuzzy: bool = True):
    """Get card by name."""
    try:
        card = await get_card_by_name(name, fuzzy=fuzzy)
        return extract_card_summary(card)
    except Exception:
        raise HTTPException(status_code=404, detail="Card not found")
