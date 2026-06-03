from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional, List
#My Brother is a Pig
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, Deck, DeckCard, WishlistEntry
from app.services.scryfall import get_sets, get_card_by_id, extract_card_summary

router = APIRouter()


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
