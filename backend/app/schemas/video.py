import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class VideoBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str
    description: str
    duration: Optional[int] = None
    icon: Optional[str] = None
    video_url: Optional[str] = Field(default=None, alias="videoUrl")
    is_active: bool = Field(default=True, alias="isActive")


class VideoCreate(VideoBase):
    video_group_id: uuid.UUID = Field(alias="videoGroupId")
    sort_order: int = Field(default=0, alias="sortOrder")


class VideoUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: Optional[str] = None
    description: Optional[str] = None
    duration: Optional[int] = None
    icon: Optional[str] = None
    video_url: Optional[str] = Field(default=None, alias="videoUrl")
    is_active: Optional[bool] = Field(default=None, alias="isActive")


class VideoResponse(VideoBase):
    id: uuid.UUID
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    created_by: uuid.UUID = Field(alias="createdBy")
    updated_by: uuid.UUID = Field(alias="updatedBy")


class VideoGroupBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str
    description: str
    icon: Optional[str] = None
    sort_order: int = Field(default=0, alias="sortOrder")
    is_active: bool = Field(default=True, alias="isActive")


class VideoGroupCreate(VideoGroupBase):
    pass


class VideoGroupUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    sort_order: Optional[int] = Field(default=None, alias="sortOrder")
    is_active: Optional[bool] = Field(default=None, alias="isActive")


class VideoGroupResponse(VideoGroupBase):
    id: uuid.UUID
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    created_by: uuid.UUID = Field(alias="createdBy")
    updated_by: uuid.UUID = Field(alias="updatedBy")
