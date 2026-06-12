from fastapi import APIRouter

from app.api.v1.endpoints import appointments, auth, doctors, home, therapy_history

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(doctors.router)
api_router.include_router(home.router)
api_router.include_router(appointments.router)
api_router.include_router(therapy_history.router)
