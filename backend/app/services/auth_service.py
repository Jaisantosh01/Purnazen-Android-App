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
