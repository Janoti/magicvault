import os
import time
import uuid
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import text
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.ratelimit import limiter
from app.core.logging import setup_logging, request_id_var
from app.core.database import engine, Base
from app.core.seed import seed_stores
from app.services.calendar_sync import sync_all_stores

setup_logging()
logger = logging.getLogger("vaultspell.request")
from app.api.routes import auth, cards, collection, binders, decks, wishlist, sets, friends, shares, users, admin, feedback, listings, billing, events, community, user_events, flags

# In production the frontend is built and copied next to the backend (see the
# root Dockerfile). When present, the API also serves the SPA on the same origin.
STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")


# Lightweight idempotent migrations for columns added after a table already
# exists (create_all only creates missing tables, it never ALTERs).
_COLUMN_MIGRATIONS = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(100)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar VARCHAR(255)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS links TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE",
    "ALTER TABLE users ALTER COLUMN avatar TYPE TEXT",  # widen for base64 avatars
    "ALTER TABLE shares ADD COLUMN IF NOT EXISTS slug VARCHAR(120)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(64)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_beta BOOLEAN DEFAULT FALSE",
    "ALTER TABLE listings ADD COLUMN IF NOT EXISTS resolved_as VARCHAR(16)",
    "ALTER TABLE listings ADD COLUMN IF NOT EXISTS accepts_offers BOOLEAN DEFAULT FALSE",
    "ALTER TABLE listings ADD COLUMN IF NOT EXISTS wanted_cards TEXT",
    "ALTER TABLE interests ADD COLUMN IF NOT EXISTS status VARCHAR(12) DEFAULT 'open'",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS contact VARCHAR(100)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS contact_public BOOLEAN DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS collection_public BOOLEAN DEFAULT FALSE",
    "ALTER TABLE wishlist_entries ADD COLUMN IF NOT EXISTS price_snapshot DOUBLE PRECISION",
    "ALTER TABLE binder_cards ADD COLUMN IF NOT EXISTS page INTEGER DEFAULT 0",
    "ALTER TABLE binder_cards ADD COLUMN IF NOT EXISTS slot INTEGER DEFAULT 0",
    "ALTER TABLE decks ADD COLUMN IF NOT EXISTS primer TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_opt_out BOOLEAN DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS unsubscribe_token VARCHAR(64)",
    "ALTER TABLE interests ADD COLUMN IF NOT EXISTS hidden_by_buyer BOOLEAN DEFAULT FALSE",
    "ALTER TABLE interests ADD COLUMN IF NOT EXISTS hidden_by_seller BOOLEAN DEFAULT FALSE",
    "ALTER TABLE stores ADD COLUMN IF NOT EXISTS calendar_url TEXT",
    "ALTER TABLE stores ADD COLUMN IF NOT EXISTS calendar_synced_at TIMESTAMP",
    "ALTER TABLE events ADD COLUMN IF NOT EXISTS source VARCHAR(10) DEFAULT 'manual'",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0",
    "ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS segment VARCHAR(20) DEFAULT 'all'",
    "ALTER TABLE decks ADD COLUMN IF NOT EXISTS folder_id INTEGER",
    "ALTER TABLE collection_entries ADD COLUMN IF NOT EXISTS acquired_price DOUBLE PRECISION",
    "ALTER TABLE collection_entries ADD COLUMN IF NOT EXISTS acquired_currency VARCHAR(3)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(60)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(60)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(80)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS location_public BOOLEAN DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verify_token VARCHAR(64)",
]


