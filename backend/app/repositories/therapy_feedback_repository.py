import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.models.therapy_feedback import TherapyFeedback


class TherapyFeedbackRepository:

    @staticmethod
    def create(db: Session, user_id: uuid.UUID, data: dict) -> TherapyFeedback:
        feedback = TherapyFeedback(**data, user_id=user_id, created_by=user_id, updated_by=user_id)
        db.add(feedback)
        db.commit()
        db.refresh(feedback)
        return feedback

    @staticmethod
    def get_by_id(db: Session, feedback_id: uuid.UUID) -> TherapyFeedback | None:
        return db.query(TherapyFeedback).filter(TherapyFeedback.id == feedback_id).first()

    @staticmethod
    def get_by_user_and_group(db: Session, user_id: uuid.UUID, video_group_id: uuid.UUID) -> TherapyFeedback | None:
        return (
            db.query(TherapyFeedback)
            .filter(
                TherapyFeedback.user_id == user_id,
                TherapyFeedback.video_group_id == video_group_id,
            )
            .first()
        )

    @staticmethod
    def get_by_session(db: Session, session_group_id: uuid.UUID) -> TherapyFeedback | None:
        return (
            db.query(TherapyFeedback)
            .filter(TherapyFeedback.session_group_id == session_group_id)
            .first()
        )

    @staticmethod
    def get_all_by_user_and_group(db: Session, user_id: uuid.UUID, video_group_id: uuid.UUID):
        return (
            db.query(TherapyFeedback)
            .filter(
                TherapyFeedback.user_id == user_id,
                TherapyFeedback.video_group_id == video_group_id,
            )
            .order_by(TherapyFeedback.created_at.desc())
            .all()
        )

    @staticmethod
    def update_pain_after(db: Session, feedback_id: uuid.UUID, user_id: uuid.UUID, pain_after: int, user_feedback: str | None) -> TherapyFeedback | None:
        feedback = TherapyFeedbackRepository.get_by_id(db, feedback_id)
        if not feedback:
            return None
        feedback.pain_after = pain_after
        feedback.user_feedback = user_feedback
        feedback.updated_by = user_id
        db.commit()
        db.refresh(feedback)
        return feedback

    @staticmethod
    def update_doctor_feedback(db: Session, feedback_id: uuid.UUID, doctor_id: uuid.UUID, doctor_feedback: str) -> TherapyFeedback | None:
        feedback = TherapyFeedbackRepository.get_by_id(db, feedback_id)
        if not feedback:
            return None
        feedback.doctor_feedback = doctor_feedback
        feedback.doctor_feedback_by = doctor_id
        feedback.updated_by = doctor_id
        db.commit()
        db.refresh(feedback)
        return feedback

    @staticmethod
    def update_admin_feedback(db: Session, feedback_id: uuid.UUID, admin_id: uuid.UUID, admin_feedback: str) -> TherapyFeedback | None:
        feedback = TherapyFeedbackRepository.get_by_id(db, feedback_id)
        if not feedback:
            return None
        feedback.admin_feedback = admin_feedback
        feedback.admin_feedback_by = admin_id
        feedback.updated_by = admin_id
        db.commit()
        db.refresh(feedback)
        return feedback
