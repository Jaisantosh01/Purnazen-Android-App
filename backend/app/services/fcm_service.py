"""Firebase Cloud Messaging (HTTP v1) sender.

Mirrors the Google Meet service pattern: ``FIREBASE_SERVICE_ACCOUNT_JSON`` is a
base64-encoded service-account key for the Firebase project. When it is empty
(local dev without Firebase) every send is silently skipped — in-app
notifications still work, only device push is disabled.

Payloads use both ``notification`` (so Android displays a tray notification
while the app is background/closed, no headless JS needed) and ``data`` (so a
foreground app can route taps to the right screen).
"""

import base64
import json
import logging
import threading

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_SCOPES = ["https://www.googleapis.com/auth/firebase.messaging"]

_lock = threading.Lock()
_credentials = None
_project_id = None
_disabled_logged = False


def _get_credentials():
    """Lazily build (and cache) service-account credentials. None => disabled."""
    global _credentials, _project_id, _disabled_logged
    with _lock:
        if _credentials is not None:
            return _credentials

        raw = getattr(settings, "FIREBASE_SERVICE_ACCOUNT_JSON", "")
        if not raw:
            if not _disabled_logged:
                logger.info("FCM disabled: FIREBASE_SERVICE_ACCOUNT_JSON is not set.")
                _disabled_logged = True
            return None

        try:
            from google.oauth2.service_account import Credentials

            info = json.loads(base64.b64decode(raw))
            _credentials = Credentials.from_service_account_info(info, scopes=_SCOPES)
            _project_id = info.get("project_id")
            return _credentials
        except Exception as exc:  # pragma: no cover — misconfiguration
            logger.error("FCM disabled: invalid FIREBASE_SERVICE_ACCOUNT_JSON (%s)", exc)
            return None


def is_enabled() -> bool:
    return _get_credentials() is not None


def _access_token() -> str:
    from google.auth.transport.requests import Request

    creds = _get_credentials()
    if not creds.valid:
        creds.refresh(Request())
    return creds.token


def send_to_token(token: str, title: str, body: str, data: dict | None = None) -> bool:
    """Send one push. Returns False when the token is dead (caller should
    delete it) and True otherwise (including when FCM is disabled)."""
    if not is_enabled():
        return True

    message = {
        "message": {
            "token": token,
            "notification": {"title": title, "body": body},
            # FCM requires string values in data
            "data": {k: str(v) for k, v in (data or {}).items()},
            "android": {"priority": "HIGH", "notification": {"channel_id": "default"}},
        }
    }

    try:
        resp = httpx.post(
            f"https://fcm.googleapis.com/v1/projects/{_project_id}/messages:send",
            json=message,
            headers={"Authorization": f"Bearer {_access_token()}"},
            timeout=10,
        )
        if resp.status_code == 200:
            return True
        # 404 UNREGISTERED / 400 invalid-argument on the token => prune it
        if resp.status_code in (400, 404):
            detail = resp.text[:300]
            logger.info("FCM token rejected (%s): %s", resp.status_code, detail)
            return False
        logger.warning("FCM send failed (%s): %s", resp.status_code, resp.text[:300])
        return True
    except Exception as exc:
        logger.warning("FCM send error: %s", exc)
        return True
