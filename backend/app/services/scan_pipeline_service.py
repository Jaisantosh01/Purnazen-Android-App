"""Sprint 2: mock pipeline — returns fixed 75.0 scores for all face metrics.
Sprint 3 will replace the score block with real MediaPipe + analyzer calls.
"""
import logging

from app.db.session import SessionLocal
from app.repositories.face_scan_repository import FaceScanRepository
from app.repositories.scan_recommendation_repository import ScanRecommendationRepository
from app.repositories.scan_result_repository import ScanResultRepository

logger = logging.getLogger(__name__)

_MOCK_FACE_SCORES = {
    "hydration_score": 75.0,
    "oiliness_score": 75.0,
    "wrinkle_score": 75.0,
    "pigmentation_score": 75.0,
    "dark_circle_score": 75.0,
    "pore_score": 75.0,
    "elasticity_score": 75.0,
    "muscle_tone_score": 75.0,
    "inflammation_score": 75.0,
    "glow_score": 75.0,
    "toxin_indicator": 25.0,
    "overall_wellness_score": 75.0,
    "skin_age_estimate": 30,
    "raw_metrics": {"mock": True, "sprint": 2},
}

_MOCK_TONGUE_SCORES = {
    "tongue_body_color": "normal",
    "tongue_coat_color": "white",
    "tongue_coat_thick": "thin",
    "tongue_moisture": "moist",
    "tongue_shape": "normal",
    "overall_wellness_score": 75.0,
    "raw_metrics": {"mock": True, "sprint": 2},
}

_MOCK_RECOMMENDATIONS = [
    {
        "recommendation_type": "routine",
        "priority": 0,
        "title": "Morning Glow Routine",
        "description": "Start your day with this energising face acupressure sequence to boost circulation and natural radiance.",
        "routine_key": "MorningGlow",
        "tip_category": None,
    },
    {
        "recommendation_type": "wellness_tip",
        "priority": 1,
        "title": "Stay Hydrated",
        "description": "Drink at least 8 glasses of water daily to maintain skin elasticity and a healthy glow.",
        "routine_key": None,
        "tip_category": "hydration",
    },
    {
        "recommendation_type": "routine",
        "priority": 2,
        "title": "Night Repair Routine",
        "description": "Wind down with this calming routine to support your skin's overnight renewal process.",
        "routine_key": "NightRepair",
        "tip_category": None,
    },
]


def run_scan_pipeline(scan_id: int, scan_type: str) -> None:
    """BackgroundTask entry point — creates its own DB session per spec §11.1."""
    db = SessionLocal()
    try:
        scan = FaceScanRepository.get_by_id(db, scan_id)
        if not scan:
            logger.error("Scan %d not found in background task", scan_id)
            return

        FaceScanRepository.set_status(db, scan, "processing")

        scores = _MOCK_FACE_SCORES if scan_type == "face" else _MOCK_TONGUE_SCORES
        ScanResultRepository.create(db, scan_id=scan_id, scores=scores)
        ScanRecommendationRepository.bulk_create(db, scan_id=scan_id, items=_MOCK_RECOMMENDATIONS)

        FaceScanRepository.set_status(db, scan, "completed")
        logger.info("Scan %d completed (mock pipeline)", scan_id)
    except Exception as exc:
        logger.exception("Scan pipeline failed for scan_id=%d: %s", scan_id, exc)
        try:
            scan = FaceScanRepository.get_by_id(db, scan_id)
            if scan:
                FaceScanRepository.set_status(db, scan, "failed", error_message=str(exc)[:500])
        except Exception:
            pass
    finally:
        db.close()
