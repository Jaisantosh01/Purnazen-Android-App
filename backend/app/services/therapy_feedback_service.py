import uuid

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.therapy_feedback import TherapyFeedback

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
    def get_by_session(db: Session, session_group_id: uuid.UUID, user_id: uuid.UUID):
        feedback = TherapyFeedbackRepository.get_by_session(db, session_group_id, user_id)
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

    # ── Staff review (doctor app, admin app) ────────────────────────────────

    REVIEW_STATUSES = ("all", "pending", "reviewed")

    @staticmethod
    def doctor_patient_ids(db: Session, doctor_user_id: uuid.UUID) -> set | None:
        """Patients a doctor may review: anyone with a non-cancelled appointment
        with them. None when the account has no doctor profile."""
        doctor = db.query(Doctor).filter(Doctor.user_id == doctor_user_id).first()
        if not doctor:
            return None
        rows = (
            db.query(Appointment.user_id)
            .filter(Appointment.doctor_id == doctor.id, Appointment.status != "cancelled")
            .distinct()
            .all()
        )
        return {r[0] for r in rows}

    @staticmethod
    def _review_item(f: TherapyFeedback) -> dict:
        item = f.to_dict()
        delta = None
        if f.pain_before is not None and f.pain_after is not None:
            delta = f.pain_before - f.pain_after
        item.update({
            "patientName": f.user.full_name if f.user else None,
            "patientAvatarUrl": f.user.avatar if f.user else None,
            "programTitle": f.video_group.title if f.video_group else None,
            "painRelief": delta,  # positive = pain went down
            "doctorFeedbackByName": f.doctor_feedback_user.full_name if f.doctor_feedback_user else None,
            "adminFeedbackByName": f.admin_feedback_user.full_name if f.admin_feedback_user else None,
        })
        return item

    @staticmethod
    def list_for_review(
        db: Session,
        *,
        reviewer: str,
        status: str = "all",
        patient_ids: set | None = None,
        patient_id: uuid.UUID | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> dict:
        """Feedback that a patient actually wrote or scored, newest first.

        `reviewer` ('doctor' | 'admin') decides what "pending" means: no reply
        yet from that kind of reviewer. `patient_ids` scopes a doctor to their
        own patients.
        """
        query = (
            db.query(TherapyFeedback)
            .options(
                joinedload(TherapyFeedback.user),
                joinedload(TherapyFeedback.video_group),
                joinedload(TherapyFeedback.doctor_feedback_user),
                joinedload(TherapyFeedback.admin_feedback_user),
            )
            .filter(TherapyFeedback.is_active.isnot(False))
            # Only records with something to review: a remark or a score.
            .filter(or_(
                TherapyFeedback.user_feedback.isnot(None),
                TherapyFeedback.user_pain_description.isnot(None),
                TherapyFeedback.pain_after.isnot(None),
            ))
        )
        if patient_ids is not None:
            if not patient_ids:
                return {"items": [], "total": 0, "limit": limit, "offset": offset}
            query = query.filter(TherapyFeedback.user_id.in_(patient_ids))
        if patient_id is not None:
            query = query.filter(TherapyFeedback.user_id == patient_id)

        column = TherapyFeedback.doctor_feedback if reviewer == "doctor" else TherapyFeedback.admin_feedback
        if status == "pending":
            query = query.filter(or_(column.is_(None), column == ""))
        elif status == "reviewed":
            query = query.filter(column.isnot(None), column != "")

        total = query.count()
        rows = (
            query.order_by(TherapyFeedback.created_at.desc(), TherapyFeedback.id)
            .offset(offset)
            .limit(limit)
            .all()
        )
        return {
            "items": [TherapyFeedbackService._review_item(f) for f in rows],
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    @staticmethod
    def get_for_review(db: Session, feedback_id: uuid.UUID) -> TherapyFeedback | None:
        return TherapyFeedbackRepository.get_by_id(db, feedback_id)
