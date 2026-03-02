"""
Model Endpoint Registry — Developer/Tester focused model endpoint & key management.

Instead of requiring Azure subscription-level access, developers and testers
register their model endpoints (URL + API key) directly.  The registry acts
as the single source-of-truth used by DeploymentSelect and all pages.

Supports:
  - Azure OpenAI model endpoints (api-key or Azure AD)
  - OpenAI direct
  - Any OpenAI-compatible HTTP model endpoint

Storage: Azure Cosmos DB (endpoint_registry container).
API keys are encrypted at rest using Fernet (symmetric AES-128-CBC)
derived from the application SECRET_KEY.  At runtime they are kept in
memory in plaintext only for the duration of model calls.
"""

from __future__ import annotations

import base64
import hashlib
import logging
import uuid
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional

from cryptography.fernet import Fernet, InvalidToken

from backend.cosmos_client import (
    create_item,
    delete_item,
    query_items,
    read_item,
    upsert_item,
    utcnow_iso,
)

logger = logging.getLogger(__name__)

CONTAINER = "endpoint_registry"


# ── Encryption helpers ──────────────────────────────────────────
def _get_fernet() -> Fernet:
    """Derive a Fernet key from the application SECRET_KEY."""
    from backend.config import settings
    digest = hashlib.sha256(settings.secret_key.encode()).digest()
    key = base64.urlsafe_b64encode(digest)          # 44-byte URL-safe base64
    return Fernet(key)


def _encrypt_key(plaintext: str) -> str:
    """Encrypt an API key. Returns a base64 token string."""
    if not plaintext:
        return ""
    return _get_fernet().encrypt(plaintext.encode()).decode()


def _decrypt_key(ciphertext: str) -> str:
    """Decrypt an API key. Returns plaintext or empty string on failure."""
    if not ciphertext:
        return ""
    try:
        return _get_fernet().decrypt(ciphertext.encode()).decode()
    except (InvalidToken, Exception) as exc:
        logger.warning("Failed to decrypt API key (key may have been rotated): %s", exc)
        return ""


# ── Data model ──────────────────────────────────────────────────
@dataclass
class RegisteredEndpoint:
    id: str
    name: str
    provider: str
    endpoint_url: str
    api_key_hash: str
    deployment_name: str
    model_name: str = ""
    model_version: str = ""
    api_version: str = "2024-06-01"
    is_active: bool = True
    tags: Dict[str, str] = field(default_factory=dict)
    created_at: str = ""
    updated_at: str = ""
    _api_key_encrypted: str = ""


def _hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()[:16]


