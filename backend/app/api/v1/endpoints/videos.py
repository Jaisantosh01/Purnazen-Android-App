import logging
import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_role
from app.models.user import User
from app.models.videos import Videos
from app.repositories.video_repository import VideoRepository
from app.schemas.video import VideoCreate, VideoGroupCreate, VideoGroupUpdate, VideoUpdate
from app.services.video_service import VideoService
from app.utils.azure_storage import (
    blob_exists,
    create_blob_directory,
    list_all_blobs_with_sas,
    list_blob_children,
    upload_blob_file,
)
from app.utils.responses import error_response, success_response

logger = logging.getLogger(__name__)


class SyncGroupVideosRequest(BaseModel):
    video_ids: list[uuid.UUID]

router = APIRouter(prefix="/videos", tags=["Videos"])


# ── Blob Storage directory management ──


class CreateDirectoryRequest(BaseModel):
    path: str


class AddFolderRequest(BaseModel):
    prefix: str


VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".ogg", ".wmv", ".flv", ".m4v", ".3gp", ".mpeg", ".mpg"}


def _recursive_list_files(prefix: str) -> list[dict]:
    files = list_all_blobs_with_sas(prefix)
    return files


@router.post(
    "/storage/add-folder",
    summary="Import all videos from a storage folder to a group",
    description=(
        "Recursively list all video files under the given storage prefix, "
        "create a DB record for each one that doesn't already exist, and "
        "map every video to the specified group. Returns the newly-created videos."
    ),
    status_code=201,
)
def add_folder_to_library(
    body: AddFolderRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prefix = body.prefix if body.prefix.endswith("/") else body.prefix + "/"
    all_files = _recursive_list_files(prefix)

    if not all_files:
        return success_response("No video files found", {"videos": [], "count": 0})

    existing = db.query(Videos).filter(
        Videos.video_url.in_([f["name"] for f in all_files]),
        Videos.is_active == True,
    ).all()
    url_to_existing = {v.video_url: v for v in existing}

    created = []
    for f in all_files:
        if f["name"] in url_to_existing:
            continue
        raw_name = f["name"].split("/")[-1]
        title = os.path.splitext(raw_name)[0].replace("_", " ").replace("-", " ").strip().title()
        video = VideoRepository.create(
            db,
            title=title,
            description="",
            duration=0,
            icon="play-circle",
            video_url=f["name"],
            created_by=user.id,
            updated_by=user.id,
        )
        created.append(VideoService._process_video_data(video.to_dict()))

    # Return ALL matched records (new + existing) so the frontend can check them
    all_videos = [VideoService._process_video_data(v.to_dict()) for v in existing] + created

    return success_response(
        f"{len(all_videos)} video(s) found in folder",
        {"videos": all_videos, "count": len(all_videos)},
        201,
    )


@router.get(
    "/storage/directories",
    summary="List blob storage directories and files",
    description="List the directories and files directly under a given parent path.",
)
def list_directories(
    parent: str = Query(default="", description="Parent directory path (e.g. 'videos/')"),
    _user: User = Depends(require_role("admin")),
):
    dirs, files = list_blob_children(parent)
    return success_response(
        "Directories fetched successfully", {"directories": dirs, "files": files}
    )


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
    directory: str = Form(default=""),
    title: str = Form(...),
    description: str = Form(default=""),
    duration: int = Form(default=0),
    icon: str = Form(default="play-circle"),
    video_group_id: str = Form(default=""),
    sort_order: int = Form(default=0),
    overwrite: bool = Form(default=False),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not file.filename:
        return error_response("No file provided", 400)

    VIDEO_MIME_PREFIXES = ['video/']
    VIDEO_EXTENSIONS = {'.mp4', '.mov', '.avi', '.mkv', '.webm', '.ogg', '.wmv', '.flv', '.m4v', '.3gp'}
    ct = (file.content_type or '').lower()
    ext = os.path.splitext(file.filename)[1].lower()
    if not any(ct.startswith(p) for p in VIDEO_MIME_PREFIXES) and not (ext in VIDEO_EXTENSIONS and ct in ('application/octet-stream', '')):
        return error_response(f"Invalid file type: {ct or ext}. Only video files are allowed.", 400)

    dir_path = directory.strip().lstrip("/")
    if dir_path and not dir_path.endswith("/"):
        dir_path += "/"
    blob_path = f"{dir_path}{file.filename}"

    logger.info("upload_video: file='%s' directory='%s' dir_path='%s' blob_path='%s' content_type='%s' overwrite=%s",
                file.filename, directory, dir_path, blob_path, file.content_type, overwrite)

    # Check for duplicate blob before uploading (unless overwrite is requested)
    if not overwrite and blob_exists(blob_path):
        logger.warning("upload_video: DUPLICATE blob '%s' already exists — rejecting", blob_path)
        return error_response(
            f'File "{file.filename}" already exists in this folder.',
            409,
        )

    data = await file.read()
    blob_path = upload_blob_file(data, blob_path, content_type=file.content_type or "video/mp4")
    if not blob_path:
        return error_response("Azure Storage not configured", 503)

    parsed_group_id = uuid.UUID(video_group_id) if video_group_id else None
    create_data = VideoCreate(
        title=title,
        description=description,
        duration=duration,
        icon=icon,
        videoUrl=blob_path,
        videoGroupId=parsed_group_id,
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
