from datetime import date

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str


class EmailCheckRequest(BaseModel):
    # Plain str (not EmailStr) so a malformed address returns a soft message
    # instead of a 422 — the apps use this to validate as the user types.
    email: str


class AdminCreateUserRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    phone: str | None = None
    role_name: str = "patient"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    # RBAC: the client app sends the role it serves (patient/doctor/admin) so a
    # valid credential signing into the wrong app is rejected. Optional for
    # backward compatibility — when omitted, no role gate is applied.
    expected_role: str | None = None


class SocialLoginRequest(BaseModel):
    # Firebase Auth ID token — one token shape regardless of which provider
    # (Google, GitHub, ...) the user picked; verified server-side against the
    # Firebase project.
    id_token: str = Field(min_length=1)
    expected_role: str | None = None


class SocialLinkRequest(BaseModel):
    id_token: str = Field(min_length=1)


class ChangeEmailRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    new_email: EmailStr = Field(alias="newEmail")
    # Required for password accounts; social-created accounts (random unusable
    # password) may omit it — the linked provider identity is the proof.
    current_password: str | None = Field(default=None, alias="currentPassword")


class UpdateProfileRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    full_name: str | None = Field(
        default=None, alias="fullName", min_length=1, max_length=100
    )
    avatar_url: str | None = Field(default=None, alias="avatarUrl", max_length=500)
    phone: str | None = Field(
        default=None, max_length=15, pattern=r"^[+0-9 ()-]{6,15}$"
    )
    gender: str | None = Field(default=None, max_length=10)
    date_of_birth: date | None = Field(default=None, alias="dateOfBirth")

    # Health profile. Free-text fields accept "" so the patient can clear them;
    # the numeric ranges just keep obvious typos out of the report.
    blood_group: str | None = Field(default=None, alias="bloodGroup", max_length=5)
    height_cm: float | None = Field(default=None, alias="heightCm", ge=30, le=280)
    weight_kg: float | None = Field(default=None, alias="weightKg", ge=2, le=500)
    allergies: str | None = Field(default=None, max_length=1000)
    conditions: str | None = Field(default=None, max_length=1000)
    medications: str | None = Field(default=None, max_length=1000)


class ChangePasswordRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    current_password: str = Field(alias="currentPassword", min_length=1)
    new_password: str = Field(alias="newPassword", min_length=6, max_length=128)
