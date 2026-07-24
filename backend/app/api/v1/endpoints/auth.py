from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import (
    get_db,
    get_current_user,
    get_refresh_payload,
    require_role,
)
from app.core.limiter import limiter
from app.core.config import settings
from app.core.security import create_access_token
from app.models.user import User
from app.repositories.token_repository import TokenRepository
from app.schemas.auth import (
    ChangeEmailRequest,
    ChangePasswordRequest,
    EmailCheckRequest,
    LoginRequest,
    RegisterRequest,
    SocialLinkRequest,
    SocialLoginRequest,
    UpdateProfileRequest,
)
from app.services.auth_service import AuthService
from app.utils.email_validation import validate_account_email
from app.utils.responses import error_response, success_response

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    status_code=201,
    summary="Create a new account",
    description="Registers a patient account. Rate-limited per client IP.",
)
@limiter.limit(settings.RATE_LIMIT_REGISTER)
def register(request: Request, body: RegisterRequest, db: Session = Depends(get_db)):
    response, status_code = AuthService.register(db, body.model_dump())

    if not response["success"]:
        return error_response(response["message"], status_code)

    return success_response(response["message"], response.get("user"), status_code)


@router.post(
    "/validate-email",
    summary="Soft-check an email address before signup",
    description=(
        "Returns whether an email is usable for an account and, when not, a "
        "soft human message. Rejects disposable/throwaway domains and (best "
        "effort) domains with no mail server. Does not touch the database."
    ),
)
@limiter.limit(settings.RATE_LIMIT_EMAIL_CHECK)
def validate_email(request: Request, body: EmailCheckRequest):
    result = validate_account_email(body.email)
    return success_response("Email checked", result)


@router.post(
    "/login",
    summary="Login with email and password",
    description="Returns an access token, a refresh token and the user profile. Rate-limited per client IP.",
)
@limiter.limit(settings.RATE_LIMIT_LOGIN)
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    response, status_code = AuthService.login(db, body.model_dump())

    if not response["success"]:
        return error_response(response["message"], status_code)

    return success_response(
        response["message"],
        {
            "access_token": response["access_token"],
            "refresh_token": response["refresh_token"],
            "user": response["user"],
        },
        status_code,
    )


@router.post(
    "/social",
    summary="Login or sign up with a social provider (Firebase Auth)",
    description=(
        "Verifies a Firebase Auth ID token server-side (any provider enabled "
        "in the Firebase console), then signs the matching account in "
        "(creating a patient account on first login). Rate-limited per client IP."
    ),
)
@limiter.limit(settings.RATE_LIMIT_LOGIN)
def social_login(request: Request, body: SocialLoginRequest, db: Session = Depends(get_db)):
    response, status_code = AuthService.social_login(db, body.model_dump())

    if not response["success"]:
        return error_response(response["message"], status_code)

    return success_response(
        response["message"],
        {
            "access_token": response["access_token"],
            "refresh_token": response["refresh_token"],
            "user": response["user"],
        },
        status_code,
    )


@router.post(
    "/social/link",
    summary="Link a social account to the logged-in user",
    description=(
        "Verifies a Firebase Auth ID token and binds that identity to the "
        "authenticated account (any role). Afterwards the social button signs "
        "into this account even if the provider email differs."
    ),
)
def link_social(
    body: SocialLinkRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    response, status_code = AuthService.link_social(db, user, body.model_dump())

    if not response["success"]:
        return error_response(response["message"], status_code)

    return success_response(response["message"], {"user": response["user"]}, status_code)


@router.post(
    "/social/unlink",
    summary="Unlink the social account from the logged-in user",
)
def unlink_social(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    response, status_code = AuthService.unlink_social(db, user)

    if not response["success"]:
        return error_response(response["message"], status_code)

    return success_response(response["message"], {"user": response["user"]}, status_code)


@router.post(
    "/change-email",
    summary="Change the login email",
    description=(
        "Password accounts must confirm the current password; social-created "
        "accounts may omit it. The new email must be unused."
    ),
)
def change_email(
    body: ChangeEmailRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    response, status_code = AuthService.change_email(db, user, body.model_dump())

    if not response["success"]:
        return error_response(response["message"], status_code)

    return success_response(response["message"], {"user": response["user"]}, status_code)


@router.post(
    "/logout",
    summary="Logout (revoke refresh token)",
    description="Requires the **refresh** token as Bearer; adds its `jti` to the blocklist.",
)
def logout(
    payload: dict = Depends(get_refresh_payload),
    db: Session = Depends(get_db),
):
    TokenRepository.add_to_blocklist(db, payload["jti"])
    return success_response("Logged out successfully")


@router.get("/me", summary="Current authenticated user")
def me(user: User = Depends(get_current_user)):
    return success_response(
        "Current user fetched successfully",
        {"user_id": str(user.id), "user": user.to_dict()},
    )


@router.put(
    "/me",
    summary="Update profile",
    description="Updates the authenticated user's full name and/or avatar URL.",
)
def update_me(
    body: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    response, status_code = AuthService.update_profile(db, user, body.model_dump())
    return success_response(response["message"], {"user": response["user"]}, status_code)


@router.post(
    "/change-password",
    summary="Change password",
    description=(
        "Verifies the current password, stores the new one and **revokes every "
        "previously issued token**. Returns a fresh access/refresh token pair."
    ),
)
def change_password(
    body: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    response, status_code = AuthService.change_password(db, user, body.model_dump())

    if not response["success"]:
        return error_response(response["message"], status_code)

    return success_response(
        response["message"],
        {
            "access_token": response["access_token"],
            "refresh_token": response["refresh_token"],
        },
        status_code,
    )


@router.delete(
    "/me",
    summary="Delete account",
    description=(
        "Permanently deletes the authenticated user with their appointments and "
        "therapy history. All tokens stop working immediately."
    ),
)
def delete_me(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    response, status_code = AuthService.delete_account(db, user)

    if not response["success"]:
        return error_response(response["message"], status_code)

    return success_response(response["message"], None, status_code)


@router.post(
    "/refresh",
    summary="Exchange a refresh token for a new access token",
    description="Requires the **refresh** token as Bearer. Rate-limited per client IP.",
)
@limiter.limit(settings.RATE_LIMIT_REFRESH)
def refresh_token(request: Request, payload: dict = Depends(get_refresh_payload)):
    return success_response(
        "Access token refreshed",
        {"access_token": create_access_token(payload["sub"], payload.get("ver", 0))},
    )


@router.get("/admin/dashboard", summary="Admin-only dashboard (role-gated)")
def admin_dashboard(user: User = Depends(require_role("admin"))):
    return success_response("Welcome Admin", {"dashboard": "Admin Panel"})
