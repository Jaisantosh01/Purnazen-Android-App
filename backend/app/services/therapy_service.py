import re
from datetime import timezone

from sqlalchemy.orm import Session

from app.repositories.therapy_session_repository import TherapySessionRepository
from app.schemas.therapy import SaveTherapySessionRequest


def _parse_minutes(duration) -> int:
    """Accept 15 or '15 min' (the shape the session screens send)."""
    if isinstance(duration, int):
        return duration
    match = re.search(r"\d+", duration)
    return int(match.group()) if match else 0


class TherapyService:

    @staticmethod
    def save_session(db: Session, user_id: int, data: SaveTherapySessionRequest):
        completed_at = data.date
        if completed_at.tzinfo is not None:
            completed_at = completed_at.astimezone(timezone.utc).replace(tzinfo=None)

        return TherapySessionRepository.create(
            db,
            user_id=user_id,
            title=data.title,
            session_type=data.type,
            duration_minutes=_parse_minutes(data.duration),
            status=data.status,
            pain_before=data.pain_before,
            pain_after=data.pain_after,
            completed_at=completed_at,
        )

    @staticmethod
    def get_history(db: Session, user_id: int, page: int, limit: int) -> dict:
        sessions, total = TherapySessionRepository.get_user_sessions(
            db, user_id, page, limit
        )
        return {
            "sessions": [session.to_dict() for session in sessions],
            "stats": TherapySessionRepository.get_user_stats(db, user_id),
            "total": total,
            "page": page,
            "limit": limit,
        }
