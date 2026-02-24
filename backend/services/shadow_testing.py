"""
Shadow Testing & Canary Deployment Service.

Provides:
  - Shadow testing: run both models, serve only baseline, compare results
  - Canary rollout: route configurable % of traffic to the new model
  - Traffic configuration management
  - Continuous production monitoring (5% sampling)
"""

from __future__ import annotations

import asyncio
import logging
import random
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from backend.services.evaluation import compute_similarity_metrics, compute_reference_similarity
from backend.services.model_provider import call_model, ModelResponse

logger = logging.getLogger(__name__)

# ── In-memory traffic configuration ─────────────────────────────
# In production this would be in a database or config service

@dataclass
class TrafficConfig:
    """Canary traffic configuration."""
    enabled: bool = False
    canary_percentage: float = 0.0  # 0-100
    baseline_provider: str = "azure_openai"
    baseline_deployment: str = ""
    canary_provider: str = "azure_openai"
    canary_deployment: str = ""
    baseline_params: Dict[str, Any] = field(default_factory=dict)
    canary_params: Dict[str, Any] = field(default_factory=dict)
    monitoring_sample_rate: float = 5.0  # % of traffic to evaluate


_traffic_config = TrafficConfig()


def get_traffic_config() -> TrafficConfig:
    """Get current traffic configuration."""
    return _traffic_config


def update_traffic_config(
    enabled: Optional[bool] = None,
    canary_percentage: Optional[float] = None,
    baseline_provider: Optional[str] = None,
    baseline_deployment: Optional[str] = None,
    canary_provider: Optional[str] = None,
    canary_deployment: Optional[str] = None,
    baseline_params: Optional[Dict[str, Any]] = None,
    canary_params: Optional[Dict[str, Any]] = None,
    monitoring_sample_rate: Optional[float] = None,
) -> TrafficConfig:
    """Update traffic configuration."""
    global _traffic_config
    if enabled is not None:
        _traffic_config.enabled = enabled
    if canary_percentage is not None:
        _traffic_config.canary_percentage = max(0, min(100, canary_percentage))
    if baseline_provider is not None:
        _traffic_config.baseline_provider = baseline_provider
    if baseline_deployment is not None:
        _traffic_config.baseline_deployment = baseline_deployment
    if canary_provider is not None:
        _traffic_config.canary_provider = canary_provider
    if canary_deployment is not None:
        _traffic_config.canary_deployment = canary_deployment
    if baseline_params is not None:
        _traffic_config.baseline_params = baseline_params
    if canary_params is not None:
        _traffic_config.canary_params = canary_params
    if monitoring_sample_rate is not None:
        _traffic_config.monitoring_sample_rate = max(0, min(100, monitoring_sample_rate))
    return _traffic_config


# ── Canary rollout stages ───────────────────────────────────────
CANARY_STAGES = [
    {"stage": 1, "name": "Initial Canary", "percentage": 5, "description": "Initial canary — monitor closely", "duration": "1 week", "success_criteria": "No increase in error rate, latency P95 within 20% of baseline, quality scores within 5% of baseline"},
    {"stage": 2, "name": "Expanded Canary", "percentage": 25, "description": "Expanded canary", "duration": "3-5 days", "success_criteria": "Error rate < 0.5%, latency P95 < 3s, all quality gate metrics passing, no safety regressions"},
    {"stage": 3, "name": "Half Traffic", "percentage": 50, "description": "Half traffic", "duration": "3-5 days", "success_criteria": "Stable error rate, cost per request within budget, user satisfaction maintained, no new failure patterns"},
    {"stage": 4, "name": "Full Rollout", "percentage": 100, "description": "Full rollout", "duration": "Ongoing", "success_criteria": "All metrics stable for 48+ hours, rollback plan tested, monitoring dashboards active, on-call team briefed"},
]


def get_canary_stages() -> List[Dict[str, Any]]:
    """Return the recommended canary rollout stages."""
    return CANARY_STAGES


