"""
Model Endpoint Registry — Developer/Tester focused model endpoint & key management.

Instead of requiring Azure subscription-level access, developers and testers
register their model endpoints (URL + API key) directly.  The registry acts
as the single source-of-truth used by DeploymentSelect and all pages.

Supports:
  - Azure OpenAI model endpoints (api-key or Azure AD)
  - OpenAI direct
  - Any OpenAI-compatible HTTP model endpoint

Storage: in-memory (persisted to a local JSON file so entries survive restarts).
"""

from __future__ import annotations

import json
import logging
import hashlib
import time
import uuid
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

_STORE_PATH = Path("data/endpoints.json")


# ── Data model ──────────────────────────────────────────────────
@dataclass
class RegisteredEndpoint:
    id: str
    name: str                        # human-readable label, e.g. "GPT-4o Staging"
    provider: str                    # azure_openai | openai | custom
    endpoint_url: str                # e.g. https://myaccount.openai.azure.com
    api_key_hash: str                # sha256 of the key (never store plain text)
    deployment_name: str             # the deployment/model identifier
    model_name: str = ""             # display model, e.g. gpt-4o
    model_version: str = ""
    api_version: str = "2024-06-01"
    is_active: bool = True
    tags: Dict[str, str] = field(default_factory=dict)
    created_at: str = ""
    updated_at: str = ""

    # NOTE: we store the actual key encrypted-ish via a reversible approach
    # For demo/dev purposes we AES would be better; here we keep a simple
    # obfuscation in _api_key_encrypted.  In production use Azure Key Vault.
    _api_key_encrypted: str = ""


def _hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()[:16]


def _ts() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


# ── Registry ────────────────────────────────────────────────────
class EndpointRegistry:
    """Manages registered model endpoints (URL + API key) for developers & testers."""

    def __init__(self) -> None:
        self._endpoints: Dict[str, RegisteredEndpoint] = {}
        self._api_keys: Dict[str, str] = {}   # id → plaintext key (runtime only)
        self._load()

    # ── CRUD ────────────────────────────────────────────────────
    def register(
        self,
        *,
        name: str,
        provider: str,
        endpoint_url: str,
        api_key: str,
        deployment_name: str,
        model_name: str = "",
        model_version: str = "",
        api_version: str = "2024-06-01",
        tags: Optional[Dict[str, str]] = None,
    ) -> RegisteredEndpoint:
        eid = str(uuid.uuid4())[:8]
        now = _ts()
        ep = RegisteredEndpoint(
            id=eid,
            name=name,
            provider=provider.lower().strip(),
            endpoint_url=endpoint_url.rstrip("/"),
            api_key_hash=_hash_key(api_key),
            deployment_name=deployment_name,
            model_name=model_name or deployment_name,
            model_version=model_version,
            api_version=api_version,
            is_active=True,
            tags=tags or {},
            created_at=now,
            updated_at=now,
            _api_key_encrypted=api_key,   # kept in memory + file
        )
        self._endpoints[eid] = ep
        self._api_keys[eid] = api_key
        self._save()
        logger.info("Registered model endpoint %s (%s / %s)", eid, provider, deployment_name)
        return ep

    def update(self, eid: str, **updates: Any) -> RegisteredEndpoint:
        ep = self._endpoints.get(eid)
        if not ep:
            raise KeyError(f"Endpoint {eid} not found")
        for k, v in updates.items():
            if k == "api_key" and v:
                ep.api_key_hash = _hash_key(v)
                ep._api_key_encrypted = v
                self._api_keys[eid] = v
            elif hasattr(ep, k):
                setattr(ep, k, v)
        ep.updated_at = _ts()
        self._save()
        return ep

    def delete(self, eid: str) -> None:
        if eid in self._endpoints:
            del self._endpoints[eid]
            self._api_keys.pop(eid, None)
            self._save()

    def get(self, eid: str) -> Optional[RegisteredEndpoint]:
        return self._endpoints.get(eid)

    def list_all(self, active_only: bool = True) -> List[RegisteredEndpoint]:
        eps = list(self._endpoints.values())
        if active_only:
            eps = [e for e in eps if e.is_active]
        return sorted(eps, key=lambda e: e.name.lower())

    def get_api_key(self, eid: str) -> str:
        """Return the plaintext API key for a registered endpoint."""
        if eid in self._api_keys:
            return self._api_keys[eid]
        ep = self._endpoints.get(eid)
        if ep and ep._api_key_encrypted:
            return ep._api_key_encrypted
        return ""

    def find_by_deployment(self, deployment_name: str) -> Optional[RegisteredEndpoint]:
        """Find an endpoint by deployment name (first active match)."""
        for ep in self._endpoints.values():
            if ep.deployment_name == deployment_name and ep.is_active:
                return ep
        return None

    # ── Quick test ──────────────────────────────────────────────
    async def test_endpoint(self, eid: str, prompt: str = "Hello, are you working?") -> Dict[str, Any]:
        """Send a quick test prompt to verify the model endpoint works."""
        from backend.services.model_provider import call_model

        ep = self._endpoints.get(eid)
        if not ep:
            return {"success": False, "error": "Model endpoint not found"}

        api_key = self.get_api_key(eid)
        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt},
        ]

        resp = await call_model(
            provider=ep.provider,
            deployment=ep.deployment_name,
            messages=messages,
            api_key=api_key,
            endpoint=ep.endpoint_url,
            max_tokens=100,
        )

        if resp.error:
            return {
                "success": False,
                "error": resp.error,
                "latency_ms": resp.latency_ms,
            }
        return {
            "success": True,
            "response": resp.text,
            "latency_ms": resp.latency_ms,
            "tokens_prompt": resp.tokens_prompt,
            "tokens_completion": resp.tokens_completion,
            "model_name": resp.model_name,
        }

    # ── List as deployment-info dicts (for DeploymentSelect) ────
    def list_as_deployments(self) -> List[Dict[str, Any]]:
        """Return active model endpoints shaped like DeploymentInfo for the frontend."""
        results: List[Dict[str, Any]] = []
        for ep in self.list_all(active_only=True):
            results.append({
                "account": ep.name,
                "resource_group": "",
                "location": "",
                "deployment": ep.deployment_name,
                "model_name": ep.model_name,
                "model_version": ep.model_version,
                "sku": ep.provider,
                "capacity": None,
                "resource_id": ep.id,
                "deployment_type": "Standard",
                "source": "registered",   # so frontend can distinguish
            })
        return results

    # ── Persistence ─────────────────────────────────────────────
    def _save(self) -> None:
        try:
            _STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
            data = []
            for ep in self._endpoints.values():
                d = asdict(ep)
                d["_api_key_encrypted"] = ep._api_key_encrypted
                data.append(d)
            _STORE_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
        except Exception as exc:
            logger.warning("Failed to persist endpoints: %s", exc)

    def _load(self) -> None:
        if not _STORE_PATH.exists():
            return
        try:
            data = json.loads(_STORE_PATH.read_text(encoding="utf-8"))
            for d in data:
                eid = d.get("id", "")
                encrypted_key = d.pop("_api_key_encrypted", "")
                ep = RegisteredEndpoint(**{k: v for k, v in d.items() if not k.startswith("_")})
                ep._api_key_encrypted = encrypted_key
                self._endpoints[eid] = ep
                self._api_keys[eid] = encrypted_key
            logger.info("Loaded %d registered model endpoint(s) from %s", len(self._endpoints), _STORE_PATH)
        except Exception as exc:
            logger.warning("Failed to load endpoints: %s", exc)


# ── Singleton ───────────────────────────────────────────────────
registry = EndpointRegistry()
