"""One-time content seed (runs only when the stores table is empty)."""
from sqlalchemy import text

# Initial store directory. Other stores are added/managed via the admin panel.
SEED_STORES = [
    {
        "name": "Tower of Cards", "city": "Rio de Janeiro", "neighborhood": "Bangu",
        "address": "Rua Sul América, 1680, Sala 201", "phone": "(21) 97700-2761",
        "instagram": "@towerofcards", "is_wpn": False, "featured": False,
        "notes": "Card games, singles e selados. Torneios de Pauper e Commander.",
    },
]

# created_at is set with CURRENT_TIMESTAMP because a raw INSERT bypasses the
# ORM-side default=datetime.utcnow (the column is NOT NULL).
_INSERT = text(
    "INSERT INTO stores (name, city, neighborhood, address, phone, phone2, email, "
    "website, instagram, is_wpn, featured, notes, created_at) VALUES "
    "(:name, :city, :neighborhood, :address, :phone, :phone2, :email, "
    ":website, :instagram, :is_wpn, :featured, :notes, CURRENT_TIMESTAMP)"
)

_COLS = ["name", "city", "neighborhood", "address", "phone", "phone2",
         "email", "website", "instagram", "is_wpn", "featured", "notes"]


async def seed_stores(conn):
    """Insert the initial store directory only if no stores exist yet."""
    count = (await conn.execute(text("SELECT COUNT(*) FROM stores"))).scalar()
    if count:
        return
    for s in SEED_STORES:
        params = {c: s.get(c) for c in _COLS}
        params["is_wpn"] = bool(s.get("is_wpn"))
        params["featured"] = bool(s.get("featured"))
        await conn.execute(_INSERT, params)
