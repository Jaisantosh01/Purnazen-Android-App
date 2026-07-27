import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_role
from app.core.security import hash_password
from app.models.doctor import Doctor
from app.models.role import Role
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import AdminCreateUserRequest
from app.schemas.preferences import UpdatePreferencesRequest
from app.services.health_report_service import HealthReportService
from app.services.preference_service import PreferenceService
from app.utils.azure_storage import upload_blob_file
from app.utils.responses import error_response, success_response

# Avatars are small; anything larger is a mis-picked original from the gallery.
MAX_AVATAR_BYTES = 5 * 1024 * 1024
ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/png", "image/webp"}

router = APIRouter(prefix="/users", tags=["Users"])

# Profile columns an admin may edit from the user detail screen. full_name and
# email are NOT NULL, so a blank value is ignored rather than written as None.
EDITABLE_USER_FIELDS = (
    "full_name",
    "email",
    "phone",
    "gender",
    "date_of_birth",
    "blood_group",
    "height_cm",
    "weight_kg",
    "allergies",
    "conditions",
    "medications",
)
_REQUIRED_USER_FIELDS = {"full_name", "email"}


def _clean(field: str, value):
    """Normalise one edited field; "" clears an optional column."""
    if isinstance(value, str):
        value = value.strip() or None
    if value is None:
        return None
    if field == "date_of_birth" and isinstance(value, str):
        return date.fromisoformat(value[:10])
    if field in ("height_cm", "weight_kg"):
        return float(value)
    return value


@router.get("", summary="Get all users (admin only)")
def get_all_users(
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name or email"),
    role: Optional[str] = Query(None, description="Filter by role name"),
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    query = db.query(User)

    if search:
        query = query.filter(
            User.full_name.ilike(f"%{search}%") | User.email.ilike(f"%{search}%")
        )
    if role:
        query = query.join(User.role).filter(Role.name.ilike(role))

    total = query.count()
    total_pages = (total + per_page - 1) // per_page if total else 0

    users = (
        query.order_by(User.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return success_response(
        "Users fetched successfully",
        {
            "users": [u.to_dict() for u in users],
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": total_pages,
        },
    )


@router.post(
    "",
    status_code=201,
    summary="Create a new user (admin only)",
    description="Creates a user with the given role. Password is hashed before storage.",
)
def create_user(
    body: AdminCreateUserRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    existing_user = UserRepository.find_by_email(db, body.email)
    if existing_user:
        return error_response("Email already exists", 400)

    role = db.query(Role).filter_by(name=body.role_name).first()
    if not role:
        return error_response(f"Role '{body.role_name}' not found", 404)

    data = body.model_dump()
    data["password"] = hash_password(data["password"])
    new_user = UserRepository.create_user(db, data, role_id=role.id)

    return success_response(
        "User created successfully",
        new_user.to_dict(),
        status_code=201,
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
    description="Partial update of the authenticated user's preferences; "
    "omitted fields keep their stored values and the notifications dict is merged.",
)
def update_preferences(
    body: UpdatePreferencesRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return success_response(
        "Preferences updated successfully", PreferenceService.update(db, user, body)
    )

@router.get(
    "/me/health-report",
    summary="Consolidated health report",
    description="Read-only roll-up of the authenticated user's profile vitals, "
    "medical background, therapy totals, appointment history and latest "
    "face/tongue scan. Aggregates existing rows — nothing is stored.",
)
def get_health_report(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return success_response(
        "Health report generated successfully", HealthReportService.build(db, user)
    )


@router.post(
    "/me/avatar",
    summary="Upload a profile photo",
    description="Stores the image in blob storage and points the account's "
    "`avatar_url` at it. Returns the refreshed user.",
)
async def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if file.content_type not in ALLOWED_AVATAR_TYPES:
        return error_response("Please choose a JPEG, PNG or WebP image", 400)

    data = await file.read()
    if not data:
        return error_response("The selected file is empty", 400)
    if len(data) > MAX_AVATAR_BYTES:
        return error_response("Please choose an image under 5 MB", 400)

    extension = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[file.content_type]
    blob_path = upload_blob_file(
        data, f"avatars/{user.id}.{extension}", content_type=file.content_type
    )
    if not blob_path:
        return error_response("Image storage is unavailable right now", 503)

    user.avatar_url = blob_path
    db.commit()
    db.refresh(user)

    # to_dict() already resolves avatar_url through generate_sas_url.
    return success_response("Profile photo updated successfully", {"user": user.to_dict()})


@router.get("/{user_id}", summary="Get user details")
def get_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)

    if not user:
        return error_response("User not found", 404)

    return success_response(
        "User fetched successfully",
        user.to_dict(),
    )

@router.put("/{user_id}", summary="Update user (admin only)", dependencies=[Depends(require_role("admin"))])
def update_user(user_id: uuid.UUID, data: dict, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        return error_response("User not found", 404)

    try:
        for field in EDITABLE_USER_FIELDS:
            if field not in data:
                continue
            value = _clean(field, data[field])
            if value is None and field in _REQUIRED_USER_FIELDS:
                continue
            setattr(user, field, value)
    except (TypeError, ValueError):
        return error_response("One or more fields have an invalid value", 400)

    if "role_id" in data:
        user.role_id = data["role_id"]
    if "is_active" in data:
        user.is_active = bool(data["is_active"])
        # Reinstating an account is the counterpart to the deactivate below.
        doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
        if user.is_active and doctor:
            doctor.is_active = True

    db.commit()
    db.refresh(user)
    return success_response("User updated successfully", user.to_dict())


@router.delete(
    "/{user_id}",
    summary="Delete (deactivate) a user (admin only)",
    description="Sets is_active=False and revokes the account's live sessions. "
    "Accounts are retained rather than dropped because appointments, payments "
    "and clinical records reference them; deactivating mirrors DELETE /doctors.",
    dependencies=[Depends(require_role("admin"))],
)
def delete_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    user = db.get(User, user_id)
    if not user:
        return error_response("User not found", 404)

    if user.id == actor.id:
        return error_response("You cannot delete your own account", 400)

    if user.role and user.role.name == "admin":
        remaining_admins = (
            db.query(func.count(User.id))
            .join(User.role)
            .filter(Role.name == "admin", User.is_active.is_(True), User.id != user.id)
            .scalar()
        )
        if not remaining_admins:
            return error_response("Cannot delete the last active admin", 400)

    user.is_active = False
    # Bump the token version so any access/refresh token already issued to this
    # account stops validating in deps._get_token_payload.
    user.token_version = (user.token_version or 0) + 1
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if doctor:
        doctor.is_active = False
    db.commit()

    return success_response("User deleted successfully")
