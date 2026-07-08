from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CreateUserAddressRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    house_name: Optional[str] = Field(default=None, alias="houseName", max_length=255)
    area: Optional[str] = Field(default=None, max_length=255)
    landmark: Optional[str] = Field(default=None, max_length=255)
    pincode: Optional[str] = Field(default=None, max_length=20)
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    type_of_address: Optional[str] = Field(default=None, alias="typeOfAddress", max_length=50)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_default: bool = Field(default=False, alias="isDefault")


class UpdateUserAddressRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    house_name: Optional[str] = Field(default=None, alias="houseName", max_length=255)
    area: Optional[str] = Field(default=None, max_length=255)
    landmark: Optional[str] = Field(default=None, max_length=255)
    pincode: Optional[str] = Field(default=None, max_length=20)
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    type_of_address: Optional[str] = Field(default=None, alias="typeOfAddress", max_length=50)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_default: Optional[bool] = Field(default=None, alias="isDefault")
