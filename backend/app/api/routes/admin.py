import secrets
from datetime import datetime, date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, delete, or_
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_admin
from app.models.user import (
    User, CollectionEntry, Binder, BinderCard, Deck, DeckCard, WishlistEntry,
    Friendship, Share, PasswordResetToken, Feedback, Listing, Interest, Message,
    EmailCampaign, Store, Event,
)
from app.services.email import send_email, render_campaign_html
from app.services.calendar_sync import sync_store

router = APIRouter()


class UpdateUserAdmin(BaseModel):
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None
    is_premium: Optional[bool] = None
    email: Optional[EmailStr] = None


@router.get("/stats")
async def admin_stats(_: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    users = (await db.execute(select(func.count(User.id)))).scalar()
    premium = (await db.execute(select(func.count(User.id)).where(User.is_premium == True))).scalar()  # noqa: E712
    cards = (await db.execute(select(func.coalesce(func.sum(CollectionEntry.quantity), 0)))).scalar()
    decks = (await db.execute(select(func.count(Deck.id)))).scalar()
    binders = (await db.execute(select(func.count(Binder.id)))).scalar()
    now = datetime.utcnow()
    active_7d = (await db.execute(select(func.count(User.id)).where(User.last_login_at >= now - timedelta(days=7)))).scalar()
    active_30d = (await db.execute(select(func.count(User.id)).where(User.last_login_at >= now - timedelta(days=30)))).scalar()
    inactive_30d = (await db.execute(select(func.count(User.id)).where(
        or_(User.last_login_at < now - timedelta(days=30), User.last_login_at.is_(None))
    ))).scalar()
    return {"users": users or 0, "premium": premium or 0, "cards": cards or 0,
            "decks": decks or 0, "binders": binders or 0,
            "active_7d": active_7d or 0, "active_30d": active_30d or 0, "inactive_30d": inactive_30d or 0}


@router.get("/users")
async def list_users(_: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(User).order_by(desc(User.created_at)))).scalars().all()
    return [{
        "id": u.id, "email": u.email, "username": u.username,
        "display_name": u.display_name, "avatar": u.avatar,
        "is_active": bool(u.is_active), "is_admin": bool(u.is_admin), "is_premium": bool(u.is_premium),
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "last_login_at": (u.last_login_at.isoformat() + "Z") if u.last_login_at else None,
        "login_count": u.login_count or 0,
    } for u in rows]


@router.patch("/users/{user_id}")
async def update_user(
    user_id: int,
    data: UpdateUserAdmin,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if user.id == admin.id and (data.is_admin is False or data.is_active is False):
        raise HTTPException(status_code=400, detail="Você não pode remover seu próprio acesso")

    if data.is_active is not None:
        user.is_active = data.is_active
    if data.is_admin is not None:
        user.is_admin = data.is_admin
    if data.is_premium is not None:
        user.is_premium = data.is_premium
    if data.email is not None and data.email != user.email:
        dup = (await db.execute(select(User).where(func.lower(User.email) == data.email.lower(), User.id != user.id))).scalar_one_or_none()
        if dup:
            raise HTTPException(status_code=400, detail="Email já em uso")
        user.email = data.email
    return {"message": "Atualizado"}


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(user_id: int, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """Permanently delete a user and everything tied to it."""
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Você não pode deletar sua própria conta")
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # Collect dependent ids so we can delete children before parents (no cascade FKs).
    listing_ids = [r[0] for r in (await db.execute(select(Listing.id).where(Listing.user_id == user_id))).all()]
    interest_ids = [r[0] for r in (await db.execute(
        select(Interest.id).where(or_(Interest.buyer_id == user_id, Interest.listing_id.in_(listing_ids or [-1])))
    )).all()]
    binder_ids = [r[0] for r in (await db.execute(select(Binder.id).where(Binder.user_id == user_id))).all()]
    deck_ids = [r[0] for r in (await db.execute(select(Deck.id).where(Deck.user_id == user_id))).all()]
    entry_ids = [r[0] for r in (await db.execute(select(CollectionEntry.id).where(CollectionEntry.user_id == user_id))).all()]

    await db.execute(delete(Message).where(or_(Message.sender_id == user_id, Message.interest_id.in_(interest_ids or [-1]))))
    await db.execute(delete(Interest).where(Interest.id.in_(interest_ids or [-1])))
    await db.execute(delete(Listing).where(Listing.user_id == user_id))
    await db.execute(delete(BinderCard).where(or_(BinderCard.binder_id.in_(binder_ids or [-1]), BinderCard.collection_entry_id.in_(entry_ids or [-1]))))
    await db.execute(delete(DeckCard).where(DeckCard.deck_id.in_(deck_ids or [-1])))
    await db.execute(delete(CollectionEntry).where(CollectionEntry.user_id == user_id))
    await db.execute(delete(Binder).where(Binder.user_id == user_id))
    await db.execute(delete(Deck).where(Deck.user_id == user_id))
    await db.execute(delete(WishlistEntry).where(WishlistEntry.user_id == user_id))
    await db.execute(delete(Friendship).where(or_(Friendship.requester_id == user_id, Friendship.addressee_id == user_id)))
    await db.execute(delete(Share).where(or_(Share.owner_id == user_id, Share.friend_id == user_id)))
    await db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user_id))
    await db.execute(delete(Feedback).where(Feedback.user_id == user_id))
    await db.execute(delete(User).where(User.id == user_id))


