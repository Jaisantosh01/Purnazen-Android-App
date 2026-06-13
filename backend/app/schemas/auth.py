from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UpdateProfileRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    full_name: str | None = Field(
        default=None, alias="fullName", min_length=1, max_length=100
    )
    avatar_url: str | None = Field(default=None, alias="avatarUrl", max_length=500)


class ChangePasswordRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    current_password: str = Field(alias="currentPassword", min_length=1)
    new_password: str = Field(alias="newPassword", min_length=6, max_length=128)
