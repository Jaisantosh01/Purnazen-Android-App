from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

APP_SLUGS = {"mobile-users", "mobile-admin", "mobile-doctors"}


class RegisterAppReleaseRequest(BaseModel):
    """Payload the release CI posts (with the X-Release-Token header) after it
    has uploaded the signed APK to the private releases container."""

    model_config = ConfigDict(populate_by_name=True)

    app_slug: str = Field(alias="appSlug", min_length=1, max_length=40)
    version: str = Field(min_length=1, max_length=20)
    apk_blob_path: str = Field(alias="apkBlobPath", min_length=1, max_length=255)
    version_code: Optional[int] = Field(alias="versionCode", default=None)
    sha256: Optional[str] = Field(default=None, max_length=64)
    notes: Optional[str] = None
    forced: bool = False

    @field_validator("app_slug")
    @classmethod
    def _valid_slug(cls, v: str) -> str:
        if v not in APP_SLUGS:
            raise ValueError(f"app_slug must be one of {sorted(APP_SLUGS)}")
        return v
