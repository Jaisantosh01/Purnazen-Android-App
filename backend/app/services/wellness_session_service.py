import uuid

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.wellness_session import WellnessSession
from app.repositories.session_catalog_repository import WellnessSessionRepository
from app.schemas.wellness_session import WellnessSessionCreate, WellnessSessionUpdate


class WellnessSessionService:

    @staticmethod
    def create(db: Session, body: WellnessSessionCreate, user: User) -> WellnessSession:
        session = WellnessSession(
            title=body.title,
            duration=body.duration,
            icon=body.icon,
            video_group_id=body.video_group_id,
            sort_order=body.sort_order or 0,
            is_active=body.is_active if body.is_active is not None else True,
            created_by=user.id,
            updated_by=user.id,
        )
        return WellnessSessionRepository.create(db, session)

    @staticmethod
    def update(db: Session, session_id: uuid.UUID, body: WellnessSessionUpdate, user: User) -> WellnessSession | None:
        session = WellnessSessionRepository.get_by_id(db, session_id)
        if not session:
            return None

        update_data = body.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(session, field, value)

        session.updated_by = user.id
        return WellnessSessionRepository.save(db, session)

    @staticmethod
    def delete(db: Session, session_id: uuid.UUID, user: User) -> WellnessSession | None:
        session = WellnessSessionRepository.get_by_id(db, session_id)
        if not session:
            return None

        session.is_active = False
        session.updated_by = user.id
        return WellnessSessionRepository.save(db, session)
