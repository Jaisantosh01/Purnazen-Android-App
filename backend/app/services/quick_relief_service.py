from sqlalchemy.orm import Session

from app.models.quick_relief import QuickRelief
from app.models.user import User
from app.repositories.quick_relief_repository import QuickReliefRepository
from app.schemas.quick_relief import QuickReliefCreate, QuickReliefUpdate


class QuickReliefService:

    @staticmethod
    def create(db: Session, body: QuickReliefCreate, user: User) -> QuickRelief:
        relief = QuickRelief(
            name=body.name,
            slug=body.slug,
            title=body.title,
            subtitle=body.subtitle,
            chat_question_id=body.chat_question_id,
            icon_name=body.icon_name,
            icon_url=body.icon_url,
            background_color=body.background_color,
            text_color=body.text_color,
            description=body.description,
            sort_order=body.sort_order or 0,
            is_active=body.is_active if body.is_active is not None else True,
            created_by=user.id,
        )
        return QuickReliefRepository.create(db, relief)

    @staticmethod
    def update(db: Session, relief_id: int, body: QuickReliefUpdate, user: User) -> QuickRelief | None:
        relief = QuickReliefRepository.get_by_id(db, relief_id)
        if not relief:
            return None

        update_data = body.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(relief, field, value)

        relief.updated_by = user.id
        return QuickReliefRepository.save(db, relief)

    @staticmethod
    def delete(db: Session, relief_id: int, user: User) -> QuickRelief | None:
        relief = QuickReliefRepository.get_by_id(db, relief_id)
        if not relief:
            return None

        relief.is_active = False
        relief.updated_by = user.id
        return QuickReliefRepository.save(db, relief)
