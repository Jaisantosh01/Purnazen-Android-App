from sqlalchemy.orm import Session

from app.repositories.session_catalog_repository import (
    ReliefSessionRepository,
    WellnessSessionRepository,
)


class SessionCatalogService:

    @staticmethod
    def get_wellness_sessions(db: Session) -> list[dict]:
        return [s.to_dict() for s in WellnessSessionRepository.get_all(db)]

    @staticmethod
    def get_wellness_session(db: Session, key: str) -> dict | None:
        session = WellnessSessionRepository.get_by_key(db, key)
        return session.to_dict() if session else None

    @staticmethod
    def get_relief_sessions(db: Session) -> list[dict]:
        return [s.to_dict() for s in ReliefSessionRepository.get_all(db)]

    @staticmethod
    def get_relief_session(db: Session, key: str) -> dict | None:
        session = ReliefSessionRepository.get_by_key(db, key)
        return session.to_dict() if session else None
