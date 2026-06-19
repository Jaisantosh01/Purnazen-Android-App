from sqlalchemy.orm import Session

from app.models.quick_relief import QuickRelief


class QuickReliefRepository:

    @staticmethod
    def get_active_quick_reliefs(db: Session):
        return (
            db.query(QuickRelief)
            .filter_by(is_active=True)
            .order_by(QuickRelief.sort_order.asc())
            .all()
        )

    @staticmethod
    def get_by_id(db: Session, relief_id: int) -> QuickRelief | None:
        return (
            db.query(QuickRelief)
            .filter(QuickRelief.id == relief_id, QuickRelief.is_active.is_(True))
            .first()
        )

    @staticmethod
    def get_by_slug(db: Session, slug: str) -> QuickRelief | None:
        return (
            db.query(QuickRelief)
            .filter(QuickRelief.slug == slug, QuickRelief.is_active.is_(True))
            .first()
        )

    @staticmethod
    def create(db: Session, relief: QuickRelief) -> QuickRelief:
        db.add(relief)
        db.commit()
        db.refresh(relief)
        return relief

    @staticmethod
    def save(db: Session, relief: QuickRelief) -> QuickRelief:
        db.commit()
        db.refresh(relief)
        return relief
