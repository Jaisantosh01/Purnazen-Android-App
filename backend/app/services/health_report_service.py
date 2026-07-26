"""Consolidated health report for a patient.

Purely a read-model: it aggregates rows the app already writes (profile vitals,
the latest completed face/tongue scan, therapy totals, appointment counts) into
one payload for the "My Health Report" screen. Nothing new is stored.
"""
from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.face_scan import FaceScan
from app.models.scan_result import ScanResult
from app.models.therapy_session import TherapySession
from app.models.user import User

# Below/above these the app shows the band label next to the BMI figure.
_BMI_BANDS = (
    (18.5, "Underweight"),
    (25.0, "Healthy"),
    (30.0, "Overweight"),
)


def _bmi_band(bmi: float | None) -> str | None:
    if bmi is None:
        return None
    for ceiling, label in _BMI_BANDS:
        if bmi < ceiling:
            return label
    return "Obese"


class HealthReportService:

    @staticmethod
    def _latest_scan(db: Session, user_id, scan_type: str) -> dict | None:
        row = (
            db.query(FaceScan, ScanResult)
            .join(ScanResult, ScanResult.scan_id == FaceScan.id)
            .filter(
                FaceScan.user_id == user_id,
                FaceScan.scan_type == scan_type,
                FaceScan.status == "completed",
            )
            .order_by(FaceScan.created_at.desc())
            .first()
        )
        if not row:
            return None

        scan, result = row
        data = {
            "id": str(scan.id),
            "takenAt": scan.created_at.isoformat() if scan.created_at else None,
        }
        if scan_type == "tongue":
            data.update(
                {
                    "tongueColour": result.tongue_body_color,
                    "coatColour": result.tongue_coat_color,
                    "coatThickness": result.tongue_coat_thick,
                    "moisture": result.tongue_moisture,
                    "shape": result.tongue_shape,
                }
            )
        else:
            data.update(
                {
                    "wellnessScore": float(result.overall_wellness_score)
                    if result.overall_wellness_score is not None
                    else None,
                    "hydrationScore": float(result.hydration_score)
                    if result.hydration_score is not None
                    else None,
                    "glowScore": float(result.glow_score) if result.glow_score is not None else None,
                    "skinAge": result.skin_age_estimate,
                }
            )
        return data

    @staticmethod
    def build(db: Session, user: User) -> dict:
        sessions, minutes = (
            db.query(
                func.count(TherapySession.id),
                func.coalesce(func.sum(TherapySession.duration_minutes), 0),
            )
            .filter(
                TherapySession.user_id == user.id,
                TherapySession.status == "Completed",
            )
            .first()
        )

        appointment_rows = (
            db.query(Appointment.status, func.count(Appointment.id))
            .filter(Appointment.user_id == user.id)
            .group_by(Appointment.status)
            .all()
        )
        by_status = {status: count for status, count in appointment_rows}

        last_visit = (
            db.query(func.max(Appointment.date))
            .filter(Appointment.user_id == user.id, Appointment.status == "completed")
            .scalar()
        )

        bmi = user.bmi
        return {
            "generatedAt": date.today().isoformat(),
            "patient": {
                "name": user.full_name,
                "age": user.age,
                "gender": user.gender,
                "bloodGroup": user.blood_group,
            },
            "vitals": {
                "heightCm": float(user.height_cm) if user.height_cm is not None else None,
                "weightKg": float(user.weight_kg) if user.weight_kg is not None else None,
                "bmi": bmi,
                "bmiBand": _bmi_band(bmi),
            },
            "medical": {
                "allergies": user.allergies,
                "conditions": user.conditions,
                "medications": user.medications,
            },
            "therapy": {
                "completedSessions": sessions or 0,
                "totalMinutes": int(minutes or 0),
            },
            "appointments": {
                "total": sum(by_status.values()),
                "completed": by_status.get("completed", 0),
                "upcoming": by_status.get("booked", 0) + by_status.get("pending", 0),
                "lastVisit": last_visit.isoformat() if last_visit else None,
            },
            "latestFaceScan": HealthReportService._latest_scan(db, user.id, "face"),
            "latestTongueScan": HealthReportService._latest_scan(db, user.id, "tongue"),
        }
