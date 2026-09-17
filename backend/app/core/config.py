import logging

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

# The values committed in source so a fresh clone runs. They are placeholders,
# they are public, and a deployment running on either of them is signing tokens
# anyone can forge. Named here so the startup check can recognise them.
_PLACEHOLDER_SECRET_KEY = "dev-only-secret-key-change-this-in-production!!"
_PLACEHOLDER_JWT_SECRET_KEY = "dev-only-jwt-secret-key-change-this-in-production!!"

# Environments where the placeholders and a permissive CORS policy are fine.
_DEV_ENVIRONMENTS = {"development", "dev", "local", "test", "testing"}


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env file."""

    # development | staging | production. The Docker image sets this to
    # "production", so any container is production unless deliberately told
    # otherwise — a deploy cannot end up in dev mode by forgetting a variable.
    ENVIRONMENT: str = "development"

    SECRET_KEY: str = _PLACEHOLDER_SECRET_KEY
    JWT_SECRET_KEY: str = _PLACEHOLDER_JWT_SECRET_KEY
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

    # Comma-separated list of allowed origins. Empty by default and empty means
    # *no* cross-origin browser access — which is correct for an API whose
    # clients are mobile apps, and which fails visibly (a blocked request in a
    # browser console) rather than invisibly. It used to default to "*", so a
    # Container App that never set the variable ran wide open and nothing said
    # so. "*" is rejected outright in production: combined with
    # allow_credentials=True it is also silently ignored by Starlette, so it
    # never did what it looked like it did.
    CORS_ORIGINS: str = ""

    # Empty string disables Redis (in-memory rate limits, DB-only blocklist).
    # With more than one replica that means limits are enforced PER PROCESS: the
    # effective limit becomes N x what is configured here. Set this in any
    # environment that scales past one replica — startup warns loudly if not.
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

    # Published-version registry. The apps are distributed through Play and the
    # App Store; this records which version is current so a running build can
    # tell the user it is out of date. No binaries are stored or served.
    # Shared secret the release CI presents (X-Release-Token) to register a new
    # version. Separate from user auth so CI needs no user login. Empty => the
    # register endpoint is disabled.
    RELEASE_REGISTER_TOKEN: str = ""
    # How many recent versions to keep active per app (older ones are deactivated).
    RELEASE_KEEP_VERSIONS: int = 4
    # Where each app's "Update" button sends people, per platform, as JSON:
    #   {"mobile-users":   {"android": "https://play.google.com/store/apps/details?id=com.purnazen",
    #                       "ios": "https://apps.apple.com/app/id1234567890"},
    #    "mobile-doctors": {"ios": "https://testflight.apple.com/join/AbCdEf12"}}
    # Lets a private channel (unlisted App Store link, TestFlight public link,
    # Firebase App Distribution) change without shipping a new build. Anything
    # not listed falls back to the store listing built into the app.
    STORE_LINKS_JSON: str = ""

    # Google Calendar / Meet integration — base64-encoded service account JSON key.
    # When empty, video-consultation bookings skip Meet link creation.
    GOOGLE_SERVICE_ACCOUNT_JSON: str = ""

    # Firebase — base64-encoded service account JSON key for the Firebase
    # project. Powers BOTH device push (FCM) and social sign-in token
    # verification. When empty, push is skipped and social login is disabled.
    FIREBASE_SERVICE_ACCOUNT_JSON: str = ""
    # Optional override; normally derived from the service account JSON above.
    FIREBASE_PROJECT_ID: str = ""

    # Two-step verification (TOTP). Roles listed here must enrol before any
    # role-gated endpoint answers them, and cannot switch it off. Comma list,
    # e.g. "admin" or "admin,doctor". Empty = optional for everyone.
    MFA_REQUIRED_ROLES: str = ""
    MFA_ISSUER: str = "Purnazen"
    RATE_LIMIT_MFA: str = "10/minute"
    # Key for encrypting TOTP secrets at rest. Defaults to a key derived from
    # SECRET_KEY; set it separately to rotate one without the other.
    MFA_ENCRYPTION_KEY: str = ""

    # Scan upload limits
    SCAN_MAX_FILE_SIZE_MB: int = 15
    RATE_LIMIT_SCAN_UPLOAD: str = "5/minute"

    # Local file storage fallback (used when Azure is not configured).
    # Set to the address the mobile/emulator uses to reach this server.
    LOCAL_UPLOADS_BASE_URL: str = "http://10.0.2.2:5000"
    LOCAL_UPLOADS_DIR: str = "uploads"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.strip().lower() not in _DEV_ENVIRONMENTS

    @property
    def mfa_required_roles(self) -> set[str]:
        return {r.strip().lower() for r in self.MFA_REQUIRED_ROLES.split(",") if r.strip()}

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @model_validator(mode="after")
    def _refuse_unsafe_production_config(self):
        """Fail fast rather than boot into a silently insecure state.

        Every one of these was overridable by an environment variable before —
        the problem was that nothing enforced it, so a deploy that forgot one
        started up healthy, served traffic, and gave no sign at all. This turns
        each into a non-zero exit with a message naming the variable.
        """
        if not self.is_production:
            return self

        problems = []
        if self.SECRET_KEY == _PLACEHOLDER_SECRET_KEY:
            problems.append("SECRET_KEY is still the placeholder committed in source")
        if self.JWT_SECRET_KEY == _PLACEHOLDER_JWT_SECRET_KEY:
            problems.append("JWT_SECRET_KEY is still the placeholder committed in source")
        if self.CORS_ORIGINS.strip() == "*":
            problems.append(
                'CORS_ORIGINS is "*" — list the allowed origins explicitly, or '
                "leave it empty if no browser client needs cross-origin access"
            )
        if problems:
            raise ValueError(
                "Refusing to start with ENVIRONMENT=" + self.ENVIRONMENT + ":\n  - "
                + "\n  - ".join(problems)
                + "\nSet these as container secrets. To run locally, set "
                "ENVIRONMENT=development."
            )

        # Not fatal — a single-replica deployment is still correctly limited —
        # but it is a silent correctness hole the moment it scales out.
        if self.RATE_LIMIT_ENABLED and not self.REDIS_URL:
            logger.warning(
                "RATE_LIMIT_ENABLED is on but REDIS_URL is empty: rate limits are "
                "per-process. With N replicas the effective limit is N x the "
                "configured value. Set REDIS_URL to an Azure Cache for Redis "
                "instance before scaling past one replica."
            )
        return self

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
