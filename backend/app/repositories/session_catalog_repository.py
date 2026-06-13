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
    def get_by_key(db: Session, key: str) -> WellnessSession | None:
        return (
            db.query(WellnessSession)
            .filter(WellnessSession.key == key, WellnessSession.is_active.is_(True))
            .first()
        )


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
