from app.repositories.user_repository import UserRepository

from flask_jwt_extended import (
    create_access_token,
    create_refresh_token
)

from app.utils.password import (
    hash_password,
    verify_password
)

from flask_jwt_extended import create_access_token

class AuthService:

    @staticmethod
    def register(data):

        existing_user = UserRepository.find_by_email(
            data['email']
        )

        if existing_user:

            return {
                "success": False,
                "message": "Email already exists"
            }, 400

        data['password'] = hash_password(
            data['password']
        )

        user = UserRepository.create_user(data)

        return {
            "success": True,
            "message": "User registered successfully",
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name
            }
        }, 201

    @staticmethod
    def login(data):

        print("Data:", data)

        user = UserRepository.find_by_email(
            data['email']
        )

        if not user:

            return {
                "success": False,
                "message": "Invalid email or password"
            }, 401

        is_valid_password = verify_password(
            data['password'],
            user.password
        )

        if not is_valid_password:

            return {
                "success": False,
                "message": "Invalid email or password"
            }, 401

        access_token = create_access_token(
            identity=str(user.id)
        )

        refresh_token = create_refresh_token(
            identity=str(user.id)
        )

        return {
            "success": True,
            "message": "Login successful",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role
            }
        }, 200