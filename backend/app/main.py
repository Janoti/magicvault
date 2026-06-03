import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine, Base
from app.api.routes import auth, cards, collection, binders, decks, wishlist, sets, friends, shares, users, admin, feedback, listings, billing

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
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        for stmt in _COLUMN_MIGRATIONS:
            await conn.execute(text(stmt))
        # Bootstrap: make the configured email an admin (so there's a first admin).
        if settings.admin_email:
            await conn.execute(
                text("UPDATE users SET is_admin = TRUE WHERE lower(email) = :e"),
                {"e": settings.admin_email.strip().lower()},
            )
    yield


app = FastAPI(
    title="VaultSpell API",
    description="Magic: The Gathering collection manager",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "VaultSpell API"}


# --- Serve the built frontend (production single-service deploy) ---
if os.path.isdir(STATIC_DIR):
    assets_dir = os.path.join(STATIC_DIR, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    index_file = os.path.join(STATIC_DIR, "index.html")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # API/docs routes are registered above and take precedence; anything
        # else falls back to the SPA so client-side routing works on refresh.
        if full_path.startswith(("api/", "docs", "openapi.json", "redoc")):
            return FileResponse(index_file, status_code=404)
        candidate = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(index_file)
