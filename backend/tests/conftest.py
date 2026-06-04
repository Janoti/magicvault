"""Pytest fixtures. IMPORTANT: we FORCE the DB to a dedicated test database so a
test run can never touch dev/prod data. Set TEST_DATABASE_URL or rely on the
default below. Create it first, e.g.:
  docker exec magicvault_db createdb -U magicvault magicvault_test
"""
import os
import uuid

# Must run BEFORE app modules import settings/engine.
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://magicvault:magicvault123@localhost:5432/magicvault_test",
)
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("SECRET_KEY", "test-secret")

import pytest_asyncio  # noqa: E402
from httpx import AsyncClient, ASGITransport  # noqa: E402
from asgi_lifespan import LifespanManager  # noqa: E402

from app.main import app  # noqa: E402
from app.core.database import engine  # noqa: E402


@pytest_asyncio.fixture
async def client():
    """App client with lifespan (runs create_all + idempotent migrations).
    The engine is disposed after each test so its asyncpg pool re-binds to the
    new event loop (avoids 'Future attached to a different loop')."""
    async with LifespanManager(app, startup_timeout=60, shutdown_timeout=30):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c
    await engine.dispose()


async def register_user(client):
    """Register a fresh user; returns creds + ready-to-use auth headers.
    Use this when a test needs more than one user (e.g. IDOR checks)."""
    s = uuid.uuid4().hex[:10]
    email, username = f"u{s}@test.dev", f"u{s}"
    r = await client.post("/api/auth/register", json={"email": email, "username": username, "password": "secret123"})
    assert r.status_code == 201, r.text
    token = r.json()["access_token"]
    return {
        "email": email, "username": username, "token": token,
        "headers": {"Authorization": f"Bearer {token}"}, "user": r.json()["user"],
    }


@pytest_asyncio.fixture
async def auth(client):
    """Registers a fresh user and returns an authenticated client + creds."""
    u = await register_user(client)
    client.headers["Authorization"] = f"Bearer {u['token']}"
    return {"client": client, **u}
