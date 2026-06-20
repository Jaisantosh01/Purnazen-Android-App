from sqlalchemy.orm import Session

from app.models.scan_recommendation import ScanRecommendation


class ScanRecommendationRepository:

    @staticmethod
    def bulk_create(db: Session, scan_id: int, items: list[dict]) -> list[ScanRecommendation]:
        recs = [ScanRecommendation(scan_id=scan_id, **item) for item in items]
        db.add_all(recs)
        db.commit()
        return recs

    @staticmethod
    def get_by_scan_id(db: Session, scan_id: int) -> list[ScanRecommendation]:
        return (
            db.query(ScanRecommendation)
            .filter(ScanRecommendation.scan_id == scan_id)
            .order_by(ScanRecommendation.priority)
            .all()
        )
