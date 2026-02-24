"""
Migration Pipeline Service.

Orchestrates the end-to-end model migration evaluation workflow:
  1. Load golden dataset
  2. Run each test case against source and target models
  3. Evaluate responses (similarity, BLEU, ROUGE-L, reference scoring)
  4. Aggregate results and generate recommendation
  5. Support export for stakeholder review
"""

from __future__ import annotations

import csv
import io
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.models.golden_dataset import GoldenDataset
from backend.models.migration_run import MigrationRun, MigrationResult, MigrationStatus
from backend.schemas.migration_pipeline import (
    MigrationRunCreate,
    MigrationSummary,
    ParameterDiffOut,
)
from backend.services.model_provider import call_model, estimate_cost
from backend.services.evaluation import (
    compute_similarity_metrics,
    compute_reference_similarity,
)

logger = logging.getLogger(__name__)


# ── Known model parameters for parameter diff / review ──────────
MODEL_PARAMETERS: Dict[str, Dict[str, Any]] = {
    "gpt-4o": {
        "max_tokens": 16384,
        "context_window": 128000,
        "supports_json_mode": True,
        "supports_function_calling": True,
        "supports_vision": True,
        "supports_streaming": True,
        "training_cutoff": "Oct 2023",
        "api_version_min": "2024-02-15-preview",
        "default_temperature": 1.0,
        "supports_seed": True,
        "supports_logprobs": True,
    },
    "gpt-4o-mini": {
        "max_tokens": 16384,
        "context_window": 128000,
        "supports_json_mode": True,
        "supports_function_calling": True,
        "supports_vision": True,
        "supports_streaming": True,
        "training_cutoff": "Oct 2023",
        "api_version_min": "2024-07-18",
        "default_temperature": 1.0,
        "supports_seed": True,
        "supports_logprobs": True,
    },
    "gpt-4-turbo": {
        "max_tokens": 4096,
        "context_window": 128000,
        "supports_json_mode": True,
        "supports_function_calling": True,
        "supports_vision": True,
        "supports_streaming": True,
        "training_cutoff": "Dec 2023",
        "api_version_min": "2024-02-15-preview",
        "default_temperature": 1.0,
        "supports_seed": True,
        "supports_logprobs": True,
    },
    "gpt-4": {
        "max_tokens": 8192,
        "context_window": 8192,
        "supports_json_mode": False,
        "supports_function_calling": True,
        "supports_vision": False,
        "supports_streaming": True,
        "training_cutoff": "Sep 2021",
        "api_version_min": "2023-05-15",
        "default_temperature": 1.0,
        "supports_seed": False,
        "supports_logprobs": True,
    },
    "gpt-35-turbo": {
        "max_tokens": 4096,
        "context_window": 16384,
        "supports_json_mode": True,
        "supports_function_calling": True,
        "supports_vision": False,
        "supports_streaming": True,
        "training_cutoff": "Sep 2021",
        "api_version_min": "2023-05-15",
        "default_temperature": 1.0,
        "supports_seed": False,
        "supports_logprobs": True,
    },
    "gpt-5.1": {
        "max_tokens": 32768,
        "context_window": 256000,
        "supports_json_mode": True,
        "supports_function_calling": True,
        "supports_vision": True,
        "supports_streaming": True,
        "training_cutoff": "Apr 2025",
        "api_version_min": "2025-03-01-preview",
        "default_temperature": 1.0,
        "supports_seed": True,
        "supports_logprobs": True,
        "supports_structured_outputs": True,
    },
    "o3": {
        "max_tokens": 65536,
        "context_window": 200000,
        "supports_json_mode": True,
        "supports_function_calling": True,
        "supports_vision": True,
        "supports_streaming": True,
        "training_cutoff": "Apr 2025",
        "api_version_min": "2025-03-01-preview",
        "default_temperature": 1.0,
        "supports_seed": True,
        "supports_logprobs": True,
        "supports_structured_outputs": True,
        "supports_reasoning": True,
    },
}


