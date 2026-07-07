import secrets

from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.payment import Payment
from app.models.therapy_session import TherapySession
from app.models.user import User
from app.models.user_preference import UserPreference
from app.repositories.user_repository import UserRepository
from app.services.social_auth import SocialAuthError, verify_firebase


class AuthService:

    @staticmethod
    def register(db: Session, data: dict):
        existing_user = UserRepository.find_by_email(db, data["email"])

        if existing_user:
            return {
                "success": False,
                "message": "Email already exists",
            }, 400

        data["password"] = hash_password(data["password"])
        user = UserRepository.create_user(db, data)

        return {
            "success": True,
            "message": "User registered successfully",
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
            },
        }, 201

    @staticmethod
    def login(db: Session, data: dict):
        user = UserRepository.find_by_email(db, data["email"])

        if not user or not verify_password(data["password"], user.password):
            return {
                "success": False,
                "message": "Invalid email or password",
            }, 401

        # RBAC gate: reject a valid credential trying to use the wrong app.
        expected_role = data.get("expected_role")
        if expected_role and (not user.role or user.role.name != expected_role):
            return {
                "success": False,
                "message": "This account is not permitted to use this app",
            }, 403

        return {
            "success": True,
            "message": "Login successful",
            "access_token": create_access_token(str(user.id), user.token_version or 0),
            "refresh_token": create_refresh_token(str(user.id), user.token_version or 0),
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role.name if user.role else None,
            },
        }, 200

    @staticmethod
    def social_login(db: Session, data: dict):
        """Sign in (or sign up) with a Firebase-verified identity.

        Firebase Auth proves ownership of the email (whichever provider the
        user picked in the app); we then reuse the account with that email or
        create a fresh patient account. Sign-up via social is patient-only —
        doctor/admin accounts are provisioned by an admin, so an unknown email
        asked for by those apps is rejected instead of created.
        """
        try:
            profile = verify_firebase(data["id_token"])
        except SocialAuthError as exc:
            return {"success": False, "message": exc.message}, exc.status_code

        if not profile["email_verified"]:
            return {
                "success": False,
                "message": "This account's email address is not verified with the provider",
            }, 403

        expected_role = data.get("expected_role")
        user = UserRepository.find_by_email(db, profile["email"])

        if user is None:
            if expected_role not in (None, "patient"):
                return {
                    "success": False,
                    "message": "No account found for this email. Please contact your administrator.",
                }, 403
            # Random throwaway password: the account is provider-backed and can
            # never be entered via the password form.
            user = UserRepository.create_user(
                db,
                {
                    "full_name": profile["full_name"],
                    "email": profile["email"],
                    "password": hash_password(secrets.token_urlsafe(32)),
                },
            )
            user.auth_provider = profile["provider"] or None
            if profile.get("avatar_url"):
                user.avatar_url = profile["avatar_url"]
            db.commit()
            db.refresh(user)
        elif expected_role and (not user.role or user.role.name != expected_role):
            return {
                "success": False,
                "message": "This account is not permitted to use this app",
            }, 403

        return {
            "success": True,
            "message": "Login successful",
            "access_token": create_access_token(str(user.id), user.token_version or 0),
            "refresh_token": create_refresh_token(str(user.id), user.token_version or 0),
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role.name if user.role else None,
            },
        }, 200

    @staticmethod
    def update_profile(db: Session, user: User, data: dict):
        if data.get("full_name") is not None:
            user.full_name = data["full_name"]
        if data.get("avatar_url") is not None:
            user.avatar_url = data["avatar_url"]
        if data.get("phone") is not None:
            user.phone = data["phone"]
        if data.get("gender") is not None:
            user.gender = data["gender"]
        if data.get("date_of_birth") is not None:
            user.date_of_birth = data["date_of_birth"]
        db.commit()
        db.refresh(user)

        return {
            "success": True,
            "message": "Profile updated successfully",
            "user": user.to_dict(),
        }, 200

    @staticmethod
    def change_password(db: Session, user: User, data: dict):
        if not verify_password(data["current_password"], user.password):
            return {"success": False, "message": "Current password is incorrect"}, 401

        user.password = hash_password(data["new_password"])
        # Invalidate every previously issued token (access + refresh)
        user.token_version = (user.token_version or 0) + 1
        db.commit()

        return {
            "success": True,
            "message": "Password changed successfully",
            "access_token": create_access_token(str(user.id), user.token_version),
            "refresh_token": create_refresh_token(str(user.id), user.token_version),
        }, 200

    @staticmethod
    def delete_account(db: Session, user: User):
        if db.query(Doctor).filter_by(user_id=user.id).first():
            return {
                "success": False,
                "message": "Doctor accounts cannot be deleted from the app",
            }, 400

        # Hard delete with explicit cascade of user-owned rows
        db.query(TherapySession).filter_by(user_id=user.id).delete()
        db.query(Payment).filter_by(user_id=user.id).delete()
        db.query(Appointment).filter_by(user_id=user.id).delete()
        db.query(UserPreference).filter_by(user_id=user.id).delete()
        db.delete(user)
        db.commit()

        return {"success": True, "message": "Account deleted successfully"}, 200
