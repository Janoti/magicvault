"""Shared rate limiter (slowapi). Backed by Redis when available so limits hold
across restarts; falls back to in-process memory otherwise. `swallow_errors`
keeps the API up (fail-open) if the storage backend is briefly unavailable."""
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings


def _client_ip(request: Request) -> str:
    # Render/most proxies put the real client IP first in X-Forwarded-For.
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(
    key_func=_client_ip,
    storage_uri=settings.redis_url or "memory://",
    swallow_errors=True,
    enabled=settings.environment != "test",  # off in the test suite
)