@router.get("/feedback")
async def list_feedback(_: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Feedback).order_by(desc(Feedback.created_at)))).scalars().all()
    out = []
    for f in rows:
        username = None
        if f.user_id:
            u = (await db.execute(select(User).where(User.id == f.user_id))).scalar_one_or_none()
            username = u.username if u else None
        out.append({
            "id": f.id, "type": f.type, "message": f.message, "email": f.email,
            "page": f.page, "status": f.status, "username": username,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        })
    return out


class UpdateFeedback(BaseModel):
    status: str


@router.patch("/feedback/{fid}")
async def update_feedback(fid: int, data: UpdateFeedback, _: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    f = (await db.execute(select(Feedback).where(Feedback.id == fid))).scalar_one_or_none()
    if not f:
        raise HTTPException(status_code=404, detail="Não encontrado")
    f.status = "resolved" if data.status == "resolved" else "open"
    return {"message": "Atualizado"}


# --- Email campaigns -------------------------------------------------------

class CampaignIn(BaseModel):
    subject: str
    title: str = ""
    body: str = ""
    image_url: Optional[str] = None
    cta_text: Optional[str] = None
    cta_url: Optional[str] = None
    segment: str = "all"   # all | inactive_14 | inactive_30


def _campaign_out(c: EmailCampaign) -> dict:
    return {
        "id": c.id, "subject": c.subject, "title": c.title, "body": c.body,
        "image_url": c.image_url, "cta_text": c.cta_text, "cta_url": c.cta_url,
        "segment": getattr(c, "segment", "all") or "all",
        "status": c.status, "total_recipients": c.total_recipients, "sent_count": c.sent_count,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "sent_at": c.sent_at.isoformat() if c.sent_at else None,
    }


def _segment_conditions(segment: str):
    """Recipient filter for a campaign segment (active, opted-in, + inactivity)."""
    conds = [User.is_active == True, User.email_opt_out == False]  # noqa: E712
    days = {"inactive_14": 14, "inactive_30": 30}.get(segment)
    if days:
        cutoff = datetime.utcnow() - timedelta(days=days)
        conds.append(or_(User.last_login_at < cutoff, User.last_login_at.is_(None)))
    return conds


async def _unsubscribe_url(user: User, db: AsyncSession) -> str:
    """Ensure the user has an unsubscribe token and return their unsubscribe link."""
    if not user.unsubscribe_token:
        user.unsubscribe_token = secrets.token_urlsafe(32)
        await db.flush()
    return f"{settings.app_url.rstrip('/')}/unsubscribe?token={user.unsubscribe_token}"


@router.get("/campaigns")
async def list_campaigns(_: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(EmailCampaign).order_by(desc(EmailCampaign.created_at)))).scalars().all()
    # Default audience (segment 'all'); composer fetches per-segment via /campaigns/audience.
    audience = (await db.execute(
        select(func.count(User.id)).where(*_segment_conditions("all"))
    )).scalar() or 0
    return {"campaigns": [_campaign_out(c) for c in rows], "audience": audience}


