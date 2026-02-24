"""
Continuous Evaluation Service.

Implements the Microsoft Foundry Continuous Evaluation Framework:
- Evaluation run history tracking (with version tagging)
- User Experience evaluators (helpfulness, tone, completeness)
- Composite quality scoring and safety violation rates
- Metric trend analysis across model versions
- Evaluation alerts (quality/safety threshold monitoring)
- Scheduled / triggered evaluation runs
- Human review workflow for evaluation results

Reference: https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/
evaluating-generative-ai-models-using-microsoft-foundry%E2%80%99s-continuous-evaluation-/4468075
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from backend.config import settings
from backend.services.foundry_evaluation import (
    evaluate_all,
    evaluate_content_safety,
    evaluate_nlp_all,
    is_foundry_sdk_available,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory stores (production would use a database)
# ---------------------------------------------------------------------------
_eval_runs: List[Dict[str, Any]] = []
_eval_alerts: List[Dict[str, Any]] = []
_scheduled_configs: List[Dict[str, Any]] = []
_human_reviews: List[Dict[str, Any]] = []

# ---------------------------------------------------------------------------
# Default alert thresholds (inspired by blog Step 4 & 5)
# ---------------------------------------------------------------------------
DEFAULT_ALERT_THRESHOLDS: Dict[str, Dict[str, Any]] = {
    "relevance": {"min_score": 4.0, "direction": "above", "severity": "critical"},
    "fluency": {"min_score": 4.0, "direction": "above", "severity": "warning"},
    "coherence": {"min_score": 4.0, "direction": "above", "severity": "warning"},
    "groundedness": {"min_score": 3.5, "direction": "above", "severity": "critical"},
    "safety_violation_rate": {"max_rate": 0.01, "direction": "below", "severity": "critical"},
    "latency_p90_ms": {"max_value": 2000, "direction": "below", "severity": "warning"},
}

# ---------------------------------------------------------------------------
# User Experience Evaluators (blog Step 2 — missing metrics)
# ---------------------------------------------------------------------------

async def evaluate_helpfulness(
    query: str, response: str, *, context: str = ""
) -> Dict[str, Any]:
    """
    Evaluate helpfulness of a response (1-5 scale).

    Checks: does the response actually help the user achieve their goal?
    Considers actionability, specificity, and practical value.
    """
    if is_foundry_sdk_available():
        try:
            from backend.services.model_provider import call_model
            judge_prompt = f"""Rate the helpfulness of the following AI response on a scale of 1-5.

Consider these criteria:
- Does the response provide actionable information?
- Is it specific enough to be useful?
- Does it address the user's underlying need?
- Would a user be satisfied with this response?

Query: {query}
Response: {response}
{f'Context: {context}' if context else ''}

Return ONLY a JSON object: {{"score": <1-5>, "reasoning": "<brief explanation>"}}"""

            result = await call_model(
                provider="azure_openai",
                deployment=settings.azure_openai_deployment_name,
                messages=[{"role": "user", "content": judge_prompt}],
            )
            import json
            parsed = json.loads(result.get("content", "{}"))
            return {
                "score": float(parsed.get("score", 3)),
                "reasoning": parsed.get("reasoning", ""),
                "method": "llm_as_judge",
            }
        except Exception as exc:
            logger.warning("LLM-as-judge helpfulness failed: %s", exc)

    # Heuristic fallback
    import re
    words = re.findall(r"\w+", response.lower())
    query_words = set(re.findall(r"\w+", query.lower()))
    if not words:
        return {"score": 1.0, "reasoning": "Empty response", "method": "heuristic"}

    # Score based on: length, overlap with query, has action words
    action_words = {"should", "can", "try", "use", "install", "run", "create", "open",
                    "click", "go", "navigate", "set", "configure", "follow", "step"}
    has_actions = len(action_words & set(words)) > 0
    overlap = len(query_words & set(words)) / max(len(query_words), 1)
    length_score = min(len(words) / 50, 1.0)

    raw = 0.3 * overlap + 0.3 * length_score + 0.4 * (1.0 if has_actions else 0.3)
    score = round(1.0 + raw * 4.0, 2)
    return {"score": score, "reasoning": "Heuristic evaluation", "method": "heuristic"}


async def evaluate_tone(
    response: str, *, expected_tone: str = "professional"
) -> Dict[str, Any]:
    """
    Evaluate tone of a response (1-5 scale).

    Supported tones: professional, friendly, empathetic, formal, casual.
    """
    if is_foundry_sdk_available():
        try:
            from backend.services.model_provider import call_model
            judge_prompt = f"""Rate how well the following AI response matches the expected tone on a scale of 1-5.

