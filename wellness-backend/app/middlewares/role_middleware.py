from functools import wraps

from flask_jwt_extended import (
    get_jwt_identity
)

from app.models.user_model import User

from app.utils.response import error_response


def role_required(required_role):

    def decorator(func):

        @wraps(func)
        def wrapper(*args, **kwargs):

            current_user_id = get_jwt_identity()

            user = User.query.get(current_user_id)

            if not user:

                return error_response(
                    "User not found",
                    404
                )

            if user.role != required_role:

                return error_response(
                    "Access denied",
                    403
                )

            return func(*args, **kwargs)

        return wrapper

    return decorator