"""Public, read-only endpoints to browse community decks (proxied + cached from
Archidekt). Unauthenticated — a discovery surface like the Sets browser."""
from fastapi import APIRouter, HTTPException, Query

from app.services import archidekt

router = APIRouter()


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