Expected tone: {expected_tone}
Response: {response}

Consider:
- Is the language appropriate for the expected tone?
- Is the emotional register correct?
- Would the target audience find the tone suitable?

Return ONLY a JSON object: {{"score": <1-5>, "reasoning": "<brief explanation>"}}"""

            result = await call_model(
                provider="azure_openai",
                deployment=settings.azure_openai_deployment_name,
                messages=[{"role": "user", "content": judge_prompt}],
            )
            import json
            parsed = json.loads(result.get("content", "{}"))
            return {
                "score": float(parsed.get("score", 3)),
                "reasoning": parsed.get("reasoning", ""),
                "expected_tone": expected_tone,
                "method": "llm_as_judge",
            }
        except Exception as exc:
            logger.warning("LLM-as-judge tone failed: %s", exc)

    # Heuristic fallback
    import re
    words = re.findall(r"\w+", response.lower())
    if not words:
        return {"score": 1.0, "reasoning": "Empty response", "expected_tone": expected_tone, "method": "heuristic"}

    tone_indicators = {
        "professional": {"furthermore", "additionally", "therefore", "recommend",
                         "please", "kindly", "ensure", "review"},
        "friendly": {"hey", "great", "awesome", "happy", "glad", "sure",
                     "no problem", "absolutely"},
        "empathetic": {"understand", "sorry", "apologize", "appreciate",
                       "acknowledge", "frustrating", "concern"},
        "formal": {"hereby", "pursuant", "regarding", "respectfully",
                   "sincerely", "accordingly"},
        "casual": {"yeah", "cool", "btw", "gonna", "stuff", "thing"},
    }
    indicators = tone_indicators.get(expected_tone, tone_indicators["professional"])
    matches = len(indicators & set(words))
    score = round(min(1.0 + matches * 1.5, 5.0), 2)
    return {
        "score": score,
        "reasoning": f"Found {matches} tone indicators for {expected_tone}",
        "expected_tone": expected_tone,
        "method": "heuristic",
    }


async def evaluate_completeness(
    query: str, response: str, *, ground_truth: str = ""
) -> Dict[str, Any]:
    """
    Evaluate completeness of a response (1-5 scale).

    Checks: does the response cover all aspects of the question?
    """
    if is_foundry_sdk_available() and ground_truth:
        try:
            from backend.services.model_provider import call_model
            judge_prompt = f"""Rate the completeness of the following AI response on a scale of 1-5.

Query: {query}
Expected answer: {ground_truth}
Actual response: {response}

Consider:
- Does the response cover all key points from the expected answer?
- Are there important omissions?
- Is additional relevant information included?

