import uuid

from sqlalchemy.orm import Session

from app.repositories.therapy_session_repository import TherapySessionRepository
from app.schemas.therapy import SaveTherapySessionRequest


class TherapyService:

    @staticmethod
    def save_session(db: Session, user_id: uuid.UUID, data: SaveTherapySessionRequest):
        session_data = data.model_dump()
        return TherapySessionRepository.upsert(db, user_id, session_data)

    @staticmethod
    def get_history(db: Session, user_id: uuid.UUID, page: int, limit: int) -> dict:
        sessions, total = TherapySessionRepository.get_user_sessions(
            db, user_id, page, limit
        )
        return {
            "sessions": sessions,
            "stats": TherapySessionRepository.get_user_stats(db, user_id),
            "total": total,
            "page": page,
            "limit": limit,
        }

    @staticmethod
    def count_completed_by_group(db: Session, user_id: uuid.UUID, group_id: uuid.UUID) -> int:
        return TherapySessionRepository.count_completed_by_group(db, user_id, group_id)
