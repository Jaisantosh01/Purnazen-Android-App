from sqlalchemy.orm import Session

from app.models.token_blocklist import TokenBlocklist


class TokenRepository:

    @staticmethod
    def add_to_blocklist(db: Session, jti: str):
        db.add(TokenBlocklist(jti=jti))
        db.commit()

    @staticmethod
    def is_token_revoked(db: Session, jti: str) -> bool:
        return (
            db.query(TokenBlocklist).filter_by(jti=jti).first() is not None
        )
