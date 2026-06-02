import json
import logging
from typing import Optional, Any
import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger(__name__)

_redis: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def cache_get(key: str) -> Optional[Any]:
    """Best-effort read. Returns None (cache miss) if Redis is unavailable."""
    try:
        r = await get_redis()
        val = await r.get(key)
        return json.loads(val) if val else None
    except Exception as e:  # connection refused, timeout, etc.
        logger.warning("cache_get failed (%s); serving without cache", e)
        return None


async def cache_set(key: str, value: Any, ttl: int = settings.scryfall_cache_ttl):
    """Best-effort write. Silently skips if Redis is unavailable."""
    try:
        r = await get_redis()
        await r.setex(key, ttl, json.dumps(value))
    except Exception as e:
        logger.warning("cache_set failed (%s); skipping cache write", e)


async def cache_delete(key: str):
    try:
        r = await get_redis()
        await r.delete(key)
    except Exception as e:
        logger.warning("cache_delete failed (%s)", e)
