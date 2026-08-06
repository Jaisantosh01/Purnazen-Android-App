import uuid

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.wellness_session import WellnessSession
from app.repositories.session_catalog_repository import WellnessSessionRepository
from app.repositories.video_repository import VideoRepository
from app.schemas.wellness_session import WellnessSessionCreate, WellnessSessionUpdate


class WellnessSessionService:

    @staticmethod
    def _calculate_duration(db: Session, video_group_id: uuid.UUID | None) -> str:
        if not video_group_id:
            return '0'
        videos = VideoRepository.get_by_group(db, video_group_id)
        total_secs = sum((v.duration or 0) for v in videos)
        mins = total_secs // 60
        secs = total_secs % 60
        if mins > 0 and secs > 0:
            return f'{mins} min {secs} sec'
        if mins > 0:
            return f'{mins} min'
        return f'{secs} sec'

    @staticmethod
    def create(db: Session, body: WellnessSessionCreate, user: User) -> WellnessSession:
        duration = body.duration or WellnessSessionService._calculate_duration(db, body.video_group_id)
        session = WellnessSession(
            title=body.title,
            duration=duration,
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

        if 'duration' not in update_data and 'video_group_id' in update_data:
            new_group_id = update_data['video_group_id']
            update_data['duration'] = WellnessSessionService._calculate_duration(db, new_group_id)

        for field, value in update_data.items():
            setattr(session, field, value)

        session.updated_by = user.id
        return WellnessSessionRepository.save(db, session)

    @staticmethod
    def delete(
        db: Session, session_id: uuid.UUID, user: User, hard: bool = False
    ) -> WellnessSession | None:
        session = WellnessSessionRepository.get_by_id(db, session_id)
        if not session:
            return None

        if hard:
            # Nothing references wellness_sessions, so the row can just go. The
            # video group it pointed at is untouched.
            db.delete(session)
            db.commit()
            return session

        session.is_active = False
        session.updated_by = user.id
        return WellnessSessionRepository.save(db, session)