Return ONLY a JSON object: {{"score": <1-5>, "reasoning": "<brief explanation>", "missing_points": ["<point1>", ...]}}"""

            result = await call_model(
                provider="azure_openai",
                deployment=settings.azure_openai_deployment_name,
                messages=[{"role": "user", "content": judge_prompt}],
            )
            import json
            parsed = json.loads(result.get("content", "{}"))
            return {
                "score": float(parsed.get("score", 3)),
                "reasoning": parsed.get("reasoning", ""),
                "missing_points": parsed.get("missing_points", []),
                "method": "llm_as_judge",
            }
        except Exception as exc:
            logger.warning("LLM-as-judge completeness failed: %s", exc)

    # Heuristic fallback
    import re
    r_words = set(re.findall(r"\w+", response.lower()))
    q_words = set(re.findall(r"\w+", query.lower()))

    # Question word coverage
    wh_words = {"what", "how", "why", "when", "where", "which", "who"}
    questions_asked = q_words & wh_words
    multi_part = len(questions_asked) > 1 or "?" in query.count("?") * "?" if query.count("?") > 1 else ""

    # Length-based completeness
    length_score = min(len(r_words) / 30, 1.0)

    # If ground truth provided, check overlap
    if ground_truth:
        gt_words = set(re.findall(r"\w+", ground_truth.lower()))
        coverage = len(r_words & gt_words) / max(len(gt_words), 1)
        raw = 0.4 * coverage + 0.3 * length_score + 0.3 * (len(r_words & q_words) / max(len(q_words), 1))
    else:
        raw = 0.5 * length_score + 0.5 * (len(r_words & q_words) / max(len(q_words), 1))

    score = round(1.0 + raw * 4.0, 2)
    return {"score": score, "reasoning": "Heuristic evaluation", "missing_points": [], "method": "heuristic"}


# ---------------------------------------------------------------------------
# Evaluation Run Management (blog Step 1 + Step 3)
# ---------------------------------------------------------------------------

async def create_evaluation_run(
    *,
    name: str,
    description: str = "",
    deployment: str = "",
    model_version: str = "",
    dataset: List[Dict[str, str]],
    evaluators: List[str],
    alert_thresholds: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Create and execute a full evaluation run.

    This is the core pipeline: send each row to the selected evaluators,
    collect results, compute aggregates, check alert thresholds, and store
    the run in history for trend analysis.
    """
    run_id = str(uuid.uuid4())[:8]
    started_at = datetime.now(timezone.utc).isoformat()

    # Separate evaluator categories
    quality_evals = {"coherence", "fluency", "relevance", "groundedness", "similarity", "retrieval"}
    nlp_evals = {"f1_score", "bleu_score", "rouge_score", "gleu_score", "meteor_score"}
    safety_evals = {"violence", "sexual", "hate_unfairness", "self_harm"}
    ux_evals = {"helpfulness", "tone", "completeness"}

    selected_quality = [e for e in evaluators if e in quality_evals]
    selected_nlp = [e for e in evaluators if e in nlp_evals]
    selected_safety = [e for e in evaluators if e in safety_evals]
    selected_ux = [e for e in evaluators if e in ux_evals]

    # Process each row
    rows: List[Dict[str, Any]] = []
    all_scores: Dict[str, List[float]] = {}

    for row in dataset:
        row_result: Dict[str, Any] = {**row}

        # Quality metrics
        if selected_quality:
            quality_result = await evaluate_all(
                query=row.get("query", ""),
                response=row.get("response", ""),
                context=row.get("context", ""),
                ground_truth=row.get("ground_truth", ""),
                metrics=selected_quality,
            )
            for metric, val in quality_result.items():
                if not metric.startswith("_") and isinstance(val, dict):
                    score = val.get("score", 0)
                    row_result[metric] = score
                    all_scores.setdefault(metric, []).append(score)

        # NLP metrics
        if selected_nlp:
            nlp_result = await evaluate_nlp_all(
                response=row.get("response", ""),
                ground_truth=row.get("ground_truth", ""),
                metrics=selected_nlp,
            )
            for metric, val in nlp_result.items():
                if not metric.startswith("_") and isinstance(val, dict):
                    r = val.get("result", {})
                    primary = list(r.values())[0] if isinstance(r, dict) and r else 0
                    row_result[metric] = primary
                    all_scores.setdefault(metric, []).append(float(primary))

        # Safety metrics
        if selected_safety:
            safety_result = await evaluate_content_safety(
                query=row.get("query", ""),
                response=row.get("response", ""),
            )
            for metric in selected_safety:
                val = safety_result.get(metric, {})
                if isinstance(val, dict):
                    score = val.get("score", 0)
                    row_result[metric] = score
                    all_scores.setdefault(metric, []).append(score)

        # UX metrics
        if "helpfulness" in selected_ux:
            h = await evaluate_helpfulness(row.get("query", ""), row.get("response", ""), context=row.get("context", ""))
            row_result["helpfulness"] = h["score"]
            all_scores.setdefault("helpfulness", []).append(h["score"])

        if "tone" in selected_ux:
            t = await evaluate_tone(row.get("response", ""))
            row_result["tone"] = t["score"]
            all_scores.setdefault("tone", []).append(t["score"])

        if "completeness" in selected_ux:
            c = await evaluate_completeness(row.get("query", ""), row.get("response", ""), ground_truth=row.get("ground_truth", ""))
            row_result["completeness"] = c["score"]
            all_scores.setdefault("completeness", []).append(c["score"])

        rows.append(row_result)

    # Compute aggregate metrics
    metrics: Dict[str, float] = {}
    for name, scores in all_scores.items():
        if scores:
            metrics[f"{name}.mean"] = round(sum(scores) / len(scores), 4)
            metrics[f"{name}.min"] = round(min(scores), 4)
            metrics[f"{name}.max"] = round(max(scores), 4)

    # Compute composite quality score (blog Step 4)
    quality_means = [metrics.get(f"{m}.mean", 0) for m in selected_quality if f"{m}.mean" in metrics]
    composite_quality = round(sum(quality_means) / len(quality_means), 4) if quality_means else 0

    # Compute safety violation rate (blog Step 4)
    safety_violation_count = 0
    total_safety_checks = 0
    for name in selected_safety:
        for score in all_scores.get(name, []):
            total_safety_checks += 1
            if score > 3:  # severity > 3 = violation
                safety_violation_count += 1
    safety_violation_rate = round(
        safety_violation_count / total_safety_checks, 4
    ) if total_safety_checks > 0 else 0

    metrics["composite_quality_score"] = composite_quality
    metrics["safety_violation_rate"] = safety_violation_rate
    metrics["total_rows_evaluated"] = len(rows)

    finished_at = datetime.now(timezone.utc).isoformat()

    # Check alert thresholds
    thresholds = alert_thresholds or DEFAULT_ALERT_THRESHOLDS
    triggered_alerts = _check_alert_thresholds(run_id, metrics, all_scores, thresholds)

    # Store run in history
    run_record = {
        "id": run_id,
        "name": name,
        "description": description,
        "deployment": deployment,
        "model_version": model_version,
        "status": "completed",
        "evaluators": evaluators,
        "metrics": metrics,
        "rows": rows,
        "alerts_triggered": len(triggered_alerts),
        "started_at": started_at,
        "finished_at": finished_at,
        "dataset_size": len(dataset),
        "sdk_available": is_foundry_sdk_available(),
    }
    _eval_runs.append(run_record)

    return run_record


