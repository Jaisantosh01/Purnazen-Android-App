import hmac

from fastapi import APIRouter, Header, Query, Depends
from sqlalchemy.orm import Session
from typing import Optional

from app.api.deps import get_db
from app.core.config import settings
from app.schemas.app_release import APP_SLUGS, RegisterAppReleaseRequest
from app.services.app_release_service import AppReleaseService
from app.utils.responses import error_response, success_response

router = APIRouter(prefix="/app-releases", tags=["App Releases"])


# Deliberately unauthenticated. A build old enough to be force-updated may not
# be able to reach the login screen at all, and the check runs before any
# session exists — behind a token this 401'd, which the api client then turned
# into a "session expired" reset. It returns published version metadata only:
# the apps are distributed through the stores, and nothing here hands out a
# binary.
@router.get("/latest", summary="Latest published version for an app")
def latest_release(
    app: str = Query(..., description="App slug: mobile-users | mobile-admin | mobile-doctors"),
    db: Session = Depends(get_db),
):
    if app not in APP_SLUGS:
        return error_response("Unknown app", 400)
    latest = AppReleaseService.get_latest(db, app)
    if not latest:
        return error_response("No release found", 404)
    return success_response("Latest release", latest)


@router.post("", status_code=201, summary="Register a published version (CI only — X-Release-Token)")
def register_release(
    body: RegisterAppReleaseRequest,
    x_release_token: Optional[str] = Header(default=None, alias="X-Release-Token"),
    db: Session = Depends(get_db),
):
    expected = settings.RELEASE_REGISTER_TOKEN
    # Disabled unless a token is configured; constant-time compare to avoid leaks.
    if not expected or not x_release_token or not hmac.compare_digest(x_release_token, expected):
        return error_response("Unauthorized", 401)
    release = AppReleaseService.register(db, body)
    return success_response("Release registered", release, 201)