# ── Registry ────────────────────────────────────────────────────
class EndpointRegistry:
    """Manages registered model endpoints (URL + API key) backed by Cosmos DB."""

    def __init__(self) -> None:
        self._endpoints: Dict[str, RegisteredEndpoint] = {}
        self._api_keys: Dict[str, str] = {}
        self._loaded = False

    async def _ensure_loaded(self) -> None:
        """Lazy-load from Cosmos DB on first access."""
        if self._loaded:
            return
        try:
            docs = await query_items(CONTAINER, "SELECT * FROM c")
            for d in docs:
                eid = d.get("id", "")
                encrypted_token = d.get("_api_key_encrypted", "")
                # Decrypt the API key from Cosmos → memory only
                plaintext_key = _decrypt_key(encrypted_token)
                ep = RegisteredEndpoint(
                    id=eid,
                    name=d.get("name", ""),
                    provider=d.get("provider", ""),
                    endpoint_url=d.get("endpoint_url", ""),
                    api_key_hash=d.get("api_key_hash", ""),
                    deployment_name=d.get("deployment_name", ""),
                    model_name=d.get("model_name", ""),
                    model_version=d.get("model_version", ""),
                    api_version=d.get("api_version", "2024-06-01"),
                    is_active=d.get("is_active", True),
                    tags=d.get("tags", {}),
                    created_at=d.get("created_at", ""),
                    updated_at=d.get("updated_at", ""),
                    _api_key_encrypted=encrypted_token,
                )
                self._endpoints[eid] = ep
                # Store plaintext key in memory dict only
                self._api_keys[eid] = plaintext_key
            logger.info("Loaded %d endpoint(s) from Cosmos DB", len(self._endpoints))
        except Exception as exc:
            logger.warning("Failed to load endpoints from Cosmos DB: %s", exc)
        self._loaded = True

    # ── CRUD ────────────────────────────────────────────────────
    async def register(
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
        await self._ensure_loaded()
        eid = str(uuid.uuid4())[:8]
        now = utcnow_iso()
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
            _api_key_encrypted="",  # will be set by _save()
        )
        self._endpoints[eid] = ep
        self._api_keys[eid] = api_key  # plaintext in memory only
        await self._save(ep, plaintext_key=api_key)
        logger.info("Registered model endpoint %s (%s / %s)", eid, provider, deployment_name)
        return ep

    async def update(self, eid: str, **updates: Any) -> RegisteredEndpoint:
        await self._ensure_loaded()
        ep = self._endpoints.get(eid)
        if not ep:
            raise KeyError(f"Endpoint {eid} not found")
        new_plaintext_key = None
        for k, v in updates.items():
            if k == "api_key" and v:
                ep.api_key_hash = _hash_key(v)
                self._api_keys[eid] = v  # plaintext in memory only
                new_plaintext_key = v
            elif hasattr(ep, k):
                setattr(ep, k, v)
        ep.updated_at = utcnow_iso()
        await self._save(ep, plaintext_key=new_plaintext_key or self._api_keys.get(eid, ""))
        return ep

    async def delete(self, eid: str) -> None:
        await self._ensure_loaded()
        if eid in self._endpoints:
            del self._endpoints[eid]
            self._api_keys.pop(eid, None)
            await delete_item(CONTAINER, eid)

    async def get(self, eid: str) -> Optional[RegisteredEndpoint]:
        await self._ensure_loaded()
        return self._endpoints.get(eid)

    async def list_all(self, active_only: bool = True) -> List[RegisteredEndpoint]:
        await self._ensure_loaded()
        eps = list(self._endpoints.values())
        if active_only:
            eps = [e for e in eps if e.is_active]
        return sorted(eps, key=lambda e: e.name.lower())

    def get_api_key(self, eid: str) -> str:
        """Return the plaintext API key from memory (never from Cosmos)."""
        if eid in self._api_keys:
            return self._api_keys[eid]
        # Fallback: try decrypting from the endpoint object
        ep = self._endpoints.get(eid)
        if ep and ep._api_key_encrypted:
            decrypted = _decrypt_key(ep._api_key_encrypted)
            if decrypted:
                self._api_keys[eid] = decrypted
                return decrypted
        return ""

    async def find_by_deployment(self, deployment_name: str) -> Optional[RegisteredEndpoint]:
        await self._ensure_loaded()
        for ep in self._endpoints.values():
            if ep.deployment_name == deployment_name and ep.is_active:
                return ep
        return None

    # ── Quick test ──────────────────────────────────────────────
    async def test_endpoint(self, eid: str, prompt: str = "Hello, are you working?") -> Dict[str, Any]:
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
            return {"success": False, "error": resp.error, "latency_ms": resp.latency_ms}
        return {
            "success": True,
            "response": resp.text,
            "latency_ms": resp.latency_ms,
            "tokens_prompt": resp.tokens_prompt,
            "tokens_completion": resp.tokens_completion,
            "model_name": resp.model_name,
        }

    # ── List as deployment-info dicts (for DeploymentSelect) ────
    async def list_as_deployments(self) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        for ep in await self.list_all(active_only=True):
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
                "source": "registered",
            })
        return results

    # ── Persistence ─────────────────────────────────────────────
    async def _save(self, ep: RegisteredEndpoint, plaintext_key: str = "") -> None:
        """Upsert a single endpoint document to Cosmos DB.

        API keys are encrypted before storage — never stored in plaintext.
        """
        d = asdict(ep)
        # Encrypt the API key before writing to Cosmos DB
        key_to_encrypt = plaintext_key or self._api_keys.get(ep.id, "")
        d["_api_key_encrypted"] = _encrypt_key(key_to_encrypt)
        await upsert_item(CONTAINER, d)


# ── Singleton ───────────────────────────────────────────────────
registry = EndpointRegistry()
