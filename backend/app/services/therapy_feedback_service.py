import uuid

from sqlalchemy.orm import Session

from app.repositories.therapy_feedback_repository import TherapyFeedbackRepository
from app.schemas.therapy import (CreateTherapyFeedbackRequest,
                                 UpdateAdminFeedbackRequest,
                                 UpdateDoctorFeedbackRequest,
                                 UpdatePainAfterFeedbackRequest)


class TherapyFeedbackService:

    @staticmethod
    def create_feedback(db: Session, user_id: uuid.UUID, data: CreateTherapyFeedbackRequest):
        feedback_data = data.model_dump()
        feedback = TherapyFeedbackRepository.create(db, user_id, feedback_data)
        return feedback.to_dict()

    @staticmethod
    def get_by_user_and_group(db: Session, user_id: uuid.UUID, video_group_id: uuid.UUID):
        feedback = TherapyFeedbackRepository.get_by_user_and_group(db, user_id, video_group_id)
        if not feedback:
            return None
        return feedback.to_dict()

    @staticmethod
    def get_by_session(db: Session, session_group_id: uuid.UUID):
        feedback = TherapyFeedbackRepository.get_by_session(db, session_group_id)
        if not feedback:
            return None
        return feedback.to_dict()

    @staticmethod
    def get_all_by_user_and_group(db: Session, user_id: uuid.UUID, video_group_id: uuid.UUID):
        feedbacks = TherapyFeedbackRepository.get_all_by_user_and_group(db, user_id, video_group_id)
        return [f.to_dict() for f in feedbacks]

    @staticmethod
    def update_pain_after(db: Session, feedback_id: uuid.UUID, user_id: uuid.UUID, data: UpdatePainAfterFeedbackRequest):
        feedback = TherapyFeedbackRepository.update_pain_after(
            db, feedback_id, user_id, data.pain_after, data.user_feedback
        )
        if not feedback:
            return None
        return feedback.to_dict()

    @staticmethod
    def update_doctor_feedback(db: Session, feedback_id: uuid.UUID, doctor_id: uuid.UUID, data: UpdateDoctorFeedbackRequest):
        feedback = TherapyFeedbackRepository.update_doctor_feedback(
            db, feedback_id, doctor_id, data.doctor_feedback
        )
        if not feedback:
            return None
        return feedback.to_dict()

    @staticmethod
    def update_admin_feedback(db: Session, feedback_id: uuid.UUID, admin_id: uuid.UUID, data: UpdateAdminFeedbackRequest):
        feedback = TherapyFeedbackRepository.update_admin_feedback(
            db, feedback_id, admin_id, data.admin_feedback
        )
        if not feedback:
            return None
        return feedback.to_dict()
