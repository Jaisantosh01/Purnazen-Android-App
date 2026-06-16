from sqlalchemy.orm import Session

from app.models.expertise import Expertise


class ExpertiseRepository:

    @staticmethod
    def get_all(db: Session):
        return (
            db.query(Expertise)
            .filter(Expertise.is_active.is_(True))
            .all()
        )

    @staticmethod
    def get_by_id(db: Session, expertise_id: int):
        return (
            db.query(Expertise)
            .filter(
                Expertise.id == expertise_id,
                Expertise.is_active.is_(True),
            )
            .first()
        )

    @staticmethod
    def create(db: Session, expertise: Expertise):
        db.add(expertise)
        db.commit()
        db.refresh(expertise)
        return expertise

    @staticmethod
    def save(db: Session, expertise: Expertise):
        db.commit()
        db.refresh(expertise)
        return expertise