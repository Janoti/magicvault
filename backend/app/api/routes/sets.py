from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, CollectionEntry
from app.services.scryfall import get_sets, get_set_cards, extract_card_summary

router = APIRouter()


@router.get("")
async def list_sets():
    """List all MTG sets from Scryfall."""
    sets = await get_sets()
    return [
        {
            "code": s.get("code"),
            "name": s.get("name"),
            "released_at": s.get("released_at"),
            "set_type": s.get("set_type"),
            "card_count": s.get("card_count"),
            "icon_svg_uri": s.get("icon_svg_uri"),
            "scryfall_uri": s.get("scryfall_uri"),
        }
        for s in sets
    ]


@router.get("/{code}/cards")
async def list_set_cards(code: str):
    """List all cards in a given set."""
    try:
        cards = await get_set_cards(code.lower())
    except Exception:
        raise HTTPException(status_code=404, detail="Set not found")
    return [extract_card_summary(c) for c in cards]


@router.post("/{code}/add-all")
async def add_set_to_collection(
    code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add every card of a set to the collection (qty 1, NM, non-foil)."""
    try:
        cards = await get_set_cards(code.lower())
    except Exception:
        raise HTTPException(status_code=404, detail="Set not found")

    added = 0
    updated = 0
    for card in cards:
        scryfall_id = card.get("id")
        if not scryfall_id:
            continue
        result = await db.execute(
            select(CollectionEntry).where(
                CollectionEntry.user_id == current_user.id,
                CollectionEntry.scryfall_id == scryfall_id,
                CollectionEntry.condition == "NM",
                CollectionEntry.foil == False,  # noqa: E712
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.quantity += 1
            updated += 1
        else:
            price = float((card.get("prices", {}) or {}).get("usd") or 0)
            db.add(CollectionEntry(
                user_id=current_user.id,
                scryfall_id=scryfall_id,
                quantity=1,
                condition="NM",
                foil=False,
                language="en",
                price_at_add=price,
            ))
            added += 1

    await db.flush()
    return {"added": added, "updated": updated, "total": added + updated}
