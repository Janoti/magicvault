import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models.user import User, CollectionEntry, Deck, DeckCard, Binder, UserEvent

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

    # Public decks the owner chose to share on their profile.
    public_decks = []
    for d in (await db.execute(
        select(Deck).where(Deck.user_id == user.id, Deck.is_public == True).order_by(Deck.updated_at.desc())  # noqa: E712
    )).scalars().all():
        cnt = (await db.execute(select(func.sum(DeckCard.quantity)).where(DeckCard.deck_id == d.id))).scalar() or 0
        public_decks.append({"id": d.id, "name": d.name, "format": d.format, "card_count": cnt})

    # Upcoming public events the user is organizing.
    public_events = [{
        "id": e.id, "title": e.title, "type": e.type,
        "starts_at": e.starts_at.isoformat() if e.starts_at else None,
        "location": e.location,
    } for e in (await db.execute(
        select(UserEvent).where(
            UserEvent.user_id == user.id,
            UserEvent.visibility == "public",
            UserEvent.starts_at >= datetime.utcnow(),
        ).order_by(UserEvent.starts_at).limit(20)
    )).scalars().all()]

    return {
        "username": user.username,
        "display_name": user.display_name,
        "avatar": user.avatar,
        "bio": user.bio,
        "links": json.loads(user.links) if user.links else [],
        "contact": user.contact if user.contact_public else None,
        "member_since": user.created_at.isoformat() if user.created_at else None,
        "stats": {"cards": cards or 0, "decks": decks or 0, "binders": binders or 0},
        "public_decks": public_decks,
        "public_events": public_events,
        "collection_public": bool(user.collection_public),
    }
