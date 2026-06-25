import uuid

from sqlalchemy.orm import Session

from app.models.relief_session import ReliefSession
from app.models.wellness_session import WellnessSession


class WellnessSessionRepository:

    @staticmethod
    def get_all(db: Session) -> list[WellnessSession]:
        return (
            db.query(WellnessSession)
            .filter(WellnessSession.is_active.is_(True))
            .order_by(WellnessSession.sort_order, WellnessSession.id)
            .all()
        )

    @staticmethod
    def get_by_id(db: Session, session_id: uuid.UUID) -> WellnessSession | None:
        return (
            db.query(WellnessSession)
            .filter(WellnessSession.id == session_id, WellnessSession.is_active.is_(True))
            .first()
        )

    @staticmethod
    def create(db: Session, session: WellnessSession) -> WellnessSession:
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def save(db: Session, session: WellnessSession) -> WellnessSession:
        db.commit()
        db.refresh(session)
        return session


class ReliefSessionRepository:

    @staticmethod
    def get_all(db: Session) -> list[ReliefSession]:
        return (
            db.query(ReliefSession)
            .filter(ReliefSession.is_active.is_(True))
            .order_by(ReliefSession.sort_order, ReliefSession.id)
            .all()
        )

    @staticmethod
    def get_by_key(db: Session, key: str) -> ReliefSession | None:
        return (
            db.query(ReliefSession)
            .filter(ReliefSession.key == key, ReliefSession.is_active.is_(True))
            .first()
        )
