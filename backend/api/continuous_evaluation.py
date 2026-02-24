"""
Continuous Evaluation API routes.

Implements the Microsoft Foundry Continuous Evaluation Framework endpoints:

POST /continuous-eval/runs                 → Create & execute an evaluation run
GET  /continuous-eval/runs                 → List evaluation run history
GET  /continuous-eval/runs/{run_id}        → Get detailed run results
GET  /continuous-eval/dashboard            → Evaluation analytics dashboard
GET  /continuous-eval/trends/{metric}      → Metric trend over time
GET  /continuous-eval/alerts               → List evaluation alerts
PUT  /continuous-eval/alerts/{id}/ack      → Acknowledge an alert
GET  /continuous-eval/alert-thresholds     → Get alert thresholds
PUT  /continuous-eval/alert-thresholds     → Update alert thresholds
POST /continuous-eval/schedules            → Create scheduled evaluation
GET  /continuous-eval/schedules            → List schedules
DELETE /continuous-eval/schedules/{id}     → Delete schedule
POST /continuous-eval/reviews              → Submit human review
GET  /continuous-eval/reviews              → List human reviews
GET  /continuous-eval/reviews/summary/{id} → Review summary for a run
POST /continuous-eval/ux-evaluate          → Run UX evaluators (helpfulness, tone, completeness)
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.services.continuous_evaluation import (
    create_evaluation_run,
    list_evaluation_runs,
    get_evaluation_run,
    get_evaluation_dashboard,
    get_metric_trends,
    list_eval_alerts,
    acknowledge_alert,
    get_alert_thresholds,
    update_alert_thresholds,
    create_schedule,
    list_schedules,
    delete_schedule,
    submit_human_review,
    list_human_reviews,
    get_review_summary,
    evaluate_helpfulness,
    evaluate_tone,
    evaluate_completeness,
)

router = APIRouter(prefix="/continuous-eval", tags=["Continuous Evaluation"])


# ── Schemas ────────────────────────────────────────────────────

class EvalRunRequest(BaseModel):
    name: str = Field(..., description="Evaluation run name")
    description: str = Field("", description="Optional description")
    deployment: str = Field("", description="Model deployment name")
    model_version: str = Field("", description="Model version tag for trend tracking")
    dataset: List[Dict[str, str]] = Field(
        ...,
        description="Dataset rows: [{query, response, context?, ground_truth?}]",
    )
    evaluators: List[str] = Field(
        ...,
        description="Evaluator names: coherence, fluency, relevance, groundedness, similarity, "
                    "retrieval, f1_score, bleu_score, rouge_score, violence, sexual, "
                    "hate_unfairness, self_harm, helpfulness, tone, completeness",
    )
    alert_thresholds: Optional[Dict[str, Any]] = Field(
        None, description="Custom alert thresholds (or use defaults)"
    )


class ScheduleRequest(BaseModel):
    name: str
    deployment: str
    golden_dataset_id: str
    evaluators: List[str]
    trigger: str = Field("manual", description="manual | on_deployment | cron")
    cron_expression: str = ""
    alert_thresholds: Optional[Dict[str, Any]] = None


class HumanReviewRequest(BaseModel):
    run_id: str
    row_index: int
    reviewer: str = ""
    rating: int = Field(3, ge=1, le=5, description="Human rating 1-5")
    feedback: str = ""
    suggested_response: str = ""
    flags: Optional[List[str]] = Field(
        None,
        description="Flags: hallucination, unsafe, off_topic, incomplete, biased, wrong_tone",
    )


class UxEvalRequest(BaseModel):
    query: str = ""
    response: str = Field(..., description="Model response to evaluate")
    context: str = ""
    ground_truth: str = ""
    expected_tone: str = "professional"
    metrics: Optional[List[str]] = Field(
        None,
        description="UX metrics: helpfulness, tone, completeness (default: all)",
    )


# ── Evaluation Runs ───────────────────────────────────────────

@router.post("/runs")
async def create_run(payload: EvalRunRequest):
    """
    Create and execute an evaluation run (blog Step 3).

    Runs all selected evaluators on the dataset, computes aggregate metrics,
    checks alert thresholds, and stores results for trend analysis.
    """
    result = await create_evaluation_run(
        name=payload.name,
        description=payload.description,
        deployment=payload.deployment,
        model_version=payload.model_version,
        dataset=payload.dataset,
        evaluators=payload.evaluators,
        alert_thresholds=payload.alert_thresholds,
    )
    return result


@router.get("/runs")
async def list_runs(deployment: Optional[str] = None, limit: int = 50):
    """List evaluation run history (blog Step 4 — analyze results)."""
    return list_evaluation_runs(deployment=deployment, limit=limit)


@router.get("/runs/{run_id}")
async def get_run(run_id: str):
    """Get detailed results for a specific evaluation run."""
    run = get_evaluation_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Evaluation run not found")
    return run


# ── Dashboard & Trends ────────────────────────────────────────

@router.get("/dashboard")
async def dashboard():
    """
    Evaluation analytics dashboard (blog Step 4).

    Returns composite quality score, safety violation rate, metric summaries,
    trend directions, and active alerts.
    """
    return get_evaluation_dashboard()


@router.get("/trends/{metric_name}")
async def metric_trends(metric_name: str, deployment: Optional[str] = None, limit: int = 20):
    """
    Get historical trend of a metric across evaluation runs (blog Step 4).

    Use this to chart metric performance over time and detect drift.
    """
    return get_metric_trends(metric_name, deployment=deployment, limit=limit)


# ── Alerts ────────────────────────────────────────────────────

@router.get("/alerts")
async def alerts(status: Optional[str] = None, limit: int = 50):
    """List evaluation alerts (blog Step 5 — Azure Monitor integration)."""
    return list_eval_alerts(status=status, limit=limit)


@router.put("/alerts/{alert_id}/ack")
async def ack_alert(alert_id: str):
    """Acknowledge an evaluation alert."""
    result = acknowledge_alert(alert_id)
    if not result:
        raise HTTPException(status_code=404, detail="Alert not found")
    return result


@router.get("/alert-thresholds")
async def get_thresholds():
    """Get current evaluation alert thresholds."""
    return get_alert_thresholds()


@router.put("/alert-thresholds")
async def set_thresholds(thresholds: Dict[str, Any]):
    """Update evaluation alert thresholds."""
    return update_alert_thresholds(thresholds)


# ── Scheduled Evaluations ────────────────────────────────────

@router.post("/schedules")
async def create_eval_schedule(payload: ScheduleRequest):
    """
    Create a scheduled evaluation configuration (blog Step 5 — MLOps).

    Supports manual, on_deployment, and cron triggers.
    """
    return create_schedule(
        name=payload.name,
        deployment=payload.deployment,
        golden_dataset_id=payload.golden_dataset_id,
        evaluators=payload.evaluators,
        trigger=payload.trigger,
        cron_expression=payload.cron_expression,
        alert_thresholds=payload.alert_thresholds,
    )


@router.get("/schedules")
async def get_schedules():
    """List all scheduled evaluation configurations."""
    return list_schedules()


@router.delete("/schedules/{schedule_id}")
async def remove_schedule(schedule_id: str):
    """Delete a scheduled evaluation configuration."""
    if not delete_schedule(schedule_id):
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"status": "deleted"}


# ── Human Review ──────────────────────────────────────────────

@router.post("/reviews")
async def create_review(payload: HumanReviewRequest):
    """
    Submit a human review for an evaluation result (blog Step 6).

    Enables human-in-the-loop review of AI responses flagged during evaluation.
    """
    return submit_human_review(
        run_id=payload.run_id,
        row_index=payload.row_index,
        reviewer=payload.reviewer,
        rating=payload.rating,
        feedback=payload.feedback,
        suggested_response=payload.suggested_response,
        flags=payload.flags,
    )


@router.get("/reviews")
async def get_reviews(run_id: Optional[str] = None, limit: int = 50):
    """List human reviews, optionally filtered by evaluation run."""
    return list_human_reviews(run_id=run_id, limit=limit)


@router.get("/reviews/summary/{run_id}")
async def review_summary(run_id: str):
    """Get summary of human reviews for an evaluation run."""
    return get_review_summary(run_id)


# ── UX Evaluators ────────────────────────────────────────────

@router.post("/ux-evaluate")
async def run_ux_evaluation(payload: UxEvalRequest):
    """
    Run User Experience evaluators (blog Step 2 — missing from standard SDK).

    Evaluates: helpfulness, tone, completeness — the human-facing quality metrics.
    """
    metrics = payload.metrics or ["helpfulness", "tone", "completeness"]
    results: Dict[str, Any] = {}

    if "helpfulness" in metrics:
        results["helpfulness"] = await evaluate_helpfulness(
            payload.query, payload.response, context=payload.context
        )

    if "tone" in metrics:
        results["tone"] = await evaluate_tone(
            payload.response, expected_tone=payload.expected_tone
        )

    if "completeness" in metrics:
        results["completeness"] = await evaluate_completeness(
            payload.query, payload.response, ground_truth=payload.ground_truth
        )

    return results
