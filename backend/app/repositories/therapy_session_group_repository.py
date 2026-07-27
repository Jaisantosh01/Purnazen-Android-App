import uuid

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.therapy_feedback import TherapyFeedback
from app.models.therapy_session import TherapySession
from app.models.therapy_session_group import TherapySessionGroup
from app.models.video_group_mapping import VideoGroupMapping


class TherapySessionGroupRepository:

    @staticmethod
    def create(db: Session, user_id: uuid.UUID, group_id: uuid.UUID, session_type: str) -> TherapySessionGroup:
        group = TherapySessionGroup(
            user_id=user_id,
            group_id=group_id,
            session_type=session_type,
            status="in_progress",
        )
        db.add(group)
        db.commit()
        db.refresh(group)
        return group

    @staticmethod
    def get_by_id(db: Session, session_group_id: uuid.UUID) -> TherapySessionGroup | None:
        return db.get(TherapySessionGroup, session_group_id)

    @staticmethod
    def get_incomplete_for_user_and_group(
        db: Session, user_id: uuid.UUID, group_id: uuid.UUID
    ) -> TherapySessionGroup | None:
        return (
            db.query(TherapySessionGroup)
            .filter(
                TherapySessionGroup.user_id == user_id,
                TherapySessionGroup.group_id == group_id,
                TherapySessionGroup.status == "in_progress",
            )
            .order_by(TherapySessionGroup.created_at.desc())
            .first()
        )

    @staticmethod
    def get_user_session_groups(
        db: Session, user_id: uuid.UUID, page: int, limit: int, group_id: uuid.UUID | None = None
    ):
        q = db.query(TherapySessionGroup).filter(TherapySessionGroup.user_id == user_id)
        if group_id:
            q = q.filter(TherapySessionGroup.group_id == group_id)
        q = q.order_by(TherapySessionGroup.created_at.desc())

        total = q.count()
        rows = q.offset((page - 1) * limit).limit(limit).all()

        results = []
        for sg in rows:
            d = sg.to_dict()

            total_videos = (
                db.query(VideoGroupMapping)
                .filter(VideoGroupMapping.video_group_id == sg.group_id)
                .count()
            )
            completed_videos = (
                db.query(func.count(TherapySession.id))
                .filter(
                    TherapySession.session_group_id == sg.id,
                    TherapySession.status == "Completed",
                )
                .scalar()
            ) or 0

            feedback = (
                db.query(TherapyFeedback)
                .filter(TherapyFeedback.session_group_id == sg.id)
                .first()
            )

            d["totalVideos"] = total_videos
            d["completedVideos"] = completed_videos
            d["feedback"] = feedback.to_dict() if feedback else None
            results.append(d)

        return results, total

    @staticmethod
    def complete(db: Session, session_group_id: uuid.UUID, pain_after: int | None = None, user_feedback: str | None = None) -> TherapySessionGroup | None:
        sg = db.get(TherapySessionGroup, session_group_id)
        if not sg:
            return None
        sg.status = "completed"
        if pain_after is not None or user_feedback is not None:
            fb = db.query(TherapyFeedback).filter(
                TherapyFeedback.session_group_id == session_group_id
            ).first()
            # A run that was never opened with a pain baseline has no feedback
            # row yet — create one, otherwise the score and remark collected
            # here are dropped on the floor.
            if not fb:
                fb = TherapyFeedback(
                    user_id=sg.user_id,
                    video_group_id=sg.group_id,
                    session_type=sg.session_type,
                    session_group_id=sg.id,
                    created_by=sg.user_id,
                    updated_by=sg.user_id,
                )
                db.add(fb)
            if pain_after is not None:
                fb.pain_after = pain_after
            if user_feedback is not None:
                fb.user_feedback = user_feedback
        db.commit()
        db.refresh(sg)
        return sg
