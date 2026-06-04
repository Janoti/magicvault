"""Build read-only views of a user's collection / binder / deck for sharing."""
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import CollectionEntry, Binder, BinderCard, Deck, DeckCard, User
from app.services.scryfall import get_cards_bulk, extract_card_summary


def _summarize(cards_raw: dict, scryfall_id: str) -> dict:
    raw = cards_raw.get(scryfall_id)
    if raw:
        try:
            return extract_card_summary(raw)
        except Exception:
            pass
    return {"id": scryfall_id, "name": "Unknown"}


async def build_resource_view(
    db: AsyncSession, owner_id: int, resource_type: str, resource_id: int | None
) -> dict:
    owner = (await db.execute(select(User).where(User.id == owner_id))).scalar_one_or_none()
    owner_name = owner.username if owner else "?"

    if resource_type == "collection":
        rows = (await db.execute(
            select(CollectionEntry)
            .where(CollectionEntry.user_id == owner_id)
            .order_by(CollectionEntry.added_at.desc())
        )).scalars().all()
        cards_raw = await get_cards_bulk([e.scryfall_id for e in rows])
        cards = [{
            "quantity": e.quantity, "condition": e.condition, "foil": e.foil,
            "card": _summarize(cards_raw, e.scryfall_id),
        } for e in rows]
        return {"resource_type": "collection", "owner": owner_name,
                "title": f"Coleção de {owner_name}", "cards": cards}

    if resource_type == "binder":
        binder = (await db.execute(
            select(Binder).where(Binder.id == resource_id, Binder.user_id == owner_id)
        )).scalar_one_or_none()
        if not binder:
            raise HTTPException(status_code=404, detail="Binder not found")
        rows = (await db.execute(
            select(BinderCard, CollectionEntry)
            .join(CollectionEntry, BinderCard.collection_entry_id == CollectionEntry.id)
            .where(BinderCard.binder_id == binder.id)
            .order_by(BinderCard.position)
        )).all()
        cards_raw = await get_cards_bulk([ce.scryfall_id for _, ce in rows])
        cards = [{
            "quantity": ce.quantity, "condition": ce.condition, "foil": ce.foil,
            "card": _summarize(cards_raw, ce.scryfall_id),
        } for _, ce in rows]
        return {"resource_type": "binder", "owner": owner_name, "title": binder.name,
                "description": binder.description, "color": binder.color, "cards": cards}

    if resource_type == "deck":
        deck = (await db.execute(
            select(Deck).where(Deck.id == resource_id, Deck.user_id == owner_id)
        )).scalar_one_or_none()
        if not deck:
            raise HTTPException(status_code=404, detail="Deck not found")
        rows = (await db.execute(select(DeckCard).where(DeckCard.deck_id == deck.id))).scalars().all()
        cards_raw = await get_cards_bulk([dc.scryfall_id for dc in rows])
        cards = [{
            "quantity": dc.quantity, "is_sideboard": dc.is_sideboard,
            "is_commander": dc.is_commander, "card": _summarize(cards_raw, dc.scryfall_id),
        } for dc in rows]
        return {"resource_type": "deck", "owner": owner_name, "title": deck.name,
                "format": deck.format, "description": deck.description,
                "primer": deck.primer, "cards": cards}

    raise HTTPException(status_code=400, detail="Invalid resource type")


async def assert_owns_resource(db: AsyncSession, owner_id: int, resource_type: str, resource_id: int | None):
    """Raise 404 if the user doesn't own the resource being shared."""
    if resource_type == "collection":
        return  # everyone owns their own collection
    if resource_type == "binder":
        row = (await db.execute(select(Binder).where(Binder.id == resource_id, Binder.user_id == owner_id))).scalar_one_or_none()
    elif resource_type == "deck":
        row = (await db.execute(select(Deck).where(Deck.id == resource_id, Deck.user_id == owner_id))).scalar_one_or_none()
    else:
        raise HTTPException(status_code=400, detail="Invalid resource type")
    if not row:
        raise HTTPException(status_code=404, detail=f"{resource_type} not found")
