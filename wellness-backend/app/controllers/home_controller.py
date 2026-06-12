from flask import jsonify

from app.services.home_service import HomeService


class HomeController:

    @staticmethod
    def get_quick_relief():

        data = HomeService.get_quick_reliefs()

        return jsonify({
            "data": data
        }), 200