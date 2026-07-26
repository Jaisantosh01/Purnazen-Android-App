import jwt as pyjwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import SessionLocal
from app.models.user import User
from app.repositories.token_repository import TokenRepository

bearer_scheme = HTTPBearer(auto_error=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_token_payload(
    credentials: HTTPAuthorizationCredentials | None,
    db: Session,
    token_type: str,
) -> dict:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    try:
        payload = decode_token(credentials.credentials)
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except pyjwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    if payload.get("type") != token_type:
        raise HTTPException(status_code=401, detail=f"Not a {token_type} token")

    if TokenRepository.is_token_revoked(db, payload.get("jti", "")):
        raise HTTPException(status_code=401, detail="Token has been revoked")

    # Tokens minted before a password change (or for a deleted account) carry a
    # stale "ver" claim and are rejected — see User.token_version.
    subject = payload.get("sub")
    user = db.get(User, subject)
    if user is None or payload.get("ver", 0) != (user.token_version or 0):
        raise HTTPException(status_code=401, detail="Token has been revoked")

    return payload


def get_access_payload(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> dict:
    return _get_token_payload(credentials, db, "access")


def get_refresh_payload(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> dict:
    return _get_token_payload(credentials, db, "refresh")


def get_current_user(
    payload: dict = Depends(get_access_payload),
    db: Session = Depends(get_db),
) -> User:
    user = db.get(User, payload["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def require_role(required_role: str):
    def checker(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
        # Refresh user from DB to ensure role relationship is loaded
        db.refresh(user)
        if not user.role or user.role.name != required_role:
            raise HTTPException(status_code=403, detail="Access denied")
        return user

    return checker
