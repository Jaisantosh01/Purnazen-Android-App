from fastapi import APIRouter

from app.api.v1.endpoints import (
    appointments,
    auth,
    consent,
    chat,
    doctors,
    error_report,
    face_glow,
    face_scan,
    home,
    payments,
    sessions,
    therapy_history,
    users,
    videos,
    dashboard,
    roles,
    slot_timings,
)
from app.api.v1.endpoints import therapy_feedback
from app.api.v1.endpoints import doctor_availability
from app.api.v1.endpoints import doctor_leaves
from app.api.v1.endpoints import languages
from app.api.v1.endpoints import expertises
from app.api.v1.endpoints import specialties
from app.api.v1.endpoints import support
from app.api.v1.endpoints import consultations
from app.api.v1.endpoints import app_releases
from app.api.v1.endpoints import patients
from app.api.v1.endpoints import user_addresses
from app.api.v1.endpoints import notifications

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(doctors.router)
api_router.include_router(doctor_availability.router)
api_router.include_router(doctor_leaves.router)
api_router.include_router(specialties.router)
api_router.include_router(expertises.router)
api_router.include_router(languages.router)
api_router.include_router(home.router)
api_router.include_router(appointments.router)
api_router.include_router(therapy_history.router)
api_router.include_router(therapy_feedback.router)
api_router.include_router(sessions.router)
api_router.include_router(payments.router)
api_router.include_router(users.router)
api_router.include_router(face_glow.router)
api_router.include_router(chat.router)
api_router.include_router(videos.router)
api_router.include_router(dashboard.router)
api_router.include_router(roles.router)
api_router.include_router(slot_timings.router)
api_router.include_router(face_scan.router)
api_router.include_router(consent.router)
api_router.include_router(error_report.router)
api_router.include_router(support.router)
api_router.include_router(consultations.router)
api_router.include_router(app_releases.router)
from app.api.v1.endpoints import support_faqs
# ...
api_router.include_router(patients.router)
api_router.include_router(user_addresses.router)
api_router.include_router(notifications.router)
api_router.include_router(support_faqs.router, prefix="/support-faqs", tags=["Support FAQs"])
