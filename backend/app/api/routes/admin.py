from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, delete, or_
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_admin
from app.models.user import (
    User, CollectionEntry, Binder, BinderCard, Deck, DeckCard, WishlistEntry,
    Friendship, Share, PasswordResetToken, Feedback, Listing, Interest, Message,
)

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
