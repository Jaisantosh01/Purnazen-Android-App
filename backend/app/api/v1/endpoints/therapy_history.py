import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.therapy import (
    CompleteSessionRequest,
    SaveTherapySessionRequest,
    StartSessionRequest,
)
from app.services.therapy_service import TherapyService
from app.utils.responses import error_response, success_response

router = APIRouter(prefix="/therapy-history", tags=["Therapy History"])


@router.post(
    "/save",
    status_code=201,
    summary="Save a completed therapy session",
    description="Persists a wellness/relief session the user just finished.",
)
def save_session(
    body: SaveTherapySessionRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = TherapyService.save_session(db, user.id, body)
    return success_response("Session saved successfully", session.to_dict(), 201)


@router.get(
    "",
    summary="My therapy history",
    description="The authenticated user's sessions, newest first, with aggregate stats.",
)
def get_history(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return success_response(
        "Therapy history fetched successfully",
        TherapyService.get_history(db, user.id, page, limit),
    )


@router.get(
    "/completed-count/{group_id}",
    summary="Count completed videos in a group",
    description="Returns the number of therapy sessions with status 'Completed' "
    "for the authenticated user within the specified video group.",
)
def get_completed_count(
    group_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    count = TherapyService.count_completed_by_group(db, user.id, group_id)
    return success_response("Completed count fetched successfully", {"completedCount": count})


@router.post(
    "/start-session",
    status_code=201,
    summary="Start a new therapy session",
    description="Creates a new session group for tracking video progress in one sitting.",
)
def start_session(
    body: StartSessionRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = TherapyService.start_session(db, user.id, body.group_id, body.session_type)
    return success_response("Session started successfully", result, 201)


@router.get(
    "/incomplete-session/{group_id}",
    summary="Get incomplete session for a group",
    description="Returns the latest in-progress session group for the user and video group, if any.",
)
def get_incomplete_session(
    group_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = TherapyService.get_incomplete_session(db, user.id, group_id)
    if not result:
        return error_response("No incomplete session found", 404)
    return success_response("Incomplete session found", result)


@router.get(
    "/sessions",
    summary="List session groups",
    description="Paginated list of therapy session groups with video progress.",
)
def list_sessions(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    group_id: uuid.UUID = Query(default=None, alias="groupId"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = TherapyService.list_session_groups(db, user.id, page, limit, group_id)
    return success_response("Sessions fetched successfully", result)


@router.post(
    "/sessions/{session_group_id}/complete",
    summary="Complete a therapy session",
    description="Marks a session group as completed and updates pain-after feedback.",
)
def complete_session(
    session_group_id: uuid.UUID,
    body: CompleteSessionRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = TherapyService.complete_session(db, user.id, session_group_id, body.painAfter, body.userFeedback)
    if not result:
        return error_response("Session group not found", 404)
    return success_response("Session completed successfully", result)
