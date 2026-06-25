from sqlalchemy.orm import Session

from app.repositories.session_catalog_repository import (
    ReliefSessionRepository,
    WellnessSessionRepository,
)
from app.utils.azure_storage import generate_sas_url


class SessionCatalogService:

    @staticmethod
    def _process_session_data(data: dict):
        if data.get("videoUrl"):
            data["videoUrl"] = generate_sas_url(data["videoUrl"])
        print(f"[SESSION_VIDEO_URL] {data.get('title')}: {data.get('videoUrl')}")
        return data

    @staticmethod
    def get_wellness_sessions(db: Session) -> list[dict]:
        # to_dict() in WellnessSession now returns videoGroupId
        return [s.to_dict() for s in WellnessSessionRepository.get_all(db)]

    @staticmethod
    def get_relief_sessions(db: Session) -> list[dict]:
        return [
            SessionCatalogService._process_session_data(s.to_dict()) 
            for s in ReliefSessionRepository.get_all(db)
        ]

    @staticmethod
    def get_relief_session(db: Session, key: str) -> dict | None:
        session = ReliefSessionRepository.get_by_key(db, key)
        return SessionCatalogService._process_session_data(session.to_dict()) if session else None