# ── Parameter Diff / Review ─────────────────────────────────────
def compute_parameter_diff(source_deployment: str, target_deployment: str) -> ParameterDiffOut:
    """Compare parameters between source and target models."""
    source_params = MODEL_PARAMETERS.get(source_deployment, {})
    target_params = MODEL_PARAMETERS.get(target_deployment, {})

    differences = []
    all_keys = set(list(source_params.keys()) + list(target_params.keys()))

    for key in sorted(all_keys):
        src_val = source_params.get(key, "N/A")
        tgt_val = target_params.get(key, "N/A")
        if src_val != tgt_val:
            differences.append({
                "parameter": key,
                "source_value": str(src_val),
                "target_value": str(tgt_val),
                "impact": _assess_impact(key, src_val, tgt_val),
            })

    compatibility_notes = _generate_compatibility_notes(source_deployment, target_deployment, differences)
    checklist = _generate_migration_checklist(source_deployment, target_deployment, differences)

    return ParameterDiffOut(
        source_model=source_deployment,
        target_model=target_deployment,
        parameter_differences=differences,
        compatibility_notes=compatibility_notes,
        migration_checklist=checklist,
    )


def _assess_impact(key: str, src_val: Any, tgt_val: Any) -> str:
    """Assess the impact level of a parameter difference."""
    high_impact_params = {"max_tokens", "context_window", "supports_function_calling", "supports_vision"}
    if key in high_impact_params:
        return "high"
    if key.startswith("supports_"):
        return "medium"
    return "low"


def _generate_compatibility_notes(source: str, target: str, diffs: List[Dict]) -> List[str]:
    notes = []
    for d in diffs:
        param = d["parameter"]
        if param == "context_window" and d["target_value"] != "N/A":
            notes.append(f"Context window changed from {d['source_value']} to {d['target_value']} tokens")
        if param == "max_tokens" and d["target_value"] != "N/A":
            notes.append(f"Max output tokens changed from {d['source_value']} to {d['target_value']}")
        if param == "api_version_min":
            notes.append(f"Minimum API version updated: {d['source_value']} → {d['target_value']}")
        if param == "training_cutoff":
            notes.append(f"Training data cutoff moved from {d['source_value']} to {d['target_value']}")
        if param.startswith("supports_") and d["source_value"] == "False" and d["target_value"] == "True":
            feature = param.replace("supports_", "").replace("_", " ")
            notes.append(f"New capability available: {feature}")
    return notes


def _generate_migration_checklist(source: str, target: str, diffs: List[Dict]) -> List[str]:
    checklist = [
        f"Verify {target} deployment exists in your Azure OpenAI resource",
        f"Update API version if required (check minimum API version)",
        "Build/update golden dataset with representative test cases",
        f"Run evaluation pipeline: {source} vs {target}",
        "Review similarity scores and regression analysis",
        "Check latency and cost differences",
        "Update system prompts if model behaviour differs",
        "Run performance/stress tests on new deployment",
        "Get stakeholder sign-off on evaluation results",
        "Plan staged rollout (canary → incremental → full)",
    ]
    return checklist


