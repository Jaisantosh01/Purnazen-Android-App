from app.extensions.database import db

from app.models.token_blocklist_model import (
    TokenBlocklist
)


class TokenRepository:

    @staticmethod
    def add_to_blocklist(jti):

        token = TokenBlocklist(
            jti=jti
        )

        db.session.add(token)

        db.session.commit()


    @staticmethod
    def is_token_revoked(jti):

        return TokenBlocklist.query.filter_by(
            jti=jti
        ).first() is not None