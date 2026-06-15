from sqlalchemy.orm import Session

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
