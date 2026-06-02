import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, Friendship, Share, Binder, Deck
from app.services.sharing import build_resource_view, assert_owns_resource

router = APIRouter()


class ShareWithFriendRequest(BaseModel):
    resource_type: str            # collection | binder | deck
    resource_id: Optional[int] = None
    friend_id: int


class PublicShareRequest(BaseModel):
    resource_type: str
    resource_id: Optional[int] = None


async def _are_friends(db: AsyncSession, a: int, b: int) -> bool:
    f = (await db.execute(
        select(Friendship).where(
            Friendship.status == "accepted",
            or_(
                and_(Friendship.requester_id == a, Friendship.addressee_id == b),
                and_(Friendship.requester_id == b, Friendship.addressee_id == a),
            ),
        )
    )).scalar_one_or_none()
    return f is not None


async def _resource_label(db: AsyncSession, resource_type: str, resource_id: Optional[int]) -> str:
    if resource_type == "collection":
        return "Coleção"
    if resource_type == "binder":
        b = (await db.execute(select(Binder).where(Binder.id == resource_id))).scalar_one_or_none()
        return b.name if b else "Binder"
    if resource_type == "deck":
        d = (await db.execute(select(Deck).where(Deck.id == resource_id))).scalar_one_or_none()
        return d.name if d else "Deck"
    return resource_type


@router.post("", status_code=201)
async def share_with_friend(data: ShareWithFriendRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if data.resource_type not in ("collection", "binder", "deck"):
        raise HTTPException(status_code=400, detail="Tipo inválido")
    await assert_owns_resource(db, current_user.id, data.resource_type, data.resource_id)
    if not await _are_friends(db, current_user.id, data.friend_id):
        raise HTTPException(status_code=400, detail="Vocês não são amigos")

    existing = (await db.execute(
        select(Share).where(
            Share.owner_id == current_user.id,
            Share.resource_type == data.resource_type,
            Share.resource_id == data.resource_id,
            Share.friend_id == data.friend_id,
        )
    )).scalar_one_or_none()
    if existing:
        return {"id": existing.id, "message": "Já compartilhado"}

    s = Share(owner_id=current_user.id, resource_type=data.resource_type,
              resource_id=data.resource_id, friend_id=data.friend_id)
    db.add(s)
    await db.flush()
    return {"id": s.id, "message": "Compartilhado"}


@router.post("/public", status_code=201)
async def create_public_link(data: PublicShareRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if data.resource_type not in ("collection", "binder", "deck"):
        raise HTTPException(status_code=400, detail="Tipo inválido")
    await assert_owns_resource(db, current_user.id, data.resource_type, data.resource_id)

    existing = (await db.execute(
        select(Share).where(
            Share.owner_id == current_user.id,
            Share.resource_type == data.resource_type,
            Share.resource_id == data.resource_id,
            Share.public_token.is_not(None),
        )
    )).scalar_one_or_none()
    if existing:
        return {"id": existing.id, "token": existing.public_token}

    token = secrets.token_urlsafe(12)
    s = Share(owner_id=current_user.id, resource_type=data.resource_type,
              resource_id=data.resource_id, public_token=token)
    db.add(s)
    await db.flush()
    return {"id": s.id, "token": token}


@router.get("/mine")
async def my_shares(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Share).where(Share.owner_id == current_user.id))).scalars().all()
    out = []
    for s in rows:
        entry = {
            "id": s.id, "resource_type": s.resource_type, "resource_id": s.resource_id,
            "label": await _resource_label(db, s.resource_type, s.resource_id),
            "public_token": s.public_token,
        }
        if s.friend_id:
            friend = (await db.execute(select(User).where(User.id == s.friend_id))).scalar_one_or_none()
            entry["friend"] = {"id": friend.id, "username": friend.username} if friend else None
        out.append(entry)
    return out


@router.get("/with-me")
async def shared_with_me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Share).where(Share.friend_id == current_user.id))).scalars().all()
    out = []
    for s in rows:
        owner = (await db.execute(select(User).where(User.id == s.owner_id))).scalar_one_or_none()
        out.append({
            "id": s.id, "resource_type": s.resource_type, "resource_id": s.resource_id,
            "label": await _resource_label(db, s.resource_type, s.resource_id),
            "owner": {"id": owner.id, "username": owner.username} if owner else None,
        })
    return out


@router.get("/with-me/{share_id}")
async def view_shared_with_me(share_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    s = (await db.execute(select(Share).where(Share.id == share_id, Share.friend_id == current_user.id))).scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Não encontrado")
    return await build_resource_view(db, s.owner_id, s.resource_type, s.resource_id)


@router.delete("/{share_id}", status_code=204)
async def delete_share(share_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    s = (await db.execute(select(Share).where(Share.id == share_id, Share.owner_id == current_user.id))).scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Não encontrado")
    await db.delete(s)


# --- Public, unauthenticated view ---
@router.get("/public/{token}")
async def view_public(token: str, db: AsyncSession = Depends(get_db)):
    s = (await db.execute(select(Share).where(Share.public_token == token))).scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Link inválido ou expirado")
    return await build_resource_view(db, s.owner_id, s.resource_type, s.resource_id)
