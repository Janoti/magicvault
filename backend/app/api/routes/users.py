import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.ratelimit import limiter
from app.core.security import get_premium_user
from app.models.user import User, CollectionEntry, Deck, DeckCard, Binder, BinderCard, UserEvent, Listing
from app.services.scryfall import get_cards_bulk, extract_card_summary

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
    pub = (await db.execute(
        select(Deck).where(Deck.user_id == user.id, Deck.is_public == True).order_by(Deck.updated_at.desc())  # noqa: E712
    )).scalars().all()
    pub_ids = [d.id for d in pub]
    deck_counts: dict = {}
    if pub_ids:
        for did, total in (await db.execute(
            select(DeckCard.deck_id, func.sum(DeckCard.quantity)).where(DeckCard.deck_id.in_(pub_ids)).group_by(DeckCard.deck_id)
        )).all():
            deck_counts[did] = total or 0
    public_decks = [{"id": d.id, "name": d.name, "format": d.format, "card_count": deck_counts.get(d.id, 0)} for d in pub]

    # Public binders the owner chose to expose, with their card counts.
    pub_binders = (await db.execute(
        select(Binder).where(Binder.user_id == user.id, Binder.is_public == True).order_by(Binder.updated_at.desc())  # noqa: E712
    )).scalars().all()
    binder_ids = [b.id for b in pub_binders]
    binder_counts: dict = {}
    if binder_ids:
        for bid, total in (await db.execute(
            select(BinderCard.binder_id, func.count(BinderCard.id)).where(BinderCard.binder_id.in_(binder_ids)).group_by(BinderCard.binder_id)
        )).all():
            binder_counts[bid] = total or 0
    public_binders = [{"id": b.id, "name": b.name, "color": b.color, "icon": b.icon,
                       "card_count": binder_counts.get(b.id, 0)} for b in pub_binders]

    # Number of cards this user currently has listed on the marketplace. Only a
    # count is public here; the cards themselves are premium-gated (see below).
    listings_count = (await db.execute(
        select(func.count(Listing.id)).where(Listing.user_id == user.id, Listing.status == "active")
    )).scalar() or 0

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
        # Don't expose the raw contact here (anti-scraper). Only a flag; the
        # number is fetched on demand via /{username}/contact (click to reveal).
        "has_contact": bool(user.contact_public and user.contact),
        "member_since": user.created_at.isoformat() if user.created_at else None,
        # Location only if the user opted to show it.
        "location": ", ".join(p for p in [user.city, user.state, user.country] if p) if user.location_public else None,
        "stats": {"cards": cards or 0, "decks": decks or 0, "binders": binders or 0},
        "public_decks": public_decks,
        "public_binders": public_binders,
        "public_events": public_events,
        "listings_count": listings_count,
        "collection_public": bool(user.collection_public),
    }


@router.get("/{username}/listings")
async def user_listings(
    username: str,
    viewer: User = Depends(get_premium_user),
    db: AsyncSession = Depends(get_db),
):
    """A user's active marketplace listings, shown on their public profile.
    Visitors must be logged in (401) and have the marketplace (premium → 403
    `premium_required`); the frontend turns each case into a clear call to action."""
    user = (await db.execute(select(User).where(User.username == username))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    rows = (await db.execute(
        select(Listing).where(Listing.user_id == user.id, Listing.status == "active").order_by(Listing.created_at.desc())
    )).scalars().all()
    cards = await get_cards_bulk([l.scryfall_id for l in rows])
    items = []
    for l in rows:
        raw = cards.get(l.scryfall_id)
        card = extract_card_summary(raw) if raw else {"id": l.scryfall_id, "name": "?"}
        items.append({
            "id": l.id, "condition": l.condition, "foil": l.foil,
            "price": l.price, "accepts_offers": bool(l.accepts_offers),
            "wanted": l.wanted, "photo": l.photo, "notes": l.notes,
            "card": card,
        })
    return {"items": items, "seller": {"username": user.username, "display_name": user.display_name}}


@router.get("/{username}/contact")
@limiter.limit("10/minute")
async def reveal_contact(request: Request, username: str, db: AsyncSession = Depends(get_db)):
    """Reveal a user's public contact only on explicit request (click-to-reveal),
    rate-limited, so it isn't harvested from the page/API by scrapers."""
    user = (await db.execute(select(User).where(User.username == username))).scalar_one_or_none()
    if not user or not user.contact_public or not user.contact:
        raise HTTPException(status_code=404, detail="Sem contato")
    return {"contact": user.contact}
