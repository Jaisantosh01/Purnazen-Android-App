import json
import logging

import redis
from sqlalchemy.orm import Session

from app.core.cache import get_redis
from app.repositories.face_glow_routine_repository import FaceGlowRoutineRepository

logger = logging.getLogger(__name__)

_CACHE_KEY = "face_glow_routines:all"
_CACHE_TTL = 3600  # 1 hour


class FaceGlowRoutineService:

    @staticmethod
    def get_all(db: Session) -> list[dict]:
        client = get_redis()
        if client:
            try:
                cached = client.get(_CACHE_KEY)
                if cached:
                    return json.loads(cached)
            except redis.RedisError:
                logger.warning("Redis unavailable; falling back to DB for routines")

        routines = [r.to_dict() for r in FaceGlowRoutineRepository.get_all(db)]

        if client:
            try:
                client.setex(_CACHE_KEY, _CACHE_TTL, json.dumps(routines))
            except redis.RedisError:
                pass

        return routines

    @staticmethod
    def get_by_key(db: Session, key: str) -> dict | None:
        routine = FaceGlowRoutineRepository.get_by_key(db, key)
        return routine.to_dict() if routine else None
