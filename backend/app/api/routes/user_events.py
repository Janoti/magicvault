"""User-created events: mesão, trade/sell, happening. Public events appear on the
organizer's profile; private events are link-only. Anyone can mark interest (and
gets emailed on changes) and comment. Each event has its own page + .ics export."""
import secrets
from datetime import datetime, timedelta
from html import escape
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from sqlalchemy import select, func, delete, desc
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.config import settings
from app.core.database import get_db
from app.core.ratelimit import limiter
from app.core.security import get_current_user, get_optional_user
from app.models.user import User, UserEvent, EventInterest, EventComment
from app.services.email import send_email

router = APIRouter()

TYPES = {"mesao", "trade", "happening", "other"}
VISIBILITIES = {"public", "private"}


class EventIn(BaseModel):
    title: str
    type: str = "happening"
    visibility: str = "public"
    description: Optional[str] = None
    location: Optional[str] = None
    starts_at: str                      # ISO datetime
    duration_minutes: Optional[int] = None


def _organizer(u: Optional[User]) -> dict:
    if not u:
        return {}
    return {"username": u.username, "display_name": u.display_name, "avatar": u.avatar}


def _event_out(e: UserEvent, organizer: Optional[User] = None, interested: int = 0,
               i_am_interested: bool = False, include_token: bool = False) -> dict:
    out = {
        "id": e.id, "title": e.title, "type": e.type, "visibility": e.visibility,
        "description": e.description, "location": e.location,
        "starts_at": e.starts_at.isoformat() if e.starts_at else None,
        "duration_minutes": e.duration_minutes,
        "organizer": _organizer(organizer),
        "interested": interested, "i_am_interested": i_am_interested,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }
    if include_token:
        out["public_token"] = e.public_token
    return out


def _parse_dt(value: str) -> datetime:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        raise HTTPException(status_code=400, detail="Data/hora inválida")


def _apply(e: UserEvent, data: EventIn):
    if not data.title.strip():
        raise HTTPException(status_code=400, detail="Título é obrigatório")
    if data.type not in TYPES:
        raise HTTPException(status_code=400, detail="Tipo inválido")
    if data.visibility not in VISIBILITIES:
        raise HTTPException(status_code=400, detail="Visibilidade inválida")
    e.title = data.title.strip()[:255]
    e.type = data.type
    e.visibility = data.visibility
    e.description = (data.description or None)
    e.location = (data.location or None)
    e.starts_at = _parse_dt(data.starts_at)
    e.duration_minutes = data.duration_minutes
    if data.visibility == "private" and not e.public_token:
        e.public_token = secrets.token_urlsafe(16)


async def _interested_count(db: AsyncSession, event_id: int) -> int:
    return (await db.execute(
        select(func.count(EventInterest.id)).where(EventInterest.event_id == event_id)
    )).scalar() or 0


# --- Organizer-side (my events) -------------------------------------------

@router.get("/my-events")
async def my_events(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(UserEvent).where(UserEvent.user_id == current_user.id).order_by(desc(UserEvent.starts_at))
    )).scalars().all()
    counts = {}
    if rows:
        for eid, c in (await db.execute(
            select(EventInterest.event_id, func.count(EventInterest.id))
            .where(EventInterest.event_id.in_([e.id for e in rows])).group_by(EventInterest.event_id)
        )).all():
            counts[eid] = c
    return [_event_out(e, current_user, counts.get(e.id, 0), include_token=True) for e in rows]


