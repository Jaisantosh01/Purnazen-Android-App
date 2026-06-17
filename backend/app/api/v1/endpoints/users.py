from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_role
from app.models.user import User
from app.schemas.preferences import UpdatePreferencesRequest
from app.services.preference_service import PreferenceService
from app.utils.responses import success_response

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", summary="Get all users (admin only)")
def get_all_users(
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    users = db.query(User).all()
    return success_response(
        "Users fetched successfully",
        [u.to_dict() for u in users],
    )


@router.get(
    "/me/preferences",
    summary="Get notification preferences",
    description="The authenticated user's preferences; defaults are created on first read.",
)
def get_preferences(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return success_response(
        "Preferences fetched successfully", PreferenceService.get(db, user)
    )


@router.put(
    "/me/preferences",
    summary="Update notification preferences",
    description=(
        "Partial update: `pushEnabled` toggles everything; `notifications` is a "
        "dict of toggle-id → bool and is merged with the stored values."
    ),
)
def update_preferences(
    body: UpdatePreferencesRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return success_response(
        "Preferences updated successfully", PreferenceService.update(db, user, body)
    )
