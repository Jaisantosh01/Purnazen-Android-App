import hmac

from fastapi import APIRouter, Header, Query, Depends
from sqlalchemy.orm import Session
from typing import Optional

from app.api.deps import get_db
from app.core.config import settings
from app.schemas.app_release import APP_SLUGS, RegisterAppReleaseRequest
from app.services.app_release_service import AppReleaseService
from app.utils.responses import error_response, success_response

router = APIRouter(prefix="/app-releases", tags=["App Releases (OTA)"])


# Both read endpoints are deliberately unauthenticated. A build old enough to be
# force-updated may not be able to reach the login screen at all, and the
# updater runs before any session exists — behind a token these 401'd, which the
# api client then turned into a "session expired" reset. `/download` still only
# ever hands out the *current* build for a slug (see below), so this doesn't
# expose the archive of past releases.
@router.get("/latest", summary="Latest release for an app (in-app updater)")
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


@router.get(
    "/{app_slug}/{version}/download",
    summary="Short-lived SAS download URL for a release APK (in-app updater)",
)
def download_release(
    app_slug: str,
    version: str,
    db: Session = Depends(get_db),
):
    if app_slug not in APP_SLUGS:
        return error_response("Unknown app", 400)
    # Only the version `/latest` just advertised is downloadable, so an
    # anonymous caller can't walk back through older builds.
    latest = AppReleaseService.get_latest(db, app_slug)
    if not latest or latest.get("version") != version:
        return error_response("Release not found", 404)
    url = AppReleaseService.get_download_url(db, app_slug, version)
    if not url:
        return error_response("Release not found", 404)
    return success_response("Download URL", {"url": url})


@router.post("", status_code=201, summary="Register a release (CI only — X-Release-Token)")
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
