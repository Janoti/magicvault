from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional, List

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, Binder, BinderCard, CollectionEntry
from app.services.scryfall import get_card_by_id, extract_card_summary

router = APIRouter()


class CreateBinderRequest(BaseModel):
    name: str
    description: Optional[str] = None
    color: str = "#6366f1"
    icon: str = "book"
    is_public: bool = False


class AddCardToBinderRequest(BaseModel):
    collection_entry_id: int
    position: int = 0


@router.get("")
async def list_binders(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Binder).where(Binder.user_id == current_user.id).order_by(Binder.created_at.desc())
    )
    binders = result.scalars().all()

    items = []
    for b in binders:
        count_result = await db.execute(
            select(func.count(BinderCard.id)).where(BinderCard.binder_id == b.id)
        )
        card_count = count_result.scalar()
        items.append({
            "id": b.id,
            "name": b.name,
            "description": b.description,
            "color": b.color,
            "icon": b.icon,
            "is_public": b.is_public,
            "card_count": card_count,
            "created_at": b.created_at.isoformat(),
        })
    return items


@router.post("", status_code=201)
async def create_binder(
    data: CreateBinderRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    binder = Binder(
        user_id=current_user.id,
        name=data.name,
        description=data.description,
        color=data.color,
        icon=data.icon,
        is_public=data.is_public,
    )
    db.add(binder)
    await db.flush()
    return {"id": binder.id, "name": binder.name, "message": "Binder created"}


@router.get("/{binder_id}")
async def get_binder(
    binder_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Binder).where(Binder.id == binder_id, Binder.user_id == current_user.id)
    )
    binder = result.scalar_one_or_none()
    if not binder:
        raise HTTPException(status_code=404, detail="Binder not found")

    cards_result = await db.execute(
        select(BinderCard, CollectionEntry)
        .join(CollectionEntry, BinderCard.collection_entry_id == CollectionEntry.id)
        .where(BinderCard.binder_id == binder_id)
        .order_by(BinderCard.page, BinderCard.slot, BinderCard.position)
    )
    cards = []
    for bc, ce in cards_result:
        try:
            card_data = await get_card_by_id(ce.scryfall_id)
            summary = extract_card_summary(card_data)
        except Exception:
            summary = {"id": ce.scryfall_id, "name": "Unknown"}

        cards.append({
            "binder_card_id": bc.id,
            "collection_entry_id": ce.id,
            "position": bc.position,
            "page": bc.page,
            "slot": bc.slot,
            "quantity": ce.quantity,
            "condition": ce.condition,
            "foil": ce.foil,
            "card": summary,
        })

    return {
        "id": binder.id,
        "name": binder.name,
        "description": binder.description,
        "color": binder.color,
        "icon": binder.icon,
        "is_public": binder.is_public,
        "cards": cards,
    }


@router.patch("/{binder_id}")
async def update_binder(
    binder_id: int,
    data: CreateBinderRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Binder).where(Binder.id == binder_id, Binder.user_id == current_user.id)
    )
    binder = result.scalar_one_or_none()
    if not binder:
        raise HTTPException(status_code=404, detail="Binder not found")

    binder.name = data.name
    binder.description = data.description
    binder.color = data.color
    binder.icon = data.icon
    binder.is_public = data.is_public
    return {"message": "Updated"}


@router.delete("/{binder_id}", status_code=204)
async def delete_binder(
    binder_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Binder).where(Binder.id == binder_id, Binder.user_id == current_user.id)
    )
    binder = result.scalar_one_or_none()
    if not binder:
        raise HTTPException(status_code=404, detail="Binder not found")
    await db.delete(binder)


@router.post("/{binder_id}/cards", status_code=201)
async def add_card_to_binder(
    binder_id: int,
    data: AddCardToBinderRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Binder).where(Binder.id == binder_id, Binder.user_id == current_user.id)
    )
    binder = result.scalar_one_or_none()
    if not binder:
        raise HTTPException(status_code=404, detail="Binder not found")

    entry_result = await db.execute(
        select(CollectionEntry).where(
            CollectionEntry.id == data.collection_entry_id,
            CollectionEntry.user_id == current_user.id,
        )
    )
    if not entry_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Collection entry not found")

    bc = BinderCard(
        binder_id=binder_id,
        collection_entry_id=data.collection_entry_id,
        position=data.position,
    )
    db.add(bc)
    await db.flush()
    return {"id": bc.id, "message": "Card added to binder"}


@router.delete("/{binder_id}/cards/{binder_card_id}", status_code=204)
async def remove_card_from_binder(
    binder_id: int,
    binder_card_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BinderCard)
        .join(Binder)
        .where(
            BinderCard.id == binder_card_id,
            BinderCard.binder_id == binder_id,
            Binder.user_id == current_user.id,
        )
    )
    bc = result.scalar_one_or_none()
    if not bc:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(bc)


class UpdateLocationRequest(BaseModel):
    page: Optional[int] = None
    slot: Optional[int] = None


@router.patch("/{binder_id}/cards/{binder_card_id}")
async def update_card_location(
    binder_id: int,
    binder_card_id: int,
    data: UpdateLocationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set the physical location (page / pocket slot) of a card in the binder."""
    bc = (await db.execute(
        select(BinderCard).join(Binder).where(
            BinderCard.id == binder_card_id,
            BinderCard.binder_id == binder_id,
            Binder.user_id == current_user.id,
        )
    )).scalar_one_or_none()
    if not bc:
        raise HTTPException(status_code=404, detail="Not found")
    if data.page is not None:
        bc.page = max(0, min(data.page, 999))
    if data.slot is not None:
        bc.slot = max(0, min(data.slot, 9))
    return {"page": bc.page, "slot": bc.slot}
