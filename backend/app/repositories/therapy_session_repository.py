import uuid
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.therapy_session import TherapySession
from app.models.videos import Videos as Video
from app.models.video_groups import VideoGroups as VideoGroup
from app.models.video_group_mapping import VideoGroupMapping


class TherapySessionRepository:

    @staticmethod
    def upsert(db: Session, user_id: uuid.UUID, data: dict) -> TherapySession:
        if "type" in data:
            data["session_type"] = data.pop("type")

        f = [
            TherapySession.user_id == user_id,
            TherapySession.group_id == data["group_id"],
            TherapySession.video_id == data["video_id"],
            TherapySession.session_type == data["session_type"],
        ]
        session_group_id = data.get("session_group_id")
        if session_group_id:
            f.append(TherapySession.session_group_id == session_group_id)

        session = db.query(TherapySession).filter(*f).first()

        if session:
            for key, value in data.items():
                setattr(session, key, value)
            session.updated_by = user_id
        else:
            session = TherapySession(**data, user_id=user_id, created_by=user_id, updated_by=user_id)
            db.add(session)

        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def get_user_sessions(db: Session, user_id: uuid.UUID, page: int, limit: int):
        # Query sessions and join with related tables for additional info
        query = (
            db.query(TherapySession)
            .filter(TherapySession.user_id == user_id)
            .order_by(TherapySession.updated_at.desc())
        )
        total = query.count()
        sessions = query.offset((page - 1) * limit).limit(limit).all()

        results = []
        for session in sessions:
            # Query counts using VideoGroupMapping
            total_videos_in_group = db.query(VideoGroupMapping).filter(VideoGroupMapping.video_group_id == session.group_id).count()
            total_sessions_in_group = (
                db.query(TherapySession)
                .filter(TherapySession.user_id == user_id, TherapySession.group_id == session.group_id)
                .count()
            )

            data = session.to_dict()
            data["totalVideosInGroup"] = total_videos_in_group
            data["totalSessionsInGroup"] = total_sessions_in_group
            results.append(data)

        return results, total

    @staticmethod
    def count_completed_by_group(db: Session, user_id: uuid.UUID, group_id: uuid.UUID) -> int:
        return (
            db.query(func.count(TherapySession.id))
            .filter(
                TherapySession.user_id == user_id,
                TherapySession.group_id == group_id,
                TherapySession.status == "Completed",
            )
            .scalar()
        ) or 0

    @staticmethod
    def get_user_stats(db: Session, user_id: uuid.UUID) -> dict:
        completed = (
            TherapySession.user_id == user_id,
            TherapySession.status == "Completed",
        )

        count, minutes = (
            db.query(
                func.count(TherapySession.id),
                func.coalesce(func.sum(TherapySession.duration_minutes), 0),
            )
            .filter(*completed)
            .first()
        )

        return {
            "sessions": count,
            "minutes": int(minutes),
        }
