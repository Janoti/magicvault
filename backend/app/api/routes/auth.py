import json
import re
import secrets
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from pydantic import BaseModel, EmailStr

from app.core.config import settings
from app.core.ratelimit import limiter
from app.core.database import get_db
from app.core.security import verify_password, hash_password, create_access_token, get_current_user
from app.models.user import User, PasswordResetToken
from app.services.email import send_password_reset

router = APIRouter()

USERNAME_RE = re.compile(r"^[a-zA-Z0-9_.-]{3,30}$")
MIN_PASSWORD_LEN = 6
MAX_AVATAR_LEN = 350_000   # ~256 KB image as base64
MAX_BIO_LEN = 1000


def _validate_username(username: str) -> str:
    u = (username or "").strip()
    if not USERNAME_RE.match(u):
        raise HTTPException(
            status_code=400,
            detail="Nome de usuário inválido (3–30 caracteres: letras, números, _ . -)",
        )
    return u


class UserRegister(BaseModel):
    email: EmailStr
    username: str
    password: str


class LinkItem(BaseModel):
    label: str
    url: str


class UserOut(BaseModel):
    id: int
    email: str
    username: str
    display_name: Optional[str] = None
    avatar: Optional[str] = None
    bio: Optional[str] = None
    links: List[LinkItem] = []
    is_admin: bool = False
    is_premium: bool = False
    is_beta: bool = False


def to_user_out(u: User) -> UserOut:
    return UserOut(
        id=u.id, email=u.email, username=u.username,
        display_name=u.display_name, avatar=u.avatar, bio=u.bio,
        links=json.loads(u.links) if u.links else [],
        is_admin=bool(u.is_admin), is_premium=bool(u.is_premium),
        is_beta=bool(u.is_beta),
    )


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


@router.post("/register", response_model=Token, status_code=201)
@limiter.limit("5/minute")
async def register(request: Request, data: UserRegister, db: AsyncSession = Depends(get_db)):
    username = _validate_username(data.username)
    if len(data.password) < MIN_PASSWORD_LEN:
        raise HTTPException(status_code=400, detail=f"Senha muito curta (mínimo {MIN_PASSWORD_LEN})")

    result = await db.execute(select(User).where(func.lower(User.email) == data.email.lower()))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    result = await db.execute(select(User).where(func.lower(User.username) == username.lower()))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already taken")

    # Beta perk: the first N accounts to register get premium free, forever.
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    beta = total_users < settings.beta_premium_limit

    user = User(
        email=data.email,
        username=username,
        hashed_password=hash_password(data.password),
        is_premium=beta,
        is_beta=beta,
    )
    db.add(user)
    await db.flush()

    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token, token_type="bearer", user=to_user_out(user))


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
async def login(request: Request, form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    # The "username" form field may hold an email or a username.
    ident = form.username.strip().lower()
    result = await db.execute(
        select(User).where(or_(func.lower(User.email) == ident, func.lower(User.username) == ident))
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token, token_type="bearer", user=to_user_out(user))


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return to_user_out(current_user)


class UpdateMeRequest(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    display_name: Optional[str] = None
    avatar: Optional[str] = None
    bio: Optional[str] = None
    links: Optional[List[LinkItem]] = None


@router.patch("/me", response_model=UserOut)
async def update_me(
    data: UpdateMeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.email and data.email != current_user.email:
        dup = (await db.execute(select(User).where(User.email == data.email, User.id != current_user.id))).scalar_one_or_none()
        if dup:
            raise HTTPException(status_code=400, detail="Email já em uso")
        current_user.email = data.email
    if data.username and data.username != current_user.username:
        username = _validate_username(data.username)
        dup = (await db.execute(select(User).where(func.lower(User.username) == username.lower(), User.id != current_user.id))).scalar_one_or_none()
        if dup:
            raise HTTPException(status_code=400, detail="Username já em uso")
        current_user.username = username
    if data.display_name is not None:
        current_user.display_name = (data.display_name or None) and data.display_name[:100]
    if data.avatar is not None:
        if data.avatar and len(data.avatar) > MAX_AVATAR_LEN:
            raise HTTPException(status_code=400, detail="Imagem muito grande (máx. ~256 KB)")
        current_user.avatar = data.avatar or None
    if data.bio is not None:
        current_user.bio = (data.bio or None) and data.bio[:MAX_BIO_LEN]
    if data.links is not None:
        current_user.links = json.dumps([l.model_dump() for l in data.links])

    await db.flush()
    return to_user_out(current_user)


class ForgotPasswordRequest(BaseModel):
    identifier: str  # email or username


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(request: Request, data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Accepts email or username. Always returns 200 (don't reveal existence)."""
    ident = data.identifier.strip().lower()
    user = (await db.execute(
        select(User).where(or_(User.email == ident, User.username == ident))
    )).scalar_one_or_none()
    if user:
        token = secrets.token_urlsafe(32)
        db.add(PasswordResetToken(
            user_id=user.id,
            token=token,
            expires_at=datetime.utcnow() + timedelta(minutes=settings.reset_token_expire_minutes),
        ))
        await db.flush()
        reset_url = f"{settings.app_url.rstrip('/')}/reset-password?token={token}"
        await send_password_reset(user.email, reset_url)
    return {"message": "Se o email existir, enviamos um link de redefinição."}


@router.post("/reset-password")
@limiter.limit("10/minute")
async def reset_password(request: Request, data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Senha muito curta (mínimo 6)")

    prt = (await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token == data.token)
    )).scalar_one_or_none()
    if not prt or prt.used or prt.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Link inválido ou expirado")

    user = (await db.execute(select(User).where(User.id == prt.user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Link inválido")

    user.hashed_password = hash_password(data.new_password)
    prt.used = True
    return {"message": "Senha redefinida com sucesso"}