# ── Pipeline Execution ──────────────────────────────────────────
async def create_migration_run(
    db: AsyncSession,
    payload: MigrationRunCreate,
) -> MigrationRun:
    """Create a migration run record."""
    # Verify golden dataset exists
    stmt = select(GoldenDataset).options(selectinload(GoldenDataset.cases)).where(GoldenDataset.id == payload.golden_dataset_id)
    result = await db.execute(stmt)
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise ValueError(f"Golden dataset {payload.golden_dataset_id} not found")

    run = MigrationRun(
        name=payload.name,
        description=payload.description,
        golden_dataset_id=payload.golden_dataset_id,
        source_provider=payload.source_model.provider,
        source_deployment=payload.source_model.deployment,
        source_params=payload.source_model.params,
        target_provider=payload.target_model.provider,
        target_deployment=payload.target_model.deployment,
        target_params=payload.target_model.params,
        system_message=payload.system_message,
        prompt_id=payload.prompt_id,
        status=MigrationStatus.PENDING,
        total_cases=len(dataset.cases),
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    return run


async def execute_migration_run(
    db: AsyncSession,
    run: MigrationRun,
    similarity_threshold: float = 0.7,
) -> MigrationRun:
    """Execute the full migration pipeline."""
    # Load dataset with cases
    stmt = select(GoldenDataset).options(selectinload(GoldenDataset.cases)).where(GoldenDataset.id == run.golden_dataset_id)
    result = await db.execute(stmt)
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise ValueError("Golden dataset not found")

    run.status = MigrationStatus.RUNNING
    await db.commit()

    source_params = run.source_params or {}
    target_params = run.target_params or {}
    results: List[MigrationResult] = []

    try:
        for case in sorted(dataset.cases, key=lambda c: c.index):
            messages = []
            if run.system_message:
                messages.append({"role": "system", "content": run.system_message})
            messages.append({"role": "user", "content": case.question})

            # Call source model
            source_resp = await call_model(
                run.source_provider,
                run.source_deployment,
                messages,
                **source_params,
            )

            # Call target model
            target_resp = await call_model(
                run.target_provider,
                run.target_deployment,
                messages,
                **target_params,
            )

            # Compute costs
            source_cost = estimate_cost(
                run.source_deployment,
                source_resp.tokens_prompt,
                source_resp.tokens_completion,
            )
            target_cost = estimate_cost(
                run.target_deployment,
                target_resp.tokens_prompt,
                target_resp.tokens_completion,
            )

            # Evaluate responses
            sim_metrics = await compute_similarity_metrics(
                source_resp.text,
                target_resp.text,
                reference=case.expected_answer,
            )

            # Reference scoring (how well each model matches expected answer)
            source_ref_score = None
            target_ref_score = None
            if case.expected_answer:
                source_ref_score = await compute_reference_similarity(
                    source_resp.text, case.expected_answer
                )
                target_ref_score = await compute_reference_similarity(
                    target_resp.text, case.expected_answer
                )

            # Determine pass/fail
            source_passed = "skip"
            target_passed = "skip"
            if source_ref_score is not None:
                source_passed = "pass" if source_ref_score >= similarity_threshold else "fail"
            if target_ref_score is not None:
                target_passed = "pass" if target_ref_score >= similarity_threshold else "fail"

            # Determine regression
            regression = "none"
            if target_ref_score is not None and source_ref_score is not None:
                diff = source_ref_score - target_ref_score
                if diff > 0.2:
                    regression = "major"
                elif diff > 0.1:
                    regression = "minor"

            mr = MigrationResult(
                migration_run_id=run.id,
                case_index=case.index,
                question=case.question,
                expected_answer=case.expected_answer,
                category=case.category,

                source_response=source_resp.text,
                source_latency_ms=source_resp.latency_ms,
                source_tokens_prompt=source_resp.tokens_prompt,
                source_tokens_completion=source_resp.tokens_completion,
                source_cost_usd=source_cost,
                source_error=source_resp.error,

                target_response=target_resp.text,
                target_latency_ms=target_resp.latency_ms,
                target_tokens_prompt=target_resp.tokens_prompt,
                target_tokens_completion=target_resp.tokens_completion,
                target_cost_usd=target_cost,
                target_error=target_resp.error,

                similarity_score=sim_metrics.get("semantic_similarity"),
                source_reference_score=source_ref_score,
                target_reference_score=target_ref_score,
                bleu_score=sim_metrics.get("bleu_score"),
                rouge_l_score=sim_metrics.get("rouge_l_score"),

                source_passed=source_passed,
                target_passed=target_passed,
                regression=regression,
            )
            db.add(mr)
            results.append(mr)

            run.completed_cases = case.index + 1
            await db.commit()

        # Aggregate results
        _aggregate_results(run, results)
        run.status = MigrationStatus.COMPLETED
        run.completed_at = datetime.now(timezone.utc)

    except Exception as exc:
        logger.exception("Migration run failed: %s", exc)
        run.status = MigrationStatus.FAILED
        run.completed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(run)
    return run


def _aggregate_results(run: MigrationRun, results: List[MigrationResult]) -> None:
    """Compute aggregate metrics from individual results."""
    if not results:
        return

    source_latencies = [r.source_latency_ms for r in results if r.source_latency_ms is not None]
    target_latencies = [r.target_latency_ms for r in results if r.target_latency_ms is not None]
    source_costs = [r.source_cost_usd for r in results if r.source_cost_usd is not None]
    target_costs = [r.target_cost_usd for r in results if r.target_cost_usd is not None]
    similarities = [r.similarity_score for r in results if r.similarity_score is not None]
    source_ref_scores = [r.source_reference_score for r in results if r.source_reference_score is not None]
    target_ref_scores = [r.target_reference_score for r in results if r.target_reference_score is not None]

    run.source_avg_latency_ms = round(sum(source_latencies) / len(source_latencies), 2) if source_latencies else None
    run.target_avg_latency_ms = round(sum(target_latencies) / len(target_latencies), 2) if target_latencies else None
    run.source_total_cost_usd = round(sum(source_costs), 6) if source_costs else None
    run.target_total_cost_usd = round(sum(target_costs), 6) if target_costs else None
    run.avg_similarity = round(sum(similarities) / len(similarities), 4) if similarities else None
    run.avg_source_reference_score = round(sum(source_ref_scores) / len(source_ref_scores), 4) if source_ref_scores else None
    run.avg_target_reference_score = round(sum(target_ref_scores) / len(target_ref_scores), 4) if target_ref_scores else None

    source_passes = sum(1 for r in results if r.source_passed == "pass")
    target_passes = sum(1 for r in results if r.target_passed == "pass")
    scoreable = sum(1 for r in results if r.source_passed != "skip")

    run.pass_rate_source = round(source_passes / scoreable, 4) if scoreable > 0 else None
    run.pass_rate_target = round(target_passes / scoreable, 4) if scoreable > 0 else None

    # Generate recommendation
    major_regressions = sum(1 for r in results if r.regression == "major")
    minor_regressions = sum(1 for r in results if r.regression == "minor")

    if major_regressions > 0:
        run.recommendation = "not_ready"
    elif minor_regressions > len(results) * 0.2:
        run.recommendation = "needs_review"
    elif run.avg_similarity and run.avg_similarity >= 0.8:
        run.recommendation = "ready"
    elif run.avg_similarity and run.avg_similarity >= 0.6:
        run.recommendation = "needs_review"
    else:
        run.recommendation = "not_ready"


# ── Summary ─────────────────────────────────────────────────────
def compute_migration_summary(run: MigrationRun, results: List[MigrationResult]) -> MigrationSummary:
    """Build a stakeholder-friendly summary from a completed migration run."""
    # Latency change
    latency_change = None
    if run.source_avg_latency_ms and run.target_avg_latency_ms:
        latency_change = round(
            ((run.target_avg_latency_ms - run.source_avg_latency_ms) / run.source_avg_latency_ms) * 100, 1
        )

    # Cost change
    cost_change = None
    if run.source_total_cost_usd and run.target_total_cost_usd and run.source_total_cost_usd > 0:
        cost_change = round(
            ((run.target_total_cost_usd - run.source_total_cost_usd) / run.source_total_cost_usd) * 100, 1
        )

    # Quality change
    quality_change = None
    if run.avg_source_reference_score and run.avg_target_reference_score and run.avg_source_reference_score > 0:
        quality_change = round(
            ((run.avg_target_reference_score - run.avg_source_reference_score) / run.avg_source_reference_score) * 100, 1
        )

    # Regression breakdown
    no_reg = sum(1 for r in results if r.regression == "none")
    minor_reg = sum(1 for r in results if r.regression == "minor")
    major_reg = sum(1 for r in results if r.regression == "major")

    # Recommendation reason
    reason = _build_recommendation_reason(run, major_reg, minor_reg, len(results))

    return MigrationSummary(
        migration_run_id=run.id,
        name=run.name,
        source_deployment=run.source_deployment,
        target_deployment=run.target_deployment,
        total_cases=run.total_cases,
        completed_cases=run.completed_cases,
        source_avg_latency_ms=run.source_avg_latency_ms,
        target_avg_latency_ms=run.target_avg_latency_ms,
        latency_change_pct=latency_change,
        source_total_cost_usd=run.source_total_cost_usd,
        target_total_cost_usd=run.target_total_cost_usd,
        cost_change_pct=cost_change,
        avg_similarity=run.avg_similarity,
        avg_source_reference_score=run.avg_source_reference_score,
        avg_target_reference_score=run.avg_target_reference_score,
        quality_change_pct=quality_change,
        pass_rate_source=run.pass_rate_source,
        pass_rate_target=run.pass_rate_target,
        no_regression_count=no_reg,
        minor_regression_count=minor_reg,
        major_regression_count=major_reg,
        recommendation=run.recommendation,
        recommendation_reason=reason,
    )


def _build_recommendation_reason(run: MigrationRun, major: int, minor: int, total: int) -> str:
    """Generate a human-readable reason for the recommendation."""
    parts = []
    if run.recommendation == "ready":
        parts.append(f"High similarity ({run.avg_similarity:.1%}) between source and target responses.")
        if major == 0 and minor == 0:
            parts.append("No regressions detected.")
    elif run.recommendation == "needs_review":
        if minor > 0:
            parts.append(f"{minor} minor regression(s) found out of {total} test cases.")
        if run.avg_similarity and run.avg_similarity < 0.8:
            parts.append(f"Average similarity ({run.avg_similarity:.1%}) is below 80% threshold.")
        parts.append("Manual review recommended before migration.")
    elif run.recommendation == "not_ready":
        if major > 0:
            parts.append(f"{major} major regression(s) detected.")
        if run.avg_similarity and run.avg_similarity < 0.6:
            parts.append(f"Low average similarity ({run.avg_similarity:.1%}).")
        parts.append("Prompt tuning or model parameters adjustment needed.")
    return " ".join(parts) if parts else "Evaluation complete."


# ── Export ──────────────────────────────────────────────────────
def export_results_csv(run: MigrationRun, results: List[MigrationResult]) -> str:
    """Export migration results as CSV string."""
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Case #", "Question", "Expected Answer", "Category",
        "Source Response", "Target Response",
        "Source Latency (ms)", "Target Latency (ms)",
        "Source Cost ($)", "Target Cost ($)",
        "Similarity", "Source Ref Score", "Target Ref Score",
        "BLEU", "ROUGE-L",
        "Source Passed", "Target Passed", "Regression",
    ])

    for r in sorted(results, key=lambda x: x.case_index):
        writer.writerow([
            r.case_index,
            r.question,
            r.expected_answer or "",
            r.category or "",
            r.source_response or "",
            r.target_response or "",
            r.source_latency_ms,
            r.target_latency_ms,
            r.source_cost_usd,
            r.target_cost_usd,
            r.similarity_score,
            r.source_reference_score,
            r.target_reference_score,
            r.bleu_score,
            r.rouge_l_score,
            r.source_passed,
            r.target_passed,
            r.regression,
        ])

    return output.getvalue()


