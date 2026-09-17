"""'Download my data' (DPDP / GDPR access request).

Everything the platform holds about one patient, as one JSON document, built
from the same to_dict() the app screens read. Scan images are referenced by
their storage path, not embedded.
"""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.consultation_record import ConsultationRecord
from app.models.face_scan import FaceScan
from app.models.notification import Notification
from app.models.payment import Payment
from app.models.scan_result import ScanResult
from app.models.therapy_feedback import TherapyFeedback
from app.models.therapy_session import TherapySession
from app.models.therapy_session_group import TherapySessionGroup
from app.models.user import User
from app.models.user_address import UserAddress
from app.models.user_consent import UserConsent
from app.models.user_preference import UserPreference
from app.models.user_subscription import UserSubscription

# Section name → model. Each has a user_id column and a to_dict().
_SECTIONS = {
    "addresses": UserAddress,
    "consents": UserConsent,
    "preferences": UserPreference,
    "subscriptions": UserSubscription,
    "payments": Payment,
    "appointments": Appointment,
    "consultationRecords": ConsultationRecord,
    "therapyRuns": TherapySessionGroup,
    "therapySessions": TherapySession,
    "therapyFeedback": TherapyFeedback,
    "notifications": Notification,
}


class DataExportService:
    @staticmethod
    def build(db: Session, user: User) -> dict:
        out = {
            "exportedAt": datetime.now(timezone.utc).isoformat(),
            "format": "purnazen-data-export/1",
            "profile": user.to_dict(),
        }
        for key, model in _SECTIONS.items():
            rows = db.query(model).filter(model.user_id == user.id).all()
            out[key] = [r.to_dict() for r in rows]

        scans = []
        for scan, result in (
            db.query(FaceScan, ScanResult)
            .outerjoin(ScanResult, ScanResult.scan_id == FaceScan.id)
            .filter(FaceScan.user_id == user.id)
            .all()
        ):
            d = scan.to_dict()
            d["result"] = result.to_dict() if result else None
            scans.append(d)
        out["scans"] = scans
        return out
