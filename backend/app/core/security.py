import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


def _create_token(
    subject: str, token_type: str, expires_delta: timedelta, version: int = 0
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "type": token_type,
        "jti": str(uuid.uuid4()),
        "ver": version,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(subject: str, version: int = 0) -> str:
    return _create_token(
        subject,
        "access",
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        version,
    )


def create_refresh_token(subject: str, version: int = 0) -> str:
    return _create_token(
        subject,
        "refresh",
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        version,
    )

def decode_token(token: str) -> dict:
    return jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )


# Short-lived proof that the password (or social sign-in) step succeeded, and
# that a one-time code is still owed. Only /auth/mfa/verify accepts it.
MFA_TOKEN_MINUTES = 5


def create_mfa_token(subject: str, version: int = 0) -> str:
    return _create_token(subject, "mfa", timedelta(minutes=MFA_TOKEN_MINUTES), version)


# One-shot link token for opening a generated file (the health-report PDF) in
# the system browser, which can't send a bearer header. Only that route accepts
# it, and it dies with the account's token_version like every other token.
DOWNLOAD_TOKEN_MINUTES = 10


def create_download_token(subject: str, version: int = 0) -> str:
    return _create_token(subject, "download", timedelta(minutes=DOWNLOAD_TOKEN_MINUTES), version)
