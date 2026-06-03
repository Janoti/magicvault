from pydantic import Field, field_validator
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://magicvault:magicvault123@localhost:5432/magicvault"
    redis_url: str = "redis://localhost:6379"
    secret_key: str = "changeme"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    environment: str = "development"
    # Kept as a plain string (read from the CORS_ORIGINS env var) so the
    # comma-separated value is not parsed as JSON by pydantic-settings.
    # Use the `cors_origins` property below to get the parsed list.
    cors_origins_raw: str = Field(
        default="http://localhost:5173,http://localhost:3000",
        validation_alias="cors_origins",
    )

    scryfall_api_base: str = "https://api.scryfall.com"
    scryfall_cache_ttl: int = 60 * 60 * 24  # 24h cache

    # Email / password reset
    resend_api_key: str = ""  # if empty, reset links are logged instead of emailed
    email_from: str = "MagicVault <onboarding@resend.dev>"
    app_url: str = "http://localhost:5173"  # base URL the reset link points to
    reset_token_expire_minutes: int = 60

    class Config:
        env_file = ".env"
        case_sensitive = False

    @field_validator("database_url", mode="after")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        # Managed hosts (Render, Heroku, ...) hand out sync DSNs like
        # "postgres://" or "postgresql://". SQLAlchemy's async engine needs the
        # asyncpg driver, so rewrite the scheme.
        if value.startswith("postgres://"):
            value = "postgresql://" + value[len("postgres://"):]
        if value.startswith("postgresql://"):
            value = "postgresql+asyncpg://" + value[len("postgresql://"):]
        return value

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.cors_origins_raw.split(",") if o.strip()]


settings = Settings()
