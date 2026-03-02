"""
GenAI Ops Framework — Application Configuration.

Loads settings from environment variables / .env file.
"""

from __future__ import annotations

import logging
import os
import secrets
from pathlib import Path
from typing import List, Optional

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_logger = logging.getLogger(__name__)


def _generate_secret_key() -> str:
    """Generate a cryptographically secure random key."""
    return secrets.token_urlsafe(64)


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

    # --- Azure Key Vault (optional — loads secrets at startup) ---
    azure_keyvault_url: str = ""

    # --- Security ---
    secret_key: str = ""
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

    @model_validator(mode="after")
    def _validate_secrets(self) -> "Settings":
        """Ensure secret_key is never the old placeholder; generate one if empty."""
        INSECURE_DEFAULTS = {
            "change-me-to-a-random-secret-key",
            "changeme",
            "secret",
            "",
        }
        if self.secret_key in INSECURE_DEFAULTS:
            if self.is_production:
                generated = _generate_secret_key()
                _logger.warning(
                    "SECRET_KEY was not set — generated a random key. "
                    "Set the SECRET_KEY env var or Key Vault secret for stable JWT sessions."
                )
                object.__setattr__(self, "secret_key", generated)
            else:
                # Dev: generate a random key silently
                object.__setattr__(self, "secret_key", _generate_secret_key())
        return self


def _load_keyvault_secrets(s: Settings) -> Settings:
    """Optionally overlay secrets from Azure Key Vault.

    Mapping (Key Vault secret → env-style field):
        cosmos-db-key          → cosmos_db_key
        secret-key             → secret_key
        azure-openai-api-key   → azure_openai_api_key
        openai-api-key         → openai_api_key
    """
    if not s.azure_keyvault_url:
        return s

    try:
        from azure.identity import DefaultAzureCredential
        from azure.keyvault.secrets import SecretClient

        credential = DefaultAzureCredential()
        client = SecretClient(vault_url=s.azure_keyvault_url, credential=credential)

        _KV_MAP = {
            "cosmos-db-key": "cosmos_db_key",
            "cosmos-db-endpoint": "cosmos_db_endpoint",
            "secret-key": "secret_key",
            "azure-openai-api-key": "azure_openai_api_key",
            "openai-api-key": "openai_api_key",
            "model-b-api-key": "model_b_api_key",
        }
        loaded = []
        for kv_name, field_name in _KV_MAP.items():
            try:
                secret_value = client.get_secret(kv_name).value
                if secret_value:
                    object.__setattr__(s, field_name, secret_value)
                    loaded.append(kv_name)
            except Exception:
                pass  # Secret not found — keep env/default value

        if loaded:
            _logger.info("Loaded %d secret(s) from Key Vault: %s", len(loaded), ", ".join(loaded))
    except ImportError:
        _logger.warning(
            "AZURE_KEYVAULT_URL is set but azure-keyvault-secrets is not installed. "
            "Run: pip install azure-keyvault-secrets azure-identity"
        )
    except Exception as exc:
        _logger.warning("Failed to load secrets from Key Vault: %s", exc)

    return s


settings = _load_keyvault_secrets(Settings())
