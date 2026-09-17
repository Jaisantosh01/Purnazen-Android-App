import json
import logging
from typing import Optional
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.app_release import AppRelease
from app.repositories.app_release_repository import AppReleaseRepository
from app.schemas.app_release import RegisterAppReleaseRequest


logger = logging.getLogger(__name__)

# Only link types the apps know how to open: web links (Play, App Store,
# TestFlight, Firebase App Distribution) and the two store deep-link schemes.
_ALLOWED_LINK_SCHEMES = {"https", "itms-apps", "itms-beta", "market"}
_PLATFORMS = ("android", "ios")


def store_links(app_slug: str) -> dict:
    """Per-platform update links for `app_slug` from STORE_LINKS_JSON.

    Malformed configuration is logged and ignored — the update check must keep
    working, and the apps fall back to their built-in store listing.
    """
    raw = (settings.STORE_LINKS_JSON or "").strip()
    if not raw:
        return {}
    try:
        table = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("STORE_LINKS_JSON is not valid JSON; ignoring it")
        return {}
    entry = table.get(app_slug) if isinstance(table, dict) else None
    if not isinstance(entry, dict):
        return {}
    links = {}
    for platform in _PLATFORMS:
        url = entry.get(platform)
        if isinstance(url, str) and urlparse(url).scheme in _ALLOWED_LINK_SCHEMES:
            links[platform] = url
        elif url:
            logger.warning("STORE_LINKS_JSON[%s][%s] has an unsupported link; ignoring it", app_slug, platform)
    return links


def _semver_key(version: str):
    """Return a tuple of ints for ordering dotted versions (missing parts = 0)."""
    parts = []
    for p in str(version).split("."):
        try:
            parts.append(int(p))
        except (TypeError, ValueError):
            parts.append(0)
    return tuple(parts)


class AppReleaseService:
    @staticmethod
    def get_latest(db: Session, app_slug: str) -> Optional[dict]:
        releases = AppReleaseRepository.list_active(db, app_slug)
        if not releases:
            return None
        latest = max(releases, key=lambda r: _semver_key(r.version))
        return {**latest.to_dict(), "storeLinks": store_links(app_slug)}

    @staticmethod
    def register(db: Session, data: RegisterAppReleaseRequest) -> dict:
        """Upsert a published-version row (by app_slug+version) and prune older
        active versions so only the most recent N stay active."""
        existing = AppReleaseRepository.get_by_slug_version(db, data.app_slug, data.version)
        if existing:
            existing.version_code = data.version_code
            existing.notes = data.notes
            existing.forced = data.forced
            existing.is_active = True
            release = AppReleaseRepository.save(db, existing)
        else:
            release = AppReleaseRepository.save(
                db,
                AppRelease(
                    app_slug=data.app_slug,
                    version=data.version,
                    version_code=data.version_code,
                    notes=data.notes,
                    forced=data.forced,
                    is_active=True,
                ),
            )

        AppReleaseService._prune(db, data.app_slug)
        return release.to_dict()

    @staticmethod
    def _prune(db: Session, app_slug: str) -> None:
        keep = max(1, settings.RELEASE_KEEP_VERSIONS)
        active = AppReleaseRepository.list_active(db, app_slug)
        if len(active) <= keep:
            return
        ordered = sorted(active, key=lambda r: _semver_key(r.version), reverse=True)
        for stale in ordered[keep:]:
            stale.is_active = False
        db.commit()
