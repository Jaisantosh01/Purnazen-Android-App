import uuid

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
