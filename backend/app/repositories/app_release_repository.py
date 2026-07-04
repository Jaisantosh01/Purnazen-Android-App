from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.app_release import AppRelease


class AppReleaseRepository:
    @staticmethod
    def get_by_slug_version(db: Session, app_slug: str, version: str) -> Optional[AppRelease]:
        return (
            db.query(AppRelease)
            .filter(AppRelease.app_slug == app_slug, AppRelease.version == version)
            .first()
        )

    @staticmethod
    def list_active(db: Session, app_slug: str) -> List[AppRelease]:
        """Active releases for an app, newest first (by created_at)."""
        return (
            db.query(AppRelease)
            .filter(AppRelease.app_slug == app_slug, AppRelease.is_active.is_(True))
            .order_by(AppRelease.created_at.desc())
            .all()
        )

    @staticmethod
    def save(db: Session, release: AppRelease) -> AppRelease:
        db.add(release)
        db.commit()
        db.refresh(release)
        return release
