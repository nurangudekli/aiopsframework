"""
Cost Management API routes.

GET  /costs/summary   → aggregated cost summary
GET  /costs/alerts    → cost alerts and threshold status
POST /costs/alerts/clear → clear alert history
POST /costs/cascade   → run a request through model cascade
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.schemas.evaluation import CostSummary, CostSummaryRequest
from backend.services.cost_tracker import ModelCascade, get_cost_summary, get_cost_alerts, clear_cost_alerts

router = APIRouter(prefix="/costs", tags=["Cost Management"])


@router.get("/summary")
async def summary(
    days: int = 30,
    provider: Optional[str] = None,
    deployment: Optional[str] = None,
):
    """Get aggregated cost summary for the given period."""
    return await get_cost_summary(days=days, provider=provider, deployment=deployment)


@router.get("/alerts")
async def alerts(limit: int = 50):
    """Get cost alerts and current threshold status."""
    return await get_cost_alerts(limit=limit)


@router.post("/alerts/clear")
async def clear_alerts():
    """Clear all in-memory cost alerts."""
    count = clear_cost_alerts()
    return {"cleared": count}


class CascadeRequest(BaseModel):
    messages: List[Dict[str, str]] = Field(..., min_length=1)
    tiers: List[Dict[str, Any]] = Field(
        ...,
        min_length=1,
        description='Ordered cheapest→expensive, each: {"provider": "...", "deployment": "...", "params": {}}',
    )
    confidence_threshold: float = Field(0.7, ge=0.0, le=1.0)


@router.post("/cascade")
async def run_cascade(payload: CascadeRequest):
    """Run a request through a model cascade for cost optimisation."""
    cascade = ModelCascade(tiers=payload.tiers, confidence_threshold=payload.confidence_threshold)
    result = await cascade.run(payload.messages)
    return result
