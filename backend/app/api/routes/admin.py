from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_admin
from app.models.user import User, CollectionEntry, Deck, Binder

router = APIRouter()


class UpdateUserAdmin(BaseModel):
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None
    is_premium: Optional[bool] = None


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
    return {"message": "Atualizado"}
