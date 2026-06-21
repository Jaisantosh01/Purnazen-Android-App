import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_role
from app.models.user import User
from app.schemas.video import VideoCreate, VideoGroupCreate, VideoGroupUpdate, VideoUpdate
from app.services.video_service import VideoService
from app.utils.azure_storage import (
    create_blob_directory,
    list_blob_directories,
    list_blob_subdirectories,
    upload_blob_file,
)
from app.utils.responses import error_response, success_response


class SyncGroupVideosRequest(BaseModel):
    video_ids: list[uuid.UUID]

router = APIRouter(prefix="/videos", tags=["Videos"])


# ── Blob Storage directory management ──


class CreateDirectoryRequest(BaseModel):
    path: str


@router.get(
    "/storage/directories",
    summary="List blob storage directories",
    description="List top-level directories or subdirectories under a given parent path.",
)
def list_directories(
    parent: str = Query(default="", description="Parent directory path (e.g. 'videos/')"),
    _user: User = Depends(require_role("admin")),
):
    dirs = list_blob_subdirectories(parent) if parent else list_blob_directories()
    return success_response("Directories fetched successfully", {"directories": dirs})


@router.post(
    "/storage/directories",
    summary="Create blob storage directory",
    description="Create a virtual directory in the blob container.",
    status_code=201,
)
def create_directory(
    body: CreateDirectoryRequest,
    _user: User = Depends(require_role("admin")),
):
    ok = create_blob_directory(body.path)
    if not ok:
        return error_response("Azure Storage not configured", 503)
    return success_response("Directory created successfully", {"path": body.path}, 201)