def export_results_json(run: MigrationRun, results: List[MigrationResult]) -> str:
    """Export migration results as JSON string."""
    summary = {
        "migration_run": {
            "id": run.id,
            "name": run.name,
            "source": f"{run.source_provider}/{run.source_deployment}",
            "target": f"{run.target_provider}/{run.target_deployment}",
            "status": run.status.value if hasattr(run.status, "value") else str(run.status),
            "total_cases": run.total_cases,
            "completed_cases": run.completed_cases,
            "recommendation": run.recommendation,
            "created_at": run.created_at.isoformat() if run.created_at else None,
            "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        },
        "aggregate_metrics": {
            "source_avg_latency_ms": run.source_avg_latency_ms,
            "target_avg_latency_ms": run.target_avg_latency_ms,
            "source_total_cost_usd": run.source_total_cost_usd,
            "target_total_cost_usd": run.target_total_cost_usd,
            "avg_similarity": run.avg_similarity,
            "avg_source_reference_score": run.avg_source_reference_score,
            "avg_target_reference_score": run.avg_target_reference_score,
            "pass_rate_source": run.pass_rate_source,
            "pass_rate_target": run.pass_rate_target,
        },
        "results": [],
    }

    for r in sorted(results, key=lambda x: x.case_index):
        summary["results"].append({
            "case_index": r.case_index,
            "question": r.question,
            "expected_answer": r.expected_answer,
            "category": r.category,
            "source_response": r.source_response,
            "target_response": r.target_response,
            "source_latency_ms": r.source_latency_ms,
            "target_latency_ms": r.target_latency_ms,
            "source_cost_usd": r.source_cost_usd,
            "target_cost_usd": r.target_cost_usd,
            "similarity_score": r.similarity_score,
            "source_reference_score": r.source_reference_score,
            "target_reference_score": r.target_reference_score,
            "bleu_score": r.bleu_score,
            "rouge_l_score": r.rouge_l_score,
            "source_passed": r.source_passed,
            "target_passed": r.target_passed,
            "regression": r.regression,
        })

    return json.dumps(summary, indent=2, default=str)


# ── List / Get ──────────────────────────────────────────────────
async def list_migration_runs(db: AsyncSession) -> List[MigrationRun]:
    stmt = select(MigrationRun).order_by(MigrationRun.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_migration_run(db: AsyncSession, run_id: str) -> Optional[MigrationRun]:
    stmt = (
        select(MigrationRun)
        .options(selectinload(MigrationRun.results))
        .where(MigrationRun.id == run_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
