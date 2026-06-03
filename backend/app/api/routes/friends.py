from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, Friendship

router = APIRouter()


class FriendRequest(BaseModel):
    identifier: str  # username or email


def _user_public(u: User) -> dict:
    # Note: email is intentionally NOT exposed to other users (PII).
    return {"id": u.id, "username": u.username,
            "display_name": u.display_name, "avatar": u.avatar}


@router.get("")
async def list_friends(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Accepted friends."""
    rows = (await db.execute(
        select(Friendship).where(
            Friendship.status == "accepted",
            or_(Friendship.requester_id == current_user.id, Friendship.addressee_id == current_user.id),
        )
    )).scalars().all()
    friends = []
    for f in rows:
        other_id = f.addressee_id if f.requester_id == current_user.id else f.requester_id
        other = (await db.execute(select(User).where(User.id == other_id))).scalar_one_or_none()
        if other:
            friends.append({"friendship_id": f.id, **_user_public(other)})
    return friends


@router.get("/requests")
async def list_requests(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Pending requests, split into incoming (to accept) and outgoing (sent)."""
    rows = (await db.execute(
        select(Friendship).where(
            Friendship.status == "pending",
            or_(Friendship.requester_id == current_user.id, Friendship.addressee_id == current_user.id),
        )
    )).scalars().all()
    incoming, outgoing = [], []
    for f in rows:
        if f.addressee_id == current_user.id:
            other = (await db.execute(select(User).where(User.id == f.requester_id))).scalar_one_or_none()
            if other:
                incoming.append({"friendship_id": f.id, **_user_public(other)})
        else:
            other = (await db.execute(select(User).where(User.id == f.addressee_id))).scalar_one_or_none()
            if other:
                outgoing.append({"friendship_id": f.id, **_user_public(other)})
    return {"incoming": incoming, "outgoing": outgoing}


@router.post("/request", status_code=201)
async def send_request(data: FriendRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    ident = data.identifier.strip().lower()
    target = (await db.execute(
        select(User).where(or_(User.username == ident, User.email == ident))
    )).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="Você não pode adicionar a si mesmo")

    existing = (await db.execute(
        select(Friendship).where(or_(
            and_(Friendship.requester_id == current_user.id, Friendship.addressee_id == target.id),
            and_(Friendship.requester_id == target.id, Friendship.addressee_id == current_user.id),
        ))
    )).scalar_one_or_none()
    if existing:
        if existing.status == "accepted":
            raise HTTPException(status_code=400, detail="Vocês já são amigos")
        # If the other person already invited me, accept it instead of duplicating.
        if existing.addressee_id == current_user.id:
            existing.status = "accepted"
            return {"message": "Pedido aceito", "friendship_id": existing.id, "status": "accepted"}
        raise HTTPException(status_code=400, detail="Pedido já enviado")

    f = Friendship(requester_id=current_user.id, addressee_id=target.id, status="pending")
    db.add(f)
    await db.flush()
    return {"message": "Pedido enviado", "friendship_id": f.id, "status": "pending"}


@router.post("/{friendship_id}/accept")
async def accept_request(friendship_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    f = (await db.execute(select(Friendship).where(Friendship.id == friendship_id))).scalar_one_or_none()
    if not f or f.addressee_id != current_user.id or f.status != "pending":
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    f.status = "accepted"
    return {"message": "Amizade aceita"}


@router.delete("/{friendship_id}", status_code=204)
async def remove_friendship(friendship_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Decline, cancel, or unfriend."""
    f = (await db.execute(select(Friendship).where(Friendship.id == friendship_id))).scalar_one_or_none()
    if not f or current_user.id not in (f.requester_id, f.addressee_id):
        raise HTTPException(status_code=404, detail="Não encontrado")
    await db.delete(f)
