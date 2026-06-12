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
