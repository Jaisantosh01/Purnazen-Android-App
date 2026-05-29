from flask import request, jsonify

from app.services.auth_service import AuthService

from flask_jwt_extended import (
    jwt_required,
    get_jwt_identity,
    create_access_token,
    get_jwt
)

from app.repositories.token_repository import (
    TokenRepository
)

from marshmallow import ValidationError

from app.validators.auth_validator import (
    RegisterSchema,
    LoginSchema
)

from app.utils.response import (
    success_response,
    error_response
)

from app.middlewares.role_middleware import (
    role_required
)

def register():
    """
    User Registration API
    ---
    tags:
      - Authentication

    parameters:
      - in: body
        name: body
        required: true

        schema:
          type: object

          properties:
            full_name:
              type: string

            email:
              type: string

            password:
              type: string

    responses:
      201:
        description: User registered successfully
    """
    try:

        data = RegisterSchema().load(
            request.get_json()
        )

    except ValidationError as err:

        return error_response(
            err.messages,
            400
        )

    response, status_code = AuthService.register(data)

    if not response['success']:

        return error_response(
            response['message'],
            status_code
        )

    return success_response(
        response['message'],
        response.get('user'),
        status_code
    )

def login():

    try:

        data = LoginSchema().load(
            request.get_json()
        )

    except ValidationError as err:

        return error_response(
            err.messages,
            400
        )

    response, status_code = AuthService.login(data)

    if not response['success']:

        return error_response(
            response['message'],
            status_code
        )

    return success_response(
        response['message'],
        {
            "access_token": response['access_token'],
            "refresh_token": response['refresh_token'],
            "user": response['user']
        },
        status_code
    )

@jwt_required(refresh=True)
def logout():

    jwt_data = get_jwt()

    jti = jwt_data['jti']

    TokenRepository.add_to_blocklist(
        jti
    )

    return success_response(
        "Logged out successfully"
    )

@jwt_required()
def me():

    current_user = get_jwt_identity()

    return success_response(
        "Current user fetched successfully",
        {
            "user_id": current_user
        }
    )

@jwt_required()
@role_required('admin')
def admin_dashboard():

    return success_response(
        "Welcome Admin",
        {
            "dashboard": "Admin Panel"
        }
    )

@jwt_required(refresh=True)
def refresh_token():

    current_user = get_jwt_identity()

    new_access_token = create_access_token(
        identity=current_user
    )

    return success_response(
        "Access token refreshed",
        {
            "access_token": new_access_token
        }
    )