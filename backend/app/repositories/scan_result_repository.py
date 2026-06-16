from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.face_scan import FaceScan
from app.models.scan_result import ScanResult


class ScanResultRepository:

    @staticmethod
    def create(db: Session, scan_id: int, scores: dict) -> ScanResult:
        result = ScanResult(scan_id=scan_id, **scores)
        db.add(result)
        db.commit()
        db.refresh(result)
        return result

    @staticmethod
    def get_by_scan_id(db: Session, scan_id: int) -> ScanResult | None:
        return db.query(ScanResult).filter(ScanResult.scan_id == scan_id).first()

    @staticmethod
    def get_user_results(
        db: Session,
        user_id: int,
        scan_type: str = "face",
        days: int | None = None,
    ) -> "list[tuple[ScanResult, FaceScan]]":
        """Completed (result, scan) pairs for a user, oldest→newest.

        Powers the dashboard/trends/compare features.
        """
        q = (
            db.query(ScanResult, FaceScan)
            .join(FaceScan, ScanResult.scan_id == FaceScan.id)
            .filter(
                FaceScan.user_id == user_id,
                FaceScan.scan_type == scan_type,
                FaceScan.status == "completed",
            )
        )
        if days:
            since = datetime.now(timezone.utc) - timedelta(days=days)
            q = q.filter(FaceScan.created_at >= since)
        return q.order_by(FaceScan.created_at.asc()).all()
