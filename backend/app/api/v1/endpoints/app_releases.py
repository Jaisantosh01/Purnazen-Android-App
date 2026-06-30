import hmac

from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.api.deps import get_db, get_current_user
from app.core.config import settings
from app.models.user import User
from app.schemas.app_release import APP_SLUGS, RegisterAppReleaseRequest
from app.services.app_release_service import AppReleaseService
from app.utils.responses import error_response, success_response

router = APIRouter(prefix="/app-releases", tags=["App Releases (OTA)"])


@router.get("/latest", summary="Latest release for an app (in-app updater)")
def latest_release(
    app: str = Query(..., description="App slug: mobile-users | mobile-admin | mobile-doctors"),
    user: User = Depends(get_current_user),
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
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if app_slug not in APP_SLUGS:
        return error_response("Unknown app", 400)
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
