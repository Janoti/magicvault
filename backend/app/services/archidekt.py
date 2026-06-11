"""Browse public decks from Archidekt (https://archidekt.com) via their public
JSON API. Cached, and fails gracefully if Archidekt changes its format.

Endpoints used:
  - GET /api/decks/v3/?deckFormat={id}&orderBy={order}&page={n}&pageSize={n}
  - GET /api/decks/{id}/
"""
import json
import logging
import httpx

from app.core.cache import cache_get, cache_set

logger = logging.getLogger(__name__)

BASE = "https://archidekt.com/api"
_HEADERS = {"User-Agent": "VaultSpell/1.0", "Accept": "application/json"}

# Archidekt numeric deckFormat IDs (verified against the live API).
FORMATS: dict[int, str] = {
    3: "Commander", 1: "Standard", 2: "Modern", 15: "Pioneer", 6: "Pauper",
    4: "Legacy", 5: "Vintage", 13: "Brawl", 14: "Oathbreaker", 17: "Pauper EDH",
    22: "Premodern",
}
ORDERS = {"popular": "-viewCount", "recent": "-createdAt", "updated": "-updatedAt"}
PAGE_SIZE = 24


def _plain_description(desc: str | None) -> str | None:
    """Archidekt stores the description as a Quill Delta JSON ({"ops":[...]}).
    Flatten it to plain text; pass through anything that's already plain text."""
    if not desc:
        return None
    s = desc.strip()
    if s.startswith("{") and '"ops"' in s:
        try:
            ops = json.loads(s).get("ops", [])
            text = "".join(op["insert"] for op in ops if isinstance(op.get("insert"), str)).strip()
            return text or None
        except Exception:
            return None  # malformed rich text — better nothing than raw JSON
    return desc


def _colors(c: dict | None) -> list[str]:
    if not isinstance(c, dict):
        return []
    return [k for k in ("W", "U", "B", "R", "G") if (c.get(k) or 0) > 0]


def _deck_summary(r: dict) -> dict:
    fmt = r.get("deckFormat")
    return {
        "id": r.get("id"),
        "name": r.get("name") or "—",
        "format": FORMATS.get(fmt, "Other"),
        "size": r.get("size"),
        "views": r.get("viewCount") or 0,
        "art": r.get("featured") or None,
        "colors": _colors(r.get("colors")),
        "updated_at": r.get("updatedAt"),
        "owner": (r.get("owner") or {}).get("username"),
        "owner_avatar": (r.get("owner") or {}).get("avatar"),
        "url": f"https://archidekt.com/decks/{r.get('id')}",
    }


async def search_decks(format_id: int, order: str = "popular", page: int = 1) -> dict:
    order_by = ORDERS.get(order, ORDERS["popular"])
    page = max(1, min(page, 40))
    cache_key = f"archidekt:decks:{format_id}:{order_by}:{page}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    out = {"decks": [], "page": page, "has_more": False}
    try:
        url = (f"{BASE}/decks/v3/?deckFormat={format_id}&orderBy={order_by}"
               f"&page={page}&pageSize={PAGE_SIZE}")
        async with httpx.AsyncClient(timeout=12.0) as client:
            r = await client.get(url, headers=_HEADERS)
        if r.status_code == 200:
            data = r.json()
            out["decks"] = [_deck_summary(d) for d in (data.get("results") or [])]
            out["has_more"] = bool(data.get("next"))
    except Exception as e:
        logger.warning("Archidekt search failed (fmt=%s page=%s): %s", format_id, page, e)

    await cache_set(cache_key, out, ttl=60 * 30)  # 30 min
    return out


async def get_deck(deck_id: int) -> dict | None:
    cache_key = f"archidekt:deck:{deck_id}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            r = await client.get(f"{BASE}/decks/{deck_id}/", headers=_HEADERS)
        if r.status_code != 200:
            return None
        data = r.json()
    except Exception as e:
        logger.warning("Archidekt deck %s fetch failed: %s", deck_id, e)
        return None

    cards = []
    for c in data.get("cards") or []:
        card = c.get("card") or {}
        oracle = card.get("oracleCard") or {}
        name = oracle.get("name") or card.get("displayName")
        if not name:
            continue
        cats = c.get("categories") or []
        cards.append({
            "name": name,
            "qty": c.get("quantity") or 1,
            "category": cats[0] if cats else "Outros",
            "scryfall_id": card.get("uid"),
            "mana_cost": oracle.get("manaCost"),
            "cmc": oracle.get("cmc"),
            "type": (oracle.get("types") or [None])[0],
        })

    owner = data.get("owner") or {}
    out = {
        "id": data.get("id"),
        "name": data.get("name") or "—",
        "format": FORMATS.get(data.get("deckFormat"), "Other"),
        "views": data.get("viewCount") or 0,
        "art": data.get("featured") or None,
        "colors": _colors(data.get("colors")),
        "description": _plain_description(data.get("description")),
        "owner": owner.get("username"),
        "owner_avatar": owner.get("avatar"),
        "updated_at": data.get("updatedAt"),
        "created_at": data.get("createdAt"),
        "url": f"https://archidekt.com/decks/{data.get('id')}",
        "cards": cards,
    }
    await cache_set(cache_key, out, ttl=60 * 60 * 6)  # 6h
    return out