async def _calendar_sync_loop():
    """Refresh store calendars on boot, then every 6 hours."""
    while True:
        try:
            await sync_all_stores()
        except Exception:
            logger.warning("calendar sync loop error", exc_info=True)
        await asyncio.sleep(6 * 60 * 60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        for stmt in _COLUMN_MIGRATIONS:
            await conn.execute(text(stmt))
        # One-time cleanup: merge any duplicate deck_cards rows (same printing +
        # zone) into a single row with summed quantity. Idempotent — no-ops once
        # there are no duplicates left.
        await conn.execute(text(
            "UPDATE deck_cards d SET quantity = s.total FROM ("
            " SELECT MIN(id) AS keep_id, SUM(quantity) AS total FROM deck_cards"
            " GROUP BY deck_id, scryfall_id, is_sideboard, is_commander HAVING COUNT(*) > 1"
            ") s WHERE d.id = s.keep_id"
        ))
        await conn.execute(text(
            "DELETE FROM deck_cards d USING ("
            " SELECT id, ROW_NUMBER() OVER (PARTITION BY deck_id, scryfall_id, is_sideboard, is_commander ORDER BY id) AS rn FROM deck_cards"
            ") t WHERE d.id = t.id AND t.rn > 1"
        ))
        # Bootstrap: make the configured email an admin (so there's a first admin).
        if settings.admin_email:
            await conn.execute(
                text("UPDATE users SET is_admin = TRUE WHERE lower(email) = :e"),
                {"e": settings.admin_email.strip().lower()},
            )
        await seed_stores(conn)

    # Periodically sync store calendars (iCal) in the background.
    sync_task = asyncio.create_task(_calendar_sync_loop())
    try:
        yield
    finally:
        sync_task.cancel()


app = FastAPI(
    title="VaultSpell API",
    description="Magic: The Gathering collection manager",
    version="1.0.0",
    lifespan=lifespan,
)

# Rate limiting (per-IP). Decorators live on individual routes; here we just
# register the limiter and the 429 handler.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_logging(request: Request, call_next):
    """Assign a request id, time the request, and log one structured line."""
    rid = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    token = request_id_var.set(rid)
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("request failed", extra={
            "event": "request_error", "method": request.method, "path": request.url.path,
        })
        request_id_var.reset(token)
        raise
    duration_ms = round((time.perf_counter() - start) * 1000, 1)
    if request.url.path != "/api/health":  # don't spam on health pings
        logger.info("request", extra={
            "event": "request", "method": request.method, "path": request.url.path,
            "status": response.status_code, "duration_ms": duration_ms,
        })
    response.headers["X-Request-ID"] = rid
    request_id_var.reset(token)
    return response


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Baseline hardening headers on every response."""
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    if settings.environment == "production":
        response.headers.setdefault(
            "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
        )
    return response

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(cards.router, prefix="/api/cards", tags=["cards"])
app.include_router(collection.router, prefix="/api/collection", tags=["collection"])
app.include_router(binders.router, prefix="/api/binders", tags=["binders"])
app.include_router(decks.router, prefix="/api/decks", tags=["decks"])
app.include_router(wishlist.router, prefix="/api/wishlist", tags=["wishlist"])
app.include_router(sets.router, prefix="/api/sets", tags=["sets"])
app.include_router(friends.router, prefix="/api/friends", tags=["friends"])
app.include_router(shares.router, prefix="/api/shares", tags=["shares"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(feedback.router, prefix="/api/feedback", tags=["feedback"])
app.include_router(listings.router, prefix="/api/listings", tags=["listings"])
app.include_router(billing.router, prefix="/api/billing", tags=["billing"])
app.include_router(events.router, prefix="/api", tags=["events"])
app.include_router(community.router, prefix="/api/community", tags=["community"])
app.include_router(user_events.router, prefix="/api", tags=["user_events"])
app.include_router(flags.router, prefix="/api", tags=["flags"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "VaultSpell API"}


# --- Serve the built frontend (production single-service deploy) ---
if os.path.isdir(STATIC_DIR):
    assets_dir = os.path.join(STATIC_DIR, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    index_file = os.path.join(STATIC_DIR, "index.html")

    static_root = os.path.realpath(STATIC_DIR)

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # API/docs routes are registered above and take precedence; anything
        # else falls back to the SPA so client-side routing works on refresh.
        if full_path.startswith(("api/", "docs", "openapi.json", "redoc")):
            return FileResponse(index_file, status_code=404)
        # Resolve and confine to STATIC_DIR so crafted paths (e.g. ../../etc/passwd)
        # can never escape the static root.
        candidate = os.path.realpath(os.path.join(STATIC_DIR, full_path))
        if (
            full_path
            and (candidate == static_root or candidate.startswith(static_root + os.sep))
            and os.path.isfile(candidate)
        ):
            return FileResponse(candidate)
        return FileResponse(index_file)
