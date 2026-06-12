from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
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

        return {
            "success": True,
            "message": "Login successful",
            "access_token": create_access_token(str(user.id)),
            "refresh_token": create_refresh_token(str(user.id)),
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role,
            },
        }, 200
