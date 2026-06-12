from app.models.quick_relief_model import QuickRelief


class QuickReliefRepository:

    @staticmethod
    def get_active_quick_reliefs():
        return (
            QuickRelief.query
            .filter_by(is_active=True)
            .order_by(QuickRelief.sort_order.asc())
            .all()
        )