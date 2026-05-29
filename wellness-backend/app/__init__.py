from flask import Flask
from flask_migrate import Migrate

from app.config.config import Config
from app.extensions.database import db

from app.models.user_model import User
from app.routes.auth_routes import auth_bp
from app.extensions.jwt import jwt

from app.utils.error_handler import (
    register_error_handlers
)

from app.models.token_blocklist_model import (
    TokenBlocklist
)

from flask_jwt_extended import (
    JWTManager
)

from app.repositories.token_repository import (
    TokenRepository
)

from flasgger import Swagger

migrate = Migrate()


def create_app():

    app = Flask(__name__)

    app.config.from_object(Config)

    db.init_app(app)

    migrate.init_app(app, db)

    

    jwt.init_app(app)

    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(
        jwt_header,
        jwt_payload
    ):

        jti = jwt_payload['jti']

        return TokenRepository.is_token_revoked(
            jti
        )

    Swagger(app)

    app.register_blueprint(
        auth_bp,
        url_prefix='/api/v1/auth'
    )

    register_error_handlers(app)

    return app