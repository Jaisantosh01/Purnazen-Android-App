import uuid

from sqlalchemy.orm import Session

from app.models.quick_relief import QuickRelief
from app.models.user import User
from app.repositories.quick_relief_repository import QuickReliefRepository
from app.schemas.quick_relief import QuickReliefCreate, QuickReliefUpdate


class DuplicateSlugError(ValueError):
    pass


class QuickReliefService:

    @staticmethod
    def list_all(db: Session) -> list[dict]:
        return [r.to_dict() for r in QuickReliefRepository.list_all(db)]

    @staticmethod
    def create(db: Session, body: QuickReliefCreate, user: User) -> QuickRelief:
        if QuickReliefRepository.slug_taken(db, body.slug):
            raise DuplicateSlugError(f"A card with the slug '{body.slug}' already exists")
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
    def update(db: Session, relief_id: uuid.UUID, body: QuickReliefUpdate, user: User) -> QuickRelief | None:
        # Hidden cards stay editable, so an admin can switch them back on.
        relief = QuickReliefRepository.get_by_id(db, relief_id, include_inactive=True)
        if not relief:
            return None

        update_data = body.model_dump(exclude_unset=True)
        if "slug" in update_data and QuickReliefRepository.slug_taken(db, update_data["slug"], relief.id):
            raise DuplicateSlugError(f"A card with the slug '{update_data['slug']}' already exists")
        for field, value in update_data.items():
            setattr(relief, field, value)

        relief.updated_by = user.id
        return QuickReliefRepository.save(db, relief)

    @staticmethod
    def delete(db: Session, relief_id: uuid.UUID, user: User) -> QuickRelief | None:
        relief = QuickReliefRepository.get_by_id(db, relief_id)
        if not relief:
            return None

        relief.is_active = False
        relief.updated_by = user.id
        return QuickReliefRepository.save(db, relief)
