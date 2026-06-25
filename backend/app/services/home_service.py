from sqlalchemy.orm import Session

from app.repositories.quick_relief_repository import QuickReliefRepository


class HomeService:

    @staticmethod
    def get_quick_reliefs(db: Session):
        items = QuickReliefRepository.get_active_quick_reliefs(db)
        return [item.to_dict() for item in items]
