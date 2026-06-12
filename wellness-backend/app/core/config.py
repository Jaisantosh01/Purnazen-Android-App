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

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
