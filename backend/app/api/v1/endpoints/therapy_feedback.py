import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_role
from app.models.user import User
from app.schemas.therapy import (CreateTherapyFeedbackRequest,
                                 UpdateAdminFeedbackRequest,
                                 UpdateDoctorFeedbackRequest,
                                 UpdatePainAfterFeedbackRequest)
from app.services.therapy_feedback_service import TherapyFeedbackService
from app.utils.responses import error_response, success_response

router = APIRouter(prefix="/therapy-feedback", tags=["Therapy Feedback"])


@router.get(
    "/by-group/{video_group_id}",
    summary="Get all therapy feedbacks by user and video group",
    description="Returns all therapy feedback records for the authenticated user and the specified "
    "`videoGroupId`, ordered newest first. Used by the mobile app to check if feedback exists.",
)
def get_feedback_by_group(
    video_group_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = TherapyFeedbackService.get_all_by_user_and_group(db, user.id, video_group_id)
    if not result:
        return error_response("Therapy feedback not found", 404)
    return success_response("Therapy feedback found", result)


@router.get(
    "/by-session/{session_group_id}",
    summary="Get therapy feedback by session group",
    description="Returns the authenticated user's therapy feedback record for a "
    "specific session group, or 404 if none exists.",
)
def get_feedback_by_session(
    session_group_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = TherapyFeedbackService.get_by_session(db, session_group_id, user.id)
    if result is None:
        return error_response("Therapy feedback not found for this session", 404)
    return success_response("Therapy feedback found", result)


@router.post(
    "",
    status_code=201,
    summary="Create therapy feedback record",
    description="Creates a new therapy feedback entry for the authenticated user. Records the "
    "`videoGroupId`, `sessionType`, optional `painBefore` (0–10), and optional "
    "`userPainDescription`. Returns the created feedback record.",
)
def create_feedback(
    body: CreateTherapyFeedbackRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = TherapyFeedbackService.create_feedback(db, user.id, body)
    return success_response("Therapy feedback created successfully", result, 201)


@router.put(
    "/{feedback_id}/pain-after",
    summary="Submit post-session pain level and user feedback",
    description="Updates an existing therapy feedback record with `painAfter` (0–10) and optional "
    "`userFeedback` after completing the session. Requires the `feedbackId` of an existing "
    "therapy feedback record. Returns the updated record.",
)
def update_pain_after(
    feedback_id: uuid.UUID,
    body: UpdatePainAfterFeedbackRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = TherapyFeedbackService.update_pain_after(db, feedback_id, user.id, body)
    if result is None:
        return error_response("Therapy feedback not found", 404)
    return success_response("Post-session pain recorded successfully", result)


@router.put(
    "/{feedback_id}/doctor-feedback",
    summary="Submit doctor feedback for a therapy record",
    description="Allows a doctor to provide `doctorFeedback` for a therapy feedback record. "
    "The doctor's ID is automatically recorded as `doctorFeedbackBy`. Requires the `feedbackId` "
    "of an existing therapy feedback record. Returns the updated record.",
)
def update_doctor_feedback(
    feedback_id: uuid.UUID,
    body: UpdateDoctorFeedbackRequest,
    user: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    result = TherapyFeedbackService.update_doctor_feedback(db, feedback_id, user.id, body)
    if result is None:
        return error_response("Therapy feedback not found", 404)
    return success_response("Doctor feedback submitted successfully", result)


@router.put(
    "/{feedback_id}/admin-feedback",
    summary="Submit admin feedback for a therapy record",
    description="Allows an admin to provide `adminFeedback` for a therapy feedback record. "
    "The admin's ID is automatically recorded as `adminFeedbackBy`. Requires the `feedbackId` "
    "of an existing therapy feedback record. Returns the updated record.",
)
def update_admin_feedback(
    feedback_id: uuid.UUID,
    body: UpdateAdminFeedbackRequest,
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    result = TherapyFeedbackService.update_admin_feedback(db, feedback_id, user.id, body)
    if result is None:
        return error_response("Therapy feedback not found", 404)
    return success_response("Admin feedback submitted successfully", result)
