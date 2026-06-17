from sqlalchemy.orm import Session

from app.models.specialty import Specialty


class SpecialtyRepository:

    @staticmethod
    def get_all(db: Session):
        return (
            db.query(Specialty)
            .filter(Specialty.is_active.is_(True))
            .all()
        )

    @staticmethod
    def get_by_id(db: Session, specialty_id: int):
        return (
            db.query(Specialty)
            .filter(
                Specialty.id == specialty_id,
                Specialty.is_active.is_(True),
            )
            .first()
        )

    @staticmethod
    def create(db: Session, specialty: Specialty):
        db.add(specialty)
        db.commit()
        db.refresh(specialty)
        return specialty

    @staticmethod
    def save(db: Session, specialty: Specialty):
        db.commit()
        db.refresh(specialty)
        return specialty