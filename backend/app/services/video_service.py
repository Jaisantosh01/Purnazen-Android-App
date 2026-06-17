from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.video_repository import VideoGroupMappingRepository, VideoGroupRepository, VideoRepository
from app.schemas.video import VideoCreate, VideoGroupCreate, VideoGroupUpdate, VideoUpdate
from app.utils.azure_storage import generate_sas_url


class VideoService:
    @staticmethod
    def _process_video_data(data: dict):
        if data.get("videoUrl"):
            data["videoUrl"] = generate_sas_url(data["videoUrl"])
        return data

    @staticmethod
    def get_groups(db: Session, active_only: bool = True):
        groups = VideoGroupRepository.get_all(db, active_only)
        return [g.to_dict() for g in groups]

    @staticmethod
    def get_group(db: Session, group_id: int):
        group = VideoGroupRepository.get_by_id(db, group_id)
        return group.to_dict() if group else None

    @staticmethod
    def upsert_group(db: Session, user: User, data: VideoGroupCreate | VideoGroupUpdate, group_id: int = None):
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
    def delete_group(db: Session, group_id: int):
        group = VideoGroupRepository.get_by_id(db, group_id)
        if not group:
            return {"success": False, "message": "Video group not found"}, 404
        
        # Soft delete associated video mappings
        for mapping in group.video_mappings:
            mapping.is_active = False
            
        VideoGroupRepository.delete(db, group)
        return {"success": True, "message": "Video group deleted (deactivated)"}, 200

    @staticmethod
    def get_videos(db: Session, group_id: int = None, active_only: bool = True):
        if group_id:
            videos = VideoRepository.get_by_group(db, group_id, active_only)
        else:
            videos = VideoRepository.get_all(db, active_only)
        return [VideoService._process_video_data(v.to_dict()) for v in videos]

    @staticmethod
    def get_video(db: Session, video_id: int):
        video = VideoRepository.get_by_id(db, video_id)
        return VideoService._process_video_data(video.to_dict()) if video else None

    @staticmethod
    def get_group_with_videos(db: Session, group_id: int, active_only: bool = True):
        group = VideoGroupRepository.get_by_id(db, group_id)
        if not group:
            return None
        
        videos = VideoRepository.get_by_group(db, group_id, active_only)
        data = group.to_dict()
        data["videos"] = [VideoService._process_video_data(v.to_dict()) for v in videos]
        return data

    @staticmethod
    def upsert_video(db: Session, user: User, data: VideoCreate | VideoUpdate, video_id: int = None):
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
            if not VideoGroupRepository.get_by_id(db, data.video_group_id):
                return {"success": False, "message": "Video group not found"}, 404

            # Create video without video_group_id and sort_order
            video_fields = data.model_dump(exclude={'video_group_id', 'sort_order'})
            video = VideoRepository.create(
                db, 
                **video_fields,
                created_by=user.id,
                updated_by=user.id
            )

            # Create mapping
            VideoGroupMappingRepository.create(
                db,
                video_group_id=data.video_group_id,
                video_id=video.id,
                sort_order=data.sort_order,
                created_by=user.id,
                updated_by=user.id
            )

            return {"success": True, "message": "Video created and mapped to group", "video": VideoService._process_video_data(video.to_dict())}, 201

    @staticmethod
    def delete_video(db: Session, video_id: int):
        video = VideoRepository.get_by_id(db, video_id)
        if not video:
            return {"success": False, "message": "Video not found"}, 404
        
        # Soft delete all mappings for this video
        for mapping in video.group_mappings:
            mapping.is_active = False

        VideoRepository.delete(db, video)
        return {"success": True, "message": "Video deleted (deactivated)"}, 200
