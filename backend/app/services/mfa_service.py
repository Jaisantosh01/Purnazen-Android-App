"""Two-step verification (TOTP) for any account, required for the roles in
settings.MFA_REQUIRED_ROLES.

Enrolment: setup() stores an encrypted secret (not yet enforced) and returns
the otpauth:// link; enable() proves the authenticator works and turns it on,
handing back ten single-use recovery codes. Sign-in: the password or social
step returns an `mfa_token` instead of a session, which verify_login() swaps
for real tokens once a code checks out.
"""
import hashlib
import secrets

import jwt as pyjwt
from sqlalchemy.orm import Session

from app.core import totp
from app.core.config import settings
from app.core.crypto import decrypt, encrypt
from app.core.security import (
    create_access_token,
    create_mfa_token,
    create_refresh_token,
    decode_token,
)
from app.models.user import User

RECOVERY_CODE_COUNT = 10


class MfaError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _hash_code(code: str) -> str:
    normalised = "".join(ch for ch in code.lower() if ch.isalnum())
    return hashlib.sha256(normalised.encode("utf-8")).hexdigest()


def _new_recovery_codes() -> list[str]:
    return [f"{secrets.token_hex(2)}-{secrets.token_hex(2)}-{secrets.token_hex(2)}"
            for _ in range(RECOVERY_CODE_COUNT)]


class MfaService:

    # ── Session issuing (used by password and social login) ─────────────────
    @staticmethod
    def session_or_challenge(user: User, second_factor_passed: bool = False,
                             message: str = "Login successful") -> dict:
        if user.mfa_enabled and not second_factor_passed:
            return {
                "success": True,
                "message": "Enter the code from your authenticator app",
                "mfa_required": True,
                "mfa_token": create_mfa_token(str(user.id), user.token_version or 0),
            }
        return {
            "success": True,
            "message": message,
            "access_token": create_access_token(str(user.id), user.token_version or 0),
            "refresh_token": create_refresh_token(str(user.id), user.token_version or 0),
            "user": user.to_dict(),
        }

    # ── Code checks ─────────────────────────────────────────────────────────
    @staticmethod
    def _check_code(db: Session, user: User, code: str) -> bool:
        """TOTP first, then a recovery code (which is then used up)."""
        secret = decrypt(user.mfa_secret) if user.mfa_secret else None
        if secret:
            step = totp.verify(secret, code, user.mfa_last_step)
            if step is not None:
                user.mfa_last_step = step
                db.commit()
                return True
        hashed = _hash_code(code or "")
        remaining = list(user.mfa_recovery_codes or [])
        if code and hashed in remaining:
            remaining.remove(hashed)
            user.mfa_recovery_codes = remaining
            db.commit()
            return True
        return False

    @staticmethod
    def verify_login(db: Session, mfa_token: str, code: str) -> dict:
        try:
            payload = decode_token(mfa_token)
        except pyjwt.ExpiredSignatureError:
            raise MfaError("The sign-in took too long. Please sign in again.", 401)
        except pyjwt.PyJWTError:
            raise MfaError("Invalid sign-in session. Please sign in again.", 401)
        if payload.get("type") != "mfa":
            raise MfaError("Invalid sign-in session. Please sign in again.", 401)
        user = db.get(User, payload.get("sub"))
        if user is None or payload.get("ver", 0) != (user.token_version or 0) or user.is_active is False:
            raise MfaError("Invalid sign-in session. Please sign in again.", 401)
        if not user.mfa_enabled:
            raise MfaError("Two-step verification is not enabled for this account.", 400)
        if not MfaService._check_code(db, user, code):
            raise MfaError("That code didn't work. Check the time on your phone and try again.", 401)
        session = MfaService.session_or_challenge(user, second_factor_passed=True)
        session["recovery_codes_left"] = len(user.mfa_recovery_codes or [])
        return session

    # ── Enrolment ───────────────────────────────────────────────────────────
    @staticmethod
    def setup(db: Session, user: User) -> dict:
        if user.mfa_enabled:
            raise MfaError("Two-step verification is already on.", 409)
        secret = totp.generate_secret()
        user.mfa_secret = encrypt(secret)
        user.mfa_last_step = None
        db.commit()
        return {
            "secret": secret,
            "otpauth_uri": totp.provisioning_uri(secret, user.email, settings.MFA_ISSUER),
            "issuer": settings.MFA_ISSUER,
            "account": user.email,
        }

    @staticmethod
    def enable(db: Session, user: User, code: str) -> dict:
        if user.mfa_enabled:
            raise MfaError("Two-step verification is already on.", 409)
        secret = decrypt(user.mfa_secret) if user.mfa_secret else None
        if not secret:
            raise MfaError("Start setup first.", 400)
        step = totp.verify(secret, code)
        if step is None:
            raise MfaError("That code didn't work. Check the time on your phone and try again.", 400)
        codes = _new_recovery_codes()
        user.mfa_enabled = True
        user.mfa_last_step = step
        user.mfa_recovery_codes = [_hash_code(c) for c in codes]
        db.commit()
        db.refresh(user)
        return {"recovery_codes": codes, "user": user.to_dict()}

    @staticmethod
    def disable(db: Session, user: User, code: str) -> dict:
        if not user.mfa_enabled:
            raise MfaError("Two-step verification is already off.", 400)
        if user.mfa_required:
            raise MfaError("Two-step verification is required for your role.", 403)
        if not MfaService._check_code(db, user, code):
            raise MfaError("That code didn't work.", 400)
        user.mfa_enabled = False
        user.mfa_secret = None
        user.mfa_last_step = None
        user.mfa_recovery_codes = None
        db.commit()
        db.refresh(user)
        return {"user": user.to_dict()}

    @staticmethod
    def regenerate_recovery_codes(db: Session, user: User, code: str) -> dict:
        if not user.mfa_enabled:
            raise MfaError("Two-step verification is off.", 400)
        if not MfaService._check_code(db, user, code):
            raise MfaError("That code didn't work.", 400)
        codes = _new_recovery_codes()
        user.mfa_recovery_codes = [_hash_code(c) for c in codes]
        db.commit()
        return {"recovery_codes": codes}

