from datetime import date

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    # RBAC: the client app sends the role it serves (patient/doctor/admin) so a
    # valid credential signing into the wrong app is rejected. Optional for
    # backward compatibility — when omitted, no role gate is applied.
    expected_role: str | None = None


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


class ChangePasswordRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    current_password: str = Field(alias="currentPassword", min_length=1)
    new_password: str = Field(alias="newPassword", min_length=6, max_length=128)
