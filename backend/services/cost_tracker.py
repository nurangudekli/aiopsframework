"""
Cost Tracker Service.

Records and aggregates token usage and API costs across all operations.
Supports model cascading strategies to optimize spend.
Includes cost alerting against configurable thresholds.
Backed by Azure Cosmos DB.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from backend.config import settings
from backend.cosmos_client import (
    create_item,
    new_id,
    query_items,
    utcnow_iso,
)
from backend.services.model_provider import PRICING, estimate_cost

logger = logging.getLogger(__name__)

CONTAINER = "cost_records"

# ── In-memory alert state ───────────────────────────────────────
_cost_alerts: List[Dict[str, Any]] = []


# ── Recording ───────────────────────────────────────────────────
async def record_cost(
    provider: str,
    deployment: str,
    tokens_prompt: int,
    tokens_completion: int,
    tokens_reasoning: int = 0,
    operation: str = "unknown",
    reference_id: Optional[str] = None,
    latency_ms: Optional[float] = None,
    deployment_type: str = "Standard",
) -> Dict[str, Any]:
    """Persist a single cost record."""
    cost = estimate_cost(deployment, tokens_prompt, tokens_completion, tokens_reasoning, deployment_type)
    now = utcnow_iso()
    record = {
        "id": new_id(),
        "provider": provider,
        "deployment": deployment,
        "operation": operation,
        "reference_id": reference_id,
        "tokens_prompt": tokens_prompt,
        "tokens_completion": tokens_completion,
        "tokens_reasoning": tokens_reasoning,
        "tokens_total": tokens_prompt + tokens_completion + tokens_reasoning,
        "cost_usd": cost,
        "latency_ms": latency_ms,
        "deployment_type": deployment_type,
        "metadata_json": None,
        "recorded_at": now,
    }
    record = await create_item(CONTAINER, record)

    # Check cost alerts after each recording
    await _check_cost_alert(record)
    return record


# ── Aggregation ─────────────────────────────────────────────────
async def get_cost_summary(
    days: int = 30,
    provider: Optional[str] = None,
    deployment: Optional[str] = None,
) -> Dict[str, Any]:
    """Return aggregated cost summary for the given period."""
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    query = "SELECT * FROM c WHERE c.recorded_at >= @since"
    params: List[Dict[str, Any]] = [{"name": "@since", "value": since}]

    if provider:
        query += " AND c.provider = @provider"
        params.append({"name": "@provider", "value": provider})
    if deployment:
        query += " AND c.deployment = @deployment"
        params.append({"name": "@deployment", "value": deployment})

    records = await query_items(CONTAINER, query, parameters=params)

    total_cost = sum(r.get("cost_usd", 0) for r in records)
    total_tokens = sum(r.get("tokens_total", 0) for r in records)

    # Daily breakdown
    daily: Dict[str, Dict[str, float]] = {}
    for r in records:
        day_key = r.get("recorded_at", "")[:10]  # YYYY-MM-DD
        if day_key not in daily:
            daily[day_key] = {"cost_usd": 0.0, "tokens": 0, "requests": 0}
        daily[day_key]["cost_usd"] += r.get("cost_usd", 0)
        daily[day_key]["tokens"] += r.get("tokens_total", 0)
        daily[day_key]["requests"] += 1

    # By deployment
    by_deploy: Dict[str, Dict[str, float]] = {}
    for r in records:
        key = f"{r.get('provider', '')}/{r.get('deployment', '')}"
        if key not in by_deploy:
            by_deploy[key] = {"cost_usd": 0.0, "tokens": 0, "requests": 0}
        by_deploy[key]["cost_usd"] += r.get("cost_usd", 0)
        by_deploy[key]["tokens"] += r.get("tokens_total", 0)
        by_deploy[key]["requests"] += 1

    return {
        "total_cost_usd": round(total_cost, 6),
        "total_tokens": total_tokens,
        "total_requests": len(records),
        "daily_breakdown": [
            {"date": k, **v} for k, v in sorted(daily.items())
        ],
        "by_deployment": [
            {"deployment": k, **v} for k, v in sorted(by_deploy.items())
        ],
    }


# ── Model Cascading ────────────────────────────────────────────
class ModelCascade:
    """
    Cost-optimised model cascading.

    Tries a cheaper model first; if confidence is below threshold,
    escalates to a more expensive model.
    """

    def __init__(
        self,
        tiers: List[Dict[str, Any]],
        confidence_threshold: float = 0.7,
    ):
        self.tiers = tiers
        self.confidence_threshold = confidence_threshold

    async def run(
        self,
        messages: List[Dict[str, str]],
        evaluate_confidence: bool = True,
    ) -> Dict[str, Any]:
        from backend.services.model_provider import call_model

        for idx, tier in enumerate(self.tiers):
            resp = await call_model(
                tier["provider"],
                tier["deployment"],
                messages,
                **(tier.get("params", {})),
            )

            if resp.error:
                logger.warning("Cascade tier %d failed: %s", idx, resp.error)
                continue

            confidence = self._estimate_confidence(resp.text)
            if confidence >= self.confidence_threshold or idx == len(self.tiers) - 1:
                cost = estimate_cost(tier["deployment"], resp.tokens_prompt, resp.tokens_completion)
                return {
                    "text": resp.text,
                    "tier_used": idx,
                    "deployment": tier["deployment"],
                    "latency_ms": resp.latency_ms,
                    "cost_usd": cost,
                    "confidence": confidence,
                    "escalated": idx > 0,
                }

            logger.info("Cascade tier %d confidence %.2f < %.2f, escalating", idx, confidence, self.confidence_threshold)

        return {"text": "", "tier_used": -1, "error": "All cascade tiers failed"}

    @staticmethod
    def _estimate_confidence(text: str) -> float:
        if not text.strip():
            return 0.0
        low_confidence_phrases = [
            "i don't know", "i'm not sure", "i cannot", "i can't",
            "no information", "not available", "unable to",
        ]
        text_lower = text.lower()
        penalty = sum(0.15 for p in low_confidence_phrases if p in text_lower)
        base = min(1.0, len(text.split()) / 50)
        return max(0.0, min(1.0, base - penalty))


# ── Cost Alerting ──────────────────────────────────────────────
async def _check_cost_alert(record: Dict[str, Any]) -> None:
    """Check if cumulative daily cost exceeds the configured threshold."""
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    records = await query_items(
        CONTAINER,
        "SELECT VALUE SUM(c.cost_usd) FROM c WHERE c.recorded_at >= @today",
        parameters=[{"name": "@today", "value": today}],
    )
    daily_total = records[0] if records and records[0] is not None else 0.0

    threshold = settings.cost_alert_threshold_usd
    if daily_total >= threshold:
        alert = {
            "type": "cost_threshold_exceeded",
            "threshold_usd": threshold,
            "current_daily_total_usd": round(float(daily_total), 4),
            "triggered_by": {
                "deployment": record.get("deployment"),
                "cost_usd": record.get("cost_usd"),
                "operation": record.get("operation"),
            },
            "triggered_at": datetime.now(timezone.utc).isoformat(),
            "message": (
                f"Daily cost ${daily_total:.2f} exceeded threshold ${threshold:.2f}. "
                f"Latest: {record.get('deployment')} ({record.get('operation')}) ${record.get('cost_usd', 0):.4f}"
            ),
        }
        _cost_alerts.append(alert)
        logger.warning("COST ALERT: %s", alert["message"])

        if len(_cost_alerts) > 100:
            _cost_alerts[:] = _cost_alerts[-100:]


async def get_cost_alerts(limit: int = 50) -> Dict[str, Any]:
    """Return recent cost alerts and current threshold status."""
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    records = await query_items(
        CONTAINER,
        "SELECT VALUE SUM(c.cost_usd) FROM c WHERE c.recorded_at >= @today",
        parameters=[{"name": "@today", "value": today}],
    )
    daily_total = float(records[0]) if records and records[0] is not None else 0.0

    threshold = settings.cost_alert_threshold_usd
    return {
        "threshold_usd": threshold,
        "current_daily_total_usd": round(daily_total, 4),
        "threshold_exceeded": daily_total >= threshold,
        "utilization_pct": round((daily_total / threshold) * 100, 1) if threshold > 0 else 0,
        "recent_alerts": _cost_alerts[-limit:],
        "total_alerts": len(_cost_alerts),
    }


def clear_cost_alerts() -> int:
    """Clear all in-memory alerts. Returns count cleared."""
    count = len(_cost_alerts)
    _cost_alerts.clear()
    return count
