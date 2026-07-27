import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.repositories.therapy_session_repository import TherapySessionRepository
from app.repositories.therapy_session_group_repository import TherapySessionGroupRepository
from app.schemas.therapy import SaveTherapySessionRequest


class TherapyService:

    @staticmethod
    def save_session(db: Session, user_id: uuid.UUID, data: SaveTherapySessionRequest):
        session_data = data.model_dump()
        session = TherapySessionRepository.upsert(db, user_id, session_data)

        # Auto-complete the session group when the last video in the group is
        # marked "Completed" — no frontend timing issues this way.
        if session.status == "Completed" and session.session_group_id:
            TherapyService._auto_complete_if_done(db, session)

        return session

    @staticmethod
    def _auto_complete_if_done(db: Session, session):
        from app.models.therapy_session import TherapySession
        from app.models.video_group_mapping import VideoGroupMapping
        from sqlalchemy import func

        total = (
            db.query(func.count(VideoGroupMapping.id))
            .filter(VideoGroupMapping.video_group_id == session.group_id)
            .scalar()
        ) or 0

        completed = (
            db.query(func.count(TherapySession.id))
            .filter(
                TherapySession.session_group_id == session.session_group_id,
                TherapySession.status == "Completed",
            )
            .scalar()
        ) or 0

        if completed >= total:
            TherapySessionGroupRepository.complete(db, session.session_group_id)

    @staticmethod
    def get_history(db: Session, user_id: uuid.UUID, page: int, limit: int) -> dict:
        sessions, total = TherapySessionRepository.get_user_sessions(
            db, user_id, page, limit
        )
        return {
            "sessions": sessions,
            "stats": TherapySessionRepository.get_user_stats(db, user_id),
            "total": total,
            "page": page,
            "limit": limit,
        }

    @staticmethod
    def count_completed_by_group(
        db: Session,
        user_id: uuid.UUID,
        group_id: uuid.UUID,
        session_group_id: uuid.UUID | None = None,
    ) -> int:
        return TherapySessionRepository.count_completed_by_group(
            db, user_id, group_id, session_group_id
        )

    @staticmethod
    def start_session(db: Session, user_id: uuid.UUID, group_id: uuid.UUID, session_type: str) -> dict:
        sg = TherapySessionGroupRepository.create(db, user_id, group_id, session_type)
        return sg.to_dict()

    @staticmethod
    def get_incomplete_session(db: Session, user_id: uuid.UUID, group_id: uuid.UUID) -> dict | None:
        sg = TherapySessionGroupRepository.get_incomplete_for_user_and_group(db, user_id, group_id)
        if not sg:
            return None

        d = sg.to_dict()
        from app.models.video_group_mapping import VideoGroupMapping
        from app.models.therapy_session import TherapySession
        from sqlalchemy import func

        total = (
            db.query(func.count(VideoGroupMapping.id))
            .filter(VideoGroupMapping.video_group_id == sg.group_id)
            .scalar()
        ) or 0
        completed = (
            db.query(func.count(TherapySession.id))
            .filter(
                TherapySession.session_group_id == sg.id,
                TherapySession.status == "Completed",
            )
            .scalar()
        ) or 0
        d["totalVideos"] = total
        d["completedVideos"] = completed
        return d

    @staticmethod
    def list_session_groups(
        db: Session, user_id: uuid.UUID, page: int, limit: int, group_id: uuid.UUID | None = None
    ) -> dict:
        results, total = TherapySessionGroupRepository.get_user_session_groups(
            db, user_id, page, limit, group_id
        )
        return {
            "sessions": results,
            "total": total,
            "page": page,
            "limit": limit,
        }

    @staticmethod
    def complete_session(db: Session, user_id: uuid.UUID, session_group_id: uuid.UUID, pain_after: int | None = None, user_feedback: str | None = None) -> dict | None:
        sg = TherapySessionGroupRepository.complete(db, session_group_id, pain_after, user_feedback)
        if not sg:
            return None

        d = sg.to_dict()
        from app.models.video_group_mapping import VideoGroupMapping
        from app.models.therapy_session import TherapySession
        from sqlalchemy import func

        total = (
            db.query(func.count(VideoGroupMapping.id))
            .filter(VideoGroupMapping.video_group_id == sg.group_id)
            .scalar()
        ) or 0
        d["totalVideos"] = total
        return d
