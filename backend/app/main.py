import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

import app.db.base  # noqa: F401  — register every model so SQLAlchemy can
#                                    resolve string-based relationships (e.g.
#                                    Doctor → "Specialty") at runtime.
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.limiter import limiter
from app.utils.responses import error_response

logger = logging.getLogger(__name__)

API_DESCRIPTION = """
REST API for the Purnazen wellness app (React Native client).

All endpoints return a JSON envelope: `{"success": bool, "message": str, "data": ...}`.
Validation errors return **400** with `{field: [messages]}` in `message`.

**Auth:** Bearer JWT. Access tokens (15 min) authorize API calls; refresh tokens
(30 days) are accepted only by `/auth/refresh` and `/auth/logout`. Logout revokes
the refresh token (`jti` blocklist).

**Rate limits:** login, register and refresh are rate-limited per client IP and
return **429** when exceeded.
"""

OPENAPI_TAGS = [
    {
        "name": "Authentication",
        "description": "Register, login, token refresh, logout (refresh-token revocation) and role-gated admin access.",
    },
    {
        "name": "Doctors",
        "description": "Doctor catalog (pagination + search), detail, visit types and time slots.",
    },
    {
        "name": "Home",
        "description": "Content for the home screen (quick relief cards).",
    },
    {
        "name": "Appointments",
        "description": "Book a slot with a doctor and list the user's appointments.",
    },
    {
        "name": "Therapy History",
        "description": "Save completed wellness/relief sessions and list them with stats.",
    },
    {
        "name": "Sessions",
        "description": "Wellness and relief player content catalogs (steps, cycles, media).",
    },
    {
        "name": "Payments",
        "description": "Razorpay order creation and signature verification (sandbox-capable).",
    },
    {
        "name": "Users",
        "description": "Per-user settings (notification preferences).",
    },
    {
        "name": "Health",
        "description": "Liveness probe.",
    },
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle for the FastAPI application.

    On startup: pre-warm the MediaPipe FaceLandmarker model so the first
    scan request doesn't incur the full model-load latency.
    On shutdown: release MediaPipe resources cleanly.
    """
    # --- Startup ---
    detector = None
    try:
        from app.ai.face_detector import get_face_detector
        detector = get_face_detector()
        app.state.face_detector = detector
        logger.info("MediaPipe FaceLandmarker pre-warmed successfully.")
    except Exception as exc:
        app.state.face_detector = None
        logger.warning(
            "MediaPipe pre-warm skipped (AI packages may not be installed): %s", exc
        )

    yield  # application is running

    # --- Shutdown ---
    detector = getattr(app.state, "face_detector", None)
    if detector is not None:
        try:
            detector.close()
            logger.info("MediaPipe FaceLandmarker closed.")
        except Exception as exc:
            logger.warning("Error closing FaceLandmarker on shutdown: %s", exc)


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version="2.1.0",
        description=API_DESCRIPTION,
        openapi_tags=OPENAPI_TAGS,
        docs_url="/apidocs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    app.state.limiter = limiter

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    # Serve locally-saved scan images in dev/test mode (no Cloudinary required).
    uploads_dir = os.path.join(os.getcwd(), settings.LOCAL_UPLOADS_DIR)
    os.makedirs(uploads_dir, exist_ok=True)
    app.mount(f"/{settings.LOCAL_UPLOADS_DIR}", StaticFiles(directory=uploads_dir), name="uploads")

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
        return error_response("Too many requests. Please try again later.", 429)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        messages: dict[str, list[str]] = {}
        for error in exc.errors():
            field = ".".join(str(loc) for loc in error["loc"] if loc != "body")
            messages.setdefault(field or "body", []).append(error["msg"])
        return error_response(messages, 400)

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        message = exc.detail if exc.detail else "Resource not found"
        return error_response(message, exc.status_code)

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        return error_response("Something went wrong", 500)

    @app.get("/health", tags=["Health"], summary="Liveness check")
    def health():
        return {"status": "ok"}

    return app


app = create_app()
