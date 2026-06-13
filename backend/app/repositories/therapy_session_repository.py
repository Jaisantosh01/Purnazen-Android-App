from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.therapy_session import TherapySession


class TherapySessionRepository:

    @staticmethod
    def create(db: Session, **fields) -> TherapySession:
        session = TherapySession(**fields)
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def get_user_sessions(db: Session, user_id: int, page: int, limit: int):
        query = (
            db.query(TherapySession)
            .filter(TherapySession.user_id == user_id)
            .order_by(TherapySession.completed_at.desc())
        )
        total = query.count()
        sessions = query.offset((page - 1) * limit).limit(limit).all()
        return sessions, total

    @staticmethod
    def get_user_stats(db: Session, user_id: int) -> dict:
        completed = (
            TherapySession.user_id == user_id,
            TherapySession.status == "Completed",
        )

        count, minutes = (
            db.query(
                func.count(TherapySession.id),
                func.coalesce(func.sum(TherapySession.duration_minutes), 0),
            )
            .filter(*completed)
            .first()
        )

        avg_relief = (
            db.query(func.avg(TherapySession.pain_after - TherapySession.pain_before))
            .filter(
                *completed,
                TherapySession.pain_before.isnot(None),
                TherapySession.pain_after.isnot(None),
            )
            .scalar()
        )

        return {
            "sessions": count,
            "minutes": int(minutes),
            "avgRelief": round(avg_relief) if avg_relief is not None else 0,
        }
