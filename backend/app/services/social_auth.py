"""
Firebase Authentication token verification for social sign-in.

The app signs in with any provider enabled in the Firebase console (Google,
GitHub, ...) and sends the resulting **Firebase ID token** here. We verify its
signature and audience against the Firebase project and return a normalized
profile dict:

    {"email", "email_verified", "full_name", "avatar_url", "provider"}

One code path covers every provider, and the same service-account credential
that powers FCM (FIREBASE_SERVICE_ACCOUNT_JSON) supplies the project id used
as the token audience — no extra secrets. Raising SocialAuthError maps to a
4xx/5xx with the given message at the endpoint.
"""
import base64
import json

import google.auth.transport.requests
from google.oauth2 import id_token as google_id_token

from app.core.config import settings

# Providers whose email we accept even when Firebase reports email_verified
# false. Firebase only marks Google emails verified; GitHub only exposes
# emails GitHub itself has verified, so trusting it is fine for this app.
_TRUSTED_UNVERIFIED_PROVIDERS = {"github.com"}

_request = google.auth.transport.requests.Request()


class SocialAuthError(Exception):
    def __init__(self, message: str, status_code: int = 401):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _firebase_project_id() -> str:
    if settings.FIREBASE_PROJECT_ID:
        return settings.FIREBASE_PROJECT_ID
    if settings.FIREBASE_SERVICE_ACCOUNT_JSON:
        try:
            info = json.loads(base64.b64decode(settings.FIREBASE_SERVICE_ACCOUNT_JSON))
            return info.get("project_id", "")
        except (ValueError, json.JSONDecodeError):
            return ""
    return ""


def verify_firebase(token: str) -> dict:
    """Validate a Firebase Auth ID token and extract the user profile."""
    project_id = _firebase_project_id()
    if not project_id:
        raise SocialAuthError(
            "Social sign-in is not configured on the server "
            "(set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID)",
            503,
        )

    try:
        # Checks signature (securetoken certs), expiry, audience and issuer.
        claims = google_id_token.verify_firebase_token(token, _request, audience=project_id)
    except ValueError:
        raise SocialAuthError("Invalid or expired sign-in token")
    except Exception:
        raise SocialAuthError("Could not verify the sign-in token", 502)

    email = (claims.get("email") or "").lower()
    if not email:
        raise SocialAuthError("This sign-in method did not provide an email address", 400)

    # e.g. "google.com" / "github.com" / "password"
    provider = (claims.get("firebase") or {}).get("sign_in_provider", "")
    email_verified = bool(claims.get("email_verified")) or provider in _TRUSTED_UNVERIFIED_PROVIDERS

    return {
        "email": email,
        "email_verified": email_verified,
        "full_name": claims.get("name") or email.split("@")[0],
        "avatar_url": claims.get("picture"),
        "provider": provider.removesuffix(".com"),
    }