# ── Shadow testing ──────────────────────────────────────────────
async def run_shadow_test(
    messages: List[Dict[str, str]],
    baseline_provider: str = "azure_openai",
    baseline_deployment: str = "",
    canary_provider: str = "azure_openai",
    canary_deployment: str = "",
    baseline_params: Optional[Dict[str, Any]] = None,
    canary_params: Optional[Dict[str, Any]] = None,
    reference_answer: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Run shadow test: call both models, return comparison.
    In production, only the baseline response would be served to the user.
    """
    bp = baseline_params or {}
    cp = canary_params or {}

    # Call both models in parallel
    baseline_task = call_model(baseline_provider, baseline_deployment, messages, **bp)
    canary_task = call_model(canary_provider, canary_deployment, messages, **cp)

    baseline_resp, canary_resp = await asyncio.gather(baseline_task, canary_task)

    # Compute similarity between responses
    similarity_metrics = {}
    if baseline_resp.text and canary_resp.text:
        similarity_metrics = await compute_similarity_metrics(baseline_resp.text, canary_resp.text)

    # Compute reference similarity if provided
    baseline_ref_score = None
    canary_ref_score = None
    if reference_answer and baseline_resp.text:
        baseline_ref_score = await compute_reference_similarity(baseline_resp.text, reference_answer)
    if reference_answer and canary_resp.text:
        canary_ref_score = await compute_reference_similarity(canary_resp.text, reference_answer)

    return {
        "baseline": {
            "provider": baseline_provider,
            "deployment": baseline_deployment,
            "response": baseline_resp.text,
            "latency_ms": baseline_resp.latency_ms,
            "tokens_prompt": baseline_resp.tokens_prompt,
            "tokens_completion": baseline_resp.tokens_completion,
            "error": baseline_resp.error,
            "reference_score": round(baseline_ref_score, 4) if baseline_ref_score else None,
        },
        "canary": {
            "provider": canary_provider,
            "deployment": canary_deployment,
            "response": canary_resp.text,
            "latency_ms": canary_resp.latency_ms,
            "tokens_prompt": canary_resp.tokens_prompt,
            "tokens_completion": canary_resp.tokens_completion,
            "error": canary_resp.error,
            "reference_score": round(canary_ref_score, 4) if canary_ref_score else None,
        },
        "similarity": similarity_metrics,
        "served_model": baseline_deployment,  # In shadow mode, always serve baseline
    }


async def run_shadow_test_batch(
    test_cases: List[Dict[str, Any]],
    baseline_provider: str = "azure_openai",
    baseline_deployment: str = "",
    canary_provider: str = "azure_openai",
    canary_deployment: str = "",
    baseline_params: Optional[Dict[str, Any]] = None,
    canary_params: Optional[Dict[str, Any]] = None,
    system_message: str = "You are a helpful assistant.",
) -> Dict[str, Any]:
    """
    Run shadow test on a batch of test cases.

    Each test case should have: query, (optional) context, (optional) ground_truth
    """
    results = []
    for i, tc in enumerate(test_cases):
        query = tc.get("query", tc.get("question", ""))
        context = tc.get("context", "")
        ground_truth = tc.get("ground_truth", tc.get("expected_answer", ""))

        messages = [
            {"role": "system", "content": f"{system_message}\nContext: {context}" if context else system_message},
            {"role": "user", "content": query},
        ]

        result = await run_shadow_test(
            messages=messages,
            baseline_provider=baseline_provider,
            baseline_deployment=baseline_deployment,
            canary_provider=canary_provider,
            canary_deployment=canary_deployment,
            baseline_params=baseline_params,
            canary_params=canary_params,
            reference_answer=ground_truth or None,
        )

        result["test_id"] = tc.get("test_id", f"test_{i}")
        result["query"] = query
        results.append(result)

    # Aggregate results
    baseline_latencies = [r["baseline"]["latency_ms"] for r in results if r["baseline"]["latency_ms"]]
    canary_latencies = [r["canary"]["latency_ms"] for r in results if r["canary"]["latency_ms"]]
    similarities = [r["similarity"].get("semantic_similarity", 0) for r in results if r["similarity"]]

    summary = {
        "total_tests": len(results),
        "baseline_avg_latency_ms": round(sum(baseline_latencies) / len(baseline_latencies), 2) if baseline_latencies else None,
        "canary_avg_latency_ms": round(sum(canary_latencies) / len(canary_latencies), 2) if canary_latencies else None,
        "avg_similarity": round(sum(similarities) / len(similarities), 4) if similarities else None,
        "baseline_errors": sum(1 for r in results if r["baseline"]["error"]),
        "canary_errors": sum(1 for r in results if r["canary"]["error"]),
    }

    return {"results": results, "summary": summary}


# ── Canary routing ──────────────────────────────────────────────
async def route_request(
    messages: List[Dict[str, str]],
) -> Dict[str, Any]:
    """
    Route a request based on current traffic configuration.
    Returns the response and which model was used.
    """
    config = get_traffic_config()

    if not config.enabled or config.canary_percentage <= 0:
        # All traffic to baseline
        resp = await call_model(
            config.baseline_provider,
            config.baseline_deployment,
            messages,
            **config.baseline_params,
        )
        return {
            "response": resp.text,
            "model_used": config.baseline_deployment,
            "is_canary": False,
            "latency_ms": resp.latency_ms,
            "tokens_prompt": resp.tokens_prompt,
            "tokens_completion": resp.tokens_completion,
            "error": resp.error,
        }

    # Determine which model to use based on canary percentage
    use_canary = random.random() * 100 < config.canary_percentage

    if use_canary:
        resp = await call_model(
            config.canary_provider,
            config.canary_deployment,
            messages,
            **config.canary_params,
        )
        model_used = config.canary_deployment
    else:
        resp = await call_model(
            config.baseline_provider,
            config.baseline_deployment,
            messages,
            **config.baseline_params,
        )
        model_used = config.baseline_deployment

    return {
        "response": resp.text,
        "model_used": model_used,
        "is_canary": use_canary,
        "latency_ms": resp.latency_ms,
        "tokens_prompt": resp.tokens_prompt,
        "tokens_completion": resp.tokens_completion,
        "error": resp.error,
    }
