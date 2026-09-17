import uuid

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
    def list_all(db: Session):
        """Every card, hidden ones included — the admin list."""
        return db.query(QuickRelief).order_by(QuickRelief.sort_order.asc(), QuickRelief.title.asc()).all()

    @staticmethod
    def get_by_id(db: Session, relief_id: uuid.UUID, include_inactive: bool = False) -> QuickRelief | None:
        query = db.query(QuickRelief).filter(QuickRelief.id == relief_id)
        if not include_inactive:
            query = query.filter(QuickRelief.is_active.is_(True))
        return query.first()

    @staticmethod
    def slug_taken(db: Session, slug: str, exclude_id: uuid.UUID | None = None) -> bool:
        query = db.query(QuickRelief.id).filter(QuickRelief.slug == slug)
        if exclude_id is not None:
            query = query.filter(QuickRelief.id != exclude_id)
        return query.first() is not None

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
