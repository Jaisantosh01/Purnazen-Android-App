from flask import Flask
from flask_migrate import Migrate

from app.config.config import Config
from app.extensions.database import db

from app.models.user_model import User
from app.models.doctor_model import Doctor
from app.models.specialty_model import Specialty
from app.models.language_model import Language
from app.models.consultation_type_model import ConsultationType
from app.models.doctor_consultation_type_model import DoctorConsultationType
from app.models.doctor_language_model import DoctorLanguage
from app.models.doctor_expertise_model import DoctorExpertise
from app.models.quick_relief_model import QuickRelief
from app.models.expertise_model import Expertise
from app.models.clinic_model import Clinic
from app.models.award_model import Award
from app.models.doctor_availability_model import DoctorAvailability

from app.routes.auth_routes import auth_bp
from app.extensions.jwt import jwt

from app.routes.doctor_routes import (
    doctor_bp
)

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

from app.routes.home_routes import home_bp

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

    app.register_blueprint(auth_bp,)

    app.register_blueprint(doctor_bp)

    app.register_blueprint(home_bp)

    register_error_handlers(app)

    return app