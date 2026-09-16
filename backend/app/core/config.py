"""Application configuration.

All configuration is loaded from environment variables (optionally via a
.env file). Nothing sensitive is hard-coded here.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralized application settings."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Database ---------------------------------------------------
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/helpdesk"

    # --- API ----------------------------------------------------------
    api_port: int = 8000
    api_title: str = "Helpdesk Ticket Management System"
    api_version: str = "1.0.0"

    # --- Auth ---------------------------------------------------------
    secret_key: str = "dev-secret-key-change-me"
    jwt_algorithm: str = "HS256"

    # --- CORS ---------------------------------------------------------
    # Comma-separated list of allowed origins. "*" allows everything, which
    # is convenient for local development but should be restricted in
    # production via the CORS_ORIGINS environment variable.
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # --- Business rules -------------------------------------------------
    urgent_sla_hours: int = 2
    high_sla_hours: int = 8
    normal_sla_hours: int = 24

    # --- Escalation ------------------------------------------------------
    escalation_interval_seconds: int = 60

    # --- Pagination -----------------------------------------------------
    default_page_size: int = 20
    max_page_size: int = 100

    @property
    def cors_origins_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance.

    Cached so we don't re-parse environment variables on every request,
    while still being easily overridable in tests via dependency overrides
    or by clearing the cache (`get_settings.cache_clear()`).
    """
    return Settings()
