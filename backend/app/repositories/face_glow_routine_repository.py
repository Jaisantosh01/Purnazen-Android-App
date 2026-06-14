from sqlalchemy.orm import Session

from app.models.face_glow_routine import FaceGlowRoutine


class FaceGlowRoutineRepository:

    @staticmethod
    def get_all(db: Session, active_only: bool = True) -> list[FaceGlowRoutine]:
        q = db.query(FaceGlowRoutine)
        if active_only:
            q = q.filter(FaceGlowRoutine.is_active.is_(True))
        return q.order_by(FaceGlowRoutine.sort_order, FaceGlowRoutine.id).all()

    @staticmethod
    def get_by_key(db: Session, key: str) -> FaceGlowRoutine | None:
        return (
            db.query(FaceGlowRoutine)
            .filter(FaceGlowRoutine.key == key, FaceGlowRoutine.is_active.is_(True))
            .first()
        )
