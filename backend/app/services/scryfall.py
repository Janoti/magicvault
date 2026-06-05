"""
Scryfall API integration — https://scryfall.com/docs/api
Free, no auth required, rate limit: 10 req/s
"""
import httpx
from typing import Optional, List, Dict, Any

from app.core.config import settings
from app.core.cache import cache_get, cache_set

BASE = settings.scryfall_api_base


async def _get(url: str, params: dict = None) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        return r.json()


async def _post(url: str, json_body: dict) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(url, json=json_body)
        r.raise_for_status()
        return r.json()


async def get_cards_bulk(scryfall_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """Resolve many cards efficiently: serve from cache, then batch-fetch the rest
    via Scryfall's /cards/collection endpoint (up to 75 ids per request)."""
    result: Dict[str, Dict[str, Any]] = {}
    missing: List[str] = []
    for sid in dict.fromkeys(scryfall_ids):  # de-duplicate, preserve order
        cached = await cache_get(f"scryfall:card:{sid}")
        if cached:
            result[sid] = cached
        else:
            missing.append(sid)

    for i in range(0, len(missing), 75):
        chunk = missing[i:i + 75]
        try:
            data = await _post(f"{BASE}/cards/collection", {"identifiers": [{"id": s} for s in chunk]})
        except Exception:
            continue
        for card in data.get("data", []):
            result[card["id"]] = card
            await cache_set(f"scryfall:card:{card['id']}", card)
    return result


async def search_cards(query: str, page: int = 1) -> Dict[str, Any]:
    """Full-text search using Scryfall syntax."""
    cache_key = f"scryfall:search:{query}:{page}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    data = await _get(f"{BASE}/cards/search", params={"q": query, "page": page, "order": "name"})
    await cache_set(cache_key, data, ttl=3600)
    return data


async def get_card_by_id(scryfall_id: str) -> Optional[Dict[str, Any]]:
    """Get full card data by Scryfall UUID."""
    cache_key = f"scryfall:card:{scryfall_id}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    data = await _get(f"{BASE}/cards/{scryfall_id}")
    await cache_set(cache_key, data)
    return data


async def get_card_by_name(name: str, fuzzy: bool = True) -> Optional[Dict[str, Any]]:
    """Lookup card by exact or fuzzy name."""
    cache_key = f"scryfall:named:{'fuzzy' if fuzzy else 'exact'}:{name.lower()}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    param = "fuzzy" if fuzzy else "exact"
    data = await _get(f"{BASE}/cards/named", params={param: name})
    await cache_set(cache_key, data)
    return data


async def autocomplete_cards(query: str) -> List[str]:
    """Get card name suggestions (for search input)."""
    cache_key = f"scryfall:autocomplete:{query.lower()}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    data = await _get(f"{BASE}/cards/autocomplete", params={"q": query})
    names = data.get("data", [])
    await cache_set(cache_key, names, ttl=86400)
    return names


async def get_sets() -> List[Dict[str, Any]]:
    """List all MTG sets."""
    cache_key = "scryfall:sets"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    data = await _get(f"{BASE}/sets")
    sets_list = data.get("data", [])
    await cache_set(cache_key, sets_list, ttl=86400 * 7)
    return sets_list


async def get_set_cards(set_code: str) -> List[Dict[str, Any]]:
    """Get all cards in a set."""
    cache_key = f"scryfall:set_cards:{set_code}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    all_cards = []
    page = 1
    while True:
        data = await _get(f"{BASE}/cards/search", params={"q": f"set:{set_code}", "page": page})
        all_cards.extend(data.get("data", []))
        if not data.get("has_more"):
            break
        page += 1

    await cache_set(cache_key, all_cards, ttl=86400)
    return all_cards


async def get_card_lang_variant(scryfall_id: str, lang: str) -> Optional[Dict[str, Any]]:
    """The same printing (set + collector number) in another language, or None if
    that language doesn't exist for this card. English returns the base card."""
    base = await get_card_by_id(scryfall_id)
    if not base:
        return None
    if lang == "en" or base.get("lang") == lang:
        return base
    set_code = base.get("set")
    cn = base.get("collector_number")
    if not set_code or not cn:
        return None
    cache_key = f"scryfall:langvar:{set_code}:{cn}:{lang}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached or None  # cached False means "doesn't exist"
    try:
        data = await _get(f"{BASE}/cards/{set_code}/{cn}/{lang}")
        await cache_set(f"scryfall:card:{data['id']}", data)
        await cache_set(cache_key, data)
        return data
    except Exception:
        await cache_set(cache_key, False, ttl=86400)  # remember the miss for a day
        return None


async def get_card_prints(scryfall_id: str) -> List[Dict[str, Any]]:
    """All printings of a card (matched by oracle id), newest first."""
    cache_key = f"scryfall:prints:{scryfall_id}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    card = await get_card_by_id(scryfall_id)
    if not card:
        return []

    oracle_id = card.get("oracle_id")
    prints: List[Dict[str, Any]] = []
    if oracle_id:
        try:
            data = await _get(f"{BASE}/cards/search", params={
                "q": f"oracleid:{oracle_id}", "unique": "prints",
                "order": "released", "dir": "desc",
            })
            prints = data.get("data", [])
            while data.get("has_more") and data.get("next_page"):
                data = await _get(data["next_page"])
                prints.extend(data.get("data", []))
        except Exception:
            prints = []

    if not prints:
        prints = [card]

    await cache_set(cache_key, prints, ttl=86400)
    return prints


def extract_card_summary(card: Dict[str, Any]) -> Dict[str, Any]:
    """Extract the fields we care about from a Scryfall card object."""
    prices = card.get("prices", {})
    image_uris = card.get("image_uris", {})
    purchase = card.get("purchase_uris", {}) or {}

    # Handle double-faced cards
    if not image_uris and card.get("card_faces"):
        image_uris = card["card_faces"][0].get("image_uris", {})

    return {
        "id": card["id"],
        "name": card["name"],
        "set": card.get("set", ""),
        "set_name": card.get("set_name", ""),
        "collector_number": card.get("collector_number", ""),
        "mana_cost": card.get("mana_cost") or (card.get("card_faces", [{}])[0].get("mana_cost", "")),
        "type_line": card.get("type_line", ""),
        "oracle_text": card.get("oracle_text") or (card.get("card_faces", [{}])[0].get("oracle_text", "")),
        "colors": card.get("colors", []),
        "color_identity": card.get("color_identity", []),
        "rarity": card.get("rarity", ""),
        "cmc": card.get("cmc", 0),
        "power": card.get("power"),
        "toughness": card.get("toughness"),
        "loyalty": card.get("loyalty"),
        "image_small": image_uris.get("small", ""),
        "image_normal": image_uris.get("normal", ""),
        "image_large": image_uris.get("large", ""),
        "art_crop": image_uris.get("art_crop", ""),
        "price_usd": float(prices.get("usd") or 0),
        "price_usd_foil": float(prices.get("usd_foil") or 0),
        "price_eur": float(prices.get("eur") or 0),
        "finishes": card.get("finishes", []),
        "lang": card.get("lang", "en"),
        "scryfall_uri": card.get("scryfall_uri", ""),
        # Official store page with the live price (TCGplayer in USD, else Cardmarket in EUR).
        "purchase_uri": purchase.get("tcgplayer") or purchase.get("cardmarket") or card.get("scryfall_uri", ""),
        "legalities": card.get("legalities", {}),
        "released_at": card.get("released_at", ""),
        "artist": card.get("artist", ""),
        "flavor_text": card.get("flavor_text"),
    }
