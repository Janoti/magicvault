"""Social-login endpoints (Google, Facebook, Steam).

Flow (browser does full-page navigation, not fetch):
  GET /api/auth/oauth/{provider}/start
      -> sets a signed `state` (CSRF) and 302s to the provider.
  GET /api/auth/oauth/{provider}/callback?...
      -> verifies state, exchanges the code / verifies the OpenID assertion,
         finds-or-creates the user, then 302s back to the SPA at
         {app_url}/oauth/callback#token=<jwt>[&new=1][&needs_email=1].

The SPA's OAuthCallbackPage reads the token from the URL fragment and logs in.
"""
import re
import secrets
import logging
from datetime import datetime, timedelta
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from jose import jwt, JWTError
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, hash_password
from app.models.user import User, OAuthAccount
from app.services import oauth

router = APIRouter()
logger = logging.getLogger(__name__)

STATE_COOKIE = "oauth_state"
_USERNAME_RE = re.compile(r"[^a-z0-9_.-]+")


def _enabled_or_404(provider: str) -> None:
    if not oauth.is_enabled(provider):
        raise HTTPException(status_code=404, detail="Provedor de login não configurado")


def _sign_state(provider: str, nonce: str) -> str:
    payload = {"p": provider, "n": nonce, "exp": datetime.utcnow() + timedelta(minutes=15)}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def _verify_state(token: str, provider: str, nonce: str) -> bool:
    try:
        data = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return False
    return data.get("p") == provider and data.get("n") == nonce and bool(nonce)


def _front_redirect(token: str, *, new: bool, needs_email: bool) -> RedirectResponse:
    q = {"token": token}
    if new:
        q["new"] = "1"
    if needs_email:
        q["needs_email"] = "1"
    url = f"{settings.app_url.rstrip('/')}/oauth/callback#{urlencode(q)}"
    return RedirectResponse(url, status_code=302)


def _front_error(msg: str) -> RedirectResponse:
    url = f"{settings.app_url.rstrip('/')}/login?oauth_error={urlencode({'m': msg})[2:]}"
    return RedirectResponse(url, status_code=302)


async def _unique_username(db: AsyncSession, base: str) -> str:
    base = _USERNAME_RE.sub("", (base or "").lower()).strip("._-") or "player"
    base = base[:24]
    if len(base) < 3:
        base = f"{base}player"[:24]
    candidate = base
    for _ in range(50):
        exists = (await db.execute(
            select(User.id).where(func.lower(User.username) == candidate.lower())
        )).scalar_one_or_none()
        if not exists:
            return candidate
        candidate = f"{base}{secrets.randbelow(9000) + 1000}"[:30]
    return f"{base}{secrets.token_hex(3)}"[:30]


async def _find_or_create(db: AsyncSession, profile: dict) -> tuple[User, bool, bool]:
    """Returns (user, is_new, needs_email). Links the provider identity, creating
    a User when neither the identity nor a matching email is known yet."""
    provider, sub = profile["provider"], profile["sub"]
    email = (profile.get("email") or "").strip() or None

    # 1) Identity already linked.
    oa = (await db.execute(
        select(OAuthAccount).where(
            OAuthAccount.provider == provider, OAuthAccount.provider_user_id == sub
        )
    )).scalar_one_or_none()
    if oa:
        user = (await db.execute(select(User).where(User.id == oa.user_id))).scalar_one()
        return user, False, _is_placeholder_email(user.email)

    # 2) Match an existing account by verified email → link it.
    user = None
    if email:
        user = (await db.execute(
            select(User).where(func.lower(User.email) == email.lower())
        )).scalar_one_or_none()

    is_new = False
    needs_email = False
    if not user:
        is_new = True
        username = await _unique_username(db, profile.get("name") or (email.split("@")[0] if email else provider))
        if not email:
            email = f"{provider}.{sub}@social.vaultspell.local"  # placeholder until the user sets a real one
            needs_email = True
        total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
        beta = total_users < settings.beta_premium_limit
        avatar = profile.get("avatar")
        user = User(
            email=email,
            username=username,
            hashed_password=hash_password(secrets.token_urlsafe(32)),  # unusable; social-only
            display_name=profile.get("name"),
            avatar=avatar if (avatar and len(avatar) < 350_000) else None,
            is_premium=beta, is_beta=beta,
            email_verified=bool(profile.get("email_verified")),
            last_login_at=datetime.utcnow(), login_count=1,
        )
        db.add(user)
        await db.flush()
    else:
        user.last_login_at = datetime.utcnow()
        user.login_count = (user.login_count or 0) + 1
        if profile.get("email_verified") and not user.email_verified:
            user.email_verified = True
        needs_email = _is_placeholder_email(user.email)

    db.add(OAuthAccount(user_id=user.id, provider=provider, provider_user_id=sub, email=email))
    await db.flush()
    return user, is_new, needs_email


def _is_placeholder_email(email: str) -> bool:
    return bool(email) and email.endswith("@social.vaultspell.local")


@router.get("/oauth/providers")
async def list_providers():
    """Which social buttons the SPA should show."""
    return {"providers": oauth.enabled_providers()}


@router.get("/oauth/{provider}/start")
async def oauth_start(provider: str):
    _enabled_or_404(provider)
    nonce = secrets.token_urlsafe(16)
    state = _sign_state(provider, nonce)
    resp = RedirectResponse(oauth.authorize_url(provider, state), status_code=302)
    resp.set_cookie(
        STATE_COOKIE, nonce, max_age=900, httponly=True, samesite="lax",
        secure=settings.environment != "development", path="/api/auth/oauth",
    )
    return resp


@router.get("/oauth/{provider}/callback")
async def oauth_callback(provider: str, request: Request, db: AsyncSession = Depends(get_db)):
    _enabled_or_404(provider)
    params = dict(request.query_params)

    nonce = request.cookies.get(STATE_COOKIE, "")
    if not _verify_state(params.get("state", ""), provider, nonce):
        return _front_error("Sessão de login expirou. Tente novamente.")

    profile = await oauth.fetch_profile(provider, params)
    if not profile or not profile.get("sub"):
        return _front_error("Não foi possível autenticar com o provedor.")

    user, is_new, needs_email = await _find_or_create(db, profile)
    token = create_access_token({"sub": str(user.id)})
    resp = _front_redirect(token, new=is_new, needs_email=needs_email)
    resp.delete_cookie(STATE_COOKIE, path="/api/auth/oauth")
    return resp
