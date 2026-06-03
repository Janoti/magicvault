"""USD→BRL exchange rate, cached for a day. Scryfall prices are in USD/EUR only,
so we convert client-side using this rate to show an approximate BRL value."""
import logging
import httpx

from app.core.cache import cache_get, cache_set

logger = logging.getLogger(__name__)

_CACHE_KEY = "fx:usd_brl"
_TTL = 60 * 60 * 12  # 12h
_FALLBACK = 5.0      # used only if the FX API is unreachable


async def get_usd_brl() -> float:
    """Current USD→BRL rate (approximate). Best-effort with a daily cache."""
    cached = await cache_get(_CACHE_KEY)
    if cached:
        return float(cached)
    rate = _FALLBACK
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get("https://open.er-api.com/v6/latest/USD")
            r.raise_for_status()
            data = r.json()
            rate = float(data["rates"]["BRL"])
    except Exception as e:
        logger.warning("FX fetch failed (%s); using fallback %.2f", e, rate)
    await cache_set(_CACHE_KEY, rate, ttl=_TTL)
    return rate
