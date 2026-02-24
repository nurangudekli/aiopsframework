"""
Shadow Testing & Canary Deployment API routes.

POST /shadow-testing/test           → run shadow test (single)
POST /shadow-testing/test-batch     → run shadow test batch
GET  /shadow-testing/config         → get traffic configuration
PUT  /shadow-testing/config         → update traffic configuration
GET  /shadow-testing/canary-stages  → get recommended canary stages
POST /shadow-testing/route          → route a request via canary config
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.services.shadow_testing import (
    get_canary_stages,
    get_traffic_config,
    route_request,
    run_shadow_test,
    run_shadow_test_batch,
    update_traffic_config,
)

router = APIRouter(prefix="/shadow-testing", tags=["Shadow Testing & Canary"])
logger = logging.getLogger(__name__)


# ── Schemas ─────────────────────────────────────────────────────
class ShadowTestRequest(BaseModel):
    messages: List[Dict[str, str]] = Field(..., description="Chat messages")
    baseline_provider: str = Field("azure_openai")
    baseline_deployment: str = Field(..., description="Baseline model deployment name")
    canary_provider: str = Field("azure_openai")
    canary_deployment: str = Field(..., description="Candidate model deployment name")
    baseline_params: Optional[Dict[str, Any]] = None
    canary_params: Optional[Dict[str, Any]] = None
    reference_answer: Optional[str] = None


class ShadowTestBatchRequest(BaseModel):
    test_cases: List[Dict[str, Any]] = Field(..., description="Array of test cases with query, context, ground_truth")
    baseline_provider: str = Field("azure_openai")
    baseline_deployment: str = Field(..., description="Baseline model deployment name")
    canary_provider: str = Field("azure_openai")
    canary_deployment: str = Field(..., description="Candidate model deployment name")
    baseline_params: Optional[Dict[str, Any]] = None
    canary_params: Optional[Dict[str, Any]] = None
    system_message: str = Field("You are a helpful assistant.")


class TrafficConfigUpdate(BaseModel):
    enabled: Optional[bool] = None
    canary_percentage: Optional[float] = Field(None, ge=0, le=100)
    baseline_provider: Optional[str] = None
    baseline_deployment: Optional[str] = None
    canary_provider: Optional[str] = None
    canary_deployment: Optional[str] = None
    baseline_params: Optional[Dict[str, Any]] = None
    canary_params: Optional[Dict[str, Any]] = None
    monitoring_sample_rate: Optional[float] = Field(None, ge=0, le=100)


class RouteRequest(BaseModel):
    messages: List[Dict[str, str]] = Field(..., description="Chat messages to route")


# ── Routes ──────────────────────────────────────────────────────
@router.post("/test")
async def shadow_test(payload: ShadowTestRequest):
    """Run a shadow test: call both models, compare results."""
    return await run_shadow_test(
        messages=payload.messages,
        baseline_provider=payload.baseline_provider,
        baseline_deployment=payload.baseline_deployment,
        canary_provider=payload.canary_provider,
        canary_deployment=payload.canary_deployment,
        baseline_params=payload.baseline_params,
        canary_params=payload.canary_params,
        reference_answer=payload.reference_answer,
    )


@router.post("/test-batch")
async def shadow_test_batch(payload: ShadowTestBatchRequest):
    """Run shadow test on a batch of test cases."""
    return await run_shadow_test_batch(
        test_cases=payload.test_cases,
        baseline_provider=payload.baseline_provider,
        baseline_deployment=payload.baseline_deployment,
        canary_provider=payload.canary_provider,
        canary_deployment=payload.canary_deployment,
        baseline_params=payload.baseline_params,
        canary_params=payload.canary_params,
        system_message=payload.system_message,
    )


@router.get("/config")
async def get_config():
    """Get current traffic configuration."""
    cfg = get_traffic_config()
    return {
        "enabled": cfg.enabled,
        "canary_percentage": cfg.canary_percentage,
        "baseline_provider": cfg.baseline_provider,
        "baseline_deployment": cfg.baseline_deployment,
        "canary_provider": cfg.canary_provider,
        "canary_deployment": cfg.canary_deployment,
        "baseline_params": cfg.baseline_params,
        "canary_params": cfg.canary_params,
        "monitoring_sample_rate": cfg.monitoring_sample_rate,
    }


@router.put("/config")
async def set_config(payload: TrafficConfigUpdate):
    """Update traffic configuration."""
    cfg = update_traffic_config(
        enabled=payload.enabled,
        canary_percentage=payload.canary_percentage,
        baseline_provider=payload.baseline_provider,
        baseline_deployment=payload.baseline_deployment,
        canary_provider=payload.canary_provider,
        canary_deployment=payload.canary_deployment,
        baseline_params=payload.baseline_params,
        canary_params=payload.canary_params,
        monitoring_sample_rate=payload.monitoring_sample_rate,
    )
    return {
        "enabled": cfg.enabled,
        "canary_percentage": cfg.canary_percentage,
        "baseline_provider": cfg.baseline_provider,
        "baseline_deployment": cfg.baseline_deployment,
        "canary_provider": cfg.canary_provider,
        "canary_deployment": cfg.canary_deployment,
        "baseline_params": cfg.baseline_params,
        "canary_params": cfg.canary_params,
        "monitoring_sample_rate": cfg.monitoring_sample_rate,
    }


@router.get("/canary-stages")
async def canary_stages():
    """Get recommended canary rollout stages."""
    return get_canary_stages()


@router.post("/route")
async def route(payload: RouteRequest):
    """Route a request through the canary configuration."""
    return await route_request(messages=payload.messages)
