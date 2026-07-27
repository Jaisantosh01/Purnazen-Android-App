import uuid

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.video_groups import VideoGroups
from app.models.videos import Videos
from app.models.video_group_mapping import VideoGroupMapping


class VideoGroupRepository:
    @staticmethod
    def get_all(db: Session, active_only: bool = True) -> list[VideoGroups]:
        query = db.query(VideoGroups)
        if active_only:
            query = query.filter(VideoGroups.is_active == True)
        return query.order_by(VideoGroups.sort_order).all()

    @staticmethod
    def get_by_id(db: Session, group_id: uuid.UUID) -> VideoGroups | None:
        return db.get(VideoGroups, group_id)

    @staticmethod
    def create(db: Session, **fields) -> VideoGroups:
        group = VideoGroups(**fields)
        db.add(group)
        db.commit()
        db.refresh(group)
        return group

    @staticmethod
    def update(db: Session, group: VideoGroups, **fields) -> VideoGroups:
        for field, value in fields.items():
            setattr(group, field, value)
        db.commit()
        db.refresh(group)
        return group

    @staticmethod
    def delete(db: Session, group: VideoGroups):
        group.is_active = False
        db.commit()


class VideoGroupMappingRepository:
    @staticmethod
    def create(db: Session, **fields) -> VideoGroupMapping:
        mapping = VideoGroupMapping(**fields)
        db.add(mapping)
        db.commit()
        db.refresh(mapping)
        return mapping

    @staticmethod
    def get_mapping(db: Session, group_id: uuid.UUID, video_id: uuid.UUID) -> VideoGroupMapping | None:
        return db.query(VideoGroupMapping).filter_by(video_group_id=group_id, video_id=video_id).first()

    @staticmethod
    def update(db: Session, mapping: VideoGroupMapping, **fields) -> VideoGroupMapping:
        for field, value in fields.items():
            setattr(mapping, field, value)
        db.commit()
        db.refresh(mapping)
        return mapping

    @staticmethod
    def delete_by_video(db: Session, video_id: uuid.UUID):
        db.query(VideoGroupMapping).filter_by(video_id=video_id).delete()
        db.commit()


class VideoRepository:
    @staticmethod
    def get_all(db: Session, active_only: bool = True) -> list[Videos]:
        query = db.query(Videos)
        if active_only:
            query = query.filter(Videos.is_active == True)
        return query.all()

    @staticmethod
    def get_by_id(db: Session, video_id: uuid.UUID) -> Videos | None:
        return db.get(Videos, video_id)

    @staticmethod
    def get_by_url(db: Session, video_url: str, active_only: bool = True) -> Videos | None:
        """Find a video by its stored blob path (``video_url``).

        Used to keep uploads idempotent (a retry updates the existing record
        instead of creating a duplicate) and to resolve the DB record behind a
        storage file for move/delete operations.
        """
        query = db.query(Videos).filter(Videos.video_url == video_url)
        if active_only:
            query = query.filter(Videos.is_active == True)
        return query.order_by(Videos.created_at.desc()).first()

    @staticmethod
    def get_by_group(db: Session, group_id: uuid.UUID, active_only: bool = True) -> list[Videos]:
        query = (
            db.query(Videos)
            .join(VideoGroupMapping, Videos.id == VideoGroupMapping.video_id)
            .filter(VideoGroupMapping.video_group_id == group_id)
        )
        if active_only:
            query = query.filter(Videos.is_active == True, VideoGroupMapping.is_active == True)
        return query.order_by(VideoGroupMapping.sort_order).all()

    @staticmethod
    def count_active_in_group(db: Session, group_id: uuid.UUID) -> int:
        """How many videos a group's catalog actually serves.

        Mirrors ``get_by_group(active_only=True)``. Deleting a video only flips
        ``Videos.is_active`` and unlinking one only flips the mapping's, so
        counting mapping rows on their own reports videos nobody can play — which
        is what made therapy history read "1/3 videos" for a group holding one.
        """
        return (
            db.query(func.count(VideoGroupMapping.id))
            .join(Videos, Videos.id == VideoGroupMapping.video_id)
            .filter(
                VideoGroupMapping.video_group_id == group_id,
                VideoGroupMapping.is_active == True,
                Videos.is_active == True,
            )
            .scalar()
        ) or 0

    @staticmethod
    def create(db: Session, **fields) -> Videos:
        video = Videos(**fields)
        db.add(video)
        db.commit()
        db.refresh(video)
        return video

    @staticmethod
    def update(db: Session, video: Videos, **fields) -> Videos:
        for field, value in fields.items():
            setattr(video, field, value)
        db.commit()
        db.refresh(video)
        return video

    @staticmethod
    def delete(db: Session, video: Videos):
        video.is_active = False
        db.commit()
