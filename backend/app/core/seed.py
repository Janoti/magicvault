"""One-time content seed (runs only when the stores table is empty)."""
from sqlalchemy import text

# Initial RJ/SP store directory. Edited/extended later via the admin panel.
SEED_STORES = [
    {
        "name": "Cards of Paradise", "city": "Rio de Janeiro", "neighborhood": "Vila da Penha",
        "address": "Av. Meriti, 908 — CEP 21211-006", "phone": "(21) 99985-8001", "phone2": "(21) 95919-4344",
        "email": "vendas@cardsofparadise.com.br", "website": "https://cardsofparadise.com.br",
        "instagram": "@cardsofparadise", "is_wpn": True, "featured": True,
        "notes": "Loja WPN 2025, foco em eventos e torneios.",
    },
    {
        "name": "Tower of Cards", "city": "Rio de Janeiro", "neighborhood": "Bangu",
        "address": "Rua Sul América, 1680, Sala 201", "phone": "(21) 97700-2761",
        "instagram": "@towerofcards", "is_wpn": False, "featured": False,
        "notes": "Card games, singles e selados. Torneios de Pauper e Commander.",
    },
    {
        "name": "Universo Lúmina", "city": "Rio de Janeiro", "neighborhood": "Bonsucesso / Maré",
        "instagram": "@mtguniversolumina", "is_wpn": False, "featured": False,
        "notes": "Grupo de MTG e card games para Bonsucesso, Maré e adjacências.",
    },
    {
        "name": "Bazar de Bagdá", "city": "São Paulo", "neighborhood": "Santana",
        "address": "Rua Dr. Gabriel Piza, 463 (perto do Metrô Santana)",
        "instagram": "@bazardebagda", "is_wpn": True, "featured": True,
        "notes": "Maior estoque de singles do Brasil, WPN Premium, torneios de segunda a sexta. "
                 "Formatos: Standard, Modern, Commander, Pauper, PreModern.",
    },
    {
        "name": "Omniverse", "city": "São Paulo", "website": "https://omniverse.com.br",
        "is_wpn": False, "featured": False,
        "notes": "FNM Standard com inscrição gratuita, foco em comunidade. Vende online e físico.",
    },
    {
        "name": "MTGCards", "city": "São Paulo", "neighborhood": "Freguesia do Ó",
        "address": "R. Valentim de Barros, 142", "is_wpn": False, "featured": False,
        "notes": "Cartas avulsas e selados.",
    },
]

_INSERT = text(
    "INSERT INTO stores (name, city, neighborhood, address, phone, phone2, email, "
    "website, instagram, is_wpn, featured, notes) VALUES "
    "(:name, :city, :neighborhood, :address, :phone, :phone2, :email, "
    ":website, :instagram, :is_wpn, :featured, :notes)"
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
