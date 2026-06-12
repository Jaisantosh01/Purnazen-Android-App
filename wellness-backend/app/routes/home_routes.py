from flask import Blueprint

from app.controllers.home_controller import HomeController

home_bp = Blueprint(
    "home",
    __name__,
    url_prefix='/api/v1/home'
)


@home_bp.route("/quick-relief", methods=["GET"])
def get_quick_relief():
    return HomeController.get_quick_relief()