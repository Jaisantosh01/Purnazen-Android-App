import uuid
from typing import Annotated, Optional

from pydantic import BaseModel, Field, StringConstraints, field_validator

# Home-screen cards. The patient app paints them with these colours and opens
# icon_url as an image, so both are checked here rather than trusted.
Slug = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")]
HexColor = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^#[0-9A-Fa-f]{6}$")]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)]


def _https_or_none(value: Optional[str]) -> Optional[str]:
    if value in (None, ""):
        return None
    if not value.startswith("https://"):
        raise ValueError("icon_url must be an https:// link")
    return value


class QuickReliefCreate(BaseModel):
    name: Name
    slug: Slug
    title: Title
    subtitle: Optional[str] = Field(default=None, max_length=255)
    chat_question_id: Optional[uuid.UUID] = None
    icon_name: Optional[str] = Field(default=None, max_length=100)
    icon_url: Optional[str] = Field(default=None, max_length=500)
    background_color: Optional[HexColor] = None
    text_color: Optional[HexColor] = None
    description: Optional[str] = Field(default=None, max_length=2000)
    sort_order: Optional[int] = Field(default=0, ge=0, le=10000)
    is_active: Optional[bool] = True

    _icon_url = field_validator("icon_url")(_https_or_none)


class QuickReliefUpdate(BaseModel):
    name: Optional[Name] = None
    slug: Optional[Slug] = None
    title: Optional[Title] = None
    subtitle: Optional[str] = Field(default=None, max_length=255)
    chat_question_id: Optional[uuid.UUID] = None
    icon_name: Optional[str] = Field(default=None, max_length=100)
    icon_url: Optional[str] = Field(default=None, max_length=500)
    background_color: Optional[HexColor] = None
    text_color: Optional[HexColor] = None
    description: Optional[str] = Field(default=None, max_length=2000)
    sort_order: Optional[int] = Field(default=None, ge=0, le=10000)
    is_active: Optional[bool] = None

    _icon_url = field_validator("icon_url")(_https_or_none)
