"""
Model Provider Abstraction Layer.

Provides a unified interface to call different LLM providers:
  - Azure OpenAI
  - OpenAI (direct)
  - Custom HTTP endpoints

Each call returns a standardised ModelResponse.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import httpx
from openai import AsyncAzureOpenAI, AsyncOpenAI

from backend.config import settings


# ── Response data class ─────────────────────────────────────────
@dataclass
class ModelResponse:
    text: str
    latency_ms: float
    tokens_prompt: int = 0
    tokens_completion: int = 0
    model_name: str = ""
    raw: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None


# ── Pricing table (USD per 1K tokens) ──────────────────────────
# Standard (pay-as-you-go) pricing per 1K tokens
PRICING: Dict[str, Dict[str, float]] = {
    "gpt-4o": {"prompt": 0.005, "completion": 0.015},
    "gpt-4o-mini": {"prompt": 0.00015, "completion": 0.0006},
    "gpt-4-turbo": {"prompt": 0.01, "completion": 0.03},
    "gpt-4": {"prompt": 0.03, "completion": 0.06},
    "gpt-35-turbo": {"prompt": 0.0005, "completion": 0.0015},
    "gpt-3.5-turbo": {"prompt": 0.0005, "completion": 0.0015},
    # Reasoning / newer models
    "gpt-5.1": {"prompt": 0.00125, "completion": 0.01, "reasoning": 0.01},
    "gpt-5.1-mini": {"prompt": 0.0005, "completion": 0.004, "reasoning": 0.004},
    "o3": {"prompt": 0.01, "completion": 0.04, "reasoning": 0.04},
    "o3-mini": {"prompt": 0.003, "completion": 0.012, "reasoning": 0.012},
    "o4-mini": {"prompt": 0.003, "completion": 0.012, "reasoning": 0.012},
}

# PTU (Provisioned Throughput Unit) pricing per PTU per hour
# PTU deployments are billed hourly regardless of usage
PTU_PRICING: Dict[str, Dict[str, float]] = {
    "gpt-4o": {"ptu_per_hour": 2.00, "min_ptus": 50},
    "gpt-4o-mini": {"ptu_per_hour": 0.37, "min_ptus": 25},
    "gpt-4-turbo": {"ptu_per_hour": 2.00, "min_ptus": 50},
    "gpt-4": {"ptu_per_hour": 2.00, "min_ptus": 100},
    "gpt-5.1": {"ptu_per_hour": 2.00, "min_ptus": 50},
    "gpt-5.1-mini": {"ptu_per_hour": 0.37, "min_ptus": 25},
    "o3": {"ptu_per_hour": 3.68, "min_ptus": 50},
    "o3-mini": {"ptu_per_hour": 1.10, "min_ptus": 50},
    "o4-mini": {"ptu_per_hour": 1.10, "min_ptus": 50},
}

# ── Reasoning-model parameter mapping ────────────────────────────────
# These parameters are REMOVED in reasoning models and must not be sent
REASONING_MODEL_REMOVED_PARAMS = {"temperature", "top_p", "frequency_penalty", "presence_penalty", "logprobs", "top_logprobs"}

# These parameters are RENAMED in reasoning models
REASONING_MODEL_RENAMED_PARAMS = {"max_tokens": "max_completion_tokens"}

# Models that use reasoning-model style API
REASONING_MODELS = {"gpt-5.1", "gpt-5.1-mini", "o3", "o3-mini", "o4-mini"}


def adapt_params_for_model(deployment: str, messages: list, **params) -> tuple:
    """
    Adapt parameters for reasoning models.

    - Removes unsupported params (temperature, top_p, etc.)
    - Renames max_tokens → max_completion_tokens
    - Changes system role → developer role
    - Adds default reasoning_effort if not specified
    """
    model_lower = deployment.lower()
    is_reasoning = any(model_lower.startswith(m) for m in REASONING_MODELS)

    if not is_reasoning:
        return messages, params

    # Remove unsupported params
    cleaned_params = {k: v for k, v in params.items() if k not in REASONING_MODEL_REMOVED_PARAMS}

    # Rename params
    for old_name, new_name in REASONING_MODEL_RENAMED_PARAMS.items():
        if old_name in cleaned_params:
            cleaned_params[new_name] = cleaned_params.pop(old_name)

    # Set default reasoning_effort if not present
    if "reasoning_effort" not in cleaned_params:
        cleaned_params["reasoning_effort"] = "low"

    # Convert system role to developer role
    adapted_messages = []
    for msg in messages:
        if msg.get("role") == "system":
            adapted_messages.append({"role": "developer", "content": msg["content"]})
        else:
            adapted_messages.append(msg)

    return adapted_messages, cleaned_params


def estimate_cost(
    deployment: str,
    tokens_prompt: int,
    tokens_completion: int,
    tokens_reasoning: int = 0,
    deployment_type: str = "Standard",
) -> float:
    """Return estimated cost in USD.

    For Standard deployments: per-token pricing.
    For PTU deployments: returns 0.0 (PTU is billed hourly per unit, not per token).
    """
    if deployment_type in ("PTU", "ProvisionedManaged", "GlobalProvisionedManaged"):
        # PTU billing is per-hour per-unit, not per-token
        return 0.0
    prices = PRICING.get(deployment, {"prompt": 0.005, "completion": 0.015})
    cost = (tokens_prompt / 1000 * prices["prompt"]) + (tokens_completion / 1000 * prices["completion"])
    if tokens_reasoning > 0 and "reasoning" in prices:
        cost += tokens_reasoning / 1000 * prices["reasoning"]
    return cost


def estimate_ptu_hourly_cost(deployment: str, num_ptus: int = 0) -> float:
    """Return estimated hourly cost for PTU deployment."""
    ptu = PTU_PRICING.get(deployment, {})
    rate = ptu.get("ptu_per_hour", 0.0)
    return rate * max(num_ptus, ptu.get("min_ptus", 0))


# ── Provider implementations ────────────────────────────────────
async def _call_azure_openai(
    deployment: str,
    messages: List[Dict[str, str]],
    api_key: Optional[str] = None,
    endpoint: Optional[str] = None,
    api_version: Optional[str] = None,
    **params: Any,
) -> ModelResponse:
    # Adapt message roles + params for reasoning models
    adapted_messages, adapted_params = adapt_params_for_model(deployment, messages, **params)

    # Use correct API version for reasoning models
    model_lower = deployment.lower()
    is_reasoning = any(model_lower.startswith(m) for m in REASONING_MODELS)
    if is_reasoning and not api_version:
        api_version = "2025-06-01"

    client = AsyncAzureOpenAI(
        api_key=api_key or settings.azure_openai_api_key,
        azure_endpoint=endpoint or settings.azure_openai_endpoint,
        api_version=api_version or settings.azure_openai_api_version,
    )
    start = time.perf_counter()
    try:
        resp = await client.chat.completions.create(
            model=deployment,
            messages=adapted_messages,
            **adapted_params,
        )
        latency = (time.perf_counter() - start) * 1000
        usage = resp.usage
        return ModelResponse(
            text=resp.choices[0].message.content or "",
            latency_ms=round(latency, 2),
            tokens_prompt=usage.prompt_tokens if usage else 0,
            tokens_completion=usage.completion_tokens if usage else 0,
            model_name=resp.model or deployment,
            raw=resp.model_dump() if hasattr(resp, "model_dump") else {},
        )
    except Exception as exc:
        latency = (time.perf_counter() - start) * 1000
        return ModelResponse(text="", latency_ms=round(latency, 2), error=str(exc))
    finally:
        await client.close()


async def _call_openai(
    deployment: str,
    messages: List[Dict[str, str]],
    api_key: Optional[str] = None,
    org_id: Optional[str] = None,
    **params: Any,
) -> ModelResponse:
    client = AsyncOpenAI(
        api_key=api_key or settings.openai_api_key,
        organization=org_id or settings.openai_org_id or None,
    )
    start = time.perf_counter()
    try:
        resp = await client.chat.completions.create(
            model=deployment,
            messages=messages,
            **params,
        )
        latency = (time.perf_counter() - start) * 1000
        usage = resp.usage
        return ModelResponse(
            text=resp.choices[0].message.content or "",
            latency_ms=round(latency, 2),
            tokens_prompt=usage.prompt_tokens if usage else 0,
            tokens_completion=usage.completion_tokens if usage else 0,
            model_name=resp.model or deployment,
            raw=resp.model_dump() if hasattr(resp, "model_dump") else {},
        )
    except Exception as exc:
        latency = (time.perf_counter() - start) * 1000
        return ModelResponse(text="", latency_ms=round(latency, 2), error=str(exc))
    finally:
        await client.close()


async def _call_custom_endpoint(
    deployment: str,
    messages: List[Dict[str, str]],
    endpoint: str = "",
    api_key: str = "",
    **params: Any,
) -> ModelResponse:
    """Generic HTTP POST to an OpenAI-compatible endpoint."""
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    payload = {"model": deployment, "messages": messages, **params}

    start = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(endpoint, json=payload, headers=headers)
            r.raise_for_status()
            data = r.json()
        latency = (time.perf_counter() - start) * 1000

        choice = data.get("choices", [{}])[0]
        usage = data.get("usage", {})
        return ModelResponse(
            text=choice.get("message", {}).get("content", ""),
            latency_ms=round(latency, 2),
            tokens_prompt=usage.get("prompt_tokens", 0),
            tokens_completion=usage.get("completion_tokens", 0),
            model_name=data.get("model", deployment),
            raw=data,
        )
    except Exception as exc:
        latency = (time.perf_counter() - start) * 1000
        return ModelResponse(text="", latency_ms=round(latency, 2), error=str(exc))


# ── Public dispatcher ───────────────────────────────────────────
async def call_model(
    provider: str,
    deployment: str,
    messages: List[Dict[str, str]],
    api_key: Optional[str] = None,
    endpoint: Optional[str] = None,
    **params: Any,
) -> ModelResponse:
    """
    Unified entry point for calling any supported LLM provider.

    Parameters
    ----------
    provider : str
        One of "azure_openai", "openai", "custom".
    deployment : str
        Model / deployment name.
    messages : list
        Chat-completion message array.
    api_key : str, optional
        Override default API key.
    endpoint : str, optional
        Override default endpoint (required for custom).
    **params
        Extra params forwarded to the model (temperature, max_tokens …).
    """
    provider = provider.lower().strip()

    if provider == "azure_openai":
        return await _call_azure_openai(deployment, messages, api_key=api_key, endpoint=endpoint, **params)
    elif provider == "openai":
        return await _call_openai(deployment, messages, api_key=api_key, **params)
    elif provider == "custom":
        return await _call_custom_endpoint(deployment, messages, endpoint=endpoint or "", api_key=api_key or "", **params)
    else:
        return ModelResponse(text="", latency_ms=0, error=f"Unsupported provider: {provider}")
