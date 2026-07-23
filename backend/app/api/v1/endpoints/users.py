import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_role
from app.core.security import hash_password
from app.models.role import Role
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import AdminCreateUserRequest
from app.schemas.preferences import UpdatePreferencesRequest
from app.services.preference_service import PreferenceService
from app.utils.responses import error_response, success_response

router = APIRouter(prefix="/users", tags=["Users"])


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
    
    if "full_name" in data:
        user.full_name = data["full_name"]
    if "email" in data:
        user.email = data["email"]
    if "role_id" in data:
        user.role_id = data["role_id"]
        
    db.commit()
    db.refresh(user)
    return success_response("User updated successfully", user.to_dict())
