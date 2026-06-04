"""Sync a store's events from an iCal/.ics feed (e.g. a public Google Calendar).
Recurring events are expanded into concrete dated occurrences and stored as
source='ical' events, replacing the previous synced set for that store. Manual
events (source='manual') are never touched."""
import logging
from datetime import datetime, date, timedelta

import httpx
import icalendar
import recurring_ical_events
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.user import Store, Event

logger = logging.getLogger(__name__)

WINDOW_DAYS = 90        # how far ahead to expand recurring events
MAX_OCCURRENCES = 200   # safety cap per store

try:
    from zoneinfo import ZoneInfo
    _BRT = ZoneInfo("America/Sao_Paulo")
except Exception:  # pragma: no cover - tzdata missing
    _BRT = None

_FORMATS = ["Commander", "Pauper", "Modern", "Standard", "Pioneer", "Legacy",
            "Vintage", "Brawl", "Oathbreaker", "Premodern", "Duel Commander", "cEDH"]


def _detect_format(text: str):
    low = text.lower()
    for f in _FORMATS:
        if f.lower() in low:
            return f
    return None


def _local_date_time(dt):
    """Return (date, 'HH:MM'|None) in Brazil time for a VEVENT DTSTART value."""
    if isinstance(dt, datetime):
        local = dt.astimezone(_BRT) if (dt.tzinfo and _BRT) else dt
        return local.date(), local.strftime("%H:%M")
    return dt, None  # all-day (a plain date)


async def sync_store(store: Store, db: AsyncSession) -> int:
    """Fetch + parse the store's calendar and replace its ical events. Returns
    the number of occurrences imported."""
    if not store.calendar_url:
        return 0
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            r = await client.get(store.calendar_url, headers={"User-Agent": "VaultSpell/1.0"})
        r.raise_for_status()
        cal = icalendar.Calendar.from_ical(r.content)
    except Exception as e:
        logger.warning("Calendar fetch/parse failed for store %s: %s", store.id, e)
        return 0

    start = date.today()
    end = start + timedelta(days=WINDOW_DAYS)
    try:
        occurrences = recurring_ical_events.of(cal).between(start, end)
    except Exception as e:
        logger.warning("Calendar expand failed for store %s: %s", store.id, e)
        return 0

    # Replace this store's previously-synced events (leave manual ones alone).
    await db.execute(delete(Event).where(Event.store_id == store.id, Event.source == "ical"))

    count = 0
    for comp in occurrences[:MAX_OCCURRENCES]:
        title = str(comp.get("SUMMARY") or "").strip()
        if not title:
            continue
        d, time_label = _local_date_time(comp.get("DTSTART").dt)
        location = str(comp.get("LOCATION") or "").strip() or None
        description = str(comp.get("DESCRIPTION") or "").strip()[:500] or None
        url = str(comp.get("URL") or "").strip() or None
        db.add(Event(
            title=title[:255],
            store_id=store.id,
            city=store.city,
            address=location or store.address,
            format=_detect_format(f"{title} {description or ''}"),
            kind="tournament",
            description=description,
            link=url,
            recurrence="none",
            event_date=d,
            time_label=time_label,
            source="ical",
        ))
        count += 1

    store.calendar_synced_at = datetime.utcnow()
    return count


async def sync_all_stores() -> int:
    """Background sweep: sync every store that has a calendar configured."""
    total = 0
    async with AsyncSessionLocal() as db:
        stores = (await db.execute(
            select(Store).where(Store.calendar_url.isnot(None), Store.calendar_url != "")
        )).scalars().all()
        for store in stores:
            try:
                total += await sync_store(store, db)
            except Exception:
                logger.warning("Calendar sync failed for store %s", store.id, exc_info=True)
        await db.commit()
    if total:
        logger.info("Calendar sync imported %s events across stores", total)
    return total
