"""EDHREC recommendations (unofficial JSON API). Returns the names of cards that
most often appear alongside a given commander. Cached, and fails gracefully if
EDHREC changes its format."""
import re
import logging
import httpx

from app.core.cache import cache_get, cache_set

logger = logging.getLogger(__name__)


def edhrec_slug(name: str) -> str:
    s = name.split("//")[0].strip().lower()
    s = s.replace("'", "").replace("’", "")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


async def commander_recommendations(commander_name: str) -> list[str]:
    """Card names recommended for a commander, ordered by relevance."""
    slug = edhrec_slug(commander_name)
    if not slug:
        return []
    cache_key = f"edhrec:{slug}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    names: list[str] = []
    try:
        url = f"https://json.edhrec.com/pages/commanders/{slug}.json"
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(url, headers={"User-Agent": "VaultSpell/1.0"})
        if r.status_code == 200:
            data = r.json()
            cardlists = (data.get("container", {}).get("json_dict", {}) or {}).get("cardlists", []) or []
            for cl in cardlists:
                for cv in cl.get("cardviews", []) or []:
                    nm = cv.get("name")
                    if nm:
                        names.append(nm)
    except Exception as e:
        logger.warning("EDHREC fetch failed for %s: %s", slug, e)

    # De-duplicate, keep order.
    seen, out = set(), []
    for n in names:
        k = n.lower()
        if k not in seen:
            seen.add(k)
            out.append(n)

    await cache_set(cache_key, out, ttl=60 * 60 * 24)  # 1 day
    return out
