from fastapi import APIRouter

from app.api.v1.endpoints import (
    appointments,
    auth,
    doctors,
    home,
    payments,
    sessions,
    therapy_history,
    users,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(doctors.router)
api_router.include_router(home.router)
api_router.include_router(appointments.router)
api_router.include_router(therapy_history.router)
api_router.include_router(sessions.router)
api_router.include_router(payments.router)
api_router.include_router(users.router)
