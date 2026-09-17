import re
from typing import Literal, Optional

from pydantic import BaseModel, Field

# The patient app turns `value` into a tel:, mailto:, whatsapp:// or https://
# link, so what an admin types here is exactly what a patient's phone opens.
ContactType = Literal["chat", "email", "phone", "whatsapp", "other"]

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_PHONE = re.compile(r"^\+?[0-9][0-9 ()-]{5,19}$")


def validate_contact_value(contact_type: str, value: Optional[str]) -> Optional[str]:
    """Normalise and check a contact value for its type. Empty = not wired up yet."""
    if value is None or not value.strip():
        return None
    value = value.strip()
    if contact_type == "email" and not _EMAIL.match(value):
        raise ValueError("Enter a valid email address")
    if contact_type in ("phone", "whatsapp") and not _PHONE.match(value):
        raise ValueError("Enter a phone number with country code, e.g. +91 98765 43210")
    if contact_type in ("chat", "other") and not value.startswith("https://"):
        raise ValueError("Enter an https:// link")
    return value


class SupportContactCreate(BaseModel):
    contact_type: ContactType
    title: str = Field(min_length=1, max_length=100)
    subtitle: Optional[str] = Field(default=None, max_length=150)
    value: Optional[str] = Field(default=None, max_length=255)
    icon: Optional[str] = Field(default=None, max_length=60)
    color: Optional[str] = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    sort_order: Optional[int] = Field(default=0, ge=0, le=10000)
    is_active: Optional[bool] = True


class SupportContactUpdate(BaseModel):
    contact_type: Optional[ContactType] = None
    title: Optional[str] = Field(default=None, min_length=1, max_length=100)
    subtitle: Optional[str] = Field(default=None, max_length=150)
    value: Optional[str] = Field(default=None, max_length=255)
    icon: Optional[str] = Field(default=None, max_length=60)
    color: Optional[str] = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    sort_order: Optional[int] = Field(default=None, ge=0, le=10000)
    is_active: Optional[bool] = None


class SupportFaqCreate(BaseModel):
    question: str
    answer: str
    sort_order: Optional[int] = 0
    is_active: Optional[bool] = True


class SupportFaqUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
