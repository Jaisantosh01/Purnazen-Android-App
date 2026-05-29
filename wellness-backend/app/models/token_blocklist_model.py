from app.extensions.database import db


class TokenBlocklist(db.Model):

    __tablename__ = "token_blocklist"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    jti = db.Column(
        db.String(255),
        nullable=False,
        unique=True
    )

    created_at = db.Column(
        db.DateTime,
        server_default=db.func.now()
    )