@router.post("/my-events", status_code=201)
async def create_event(data: EventIn, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    e = UserEvent(user_id=current_user.id)
    _apply(e, data)
    db.add(e)
    await db.flush()
    return _event_out(e, current_user, 0, include_token=True)


@router.patch("/my-events/{event_id}")
async def update_event(event_id: int, data: EventIn, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    e = (await db.execute(select(UserEvent).where(UserEvent.id == event_id))).scalar_one_or_none()
    if not e or e.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    _apply(e, data)
    await db.flush()

    # Notify interested users about the change (best-effort).
    interested = (await db.execute(
        select(User).join(EventInterest, EventInterest.user_id == User.id)
        .where(EventInterest.event_id == e.id, User.is_active == True, User.email_opt_out == False)  # noqa: E712
    )).scalars().all()
    when = e.starts_at.strftime("%d/%m/%Y %H:%M") if e.starts_at else ""
    url = f"{settings.app_url.rstrip('/')}/e/{e.id}"
    for u in interested:
        if u.id == current_user.id or not u.email:
            continue
        try:
            html = (
                f"<div style='font-family:system-ui,sans-serif;font-size:15px;color:#1a1f35'>"
                f"<h2 style='color:#6c5ce7'>📅 Evento atualizado</h2>"
                f"<p>O evento <b>{escape(e.title)}</b> teve uma atualização.</p>"
                f"<p><b>Quando:</b> {when}<br><b>Onde:</b> {escape(e.location or '—')}</p>"
                f"<p><a href='{url}' style='display:inline-block;background:#6c5ce7;color:#fff;"
                f"padding:10px 18px;border-radius:8px;text-decoration:none'>Ver evento</a></p></div>"
            )
            await send_email(u.email, f"Atualização: {e.title}", html)
        except Exception:
            pass
    return _event_out(e, current_user, len(interested), include_token=True)


@router.delete("/my-events/{event_id}", status_code=204)
async def delete_event(event_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    e = (await db.execute(select(UserEvent).where(UserEvent.id == event_id))).scalar_one_or_none()
    if not e or e.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    await db.execute(delete(EventComment).where(EventComment.event_id == event_id))
    await db.execute(delete(EventInterest).where(EventInterest.event_id == event_id))
    await db.execute(delete(UserEvent).where(UserEvent.id == event_id))


# --- Public-side ----------------------------------------------------------

async def _load_viewable(db: AsyncSession, event_id: int, token: Optional[str]) -> UserEvent:
    e = (await db.execute(select(UserEvent).where(UserEvent.id == event_id))).scalar_one_or_none()
    if not e:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    if e.visibility == "private" and (not token or token != e.public_token):
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    return e


@router.get("/events/u/{event_id}")
async def get_event(event_id: int, token: Optional[str] = Query(None),
                    viewer: Optional[User] = Depends(get_optional_user), db: AsyncSession = Depends(get_db)):
    e = await _load_viewable(db, event_id, token)
    organizer = (await db.execute(select(User).where(User.id == e.user_id))).scalar_one_or_none()
    count = await _interested_count(db, e.id)
    mine = False
    if viewer:
        mine = (await db.execute(
            select(EventInterest.id).where(EventInterest.event_id == e.id, EventInterest.user_id == viewer.id)
        )).scalar_one_or_none() is not None
    return _event_out(e, organizer, count, mine)


@router.post("/events/u/{event_id}/interest")
@limiter.limit("30/minute")
async def toggle_interest(request: Request, event_id: int, token: Optional[str] = Query(None),
                          current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    e = await _load_viewable(db, event_id, token)
    existing = (await db.execute(
        select(EventInterest).where(EventInterest.event_id == e.id, EventInterest.user_id == current_user.id)
    )).scalar_one_or_none()
    if existing:
        await db.execute(delete(EventInterest).where(EventInterest.id == existing.id))
        interested = False
    else:
        db.add(EventInterest(event_id=e.id, user_id=current_user.id))
        interested = True
    await db.flush()
    return {"interested": interested, "count": await _interested_count(db, e.id)}


@router.get("/events/u/{event_id}/interested")
async def list_interested(event_id: int, token: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    """Public list of users who marked interest (avatar + username) — shown on the
    event page so people can see who is going."""
    await _load_viewable(db, event_id, token)
    rows = (await db.execute(
        select(User).join(EventInterest, EventInterest.user_id == User.id)
        .where(EventInterest.event_id == event_id, User.is_active == True)  # noqa: E712
        .order_by(EventInterest.created_at).limit(200)
    )).scalars().all()
    return [_organizer(u) for u in rows]


# --- Comments -------------------------------------------------------------

class CommentIn(BaseModel):
    body: str


@router.get("/events/u/{event_id}/comments")
async def list_comments(event_id: int, token: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    await _load_viewable(db, event_id, token)
    rows = (await db.execute(
        select(EventComment).where(EventComment.event_id == event_id).order_by(EventComment.created_at)
    )).scalars().all()
    users = {u.id: u for u in (await db.execute(
        select(User).where(User.id.in_([c.user_id for c in rows] or [-1]))
    )).scalars().all()}
    return [{
        "id": c.id, "body": c.body, "created_at": c.created_at.isoformat() if c.created_at else None,
        "user": _organizer(users.get(c.user_id)),
    } for c in rows]


@router.post("/events/u/{event_id}/comments", status_code=201)
@limiter.limit("20/minute")
async def add_comment(request: Request, event_id: int, data: CommentIn, token: Optional[str] = Query(None),
                      current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _load_viewable(db, event_id, token)
    body = (data.body or "").strip()
    if not body:
        raise HTTPException(status_code=400, detail="Comentário vazio")
    c = EventComment(event_id=event_id, user_id=current_user.id, body=body[:1000])
    db.add(c)
    await db.flush()
    return {"id": c.id, "body": c.body, "created_at": c.created_at.isoformat(), "user": _organizer(current_user)}


@router.delete("/events/u/{event_id}/comments/{comment_id}", status_code=204)
async def delete_comment(event_id: int, comment_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    c = (await db.execute(select(EventComment).where(EventComment.id == comment_id, EventComment.event_id == event_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Comentário não encontrado")
    event = (await db.execute(select(UserEvent).where(UserEvent.id == event_id))).scalar_one_or_none()
    # The author or the event organizer can delete a comment.
    if c.user_id != current_user.id and (not event or event.user_id != current_user.id):
        raise HTTPException(status_code=403, detail="Sem permissão")
    await db.execute(delete(EventComment).where(EventComment.id == comment_id))


# --- iCal export ----------------------------------------------------------

def _ics_dt(dt: datetime) -> str:
    return dt.strftime("%Y%m%dT%H%M%S")


@router.get("/events/u/{event_id}/ics")
async def event_ics(event_id: int, token: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    e = await _load_viewable(db, event_id, token)
    end = e.starts_at + timedelta(minutes=e.duration_minutes or 120)
    uid = f"vaultspell-event-{e.id}@vaultspell.com"
    desc = (e.description or "").replace("\n", "\\n")
    lines = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//VaultSpell//Events//PT",
        "BEGIN:VEVENT", f"UID:{uid}", f"DTSTAMP:{_ics_dt(datetime.utcnow())}",
        f"DTSTART:{_ics_dt(e.starts_at)}", f"DTEND:{_ics_dt(end)}",
        f"SUMMARY:{e.title}",
    ]
    if e.location:
        lines.append(f"LOCATION:{e.location}")
    if desc:
        lines.append(f"DESCRIPTION:{desc}")
    lines += ["END:VEVENT", "END:VCALENDAR"]
    ics = "\r\n".join(lines)
    return Response(content=ics, media_type="text/calendar",
                    headers={"Content-Disposition": f'attachment; filename="evento-{e.id}.ics"'})
