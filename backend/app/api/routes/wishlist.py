from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, WishlistEntry
from app.services.scryfall import get_sets, get_card_by_id, extract_card_summary

# Wishlist router
router = APIRouter()


class AddWishlistRequest(BaseModel):
    scryfall_id: str
    quantity: int = 1
    max_price: Optional[float] = None
    notes: Optional[str] = None


@router.get("")
async def list_wishlist(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WishlistEntry).where(WishlistEntry.user_id == current_user.id))
    items = []
    for entry in result.scalars().all():
        try:
            card = extract_card_summary(await get_card_by_id(entry.scryfall_id))
        except Exception:
            card = {"id": entry.scryfall_id}
        items.append({"id": entry.id, "quantity": entry.quantity, "max_price": entry.max_price, "notes": entry.notes, "card": card})
    return items


@router.post("", status_code=201)
async def add_to_wishlist(data: AddWishlistRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        await get_card_by_id(data.scryfall_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Card not found")

    result = await db.execute(select(WishlistEntry).where(WishlistEntry.user_id == current_user.id, WishlistEntry.scryfall_id == data.scryfall_id))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Card already in wishlist")

    entry = WishlistEntry(user_id=current_user.id, scryfall_id=data.scryfall_id, quantity=data.quantity, max_price=data.max_price, notes=data.notes)
    db.add(entry)
    await db.flush()
    return {"id": entry.id, "message": "Added to wishlist"}


@router.delete("/{entry_id}", status_code=204)
async def remove_from_wishlist(entry_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WishlistEntry).where(WishlistEntry.id == entry_id, WishlistEntry.user_id == current_user.id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(entry)
