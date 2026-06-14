from sqlalchemy.orm import Session

from app.repositories.quick_relief_repository import QuickReliefRepository


class HomeService:

    @staticmethod
    def get_quick_reliefs(db: Session):
        items = QuickReliefRepository.get_active_quick_reliefs(db)

        return [
            {
                "id": item.id,
                "name": item.name,
                "slug": item.slug,
                "title": item.title,
                "subtitle": item.subtitle,
                "icon_name": item.icon_name,
                "icon_url": item.icon_url,
                "background_color": item.background_color,
                "text_color": item.text_color,
            }
            for item in items
        ]
