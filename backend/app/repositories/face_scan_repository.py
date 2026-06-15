from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.face_scan import FaceScan


class FaceScanRepository:

    @staticmethod
    def create(
        db: Session,
        user_id: int,
        scan_type: str,
        image_url: str,
        image_public_id: str,
        file_size_bytes: int | None = None,
    ) -> FaceScan:
        scan = FaceScan(
            user_id=user_id,
            scan_type=scan_type,
            status="queued",
            image_url=image_url,
            image_public_id=image_public_id,
            file_size_bytes=file_size_bytes,
        )
        db.add(scan)
        db.commit()
        db.refresh(scan)
        return scan

    @staticmethod
    def get_by_id(db: Session, scan_id: int) -> FaceScan | None:
        return db.get(FaceScan, scan_id)

    @staticmethod
    def get_by_user(
        db: Session,
        user_id: int,
        scan_type: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> tuple[list[FaceScan], int]:
        q = db.query(FaceScan).filter(FaceScan.user_id == user_id)
        if scan_type and scan_type != "all":
            q = q.filter(FaceScan.scan_type == scan_type)
        total = q.count()
        scans = (
            q.order_by(FaceScan.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )
        return scans, total

    @staticmethod
    def set_status(
        db: Session,
        scan: FaceScan,
        status: str,
        error_message: str | None = None,
    ) -> FaceScan:
        scan.status = status
        if status == "processing":
            scan.processing_started_at = datetime.now(timezone.utc)
        elif status in ("completed", "failed"):
            scan.processing_completed_at = datetime.now(timezone.utc)
        if error_message is not None:
            scan.error_message = error_message
        db.commit()
        db.refresh(scan)
        return scan

    @staticmethod
    def update_processed_image(
        db: Session,
        scan: FaceScan,
        processed_image_url: str,
        processed_image_public_id: str,
    ) -> FaceScan:
        scan.processed_image_url = processed_image_url
        scan.processed_image_public_id = processed_image_public_id
        db.commit()
        db.refresh(scan)
        return scan

    @staticmethod
    def delete(db: Session, scan: FaceScan) -> None:
        db.delete(scan)
        db.commit()

    @staticmethod
    def delete_all_for_user(db: Session, user_id: int) -> list[FaceScan]:
        scans = db.query(FaceScan).filter(FaceScan.user_id == user_id).all()
        for scan in scans:
            db.delete(scan)
        db.commit()
        return scans
