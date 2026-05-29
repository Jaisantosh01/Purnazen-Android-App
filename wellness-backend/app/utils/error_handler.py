from marshmallow import ValidationError

from app.utils.response import (
    error_response
)


def register_error_handlers(app):

    @app.errorhandler(ValidationError)
    def handle_validation_error(error):

        return error_response(
            error.messages,
            400
        )


    @app.errorhandler(404)
    def handle_not_found(error):

        return error_response(
            "Resource not found",
            404
        )


    @app.errorhandler(500)
    def handle_internal_error(error):

        return error_response(
            "Internal server error",
            500
        )


    @app.errorhandler(Exception)
    def handle_exception(error):

        print(error)

        return error_response(
            "Something went wrong",
            500
        )