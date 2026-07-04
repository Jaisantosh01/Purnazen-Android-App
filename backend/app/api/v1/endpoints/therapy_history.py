import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.therapy import SaveTherapySessionRequest
from app.services.therapy_service import TherapyService
from app.utils.responses import success_response

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
