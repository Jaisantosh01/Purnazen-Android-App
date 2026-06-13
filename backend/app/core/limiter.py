from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

# Shared limiter. Uses Redis when REDIS_URL is set so limits hold across
# workers; falls back to per-process in-memory storage otherwise.
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.REDIS_URL or "memory://",
    enabled=settings.RATE_LIMIT_ENABLED,
)
