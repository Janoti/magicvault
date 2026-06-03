import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models.user import User, CollectionEntry, Deck, Binder

router = APIRouter()


@router.get("/{username}")
async def public_profile(username: str, db: AsyncSession = Depends(get_db)):
    """Public profile by username (no auth)."""
    user = (await db.execute(
        select(User).where(User.username == username)
    )).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    cards = (await db.execute(
        select(func.coalesce(func.sum(CollectionEntry.quantity), 0))
        .where(CollectionEntry.user_id == user.id)
    )).scalar()
    decks = (await db.execute(
        select(func.count(Deck.id)).where(Deck.user_id == user.id)
    )).scalar()
    binders = (await db.execute(
        select(func.count(Binder.id)).where(Binder.user_id == user.id)
    )).scalar()

    return {
        "username": user.username,
        "display_name": user.display_name,
        "avatar": user.avatar,
        "bio": user.bio,
        "links": json.loads(user.links) if user.links else [],
        "contact": user.contact if user.contact_public else None,
        "member_since": user.created_at.isoformat() if user.created_at else None,
        "stats": {"cards": cards or 0, "decks": decks or 0, "binders": binders or 0},
    }
