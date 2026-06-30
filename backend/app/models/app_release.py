import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)

from app.db.types import GUID
from app.db.base_class import Base


class AppRelease(Base):
    """A published, signed APK for one of the apps, stored in the private
    releases container. The newest active row per `app_slug` is what the in-app
    updater compares against.
    """

    __tablename__ = "app_releases"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4, nullable=False)
    app_slug = Column(String(40), nullable=False, index=True)  # mobile-users | mobile-admin | mobile-doctors
    version = Column(String(20), nullable=False)
    version_code = Column(Integer, nullable=True)
    apk_blob_path = Column(String(255), nullable=False)  # path within the releases container
    sha256 = Column(String(64), nullable=True)
    notes = Column(Text, nullable=True)
    forced = Column(Boolean, default=False, server_default="false")
    is_active = Column(Boolean, default=True, server_default="true")
    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    updated_by = Column(GUID(), ForeignKey("users.id"), nullable=True)

    __table_args__ = (
        UniqueConstraint("app_slug", "version", name="uq_app_releases_slug_version"),
    )

    def to_dict(self):
        return {
            "appSlug": self.app_slug,
            "version": self.version,
            "versionCode": self.version_code,
            "forced": bool(self.forced),
            "notes": self.notes or "",
            "sha256": self.sha256,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
