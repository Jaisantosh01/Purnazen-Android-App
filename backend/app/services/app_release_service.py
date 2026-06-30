from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.app_release import AppRelease
from app.repositories.app_release_repository import AppReleaseRepository
from app.schemas.app_release import RegisterAppReleaseRequest
from app.utils.azure_storage import generate_release_sas_url


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
        return latest.to_dict()

    @staticmethod
    def get_download_url(db: Session, app_slug: str, version: str) -> Optional[str]:
        release = AppReleaseRepository.get_by_slug_version(db, app_slug, version)
        if not release or not release.is_active:
            return None
        return generate_release_sas_url(release.apk_blob_path)

    @staticmethod
    def register(db: Session, data: RegisterAppReleaseRequest) -> dict:
        """Upsert a release row (by app_slug+version) and prune older active
        versions so only the most recent N stay active."""
        existing = AppReleaseRepository.get_by_slug_version(db, data.app_slug, data.version)
        if existing:
            existing.apk_blob_path = data.apk_blob_path
            existing.version_code = data.version_code
            existing.sha256 = data.sha256
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
                    apk_blob_path=data.apk_blob_path,
                    sha256=data.sha256,
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
