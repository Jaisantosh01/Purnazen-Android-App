import os
import uuid

from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.video_repository import VideoGroupMappingRepository, VideoGroupRepository, VideoRepository
from app.schemas.video import VideoCreate, VideoGroupCreate, VideoGroupUpdate, VideoUpdate
from app.utils.azure_storage import generate_video_sas_url


class VideoService:
    @staticmethod
    def _history_refs(db: Session, *, group_id: uuid.UUID = None, video_id: uuid.UUID = None) -> int:
        """Count user-history rows pointing at this content.

        ``therapy_sessions`` (watch history) and ``therapy_feedback`` reference
        groups/videos through NOT NULL foreign keys, so a hard delete would
        either fail on the constraint or take real user history with it. When
        any exist the hard delete is refused and the caller soft-deletes
        instead — content disappears from the apps either way, but history and
        the reporting built on it stay intact.
        """
        from app.models.therapy_feedback import TherapyFeedback
        from app.models.therapy_session import TherapySession

        if group_id is not None:
            return (
                db.query(TherapySession).filter(TherapySession.group_id == group_id).count()
                + db.query(TherapyFeedback).filter(TherapyFeedback.video_group_id == group_id).count()
            )
        return db.query(TherapySession).filter(TherapySession.video_id == video_id).count()

    @staticmethod
    def _process_video_data(data: dict):
        if data.get("videoUrl"):
            data["videoUrl"] = generate_video_sas_url(data["videoUrl"])
        return data

    @staticmethod
    def get_groups(db: Session, active_only: bool = True):
        groups = VideoGroupRepository.get_all(db, active_only)
        return [g.to_dict() for g in groups]

    @staticmethod
    def get_group(db: Session, group_id: uuid.UUID):
        group = VideoGroupRepository.get_by_id(db, group_id)
        return group.to_dict() if group else None

    @staticmethod
    def upsert_group(db: Session, user: User, data: VideoGroupCreate | VideoGroupUpdate, group_id: uuid.UUID = None):
        if group_id:
            group = VideoGroupRepository.get_by_id(db, group_id)
            if not group:
                return {"success": False, "message": "Video group not found"}, 404
            
            group = VideoGroupRepository.update(
                db, 
                group, 
                **data.model_dump(exclude_unset=True),
                updated_by=user.id
            )
            return {"success": True, "message": "Video group updated", "group": group.to_dict()}, 200
        else:
            group = VideoGroupRepository.create(
                db, 
                **data.model_dump(),
                created_by=user.id,
                updated_by=user.id
            )
            return {"success": True, "message": "Video group created", "group": group.to_dict()}, 201

    @staticmethod
    def delete_group(db: Session, group_id: uuid.UUID, hard: bool = False):
        group = VideoGroupRepository.get_by_id(db, group_id)
        if not group:
            return {"success": False, "message": "Video group not found"}, 404

        if hard:
            refs = VideoService._history_refs(db, group_id=group_id)
            if refs:
                return {
                    "success": False,
                    "message": (
                        f"This group has {refs} user history record(s) and cannot be permanently "
                        "deleted. Disable it instead — it will disappear from the apps."
                    ),
                }, 409
            # Detach the config that points here (both FKs are nullable) so the
            # delete doesn't trip the constraint, then drop the group. Its
            # video_mappings cascade; the videos themselves stay in the library.
            from app.models.chat_option import ChatOption
            from app.models.wellness_session import WellnessSession

            db.query(WellnessSession).filter(WellnessSession.video_group_id == group_id).update(
                {"video_group_id": None}, synchronize_session=False
            )
            db.query(ChatOption).filter(ChatOption.video_group_id == group_id).update(
                {"video_group_id": None}, synchronize_session=False
            )
            db.delete(group)
            db.commit()
            return {"success": True, "message": "Video group permanently deleted"}, 200

        # Soft delete associated video mappings
        for mapping in group.video_mappings:
            mapping.is_active = False

        VideoGroupRepository.delete(db, group)
        return {"success": True, "message": "Video group deleted (deactivated)"}, 200

    @staticmethod
    def get_videos(db: Session, group_id: uuid.UUID = None, active_only: bool = True):
        if group_id:
            videos = VideoRepository.get_by_group(db, group_id, active_only)
        else:
            videos = VideoRepository.get_all(db, active_only)
        return [VideoService._process_video_data(v.to_dict()) for v in videos]

    @staticmethod
    def get_video(db: Session, video_id: uuid.UUID):
        video = VideoRepository.get_by_id(db, video_id)
        return VideoService._process_video_data(video.to_dict()) if video else None

    @staticmethod
    def get_group_with_videos(db: Session, group_id: uuid.UUID, active_only: bool = True):
        group = VideoGroupRepository.get_by_id(db, group_id)
        if not group:
            return None
        
        videos = VideoRepository.get_by_group(db, group_id, active_only)
        data = group.to_dict()
        data["videos"] = [VideoService._process_video_data(v.to_dict()) for v in videos]
        return data

    @staticmethod
    def upsert_video(db: Session, user: User, data: VideoCreate | VideoUpdate, video_id: uuid.UUID = None):
        if video_id:
            video = VideoRepository.get_by_id(db, video_id)
            if not video:
                return {"success": False, "message": "Video not found"}, 404
            
            video = VideoRepository.update(
                db, 
                video, 
                **data.model_dump(exclude_unset=True),
                updated_by=user.id
            )
            return {"success": True, "message": "Video updated", "video": VideoService._process_video_data(video.to_dict())}, 200
        else:
            # Create video without video_group_id and sort_order
            video_fields = data.model_dump(exclude={'video_group_id', 'sort_order'})
            video = VideoRepository.create(
                db, 
                **video_fields,
                created_by=user.id,
                updated_by=user.id
            )

            # Only create mapping when a group was provided
            if data.video_group_id:
                if not VideoGroupRepository.get_by_id(db, data.video_group_id):
                    return {"success": False, "message": "Video group not found"}, 404
                VideoGroupMappingRepository.create(
                    db,
                    video_group_id=data.video_group_id,
                    video_id=video.id,
                    sort_order=data.sort_order,
                    created_by=user.id,
                    updated_by=user.id
                )
                return {"success": True, "message": "Video created and mapped to group", "video": VideoService._process_video_data(video.to_dict())}, 201
            else:
                return {"success": True, "message": "Video created", "video": VideoService._process_video_data(video.to_dict())}, 201

    @staticmethod
    def create_or_update_uploaded_video(db: Session, user: User, data: VideoCreate):
        """Idempotent upsert keyed on ``video_url`` for the upload flow.

        A connection dropped mid-upload can leave the blob written but the
        client unaware; the retry re-uploads with ``overwrite=True``. Keying the
        catalog record on the blob path means that retry updates the existing
        row (and reactivates/creates its group mapping) instead of piling up a
        duplicate entry under the same file — the "new row below the failed one"
        the retries used to produce.
        """
        existing = VideoRepository.get_by_url(db, data.video_url) if data.video_url else None
        if not existing:
            return VideoService.upsert_video(db, user, data)

        VideoRepository.update(
            db,
            existing,
            title=data.title,
            description=data.description,
            duration=data.duration,
            icon=data.icon,
            updated_by=user.id,
        )

        if data.video_group_id:
            if not VideoGroupRepository.get_by_id(db, data.video_group_id):
                return {"success": False, "message": "Video group not found"}, 404
            mapping = VideoGroupMappingRepository.get_mapping(db, data.video_group_id, existing.id)
            if mapping:
                if not mapping.is_active:
                    VideoGroupMappingRepository.update(
                        db, mapping, is_active=True, updated_by=user.id
                    )
            else:
                VideoGroupMappingRepository.create(
                    db,
                    video_group_id=data.video_group_id,
                    video_id=existing.id,
                    sort_order=data.sort_order,
                    created_by=user.id,
                    updated_by=user.id,
                )

        return {
            "success": True,
            "message": "Existing video updated from upload",
            "video": VideoService._process_video_data(existing.to_dict()),
        }, 200

    @staticmethod
    def delete_video(db: Session, video_id: uuid.UUID, hard: bool = False):
        video = VideoRepository.get_by_id(db, video_id)
        if not video:
            return {"success": False, "message": "Video not found"}, 404

        if hard:
            refs = VideoService._history_refs(db, video_id=video_id)
            if refs:
                return {
                    "success": False,
                    "message": (
                        f"This video has {refs} user history record(s) and cannot be permanently "
                        "deleted. Disable it instead — it will disappear from the apps."
                    ),
                }, 409
            # group_mappings cascade with the row. The blob in storage is left
            # alone: the same file can back more than one catalog entry.
            db.delete(video)
            db.commit()
            return {"success": True, "message": "Video permanently deleted"}, 200

        # Soft delete all mappings for this video
        for mapping in video.group_mappings:
            mapping.is_active = False

        VideoRepository.delete(db, video)
        return {"success": True, "message": "Video deleted (deactivated)"}, 200

    @staticmethod
    def _video_dependencies(db: Session, video) -> dict:
        """Describe everything that references a video: the groups it's mapped
        to, the wellness sessions linked to those groups, and how many user
        history rows point at it. The frontend uses this to warn before a move
        or delete and to explain why a hard delete is refused.
        """
        from app.models.wellness_session import WellnessSession

        mappings = [m for m in video.group_mappings if m.is_active]
        groups = []
        group_ids = []
        for m in mappings:
            group = VideoGroupRepository.get_by_id(db, m.video_group_id)
            if group and group.is_active:
                groups.append({"id": group.id, "title": group.title})
                group_ids.append(group.id)

        sessions = []
        if group_ids:
            rows = (
                db.query(WellnessSession)
                .filter(
                    WellnessSession.video_group_id.in_(group_ids),
                    WellnessSession.is_active == True,
                )
                .all()
            )
            sessions = [{"id": s.id, "title": s.title} for s in rows]

        history = VideoService._history_refs(db, video_id=video.id)
        return {
            "groups": groups,
            "sessions": sessions,
            "historyCount": history,
            "canHardDelete": history == 0,
        }

    @staticmethod
    def get_storage_file_info(db: Session, path: str) -> dict:
        """Return the DB video (if any) behind a storage blob path plus its
        dependencies. ``path`` is the raw blob path (``video_url``), not a SAS URL.
        """
        video = VideoRepository.get_by_url(db, path)
        if not video:
            return {"video": None, "dependencies": None}
        return {
            "video": VideoService._process_video_data(video.to_dict()),
            "dependencies": VideoService._video_dependencies(db, video),
        }

    @staticmethod
    def move_storage_file(db: Session, user: User, src_path: str, dst_directory: str, overwrite: bool = False):
        """Move a blob to another folder and keep the catalog consistent.

        Group/session mappings reference the video by ID, so moving the file and
        repointing ``video_url`` leaves every mapping intact — nothing to
        rewrite. Returns the updated video plus its dependencies so the UI can
        confirm what carried over.
        """
        from app.utils.azure_storage import blob_exists, move_blob, preserve_empty_directory

        if not blob_exists(src_path):
            return {"success": False, "message": "Source file not found in storage"}, 404

        dir_path = (dst_directory or "").strip().lstrip("/")
        if dir_path and not dir_path.endswith("/"):
            dir_path += "/"
        filename = src_path.split("/")[-1]
        dst_path = f"{dir_path}{filename}"

        if dst_path == src_path:
            return {"success": False, "message": "The file is already in that folder"}, 400

        try:
            moved = move_blob(src_path, dst_path, overwrite=overwrite)
        except FileExistsError:
            return {
                "success": False,
                "message": f'"{filename}" already exists in the destination folder.',
            }, 409
        except Exception as exc:  # noqa: BLE001 — surface a clean message to the client
            return {"success": False, "message": f"Failed to move file: {exc}"}, 500

        if not moved:
            return {"success": False, "message": "Azure Storage not configured"}, 503

        # Keep the source folder alive even if it's now empty.
        src_dir = src_path[: src_path.rfind("/") + 1] if "/" in src_path else ""
        preserve_empty_directory(src_dir)

        video = VideoRepository.get_by_url(db, src_path)
        dependencies = None
        video_data = None
        if video:
            video = VideoRepository.update(db, video, video_url=dst_path, updated_by=user.id)
            dependencies = VideoService._video_dependencies(db, video)
            video_data = VideoService._process_video_data(video.to_dict())

        return {
            "success": True,
            "message": f'Moved "{filename}" to {dir_path or "root"}',
            "video": video_data,
            "dependencies": dependencies,
        }, 200

    @staticmethod
    def rename_storage_file(db: Session, user: User, src_path: str, new_name: str, update_title: bool = True):
        """Rename a stored video's file within its current folder.

        The **extension is locked** to the original: whatever the admin types is
        reduced to a base name and the source file's extension is re-attached,
        so an ``.mp4`` can't become an ``.mov``/``.txt``/etc. The folder and
        every group/session mapping stay put (mappings key on the video ID).

        By default the catalog record's ``title`` is also refreshed from the new
        name so the rename shows up wherever the video appears (group catalogs,
        sessions, video management) — not just in the storage browser.
        """
        from app.utils.azure_storage import blob_exists, move_blob

        if not blob_exists(src_path):
            return {"success": False, "message": "Source file not found in storage"}, 404

        src_filename = src_path.rsplit("/", 1)[-1]
        _, ext = os.path.splitext(src_filename)  # e.g. ".mp4" (kept verbatim)

        raw = (new_name or "").strip().replace("\\", "/").split("/")[-1].strip()
        base = os.path.splitext(raw)[0].strip()  # drop any extension the admin typed
        if not base:
            return {"success": False, "message": "Enter a file name"}, 400
        clean = f"{base}{ext}"

        src_dir = src_path[: src_path.rfind("/") + 1] if "/" in src_path else ""
        dst_path = f"{src_dir}{clean}"

        if dst_path == src_path:
            return {"success": False, "message": "That's already the file name"}, 400

        try:
            moved = move_blob(src_path, dst_path, overwrite=False)
        except FileExistsError:
            return {"success": False, "message": f'"{clean}" already exists in this folder.'}, 409
        except Exception as exc:  # noqa: BLE001
            return {"success": False, "message": f"Failed to rename file: {exc}"}, 500

        if not moved:
            return {"success": False, "message": "Azure Storage not configured"}, 503

        video = VideoRepository.get_by_url(db, src_path)
        video_data = None
        dependencies = None
        if video:
            fields = {"video_url": dst_path, "updated_by": user.id}
            if update_title:
                pretty = base.replace("_", " ").replace("-", " ").strip()
                if pretty:
                    fields["title"] = pretty
            video = VideoRepository.update(db, video, **fields)
            video_data = VideoService._process_video_data(video.to_dict())
            dependencies = VideoService._video_dependencies(db, video)

        return {
            "success": True,
            "message": f'Renamed to "{clean}"',
            "video": video_data,
            "dependencies": dependencies,
        }, 200

    @staticmethod
    def delete_storage_file(db: Session, path: str, hard: bool = False):
        """Delete a storage blob and reconcile its catalog record.

        A soft delete deactivates the video (and its mappings) but leaves the
        blob in place, mirroring ``delete_video``. A hard delete removes the DB
        record and the blob together, and is refused with 409 when user history
        references the video.
        """
        from app.utils.azure_storage import delete_blob, preserve_empty_directory

        video = VideoRepository.get_by_url(db, path)
        src_dir = path[: path.rfind("/") + 1] if "/" in path else ""

        if hard:
            if video:
                refs = VideoService._history_refs(db, video_id=video.id)
                if refs:
                    return {
                        "success": False,
                        "message": (
                            f"This video has {refs} user history record(s) and cannot be permanently "
                            "deleted. Disable it instead — it will disappear from the apps."
                        ),
                    }, 409
                db.delete(video)
                db.commit()
            delete_blob(path)
            preserve_empty_directory(src_dir)
            return {"success": True, "message": "Video permanently deleted"}, 200

        # Soft delete: deactivate the record + mappings, keep the blob.
        if video:
            for mapping in video.group_mappings:
                mapping.is_active = False
            VideoRepository.delete(db, video)
            return {"success": True, "message": "Video deactivated (file kept in storage)"}, 200

        # No DB record — just drop the orphan blob.
        delete_blob(path)
        preserve_empty_directory(src_dir)
        return {"success": True, "message": "File deleted from storage"}, 200

    # ── Folder-level operations ──

    @staticmethod
    def _folder_dependencies(db: Session, prefix: str) -> dict:
        """Aggregate every dependency under a storage folder (recursive).

        Rolls up the files it contains, the distinct groups/sessions those
        videos belong to and the total user-history rows, so the UI can warn
        before renaming or deleting a whole folder. Mappings key on the video
        id, so a rename/move preserves them — only a delete is destructive,
        which is why ``canHardDelete`` reflects the history count.
        """
        from app.utils.azure_storage import list_blob_names

        prefix = prefix if prefix.endswith("/") else prefix + "/"
        names = [n for n in list_blob_names(prefix) if not n.endswith("/")]
        videos = []
        group_map: dict = {}
        session_map: dict = {}
        history = 0
        catalogued = 0
        for name in names:
            video = VideoRepository.get_by_url(db, name)
            leaf = name.split("/")[-1]
            if not video:
                videos.append({"name": leaf, "title": None, "mapped": False})
                continue
            catalogued += 1
            dep = VideoService._video_dependencies(db, video)
            for g in dep["groups"]:
                group_map[g["id"]] = g["title"]
            for s in dep["sessions"]:
                session_map[s["id"]] = s["title"]
            history += dep["historyCount"]
            videos.append({"name": leaf, "title": video.title, "mapped": bool(dep["groups"])})
        return {
            "fileCount": len(names),
            "cataloguedCount": catalogued,
            "videos": videos,
            "groups": [{"id": gid, "title": t} for gid, t in group_map.items()],
            "sessions": [{"id": sid, "title": t} for sid, t in session_map.items()],
            "historyCount": history,
            "canHardDelete": history == 0,
        }

    @staticmethod
    def get_storage_folder_info(db: Session, path: str) -> dict:
        """Return a folder's rolled-up dependencies for pre-action warnings."""
        return {"folder": path, "dependencies": VideoService._folder_dependencies(db, path)}

    @staticmethod
    def _clean_folder_segment(name: str) -> str:
        """Reduce user input to a single, safe folder-name segment (or '')."""
        import re

        seg = (name or "").strip().replace("\\", "/").strip("/").split("/")[-1].strip()
        seg = seg.replace("..", "").strip()
        if not seg or not re.match(r"^[A-Za-z0-9 _\-()&]+$", seg):
            return ""
        return seg

    @staticmethod
    def create_storage_folder(db: Session, parent: str, name: str):
        """Create a single subfolder under *parent*. New folders reference
        nothing, so there's no dependency to check — only the name is validated.
        """
        from app.utils.azure_storage import create_blob_directory, list_blob_names

        seg = VideoService._clean_folder_segment(name)
        if not seg:
            return {
                "success": False,
                "message": "Use letters, numbers, spaces, - or _ in folder names",
            }, 400
        parent = (parent or "").strip().lstrip("/")
        if parent and not parent.endswith("/"):
            parent += "/"
        path = f"{parent}{seg}/"
        if list_blob_names(path):
            return {"success": False, "message": f'A folder named "{seg}" already exists here'}, 409
        if not create_blob_directory(path):
            return {"success": False, "message": "Azure Storage not configured"}, 503
        return {"success": True, "message": f'Folder "{seg}" created', "path": path}, 201

    @staticmethod
    def rename_storage_folder(db: Session, user: User, src_path: str, new_name: str):
        """Rename a folder by re-prefixing every blob under it.

        Each contained file is moved to the new prefix and its ``video_url`` is
        repointed; group/session mappings key on the video id so they carry over
        untouched. Blocked with 409 if a sibling folder already uses the target
        name.
        """
        from app.utils.azure_storage import list_blob_names, move_folder, preserve_empty_directory

        src = (src_path or "").strip().lstrip("/")
        if src and not src.endswith("/"):
            src += "/"
        if not src:
            return {"success": False, "message": "Folder not specified"}, 400
        if not list_blob_names(src):
            return {"success": False, "message": "Folder not found in storage"}, 404

        seg = VideoService._clean_folder_segment(new_name)
        if not seg:
            return {
                "success": False,
                "message": "Use letters, numbers, spaces, - or _ in folder names",
            }, 400

        parent = src[: src[:-1].rfind("/") + 1] if "/" in src[:-1] else ""
        dst = f"{parent}{seg}/"
        if dst == src:
            return {"success": False, "message": "That's already the folder name"}, 400
        if list_blob_names(dst):
            return {"success": False, "message": f'A folder named "{seg}" already exists here'}, 409

        try:
            moved = move_folder(src, dst)
        except FileExistsError:
            return {
                "success": False,
                "message": "A file with the same name already exists at the destination",
            }, 409
        except Exception as exc:  # noqa: BLE001
            return {"success": False, "message": f"Failed to rename folder: {exc}"}, 500

        updated = 0
        for old, new in moved:
            video = VideoRepository.get_by_url(db, old)
            if video:
                VideoRepository.update(db, video, video_url=new, updated_by=user.id)
                updated += 1

        return {
            "success": True,
            "message": f'Folder renamed to "{seg}"',
            "path": dst,
            "updatedVideos": updated,
        }, 200

    @staticmethod
    def delete_storage_folder(db: Session, path: str):
        """Permanently delete a folder and everything under it.

        Refused with 409 if any catalogued video inside has user history (the
        same guard files use) — the admin must disable those individually first.
        Otherwise the catalog records and blobs are removed together.
        """
        from app.utils.azure_storage import delete_blob, list_blob_names, preserve_empty_directory

        prefix = (path or "").strip().lstrip("/")
        if prefix and not prefix.endswith("/"):
            prefix += "/"
        if not prefix:
            return {"success": False, "message": "Folder not specified"}, 400
        names = list_blob_names(prefix)
        if not names:
            return {"success": False, "message": "Folder not found in storage"}, 404

        file_names = [n for n in names if not n.endswith("/")]
        blocked = 0
        for n in file_names:
            video = VideoRepository.get_by_url(db, n, active_only=False)
            if video and VideoService._history_refs(db, video_id=video.id):
                blocked += 1
        if blocked:
            return {
                "success": False,
                "message": (
                    f"{blocked} video(s) in this folder have user history and can't be "
                    "permanently deleted. Disable them individually first."
                ),
            }, 409

        for n in file_names:
            video = VideoRepository.get_by_url(db, n, active_only=False)
            if video:
                db.delete(video)
        db.commit()
        for n in names:
            delete_blob(n)

        parent = prefix[: prefix[:-1].rfind("/") + 1] if "/" in prefix[:-1] else ""
        preserve_empty_directory(parent)
        return {"success": True, "message": "Folder deleted", "deletedFiles": len(file_names)}, 200

    @staticmethod
    def add_videos_to_group(db: Session, group_id: uuid.UUID, video_ids: list[uuid.UUID], user: User):
        group = VideoGroupRepository.get_by_id(db, group_id)
        if not group:
            return {"success": False, "message": "Video group not found"}, 404

        existing_ids = {m.video_id for m in group.video_mappings if m.is_active}
        added = []
        for vid in video_ids:
            if vid in existing_ids:
                continue
            video = VideoRepository.get_by_id(db, vid)
            if not video or not video.is_active:
                continue
            VideoGroupMappingRepository.create(
                db,
                video_group_id=group_id,
                video_id=vid,
                created_by=user.id,
                updated_by=user.id
            )
            added.append(vid)

        # Remove mappings for videos no longer in the list
        for mapping in group.video_mappings:
            if mapping.is_active and mapping.video_id not in video_ids:
                mapping.is_active = False
                mapping.updated_by = user.id

        db.commit()
        return {"success": True, "message": f"{len(added)} video(s) added to group"}, 200
