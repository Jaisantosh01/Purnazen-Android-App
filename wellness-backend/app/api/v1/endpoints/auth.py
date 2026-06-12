from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import (
    get_db,
    get_access_payload,
    get_refresh_payload,
    require_role,
)
from app.core.security import create_access_token
from app.models.user import User
from app.repositories.token_repository import TokenRepository
from app.schemas.auth import LoginRequest, RegisterRequest
from app.services.auth_service import AuthService
from app.utils.responses import error_response, success_response

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    response, status_code = AuthService.register(db, body.model_dump())

    if not response["success"]:
        return error_response(response["message"], status_code)

    return success_response(response["message"], response.get("user"), status_code)


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
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


@router.post("/logout")
def logout(
    payload: dict = Depends(get_refresh_payload),
    db: Session = Depends(get_db),
):
    TokenRepository.add_to_blocklist(db, payload["jti"])
    return success_response("Logged out successfully")


@router.get("/me")
def me(payload: dict = Depends(get_access_payload)):
    return success_response(
        "Current user fetched successfully",
        {"user_id": payload["sub"]},
    )


@router.post("/refresh")
def refresh_token(payload: dict = Depends(get_refresh_payload)):
    return success_response(
        "Access token refreshed",
        {"access_token": create_access_token(payload["sub"])},
    )


@router.get("/admin/dashboard")
def admin_dashboard(user: User = Depends(require_role("admin"))):
    return success_response("Welcome Admin", {"dashboard": "Admin Panel"})
