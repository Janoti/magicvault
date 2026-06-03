from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional, List
#My Brother is a Pig
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, Deck, DeckCard, WishlistEntry, CollectionEntry
from app.services.scryfall import get_sets, get_card_by_id, extract_card_summary, get_cards_bulk

router = APIRouter()


@router.get("/{deck_id}/coverage")
async def deck_coverage(deck_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """How much of this deck the user already owns (matched by card name)."""
    deck = (await db.execute(select(Deck).where(Deck.id == deck_id, Deck.user_id == current_user.id))).scalar_one_or_none()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")

    deck_cards = (await db.execute(select(DeckCard).where(DeckCard.deck_id == deck_id))).scalars().all()
    coll = (await db.execute(select(CollectionEntry).where(CollectionEntry.user_id == current_user.id))).scalars().all()

    # Resolve all involved cards in one batch (cached) to get names + prices.
    ids = list({dc.scryfall_id for dc in deck_cards} | {e.scryfall_id for e in coll})
    cards = await get_cards_bulk(ids)

    def name_of(sid):
        c = cards.get(sid)
        return (c.get("name", "").lower() if c else sid)

    # Owned quantity per card name (any printing counts).
    owned_by_name: dict[str, int] = {}
    for e in coll:
        owned_by_name[name_of(e.scryfall_id)] = owned_by_name.get(name_of(e.scryfall_id), 0) + e.quantity

    remaining = dict(owned_by_name)  # allocate owned across duplicate-named deck entries
    rows = []
    tot_needed = tot_owned = tot_missing = 0
    missing_cost = 0.0
    for dc in deck_cards:
        nm = name_of(dc.scryfall_id)
        have = remaining.get(nm, 0)
        allocated = min(dc.quantity, have)
        remaining[nm] = have - allocated
        missing = dc.quantity - allocated
        summary = extract_card_summary(cards[dc.scryfall_id]) if cards.get(dc.scryfall_id) else {"id": dc.scryfall_id, "name": "?"}
        tot_needed += dc.quantity
        tot_owned += allocated
        tot_missing += missing
        missing_cost += missing * (summary.get("price_usd") or 0)
        rows.append({
            "card": summary, "needed": dc.quantity, "owned": allocated, "missing": missing,
            "is_sideboard": dc.is_sideboard, "is_commander": dc.is_commander,
        })

    return {
        "summary": {
            "needed": tot_needed, "owned": tot_owned, "missing": tot_missing,
            "percent": round(100 * tot_owned / tot_needed) if tot_needed else 100,
            "missing_cost": round(missing_cost, 2),
        },
        "cards": rows,
    }


class CreateDeckRequest(BaseModel):
    name: str
    format: str = "casual"
    description: Optional[str] = None
    is_public: bool = False


class AddDeckCardRequest(BaseModel):
    scryfall_id: str
    quantity: int = 1
    is_sideboard: bool = False
    is_commander: bool = False


@router.get("")
async def list_decks(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Deck).where(Deck.user_id == current_user.id).order_by(Deck.updated_at.desc())
    )
    decks = result.scalars().all()
    items = []
    for d in decks:
        count_r = await db.execute(select(func.sum(DeckCard.quantity)).where(DeckCard.deck_id == d.id))
        items.append({
            "id": d.id, "name": d.name, "format": d.format,
            "description": d.description, "is_public": d.is_public,
            "card_count": count_r.scalar() or 0,
            "created_at": d.created_at.isoformat(),
        })
    return items


@router.post("", status_code=201)
async def create_deck(data: CreateDeckRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    deck = Deck(user_id=current_user.id, name=data.name, format=data.format, description=data.description, is_public=data.is_public)
    db.add(deck)
    await db.flush()
    return {"id": deck.id, "name": deck.name}


@router.get("/{deck_id}")
async def get_deck(deck_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Deck).where(Deck.id == deck_id, Deck.user_id == current_user.id))
    deck = result.scalar_one_or_none()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")

    cards_r = await db.execute(select(DeckCard).where(DeckCard.deck_id == deck_id))
    cards = []
    for dc in cards_r.scalars().all():
        try:
            card = extract_card_summary(await get_card_by_id(dc.scryfall_id))
        except Exception:
            card = {"id": dc.scryfall_id}
        cards.append({"id": dc.id, "quantity": dc.quantity, "is_sideboard": dc.is_sideboard, "is_commander": dc.is_commander, "card": card})

    return {"id": deck.id, "name": deck.name, "format": deck.format, "description": deck.description, "cards": cards}


@router.post("/{deck_id}/cards", status_code=201)
async def add_to_deck(deck_id: int, data: AddDeckCardRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Deck).where(Deck.id == deck_id, Deck.user_id == current_user.id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Deck not found")
    dc = DeckCard(deck_id=deck_id, scryfall_id=data.scryfall_id, quantity=data.quantity, is_sideboard=data.is_sideboard, is_commander=data.is_commander)
    db.add(dc)
    await db.flush()
    return {"id": dc.id}


@router.delete("/{deck_id}", status_code=204)
async def delete_deck(deck_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Deck).where(Deck.id == deck_id, Deck.user_id == current_user.id))
    deck = result.scalar_one_or_none()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    await db.delete(deck)