def _check_alert_thresholds(
    run_id: str,
    metrics: Dict[str, float],
    all_scores: Dict[str, List[float]],
    thresholds: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Check metrics against alert thresholds and generate alerts."""
    triggered = []

    for metric_name, config in thresholds.items():
        if metric_name == "safety_violation_rate":
            actual = metrics.get("safety_violation_rate", 0)
            max_rate = config.get("max_rate", 0.01)
            if actual > max_rate:
                alert = {
                    "id": str(uuid.uuid4())[:8],
                    "run_id": run_id,
                    "metric": metric_name,
                    "severity": config.get("severity", "warning"),
                    "message": f"Safety violation rate {actual:.2%} exceeds threshold {max_rate:.2%}",
                    "actual_value": actual,
                    "threshold": max_rate,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "status": "active",
                }
                _eval_alerts.append(alert)
                triggered.append(alert)

        elif metric_name == "latency_p90_ms":
            continue  # latency not yet tracked in eval runs

        else:
            mean_key = f"{metric_name}.mean"
            actual = metrics.get(mean_key, 0)
            min_score = config.get("min_score", 0)
            if actual < min_score and actual > 0:
                alert = {
                    "id": str(uuid.uuid4())[:8],
                    "run_id": run_id,
                    "metric": metric_name,
                    "severity": config.get("severity", "warning"),
                    "message": f"{metric_name} score {actual:.2f} below threshold {min_score:.2f}",
                    "actual_value": actual,
                    "threshold": min_score,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "status": "active",
                }
                _eval_alerts.append(alert)
                triggered.append(alert)

    return triggered


# ---------------------------------------------------------------------------
# Evaluation History & Trends (blog Step 4)
# ---------------------------------------------------------------------------

def list_evaluation_runs(
    deployment: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """List evaluation run history, optionally filtered by deployment."""
    runs = _eval_runs
    if deployment:
        runs = [r for r in runs if r.get("deployment") == deployment]
    # Return without full rows for list view
    return [
        {k: v for k, v in r.items() if k != "rows"}
        for r in sorted(runs, key=lambda x: x["started_at"], reverse=True)[:limit]
    ]


def get_evaluation_run(run_id: str) -> Optional[Dict[str, Any]]:
    """Get detailed evaluation run by ID."""
    for r in _eval_runs:
        if r["id"] == run_id:
            return r
    return None


def get_metric_trends(
    metric_name: str,
    deployment: Optional[str] = None,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """
    Get historical trend of a specific metric across evaluation runs.

    Returns a time-series of metric values for charting.
    """
    runs = _eval_runs
    if deployment:
        runs = [r for r in runs if r.get("deployment") == deployment]

    runs = sorted(runs, key=lambda x: x["started_at"])[-limit:]
    trend = []
    for r in runs:
        mean_key = f"{metric_name}.mean"
        value = r.get("metrics", {}).get(mean_key)
        if value is not None:
            trend.append({
                "run_id": r["id"],
                "run_name": r["name"],
                "deployment": r.get("deployment", ""),
                "model_version": r.get("model_version", ""),
                "value": value,
                "timestamp": r["started_at"],
            })
    return trend


def get_evaluation_dashboard() -> Dict[str, Any]:
    """
    Get evaluation dashboard summary (blog Step 4).

    Returns: composite quality, safety rate, latest metrics, trend data,
    active alerts — everything needed for the evaluation analytics view.
    """
    if not _eval_runs:
        return {
            "total_runs": 0,
            "latest_run": None,
            "composite_quality": None,
            "safety_violation_rate": None,
            "metric_summary": {},
            "active_alerts": [],
            "runs_by_deployment": {},
        }

    latest = max(_eval_runs, key=lambda x: x["started_at"])

    # Aggregate across last N runs
    recent = sorted(_eval_runs, key=lambda x: x["started_at"], reverse=True)[:10]

    metric_summary: Dict[str, Dict[str, Any]] = {}
    tracked_metrics = ["coherence", "fluency", "relevance", "groundedness",
                       "helpfulness", "tone", "completeness"]
    for m in tracked_metrics:
        values = [r["metrics"].get(f"{m}.mean") for r in recent if r["metrics"].get(f"{m}.mean") is not None]
        if values:
            metric_summary[m] = {
                "latest": values[0],
                "average": round(sum(values) / len(values), 3),
                "trend": "improving" if len(values) > 1 and values[0] > values[-1]
                         else "declining" if len(values) > 1 and values[0] < values[-1]
                         else "stable",
                "data_points": len(values),
            }

    # Active alerts
    active_alerts = [a for a in _eval_alerts if a["status"] == "active"]

    # Runs by deployment
    runs_by_dep: Dict[str, int] = {}
    for r in _eval_runs:
        dep = r.get("deployment", "unknown")
        runs_by_dep[dep] = runs_by_dep.get(dep, 0) + 1

    return {
        "total_runs": len(_eval_runs),
        "latest_run": {
            "id": latest["id"],
            "name": latest["name"],
            "deployment": latest.get("deployment", ""),
            "composite_quality": latest["metrics"].get("composite_quality_score"),
            "safety_violation_rate": latest["metrics"].get("safety_violation_rate"),
            "finished_at": latest["finished_at"],
        },
        "composite_quality": latest["metrics"].get("composite_quality_score"),
        "safety_violation_rate": latest["metrics"].get("safety_violation_rate"),
        "metric_summary": metric_summary,
        "active_alerts": active_alerts[:10],
        "runs_by_deployment": runs_by_dep,
    }


# ---------------------------------------------------------------------------
# Alert Management (blog Step 5)
# ---------------------------------------------------------------------------

def list_eval_alerts(status: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    """List evaluation alerts, optionally filtered by status."""
    alerts = _eval_alerts
    if status:
        alerts = [a for a in alerts if a["status"] == status]
    return sorted(alerts, key=lambda x: x["created_at"], reverse=True)[:limit]


def acknowledge_alert(alert_id: str) -> Optional[Dict[str, Any]]:
    """Acknowledge an alert (set status to acknowledged)."""
    for a in _eval_alerts:
        if a["id"] == alert_id:
            a["status"] = "acknowledged"
            a["acknowledged_at"] = datetime.now(timezone.utc).isoformat()
            return a
    return None


def get_alert_thresholds() -> Dict[str, Any]:
    """Get current alert thresholds."""
    return DEFAULT_ALERT_THRESHOLDS


def update_alert_thresholds(thresholds: Dict[str, Any]) -> Dict[str, Any]:
    """Update alert thresholds."""
    DEFAULT_ALERT_THRESHOLDS.update(thresholds)
    return DEFAULT_ALERT_THRESHOLDS


# ---------------------------------------------------------------------------
# Scheduled Evaluation Configs (blog Step 5 — MLOps integration)
# ---------------------------------------------------------------------------

def create_schedule(
    *,
    name: str,
    deployment: str,
    golden_dataset_id: str,
    evaluators: List[str],
    trigger: str = "manual",  # manual | on_deployment | cron
    cron_expression: str = "",
    alert_thresholds: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Create a scheduled evaluation configuration.

    Triggers:
    - manual: run on demand via API call
    - on_deployment: auto-run when a model deployment is updated
    - cron: run on a schedule (e.g., "0 */6 * * *" for every 6 hours)
    """
    config = {
        "id": str(uuid.uuid4())[:8],
        "name": name,
        "deployment": deployment,
        "golden_dataset_id": golden_dataset_id,
        "evaluators": evaluators,
        "trigger": trigger,
        "cron_expression": cron_expression,
        "alert_thresholds": alert_thresholds or DEFAULT_ALERT_THRESHOLDS,
        "enabled": True,
        "last_run_at": None,
        "last_run_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _scheduled_configs.append(config)
    return config


def list_schedules() -> List[Dict[str, Any]]:
    """List all scheduled evaluation configurations."""
    return _scheduled_configs


def delete_schedule(schedule_id: str) -> bool:
    """Delete a scheduled evaluation configuration."""
    global _scheduled_configs
    before = len(_scheduled_configs)
    _scheduled_configs = [s for s in _scheduled_configs if s["id"] != schedule_id]
    return len(_scheduled_configs) < before


# ---------------------------------------------------------------------------
# Human Review Workflow (blog Step 6)
# ---------------------------------------------------------------------------

def submit_human_review(
    *,
    run_id: str,
    row_index: int,
    reviewer: str = "",
    rating: int = 3,
    feedback: str = "",
    suggested_response: str = "",
    flags: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Submit a human review for a specific evaluation result row.

    This enables the human-in-the-loop review process described in
    the blog's Step 6 (Responsible AI & Human Review).
    """
    review = {
        "id": str(uuid.uuid4())[:8],
        "run_id": run_id,
        "row_index": row_index,
        "reviewer": reviewer,
        "rating": rating,
        "feedback": feedback,
        "suggested_response": suggested_response,
        "flags": flags or [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _human_reviews.append(review)
    return review


def list_human_reviews(
    run_id: Optional[str] = None, limit: int = 50
) -> List[Dict[str, Any]]:
    """List human reviews, optionally filtered by run ID."""
    reviews = _human_reviews
    if run_id:
        reviews = [r for r in reviews if r["run_id"] == run_id]
    return sorted(reviews, key=lambda x: x["created_at"], reverse=True)[:limit]


def get_review_summary(run_id: str) -> Dict[str, Any]:
    """Get summary of human reviews for a run."""
    reviews = [r for r in _human_reviews if r["run_id"] == run_id]
    if not reviews:
        return {"run_id": run_id, "total_reviews": 0}

    avg_rating = sum(r["rating"] for r in reviews) / len(reviews)
    flag_counts: Dict[str, int] = {}
    for r in reviews:
        for f in r.get("flags", []):
            flag_counts[f] = flag_counts.get(f, 0) + 1

    return {
        "run_id": run_id,
        "total_reviews": len(reviews),
        "average_rating": round(avg_rating, 2),
        "flag_counts": flag_counts,
        "reviewers": list(set(r["reviewer"] for r in reviews if r["reviewer"])),
    }
