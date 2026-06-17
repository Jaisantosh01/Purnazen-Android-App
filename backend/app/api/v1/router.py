from fastapi import APIRouter

from app.api.v1.endpoints import (
    appointments,
    auth,
    chat,
    doctors,
    face_glow,
    home,
    payments,
    sessions,
    therapy_history,
    users,
    videos,
)
from app.api.v1.endpoints import doctor_availability
from app.api.v1.endpoints import languages
from app.api.v1.endpoints import expertises
from app.api.v1.endpoints import specialties

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(doctors.router)
api_router.include_router(doctor_availability.router)
api_router.include_router(specialties.router)
api_router.include_router(expertises.router)
api_router.include_router(languages.router)
api_router.include_router(home.router)
api_router.include_router(appointments.router)
api_router.include_router(therapy_history.router)
api_router.include_router(sessions.router)
api_router.include_router(payments.router)
api_router.include_router(users.router)
api_router.include_router(face_glow.router)
api_router.include_router(chat.router)
api_router.include_router(videos.router)
