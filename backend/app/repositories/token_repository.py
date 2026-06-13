import logging
from datetime import timedelta

import redis as redis_lib
from sqlalchemy.orm import Session

from app.core.cache import get_redis
from app.core.config import settings
from app.models.token_blocklist import TokenBlocklist

logger = logging.getLogger(__name__)

_BLOCKLIST_KEY_PREFIX = "token_blocklist:"

# A revoked jti only matters until the token itself would have expired
_BLOCKLIST_TTL = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)


class TokenRepository:

    @staticmethod
    def add_to_blocklist(db: Session, jti: str):
        db.add(TokenBlocklist(jti=jti))
        db.commit()

        redis_client = get_redis()
        if redis_client is not None:
            try:
                redis_client.setex(f"{_BLOCKLIST_KEY_PREFIX}{jti}", _BLOCKLIST_TTL, "1")
            except redis_lib.RedisError as exc:
                logger.warning("Redis unavailable, blocklist cached in DB only: %s", exc)

    @staticmethod
    def is_token_revoked(db: Session, jti: str) -> bool:
        # Redis hit short-circuits; a miss still checks the DB because the
        # cache may not hold entries written before Redis was configured.
        redis_client = get_redis()
        if redis_client is not None:
            try:
                if redis_client.exists(f"{_BLOCKLIST_KEY_PREFIX}{jti}"):
                    return True
            except redis_lib.RedisError as exc:
                logger.warning("Redis unavailable, falling back to DB: %s", exc)

        return (
            db.query(TokenBlocklist).filter_by(jti=jti).first() is not None
        )
