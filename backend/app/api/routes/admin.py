import secrets
from datetime import datetime

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
    EmailCampaign,
)
from app.services.email import send_email, render_campaign_html

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
    return {"users": users or 0, "premium": premium or 0, "cards": cards or 0,
            "decks": decks or 0, "binders": binders or 0}


@router.get("/users")
async def list_users(_: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(User).order_by(desc(User.created_at)))).scalars().all()
    return [{
        "id": u.id, "email": u.email, "username": u.username,
        "display_name": u.display_name, "avatar": u.avatar,
        "is_active": bool(u.is_active), "is_admin": bool(u.is_admin), "is_premium": bool(u.is_premium),
        "created_at": u.created_at.isoformat() if u.created_at else None,
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


def _campaign_out(c: EmailCampaign) -> dict:
    return {
        "id": c.id, "subject": c.subject, "title": c.title, "body": c.body,
        "image_url": c.image_url, "cta_text": c.cta_text, "cta_url": c.cta_url,
        "status": c.status, "total_recipients": c.total_recipients, "sent_count": c.sent_count,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "sent_at": c.sent_at.isoformat() if c.sent_at else None,
    }


async def _unsubscribe_url(user: User, db: AsyncSession) -> str:
    """Ensure the user has an unsubscribe token and return their unsubscribe link."""
    if not user.unsubscribe_token:
        user.unsubscribe_token = secrets.token_urlsafe(32)
        await db.flush()
    return f"{settings.app_url.rstrip('/')}/unsubscribe?token={user.unsubscribe_token}"


@router.get("/campaigns")
async def list_campaigns(_: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(EmailCampaign).order_by(desc(EmailCampaign.created_at)))).scalars().all()
    # Audience size = active users who haven't opted out.
    audience = (await db.execute(
        select(func.count(User.id)).where(User.is_active == True, User.email_opt_out == False)  # noqa: E712
    )).scalar() or 0
    return {"campaigns": [_campaign_out(c) for c in rows], "audience": audience}


@router.post("/campaigns", status_code=201)
async def create_campaign(data: CampaignIn, _: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    if not data.subject.strip():
        raise HTTPException(status_code=400, detail="Assunto é obrigatório")
    c = EmailCampaign(
        subject=data.subject.strip(), title=data.title.strip(), body=data.body,
        image_url=(data.image_url or None), cta_text=(data.cta_text or None),
        cta_url=(data.cta_url or None),
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
        select(User).where(User.is_active == True, User.email_opt_out == False)  # noqa: E712
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
