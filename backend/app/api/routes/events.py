"""Public endpoints for the events calendar and the partner store directory.
All read-only and unauthenticated — also a marketing surface. Admin CRUD lives
in routes/admin.py."""
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import Store, Event

router = APIRouter()

MAX_RANGE_DAYS = 92  # cap how far recurring events are expanded


def _store_summary(s: Optional[Store]) -> Optional[dict]:
    if not s:
        return None
    return {
        "id": s.id, "name": s.name, "neighborhood": s.neighborhood,
        "city": s.city, "featured": bool(s.featured), "is_wpn": bool(s.is_wpn),
        "instagram": s.instagram, "website": s.website,
    }


def _event_base(e: Event, store: Optional[Store]) -> dict:
    return {
        "id": e.id, "title": e.title, "city": e.city,
        "address": e.address or (store.address if store else None),
        "format": e.format, "kind": e.kind, "description": e.description,
        "entry_fee": e.entry_fee, "link": e.link, "time_label": e.time_label,
        "recurrence": e.recurrence, "weekday": e.weekday,
        "store": _store_summary(store),
    }


@router.get("/events")
async def list_events(
    db: AsyncSession = Depends(get_db),
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = Query(None),
    city: Optional[str] = None,
    format: Optional[str] = None,
    kind: Optional[str] = None,
):
    """Events expanded into concrete dated occurrences within [from, to]."""
    today = date.today()
    try:
        start = date.fromisoformat(from_) if from_ else today
    except ValueError:
        start = today
    try:
        end = date.fromisoformat(to) if to else start + timedelta(days=45)
    except ValueError:
        end = start + timedelta(days=45)
    if end < start:
        end = start
    if (end - start).days > MAX_RANGE_DAYS:
        end = start + timedelta(days=MAX_RANGE_DAYS)

    stmt = select(Event)
    if city:
        stmt = stmt.where(Event.city == city)
    if format:
        stmt = stmt.where(Event.format == format)
    if kind:
        stmt = stmt.where(Event.kind == kind)
    events = (await db.execute(stmt)).scalars().all()

    store_ids = {e.store_id for e in events if e.store_id}
    stores = {s.id: s for s in (await db.execute(
        select(Store).where(Store.id.in_(store_ids or [-1]))
    )).scalars().all()}

    occurrences = []
    for e in events:
        store = stores.get(e.store_id) if e.store_id else None
        if e.recurrence == "weekly" and e.weekday is not None:
            d = start
            while d <= end:
                if d.weekday() == e.weekday:
                    occurrences.append({**_event_base(e, store), "date": d.isoformat()})
                d += timedelta(days=1)
        elif e.event_date and start <= e.event_date <= end:
            occurrences.append({**_event_base(e, store), "date": e.event_date.isoformat()})

    occurrences.sort(key=lambda o: (o["date"], o.get("time_label") or "99:99"))
    return {"from": start.isoformat(), "to": end.isoformat(), "events": occurrences}


@router.get("/events/filters")
async def event_filters(db: AsyncSession = Depends(get_db)):
    """Distinct cities and formats present, for the filter dropdowns."""
    cities = sorted({c for (c,) in (await db.execute(select(Event.city).distinct())).all() if c})
    formats = sorted({f for (f,) in (await db.execute(select(Event.format).distinct())).all() if f})
    return {"cities": cities, "formats": formats}


@router.get("/stores")
async def list_stores(db: AsyncSession = Depends(get_db), city: Optional[str] = None):
    """Partner/store directory. Featured first, then by city and name."""
    stmt = select(Store)
    if city:
        stmt = stmt.where(Store.city == city)
    stmt = stmt.order_by(desc(Store.featured), Store.city, Store.name)
    rows = (await db.execute(stmt)).scalars().all()
    return [{
        "id": s.id, "name": s.name, "city": s.city, "neighborhood": s.neighborhood,
        "address": s.address, "phone": s.phone, "phone2": s.phone2, "email": s.email,
        "website": s.website, "instagram": s.instagram, "logo": s.logo,
        "is_wpn": bool(s.is_wpn), "featured": bool(s.featured), "notes": s.notes,
    } for s in rows]
