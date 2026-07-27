from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env file."""

    SECRET_KEY: str = "dev-only-secret-key-change-this-in-production!!"
    JWT_SECRET_KEY: str = "dev-only-jwt-secret-key-change-this-in-production!!"
    DATABASE_URL: str = "postgresql://postgres:sneha1234@localhost:5432/Wellness_db_v1"

    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "Wellness Backend API"

    # IANA timezone for the app's wall-clock domain. Appointment dates and slot
    # times are stored as bare (offset-naive) values in this zone, so the
    # reminder scheduler must anchor "now" to it rather than the server's local
    # time (containers run in UTC). India Standard Time by default.
    APP_TIMEZONE: str = "Asia/Kolkata"

    # How long an unpaid booking "hold" (status=pending, payment_status=pending)
    # keeps a slot reserved before the scheduler releases it. Without this a user
    # who starts booking and abandons payment blocks that slot for everyone else
    # forever. 15 min is comfortably longer than a payment flow takes.
    UNPAID_HOLD_TTL_MINUTES: int = 15

    # Registration runs an MX/deliverability lookup on the email domain. It is a
    # live DNS call, so the automated tests turn it off (see tests/conftest.py):
    # otherwise every fixture using a placeholder domain like `@test.com` is
    # rejected, and the suite's result depends on the runner's DNS.
    EMAIL_CHECK_DELIVERABILITY: bool = True

    # Comma-separated list of allowed origins; "*" allows all (dev only)
    CORS_ORIGINS: str = "*"

    # Empty string disables Redis (in-memory rate limits, DB-only blocklist)
    REDIS_URL: str = ""

    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_LOGIN: str = "5/minute"
    RATE_LIMIT_REGISTER: str = "3/minute"
    RATE_LIMIT_REFRESH: str = "10/minute"
    # Soft email pre-check (called on blur/submit before registering).
    RATE_LIMIT_EMAIL_CHECK: str = "20/minute"

    # Razorpay credentials (test-mode keys for the sandbox). When empty, the
    # payment provider runs in a local sandbox mode: orders are generated
    # locally and signatures use a dev secret — no external calls.
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""

    # Azure Blob Storage. When empty, image uploads fall back to local
    # filesystem storage.
    AZURE_STORAGE_ACCOUNT_NAME: str = ""
    AZURE_STORAGE_ACCOUNT_KEY: str = ""
    # Program/session videos only — the admin video browser lists this whole
    # container, so nothing else belongs in it.
    AZURE_BLOB_CONTAINER_NAME: str = ""
    # User uploads (face scan images, raw + processed). Kept apart from the
    # video container so scans never show up in the video catalog.
    AZURE_SCANS_CONTAINER_NAME: str = "uploads"
    # Profile photos. Their own container for the same reason scans have one:
    # avatars were previously written into the video container under an
    # "avatars/" prefix, where the admin video browser listed them alongside
    # the programme videos. Created on first upload if it doesn't exist.
    AZURE_AVATARS_CONTAINER_NAME: str = "avatars"
    # SAS token lifetime for scan images (short-lived, per-request)
    AZURE_SAS_EXPIRY_MINUTES: int = 60
    # SAS token lifetime for video streaming (needs to outlive the longest video session)
    AZURE_VIDEO_SAS_EXPIRY_MINUTES: int = 240

    # App release distribution (OTA). A PRIVATE container holds the signed APKs;
    # the backend mints a short-lived read-only SAS so the in-app updater can
    # download without the container ever being public. CI uploads here.
    AZURE_RELEASES_CONTAINER_NAME: str = "app-releases"
    AZURE_RELEASE_SAS_EXPIRY_MINUTES: int = 15
    # Shared secret the release CI presents (X-Release-Token) to register a new
    # version. Separate from user auth so CI needs no user login. Empty => the
    # register endpoint is disabled.
    RELEASE_REGISTER_TOKEN: str = ""
    # How many recent versions to keep active per app (older ones are deactivated).
    RELEASE_KEEP_VERSIONS: int = 4

    # Google Calendar / Meet integration — base64-encoded service account JSON key.
    # When empty, video-consultation bookings skip Meet link creation.
    GOOGLE_SERVICE_ACCOUNT_JSON: str = ""

    # Firebase — base64-encoded service account JSON key for the Firebase
    # project. Powers BOTH device push (FCM) and social sign-in token
    # verification. When empty, push is skipped and social login is disabled.
    FIREBASE_SERVICE_ACCOUNT_JSON: str = ""
    # Optional override; normally derived from the service account JSON above.
    FIREBASE_PROJECT_ID: str = ""

    # Scan upload limits
    SCAN_MAX_FILE_SIZE_MB: int = 15
    RATE_LIMIT_SCAN_UPLOAD: str = "5/minute"

    # Local file storage fallback (used when Azure is not configured).
    # Set to the address the mobile/emulator uses to reach this server.
    LOCAL_UPLOADS_BASE_URL: str = "http://10.0.2.2:5000"
    LOCAL_UPLOADS_DIR: str = "uploads"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
