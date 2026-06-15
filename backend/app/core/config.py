from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env file."""

    SECRET_KEY: str = "dev-only-secret-key-change-this-in-production!!"
    JWT_SECRET_KEY: str = "dev-only-jwt-secret-key-change-this-in-production!!"
    DATABASE_URL: str = "sqlite:///./wellness.db"

    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "Wellness Backend API"

    # Comma-separated list of allowed origins; "*" allows all (dev only)
    CORS_ORIGINS: str = "*"

    # Empty string disables Redis (in-memory rate limits, DB-only blocklist)
    REDIS_URL: str = ""

    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_LOGIN: str = "5/minute"
    RATE_LIMIT_REGISTER: str = "3/minute"
    RATE_LIMIT_REFRESH: str = "10/minute"

    # Razorpay credentials (test-mode keys for the sandbox). When empty, the
    # payment provider runs in a local sandbox mode: orders are generated
    # locally and signatures use a dev secret — no external calls.
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""

    # Cloudinary — used for session videos and (Sprint 2+) face scan image storage.
    # When empty, image uploads in the scan pipeline will fail gracefully.
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # Social auth — Google client ID for ID token verification (Sprint 5)
    GOOGLE_CLIENT_ID: str = ""
    # Apple app bundle ID for Sign In with Apple identity token verification (Sprint 5)
    APPLE_APP_ID: str = ""

    # Scan upload limits
    SCAN_MAX_FILE_SIZE_MB: int = 15
    RATE_LIMIT_SCAN_UPLOAD: str = "5/minute"

    # Local file storage fallback (used when Cloudinary is not configured)
    # Set to the address the mobile/emulator uses to reach this server.
    LOCAL_UPLOADS_BASE_URL: str = "http://10.0.2.2:5000"
    LOCAL_UPLOADS_DIR: str = "uploads"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