@router.post(
    "/upload",
    summary="Upload video to blob storage",
    description=(
        "Upload a video file to a specified blob directory. "
        "The file is saved to ``{directory}{filename}`` and a corresponding "
        "``Video`` record is created with ``video_url`` set to the blob path."
    ),
    status_code=201,
)
async def upload_video(
    file: UploadFile = File(...),
    directory: str = Form(...),
    title: str = Form(...),
    description: str = Form(default=""),
    duration: int = Form(default=0),
    icon: str = Form(default="play-circle"),
    video_group_id: uuid.UUID = Form(...),
    sort_order: int = Form(default=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not file.filename:
        return error_response("No file provided", 400)

    dir_path = directory if directory.endswith("/") else directory + "/"
    blob_path = f"{dir_path}{file.filename}"

    data = await file.read()
    blob_path = upload_blob_file(data, blob_path, content_type=file.content_type or "video/mp4")
    if not blob_path:
        return error_response("Azure Storage not configured", 503)

    create_data = VideoCreate(
        title=title,
        description=description,
        duration=duration,
        icon=icon,
        videoUrl=blob_path,
        videoGroupId=video_group_id,
        sortOrder=sort_order,
    )
    response, status_code = VideoService.upsert_video(db, user, create_data)
    if not response["success"]:
        return error_response(response["message"], status_code)
    return success_response(response["message"], response["video"], status_code)


@router.get(
    "/groups",
    summary="List video groups",
    description="Fetch all video groups (e.g., Quick Relief, Wellness). Can be filtered to only active groups.",
)
def get_video_groups(
    active_only: bool = Query(default=True, description="Filter to only active groups"),
    db: Session = Depends(get_db),
):
    groups = VideoService.get_groups(db, active_only)
    return success_response(
        "Video groups fetched successfully", {"groups": groups, "total": len(groups)}
    )


@router.get(
    "/groups/{group_id}",
    summary="Get video group detail",
    description="Fetch a single video group by its internal ID.",
)
def get_video_group(group_id: uuid.UUID, db: Session = Depends(get_db)):
    group = VideoService.get_group(db, group_id)
    if not group:
        return error_response("Video group not found", 404)
    return success_response("Video group fetched successfully", group)


@router.get(
    "/groups/{group_id}/catalog",
    summary="Get video group catalog",
    description="Fetch a video group along with all its active associated videos.",
)
def get_video_group_catalog(
    group_id: uuid.UUID,
    active_only: bool = Query(default=True),
    db: Session = Depends(get_db)
):
    catalog = VideoService.get_group_with_videos(db, group_id, active_only)
    if not catalog:
        return error_response("Video group not found", 404)
    return success_response("Video catalog fetched successfully", catalog)


@router.post(
    "/groups",
    summary="Create video group",
    description="Create a new category for videos (e.g., 'Face Glow', 'Morning Yoga'). Requires admin/auth.",
    status_code=201,
)
def create_video_group(
    body: VideoGroupCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    response, status_code = VideoService.upsert_group(db, user, body)
    if not response["success"]:
        return error_response(response["message"], status_code)
    return success_response(response["message"], response["group"], status_code)


@router.put(
    "/groups/{group_id}",
    summary="Update video group",
    description="Modify an existing video group's title, description, icon, or status.",
)
def update_video_group(
    group_id: uuid.UUID,
    body: VideoGroupUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    response, status_code = VideoService.upsert_group(db, user, body, group_id)
    if not response["success"]:
        return error_response(response["message"], status_code)
    return success_response(response["message"], response["group"], status_code)


@router.put(
    "/groups/{group_id}/videos",
    summary="Sync videos in group",
    description="Replace the set of videos assigned to a group with the given list of video IDs.",
)
def sync_group_videos(
    group_id: uuid.UUID,
    body: SyncGroupVideosRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    response, status_code = VideoService.add_videos_to_group(db, group_id, body.video_ids, user)
    if not response["success"]:
        return error_response(response["message"], status_code)
    return success_response(response["message"], None, status_code)


@router.delete(
    "/groups/{group_id}",
    summary="Delete video group",
    description="Soft-delete a video group and all its associated videos by setting isActive to false.",
)
def delete_video_group(
    group_id: uuid.UUID,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    response, status_code = VideoService.delete_group(db, group_id)
    if not response["success"]:
        return error_response(response["message"], status_code)
    return success_response(response["message"], None, status_code)


@router.get(
    "",
    summary="List videos",
    description="Fetch videos, optionally filtered by group (Quick Relief, Wellness, etc.).",
)
def get_videos(
    group_id: Optional[uuid.UUID] = Query(default=None, description="Filter videos by group ID"),
    active_only: bool = Query(default=True, description="Filter to only active videos"),
    db: Session = Depends(get_db),
):
    videos = VideoService.get_videos(db, group_id, active_only)
    return success_response(
        "Videos fetched successfully", {"videos": videos, "total": len(videos)}
    )


@router.get(
    "/{video_id}",
    summary="Get video detail",
    description="Fetch detailed metadata for a single video, including its URL and duration.",
)
def get_video(video_id: uuid.UUID, db: Session = Depends(get_db)):
    video = VideoService.get_video(db, video_id)
    if not video:
        return error_response("Video not found", 404)
    return success_response("Video fetched successfully", video)


@router.post(
    "",
    summary="Create video",
    description="Upload metadata for a new video and associate it with a group. Requires admin/auth.",
    status_code=201,
)
def create_video(
    body: VideoCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    response, status_code = VideoService.upsert_video(db, user, body)
    if not response["success"]:
        return error_response(response["message"], status_code)
    return success_response(response["message"], response["video"], status_code)


@router.put(
    "/{video_id}",
    summary="Update video",
    description="Modify a video's title, URL, duration, or assigned group.",
)
def update_video(
    video_id: uuid.UUID,
    body: VideoUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    response, status_code = VideoService.upsert_video(db, user, body, video_id)
    if not response["success"]:
        return error_response(response["message"], status_code)
    return success_response(response["message"], response["video"], status_code)


@router.delete(
    "/{video_id}",
    summary="Delete video",
    description="Soft-delete a video from the catalog by setting isActive to false.",
)
def delete_video(
    video_id: uuid.UUID,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    response, status_code = VideoService.delete_video(db, video_id)
    if not response["success"]:
        return error_response(response["message"], status_code)
    return success_response(response["message"], None, status_code)
