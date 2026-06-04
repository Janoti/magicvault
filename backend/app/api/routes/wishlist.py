from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, WishlistEntry, Listing
from app.services.scryfall import get_sets, get_card_by_id, extract_card_summary, get_cards_bulk

# Wishlist router
router = APIRouter()


class AddWishlistRequest(BaseModel):
    scryfall_id: str
    quantity: int = 1
    max_price: Optional[float] = None
    notes: Optional[str] = None


@router.get("")
async def list_wishlist(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    entries = (await db.execute(select(WishlistEntry).where(WishlistEntry.user_id == current_user.id))).scalars().all()
    ids = [e.scryfall_id for e in entries]
    cards = await get_cards_bulk(ids) if ids else {}

    # Our marketplace: cheapest active for-sale listing per card.
    market: dict = {}
    if ids:
        rows = (await db.execute(
            select(Listing.scryfall_id, func.count(Listing.id), func.min(Listing.price))
            .where(Listing.scryfall_id.in_(ids), Listing.status == "active", Listing.price.is_not(None))
            .group_by(Listing.scryfall_id)
        )).all()
        market = {sid: {"count": cnt, "min_price": float(mn) if mn is not None else None} for sid, cnt, mn in rows}

    items = []
    for entry in entries:
        raw = cards.get(entry.scryfall_id)
        card = extract_card_summary(raw) if raw else {"id": entry.scryfall_id}
        current = card.get("price_usd") or 0
        snap = entry.price_snapshot
        # Movement since the card was added, and whether the target price was hit.
        delta = round(current - snap, 2) if (snap is not None and current) else None
        delta_pct = round((delta / snap) * 100, 1) if (delta is not None and snap) else None
        target_hit = bool(entry.max_price is not None and current and current <= entry.max_price)
        items.append({
            "id": entry.id, "quantity": entry.quantity, "max_price": entry.max_price,
            "notes": entry.notes, "card": card,
            "price_snapshot": snap, "delta": delta, "delta_pct": delta_pct, "target_hit": target_hit,
            "market": market.get(entry.scryfall_id, {"count": 0, "min_price": None}),
        })
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

    # Snapshot the current price as the baseline for movement alerts.
    snapshot = None
    try:
        snapshot = extract_card_summary(await get_card_by_id(data.scryfall_id)).get("price_usd") or None
    except Exception:
        pass

    entry = WishlistEntry(user_id=current_user.id, scryfall_id=data.scryfall_id, quantity=data.quantity,
                          max_price=data.max_price, notes=data.notes, price_snapshot=snapshot)
    db.add(entry)
    await db.flush()
    return {"id": entry.id, "message": "Added to wishlist"}


class UpdateWishlistRequest(BaseModel):
    max_price: Optional[float] = None
    notes: Optional[str] = None
    clear_target: bool = False


@router.patch("/{entry_id}")
async def update_wishlist(entry_id: int, data: UpdateWishlistRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    entry = (await db.execute(select(WishlistEntry).where(WishlistEntry.id == entry_id, WishlistEntry.user_id == current_user.id))).scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    if data.clear_target:
        entry.max_price = None
    elif data.max_price is not None:
        entry.max_price = data.max_price if data.max_price > 0 else None
    if data.notes is not None:
        entry.notes = data.notes or None
    return {"id": entry.id, "max_price": entry.max_price}


@router.delete("/{entry_id}", status_code=204)
async def remove_from_wishlist(entry_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WishlistEntry).where(WishlistEntry.id == entry_id, WishlistEntry.user_id == current_user.id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(entry)
