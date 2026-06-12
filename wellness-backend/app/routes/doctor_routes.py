from flask import Blueprint

from app.controllers.doctor_controller import (
    get_doctors
)

doctor_bp = Blueprint(
    "doctor",
    __name__,
    url_prefix="/api/v1"
)

doctor_bp.route(
    "/doctors",
    methods=["GET"]
)(get_doctors)