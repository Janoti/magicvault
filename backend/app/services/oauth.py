"""Social-login (OAuth) providers: Google, Facebook and Steam.

Each provider is enabled only when its credentials are configured (see config).
The flow is driven by routes/oauth.py:
  1. /start  -> redirect the browser to the provider's authorize URL
  2. callback -> exchange the code (or verify the OpenID assertion) and return a
                 normalized profile: {provider, sub, email, email_verified, name, avatar}

Apple is intentionally not implemented yet (needs a paid Apple Developer account).
"""
import logging
from typing import Optional
from urllib.parse import urlencode

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# OAuth2 / OpenID-Connect endpoints.
_GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN = "https://oauth2.googleapis.com/token"
_GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo"

_FB_AUTH = "https://www.facebook.com/v19.0/dialog/oauth"
_FB_TOKEN = "https://graph.facebook.com/v19.0/oauth/access_token"
_FB_PROFILE = "https://graph.facebook.com/me"

_STEAM_OPENID = "https://steamcommunity.com/openid/login"
_STEAM_SUMMARY = "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/"


def is_enabled(provider: str) -> bool:
    if provider == "google":
        return bool(settings.google_client_id and settings.google_client_secret)
    if provider == "facebook":
        return bool(settings.facebook_client_id and settings.facebook_client_secret)
    if provider == "steam":
        return bool(settings.steam_api_key)
    return False


def enabled_providers() -> list[str]:
    return [p for p in ("google", "facebook", "steam") if is_enabled(p)]


def redirect_uri(provider: str) -> str:
    return f"{settings.oauth_base}/api/auth/oauth/{provider}/callback"


# --- Building the authorize redirect ----------------------------------------

def authorize_url(provider: str, state: str) -> str:
    ru = redirect_uri(provider)
    if provider == "google":
        return _GOOGLE_AUTH + "?" + urlencode({
            "response_type": "code",
            "client_id": settings.google_client_id,
            "redirect_uri": ru,
            "scope": "openid email profile",
            "state": state,
            "access_type": "online",
            "prompt": "select_account",
        })
    if provider == "facebook":
        return _FB_AUTH + "?" + urlencode({
            "client_id": settings.facebook_client_id,
            "redirect_uri": ru,
            "state": state,
            "scope": "email,public_profile",
            "response_type": "code",
        })
    if provider == "steam":
        # OpenID 2.0 — Steam does not support a `state` param, so we carry it in
        # the return_to URL (verified on the way back).
        return_to = f"{ru}?state={state}"
        return _STEAM_OPENID + "?" + urlencode({
            "openid.ns": "http://specs.openid.net/auth/2.0",
            "openid.mode": "checkid_setup",
            "openid.return_to": return_to,
            "openid.realm": settings.oauth_base,
            "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
            "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
        })
    raise ValueError(f"unknown provider {provider}")


# --- Handling the callback ---------------------------------------------------

async def fetch_profile(provider: str, params: dict) -> Optional[dict]:
    """Given the raw callback query params, return a normalized profile or None.
    `params` must include `code` for OAuth2 providers, or the openid.* set for Steam."""
    try:
        if provider == "google":
            return await _google_profile(params.get("code"))
        if provider == "facebook":
            return await _facebook_profile(params.get("code"))
        if provider == "steam":
            return await _steam_profile(params)
    except Exception:
        logger.warning("OAuth profile fetch failed for %s", provider, exc_info=True)
        return None
    return None


async def _google_profile(code: Optional[str]) -> Optional[dict]:
    if not code:
        return None
    async with httpx.AsyncClient(timeout=15) as client:
        tok = await client.post(_GOOGLE_TOKEN, data={
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": redirect_uri("google"),
            "grant_type": "authorization_code",
        })
        tok.raise_for_status()
        access = tok.json().get("access_token")
        if not access:
            return None
        info = await client.get(_GOOGLE_USERINFO, headers={"Authorization": f"Bearer {access}"})
        info.raise_for_status()
        d = info.json()
    return {
        "provider": "google",
        "sub": str(d["sub"]),
        "email": d.get("email"),
        "email_verified": bool(d.get("email_verified")),
        "name": d.get("name") or d.get("given_name"),
        "avatar": d.get("picture"),
    }


async def _facebook_profile(code: Optional[str]) -> Optional[dict]:
    if not code:
        return None
    async with httpx.AsyncClient(timeout=15) as client:
        tok = await client.get(_FB_TOKEN, params={
            "client_id": settings.facebook_client_id,
            "client_secret": settings.facebook_client_secret,
            "redirect_uri": redirect_uri("facebook"),
            "code": code,
        })
        tok.raise_for_status()
        access = tok.json().get("access_token")
        if not access:
            return None
        prof = await client.get(_FB_PROFILE, params={
            "fields": "id,name,email,picture.type(large)",
            "access_token": access,
        })
        prof.raise_for_status()
        d = prof.json()
    pic = (d.get("picture") or {}).get("data", {}).get("url")
    return {
        "provider": "facebook",
        "sub": str(d["id"]),
        "email": d.get("email"),
        "email_verified": bool(d.get("email")),  # FB only returns verified emails
        "name": d.get("name"),
        "avatar": pic,
    }


async def _steam_profile(params: dict) -> Optional[dict]:
    """Verify the OpenID assertion with Steam, then look up the player summary."""
    claimed = params.get("openid.claimed_id") or params.get("openid.identity")
    if not claimed:
        return None
    # Verify the assertion is genuine by echoing it back with check_authentication.
    verify = {k: v for k, v in params.items() if k.startswith("openid.")}
    verify["openid.mode"] = "check_authentication"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(_STEAM_OPENID, data=verify)
        resp.raise_for_status()
        if "is_valid:true" not in resp.text:
            logger.warning("Steam OpenID assertion failed verification")
            return None
        steamid = claimed.rstrip("/").rsplit("/", 1)[-1]
        if not steamid.isdigit():
            return None
        summary = await client.get(_STEAM_SUMMARY, params={
            "key": settings.steam_api_key, "steamids": steamid,
        })
        summary.raise_for_status()
        players = summary.json().get("response", {}).get("players", [])
    p = players[0] if players else {}
    return {
        "provider": "steam",
        "sub": steamid,
        "email": None,                 # Steam never gives an email
        "email_verified": False,
        "name": p.get("personaname"),
        "avatar": p.get("avatarfull"),
    }
