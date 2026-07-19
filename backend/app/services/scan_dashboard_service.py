"""Dashboard / trends / comparison aggregation over scan results (Sprint 4).

Face scans carry numeric skin metrics (glow, hydration, …); tongue scans carry a
single 0-100 wellness score plus *categorical* TCM markers (body colour, coat,
moisture, shape). Both share the same time-series / compare plumbing; the shape
diverges only where the data model genuinely does.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.face_scan import FaceScan
from app.repositories.scan_result_repository import ScanResultRepository

# Numeric metrics clients may chart/compare.
TREND_METRICS = {
    "glow_score", "overall_wellness_score", "toxin_indicator", "skin_age_estimate",
    "hydration_score", "oiliness_score", "wrinkle_score", "pigmentation_score",
    "dark_circle_score", "pore_score", "elasticity_score", "muscle_tone_score",
    "inflammation_score",
}

# camelCase keys (ScanResult.to_dict) for the deltas the mobile app reads.
_COMPARE_KEYS = [
    "glowScore", "overallWellnessScore", "hydrationScore", "oilinessScore",
    "wrinkleScore", "pigmentationScore", "darkCircleScore", "poreScore",
    "elasticityScore", "muscleToneScore", "inflammationScore", "toxinIndicator",
]

# Categorical tongue markers: (camelCase to_dict key, human label).
_TONGUE_MARKERS = [
    ("tongueBodyColor", "Body colour"),
    ("tongueCoatColor", "Coat colour"),
    ("tongueCoatThick", "Coat thickness"),
    ("tongueMoisture",  "Moisture"),
    ("tongueShape",     "Shape"),
]


def _f(v):
    return float(v) if v is not None else None


def _iso(dt):
    return dt.isoformat() if dt else None


class ScanDashboardService:

    @staticmethod
    def dashboard(db: Session, user_id: int, scan_type: str = "face") -> dict:
        if scan_type == "tongue":
            return ScanDashboardService._tongue_dashboard(db, user_id)
        return ScanDashboardService._face_dashboard(db, user_id)

    @staticmethod
    def _face_dashboard(db: Session, user_id: int) -> dict:
        pairs = ScanResultRepository.get_user_results(db, user_id, "face")
        if not pairs:
            return {"scanType": "face", "hasData": False, "scanCount": 0, "latest": None,
                    "rollingGlow7d": None, "glowTrend": []}

        latest_result, latest_scan = pairs[-1]

        # 7-day rolling average glow.
        since = datetime.now(timezone.utc) - timedelta(days=7)
        recent = [
            float(r.glow_score) for r, s in pairs
            if r.glow_score is not None and s.created_at and _aware(s.created_at) >= since
        ]
        rolling = round(sum(recent) / len(recent), 2) if recent else None

        glow_trend = [
            {"date": _iso(s.created_at), "value": _f(r.glow_score)}
            for r, s in pairs if r.glow_score is not None
        ]

        return {
            "scanType": "face",
            "hasData": True,
            "scanCount": len(pairs),
            "latest": {
                "scanId": latest_scan.id,
                "createdAt": _iso(latest_scan.created_at),
                "results": latest_result.to_dict(),
            },
            "rollingGlow7d": rolling,
            "glowTrend": glow_trend,
        }

    @staticmethod
    def _tongue_dashboard(db: Session, user_id: int) -> dict:
        pairs = ScanResultRepository.get_user_results(db, user_id, "tongue")
        if not pairs:
            return {"scanType": "tongue", "hasData": False, "scanCount": 0, "latest": None,
                    "rollingWellness7d": None, "wellnessTrend": [], "markers": None}

        latest_result, latest_scan = pairs[-1]

        since = datetime.now(timezone.utc) - timedelta(days=7)
        recent = [
            float(r.overall_wellness_score) for r, s in pairs
            if r.overall_wellness_score is not None and s.created_at and _aware(s.created_at) >= since
        ]
        rolling = round(sum(recent) / len(recent), 2) if recent else None

        wellness_trend = [
            {"date": _iso(s.created_at), "value": _f(r.overall_wellness_score)}
            for r, s in pairs if r.overall_wellness_score is not None
        ]

        latest_dict = latest_result.to_dict()
        markers = {key: latest_dict.get(key) for key, _label in _TONGUE_MARKERS}

        return {
            "scanType": "tongue",
            "hasData": True,
            "scanCount": len(pairs),
            "latest": {
                "scanId": latest_scan.id,
                "createdAt": _iso(latest_scan.created_at),
                "results": latest_dict,
            },
            "rollingWellness7d": rolling,
            "wellnessTrend": wellness_trend,
            "markers": markers,
        }

    @staticmethod
    def trends(db: Session, user_id: int, metric: str, days: int | None = None,
               scan_type: str = "face") -> dict:
        if metric not in TREND_METRICS:
            return {"error": f"Unknown metric '{metric}'", "metric": metric, "points": []}
        pairs = ScanResultRepository.get_user_results(db, user_id, scan_type, days=days)
        points = []
        for r, s in pairs:
            val = getattr(r, metric, None)
            if val is not None:
                points.append({"date": _iso(s.created_at), "value": float(val)})
        return {"metric": metric, "days": days, "scanType": scan_type, "points": points}

    @staticmethod
    def compare(db: Session, user_id: int, scan_id, compare_to_id: int | None = None) -> dict | None:
        """Compare a scan to a baseline (explicit id, else the previous scan).

        Scan-type-aware: numeric deltas for face scans, wellness delta + per-marker
        before→after for tongue scans.
        """
        scan = (
            db.query(FaceScan)
            .filter(FaceScan.id == scan_id, FaceScan.user_id == user_id)
            .first()
        )
        if scan is None:
            return None
        scan_type = scan.scan_type or "face"

        pairs = ScanResultRepository.get_user_results(db, user_id, scan_type)
        by_id = {s.id: (r, s) for r, s in pairs}
        if scan_id not in by_id:
            return None
        current_r, current_s = by_id[scan_id]

        if compare_to_id is not None:
            if compare_to_id not in by_id:
                return None
            base_r, base_s = by_id[compare_to_id]
        else:
            # Previous completed scan before this one (pairs are oldest→newest).
            ordered = [s.id for _, s in pairs]
            idx = ordered.index(scan_id)
            if idx == 0:
                return {"scanType": scan_type, "hasBaseline": False,
                        "current": {"scanId": scan_id, "results": current_r.to_dict()}}
            base_r, base_s = by_id[ordered[idx - 1]]

        if scan_type == "tongue":
            return ScanDashboardService._tongue_compare(current_r, current_s, base_r, base_s)
        return ScanDashboardService._face_compare(current_r, current_s, base_r, base_s)

    @staticmethod
    def _face_compare(current_r, current_s, base_r, base_s) -> dict:
        cur = current_r.to_dict()
        base = base_r.to_dict()
        deltas = {}
        for k in _COMPARE_KEYS:
            a, b = cur.get(k), base.get(k)
            deltas[k] = round(a - b, 2) if (a is not None and b is not None) else None
        return {
            "scanType": "face",
            "hasBaseline": True,
            "current":  {"scanId": current_s.id, "createdAt": _iso(current_s.created_at), "results": cur},
            "baseline": {"scanId": base_s.id, "createdAt": _iso(base_s.created_at), "results": base},
            "deltas": deltas,
        }

    @staticmethod
    def _tongue_compare(current_r, current_s, base_r, base_s) -> dict:
        cur = current_r.to_dict()
        base = base_r.to_dict()
        c_well, b_well = cur.get("overallWellnessScore"), base.get("overallWellnessScore")
        wellness_delta = round(c_well - b_well, 2) if (c_well is not None and b_well is not None) else None
        marker_changes = [
            {
                "key": key,
                "label": label,
                "baseline": base.get(key),
                "current": cur.get(key),
                "changed": base.get(key) != cur.get(key),
            }
            for key, label in _TONGUE_MARKERS
        ]
        return {
            "scanType": "tongue",
            "hasBaseline": True,
            "current":  {"scanId": current_s.id, "createdAt": _iso(current_s.created_at), "results": cur},
            "baseline": {"scanId": base_s.id, "createdAt": _iso(base_s.created_at), "results": base},
            "wellnessDelta": wellness_delta,
            "markerChanges": marker_changes,
        }


def _aware(dt):
    """Treat naive DB timestamps (SQLite) as UTC for safe comparison."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