@router.get("/campaigns/audience")
async def campaign_audience(segment: str = "all", _: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    count = (await db.execute(select(func.count(User.id)).where(*_segment_conditions(segment)))).scalar() or 0
    return {"segment": segment, "count": count}


@router.post("/campaigns", status_code=201)
async def create_campaign(data: CampaignIn, _: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    if not data.subject.strip():
        raise HTTPException(status_code=400, detail="Assunto é obrigatório")
    c = EmailCampaign(
        subject=data.subject.strip(), title=data.title.strip(), body=data.body,
        image_url=(data.image_url or None), cta_text=(data.cta_text or None),
        cta_url=(data.cta_url or None), segment=(data.segment or "all"),
    )
    db.add(c)
    await db.flush()
    return _campaign_out(c)


@router.patch("/campaigns/{cid}")
async def update_campaign(cid: int, data: CampaignIn, _: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    c = (await db.execute(select(EmailCampaign).where(EmailCampaign.id == cid))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
    if c.status != "draft":
        raise HTTPException(status_code=400, detail="Só é possível editar rascunhos")
    c.subject, c.title, c.body = data.subject.strip(), data.title.strip(), data.body
    c.image_url, c.cta_text, c.cta_url = (data.image_url or None), (data.cta_text or None), (data.cta_url or None)
    c.segment = data.segment or "all"
    return _campaign_out(c)


@router.delete("/campaigns/{cid}", status_code=204)
async def delete_campaign(cid: int, _: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    c = (await db.execute(select(EmailCampaign).where(EmailCampaign.id == cid))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
    await db.execute(delete(EmailCampaign).where(EmailCampaign.id == cid))


@router.post("/campaigns/{cid}/test")
async def test_campaign(cid: int, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """Send the campaign only to the admin so they can preview it."""
    c = (await db.execute(select(EmailCampaign).where(EmailCampaign.id == cid))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
    html = render_campaign_html(
        title=c.title, body=c.body, image_url=c.image_url,
        cta_text=c.cta_text, cta_url=c.cta_url,
        unsubscribe_url=await _unsubscribe_url(admin, db),
    )
    ok = await send_email(admin.email, f"[TESTE] {c.subject}", html)
    return {"sent": ok, "to": admin.email}


@router.post("/campaigns/{cid}/send")
async def send_campaign(cid: int, _: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    c = (await db.execute(select(EmailCampaign).where(EmailCampaign.id == cid))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
    if c.status == "sent":
        raise HTTPException(status_code=400, detail="Esta campanha já foi enviada")

    recipients = (await db.execute(
        select(User).where(*_segment_conditions(getattr(c, "segment", "all") or "all"))
    )).scalars().all()

    c.status = "sending"
    c.total_recipients = len(recipients)
    c.sent_count = 0
    await db.flush()

    sent = 0
    for user in recipients:
        try:
            html = render_campaign_html(
                title=c.title, body=c.body, image_url=c.image_url,
                cta_text=c.cta_text, cta_url=c.cta_url,
                unsubscribe_url=await _unsubscribe_url(user, db),
            )
            if await send_email(user.email, c.subject, html):
                sent += 1
        except Exception:
            pass  # one bad address shouldn't abort the whole campaign

    c.sent_count = sent
    c.status = "sent"
    c.sent_at = datetime.utcnow()
    return _campaign_out(c)


# --- Stores directory ------------------------------------------------------

class StoreIn(BaseModel):
    name: str
    city: str
    neighborhood: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    phone2: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    instagram: Optional[str] = None
    logo: Optional[str] = None
    is_wpn: bool = False
    featured: bool = False
    notes: Optional[str] = None
    calendar_url: Optional[str] = None


_STORE_FIELDS = ["name", "city", "neighborhood", "address", "phone", "phone2", "email",
                 "website", "instagram", "logo", "is_wpn", "featured", "notes", "calendar_url"]


def _store_out(s: Store) -> dict:
    return {f: getattr(s, f) for f in _STORE_FIELDS} | {
        "id": s.id,
        "calendar_synced_at": s.calendar_synced_at.isoformat() if s.calendar_synced_at else None,
    }


@router.get("/stores")
async def admin_list_stores(_: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Store).order_by(desc(Store.featured), Store.city, Store.name))).scalars().all()
    return [_store_out(s) for s in rows]


@router.post("/stores", status_code=201)
async def admin_create_store(data: StoreIn, _: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    if not data.name.strip() or not data.city.strip():
        raise HTTPException(status_code=400, detail="Nome e cidade são obrigatórios")
    s = Store(**data.model_dump())
    db.add(s)
    await db.flush()
    return _store_out(s)


@router.patch("/stores/{sid}")
async def admin_update_store(sid: int, data: StoreIn, _: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    s = (await db.execute(select(Store).where(Store.id == sid))).scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Loja não encontrada")
    for f, v in data.model_dump().items():
        setattr(s, f, v)
    return _store_out(s)


@router.delete("/stores/{sid}", status_code=204)
async def admin_delete_store(sid: int, _: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    s = (await db.execute(select(Store).where(Store.id == sid))).scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Loja não encontrada")
    # Keep the store's events but detach them.
    await db.execute(Event.__table__.update().where(Event.store_id == sid).values(store_id=None))
    await db.execute(delete(Store).where(Store.id == sid))


@router.post("/stores/{sid}/sync-calendar")
async def admin_sync_store_calendar(sid: int, _: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """Fetch the store's iCal feed now and refresh its synced events."""
    s = (await db.execute(select(Store).where(Store.id == sid))).scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Loja não encontrada")
    if not s.calendar_url:
        raise HTTPException(status_code=400, detail="Esta loja não tem calendário configurado")
    imported = await sync_store(s, db)
    return {"imported": imported, "synced_at": s.calendar_synced_at.isoformat() if s.calendar_synced_at else None}


# --- Events ----------------------------------------------------------------

class EventIn(BaseModel):
    title: str
    store_id: Optional[int] = None
    city: str
    address: Optional[str] = None
    format: Optional[str] = None
    kind: str = "tournament"
    description: Optional[str] = None
    entry_fee: Optional[str] = None
    link: Optional[str] = None
    recurrence: str = "none"          # none | weekly
    weekday: Optional[int] = None     # 0=Mon .. 6=Sun
    event_date: Optional[str] = None  # ISO date for one-off
    time_label: Optional[str] = None


def _event_out(e: Event, store_name: Optional[str] = None) -> dict:
    return {
        "id": e.id, "title": e.title, "store_id": e.store_id, "store_name": store_name,
        "city": e.city, "address": e.address, "format": e.format, "kind": e.kind,
        "description": e.description, "entry_fee": e.entry_fee, "link": e.link,
        "recurrence": e.recurrence, "weekday": e.weekday,
        "event_date": e.event_date.isoformat() if e.event_date else None,
        "time_label": e.time_label,
    }


def _apply_event(e: Event, data: EventIn):
    e.title, e.store_id, e.city = data.title.strip(), data.store_id, data.city.strip()
    e.address, e.format = data.address, data.format
    e.kind = data.kind or "tournament"
    e.description, e.entry_fee, e.link = data.description, data.entry_fee, data.link
    e.time_label = data.time_label
    if data.recurrence == "weekly":
        e.recurrence, e.weekday, e.event_date = "weekly", data.weekday, None
    else:
        e.recurrence, e.weekday = "none", None
        e.event_date = date.fromisoformat(data.event_date) if data.event_date else None


@router.get("/events")
async def admin_list_events(_: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Event).order_by(desc(Event.created_at)))).scalars().all()
    names = {s.id: s.name for s in (await db.execute(
        select(Store).where(Store.id.in_([e.store_id for e in rows if e.store_id] or [-1]))
    )).scalars().all()}
    return [_event_out(e, names.get(e.store_id)) for e in rows]


@router.post("/events", status_code=201)
async def admin_create_event(data: EventIn, _: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    if not data.title.strip() or not data.city.strip():
        raise HTTPException(status_code=400, detail="Título e cidade são obrigatórios")
    if data.recurrence == "weekly" and data.weekday is None:
        raise HTTPException(status_code=400, detail="Escolha o dia da semana")
    if data.recurrence != "weekly" and not data.event_date:
        raise HTTPException(status_code=400, detail="Escolha a data do evento")
    e = Event()
    try:
        _apply_event(e, data)
    except ValueError:
        raise HTTPException(status_code=400, detail="Data inválida")
    db.add(e)
    await db.flush()
    return _event_out(e)


@router.patch("/events/{eid}")
async def admin_update_event(eid: int, data: EventIn, _: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    e = (await db.execute(select(Event).where(Event.id == eid))).scalar_one_or_none()
    if not e:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    try:
        _apply_event(e, data)
    except ValueError:
        raise HTTPException(status_code=400, detail="Data inválida")
    return _event_out(e)


@router.delete("/events/{eid}", status_code=204)
async def admin_delete_event(eid: int, _: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    e = (await db.execute(select(Event).where(Event.id == eid))).scalar_one_or_none()
    if not e:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    await db.execute(delete(Event).where(Event.id == eid))
