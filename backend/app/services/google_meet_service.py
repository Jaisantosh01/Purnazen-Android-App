"""Google Meet link generation via the Calendar API.

Requires a Google Cloud service account with the Calendar API enabled.
When ``GOOGLE_SERVICE_ACCOUNT_JSON`` is empty the service gracefully
returns ``None`` (no meet link created).
"""
import json
import logging
import uuid
from datetime import datetime
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

# Lazy imports so the module loads even when the packages aren't installed.
_google_available = False
try:
    from google.oauth2.service_account import Credentials
    from googleapiclient.discovery import build

    _google_available = True
except ImportError:
    logger.warning(
        "google-api-python-client / google-auth not installed; "
        "Google Meet links will not be generated."
    )


SCOPES = ["https://www.googleapis.com/auth/calendar"]
TIMEZONE = "Asia/Kolkata"


def _get_calendar_service():
    """Build and return an authenticated Calendar API service, or ``None``."""
    if not _google_available:
        return None

    raw = settings.GOOGLE_SERVICE_ACCOUNT_JSON
    if not raw:
        return None

    try:
        service_account_info = json.loads(raw)
        creds = Credentials.from_service_account_info(
            service_account_info, scopes=SCOPES
        )
        return build("calendar", "v3", credentials=creds, cache_discovery=False)
    except Exception as exc:
        logger.error("Failed to initialise Calendar API client: %s", exc)
        return None


def create_meet_link(
    summary: str,
    description: str,
    start_dt: datetime,
    end_dt: datetime,
) -> Optional[str]:
    """Create a Google Calendar event with a Google Meet conference.

    Returns the ``https://meet.google.com/xxx-xxxx-xxx`` link or ``None``
    when the service is not configured / an error occurs.
    """
    service = _get_calendar_service()
    if service is None:
        return None

    event = {
        "summary": summary,
        "description": description,
        "start": {"dateTime": start_dt.isoformat(), "timeZone": TIMEZONE},
        "end": {"dateTime": end_dt.isoformat(), "timeZone": TIMEZONE},
        "conferenceData": {
            "createRequest": {
                "requestId": str(uuid.uuid4()),
                "conferenceSolutionKey": {"type": "hangoutsMeet"},
            }
        },
    }

    try:
        created = (
            service.events()
            .insert(
                calendarId="primary",
                body=event,
                conferenceDataVersion=1,
            )
            .execute()
        )
        link = (
            created.get("conferenceData", {})
            .get("entryPoints", [{}])[0]
            .get("uri")
        )
        if link:
            logger.info("Google Meet link created: %s", link)
            return link
        logger.warning("Calendar event created but no Meet link found in response")
        return None
    except Exception as exc:
        logger.error("Failed to create Google Meet link: %s", exc)
        return None
