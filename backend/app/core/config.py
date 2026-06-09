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
    email_from: str = "VaultSpell <onboarding@resend.dev>"
    app_url: str = "http://localhost:5173"  # base URL the reset link points to
    reset_token_expire_minutes: int = 60

    admin_email: str = ""  # this account is promoted to admin on startup

    # Stripe (premium subscriptions)
    stripe_secret_key: str = ""
    stripe_price_id: str = ""
    stripe_webhook_secret: str = ""

    # Beta: the first N registered accounts get premium for free, forever.
    beta_premium_limit: int = 50

    # AI Deck Doctor. Keys are set in the environment only. If both are set,
    # Anthropic (Claude) is preferred. Pick a model your account has access to.
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-haiku-4-5-20251001"
    xai_api_key: str = ""
    xai_model: str = "grok-3"
    google_vision_api_key: str = ""  # cloud OCR for the card scanner
    ximilar_api_token: str = ""      # image-based card recognition (name + set)

    # Social login (OAuth). Each provider is enabled only when its id/secret are
    # set, so leaving these empty simply hides that button. The provider's
    # redirect URI must be "<oauth_redirect_base>/api/auth/oauth/<provider>/callback".
    oauth_redirect_base: str = ""    # defaults to app_url when empty
    google_client_id: str = ""
    google_client_secret: str = ""
    facebook_client_id: str = ""
    facebook_client_secret: str = ""
    apple_client_id: str = ""        # Services ID, e.g. com.vaultspell.web
    apple_team_id: str = ""
    apple_key_id: str = ""
    apple_private_key: str = ""      # the .p8 PEM contents (literal \n are normalized)
    steam_api_key: str = ""          # Steam Web API key (OpenID gives no email)

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

    @property
    def oauth_base(self) -> str:
        """Origin used to build OAuth redirect URIs. Falls back to app_url."""
        return (self.oauth_redirect_base or self.app_url).rstrip("/")


settings = Settings()
