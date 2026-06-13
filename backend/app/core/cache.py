import logging

import redis

from app.core.config import settings

logger = logging.getLogger(__name__)

_client: redis.Redis | None = None


def get_redis() -> redis.Redis | None:
    """Lazily build the Redis client, or None when REDIS_URL is not configured.

    Callers must treat Redis as an optional cache: catch redis.RedisError and
    fall back to the database, which stays the source of truth.
    """
    global _client
    if not settings.REDIS_URL:
        return None
    if _client is None:
        _client = redis.Redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=1,
            socket_timeout=1,
        )
    return _client
