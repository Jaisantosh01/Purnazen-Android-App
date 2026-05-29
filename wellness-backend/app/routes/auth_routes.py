from flask import Blueprint

from app.controllers.auth_controller import (
    register,
    login,
    me,
    logout,
    admin_dashboard,
    refresh_token
)



auth_bp = Blueprint('auth', __name__)

auth_bp.route(
    '/register',
    methods=['POST']
)(register)

auth_bp.route(
    '/login',
    methods=['POST']
)(login)

auth_bp.route(
    '/me',
    methods=['GET']
)(me)

auth_bp.route(
    '/logout',
    methods=['POST']
)(logout)

auth_bp.route(
    '/admin/dashboard',
    methods=['GET']
)(admin_dashboard)

auth_bp.route(
    '/refresh',
    methods=['POST']
)(refresh_token)