"""Public, read-only endpoints to browse community decks (proxied + cached from
Archidekt). Unauthenticated — a discovery surface like the Sets browser."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, Deck, DeckCard
from app.services import archidekt

router = APIRouter()

# Archidekt format name -> this app's deck format value.
_FORMAT_MAP = {
    "Commander": "commander", "Standard": "standard", "Modern": "modern",
    "Pioneer": "pioneer", "Pauper": "pauper", "Legacy": "legacy", "Vintage": "vintage",
}


@router.get("/formats")
async def deck_formats():
    """Selectable formats for the filter, in display order."""
    return [{"id": fid, "name": name} for fid, name in archidekt.FORMATS.items()]


@router.get("/decks")
async def browse_decks(
    format: int = Query(3),
    order: str = Query("popular"),
    page: int = Query(1, ge=1),
):
    if format not in archidekt.FORMATS:
        raise HTTPException(status_code=400, detail="Formato inválido")
    return await archidekt.search_decks(format, order, page)


@router.get("/decks/{deck_id}")
async def deck_detail(deck_id: int):
    deck = await archidekt.get_deck(deck_id)
    if not deck:
        raise HTTPException(status_code=404, detail="Deck não encontrado")
    return deck


@router.post("/decks/{deck_id}/copy", status_code=201)
async def copy_deck(deck_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Clone a community deck into the current user's decks."""
    src = await archidekt.get_deck(deck_id)
    if not src:
        raise HTTPException(status_code=404, detail="Deck não encontrado")

    deck = Deck(
        user_id=current_user.id,
        name=f"{src['name']} (cópia)"[:200],
        format=_FORMAT_MAP.get(src.get("format"), "casual"),
        description=f"Copiado da comunidade · {src.get('url', '')}".strip(),
    )
    db.add(deck)
    await db.flush()

    for c in src.get("cards", []):
        sid = c.get("scryfall_id")
        cat = c.get("category") or ""
        if not sid or cat == "Maybeboard":  # skip cards we can't resolve / not in the deck
            continue
        db.add(DeckCard(
            deck_id=deck.id,
            scryfall_id=sid,
            quantity=c.get("qty") or 1,
            is_commander=(cat == "Commander"),
            is_sideboard=(cat in ("Sideboard", "Side")),
        ))

    return {"id": deck.id, "name": deck.name}
