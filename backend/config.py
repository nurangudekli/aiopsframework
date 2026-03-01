"""
GenAI Ops Framework — Application Configuration.

Loads settings from environment variables / .env file.
"""

from __future__ import annotations

from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration sourced from environment / .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- App ---
    app_name: str = "GenAI Ops Framework"
    app_env: str = "development"
    app_debug: bool = True
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    # --- Database (Cosmos DB) ---
    cosmos_db_endpoint: str = ""
    cosmos_db_key: str = ""
    cosmos_db_database: str = "genaiops"

    # Legacy — kept for local dev / test fallback
    database_url: str = "sqlite+aiosqlite:///./genaiops.db"

    # --- Azure OpenAI (Model A) ---
    azure_openai_api_key: str = ""
    azure_openai_endpoint: str = ""
    azure_openai_api_version: str = "2024-06-01"
    azure_openai_deployment_name: str = ""

    # --- OpenAI Direct ---
    openai_api_key: str = ""
    openai_org_id: str = ""

    # --- Model B (for A/B testing) ---
    model_b_provider: str = "azure_openai"
    model_b_api_key: str = ""
    model_b_endpoint: str = ""
    model_b_deployment_name: str = ""

    # --- Redis ---
    redis_url: str = "redis://localhost:6379/0"

    # --- Security ---
    secret_key: str = "change-me-to-a-random-secret-key"
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # --- Logging ---
    log_level: str = "INFO"

    # --- Cost ---
    cost_alert_threshold_usd: float = 100.0

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"


settings = Settings()
