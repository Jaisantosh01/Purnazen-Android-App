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
