"""
Migration Pipeline Service.

Orchestrates the end-to-end model migration evaluation workflow:
  1. Load golden dataset
  2. Run each test case against source and target models
  3. Evaluate responses (similarity, BLEU, ROUGE-L, reference scoring)
  4. Aggregate results and generate recommendation
  5. Support export for stakeholder review

Backed by Azure Cosmos DB.
"""

from __future__ import annotations

import csv
import io
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from backend.cosmos_client import (
    create_item,
    new_id,
    query_items,
    read_item,
    upsert_item,
    utcnow_iso,
)
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

CONTAINER = "migration_runs"
CONTAINER_GD = "golden_datasets"


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
async def create_migration_run(payload: MigrationRunCreate) -> Dict[str, Any]:
    """Create a migration run record."""
    # Verify golden dataset exists
    dataset = await read_item(CONTAINER_GD, payload.golden_dataset_id)
    if not dataset:
        raise ValueError(f"Golden dataset {payload.golden_dataset_id} not found")

    now = utcnow_iso()
    doc = {
        "id": new_id(),
        "name": payload.name,
        "description": payload.description,
        "golden_dataset_id": payload.golden_dataset_id,
        "source_provider": payload.source_model.provider,
        "source_deployment": payload.source_model.deployment,
        "source_params": payload.source_model.params,
        "target_provider": payload.target_model.provider,
        "target_deployment": payload.target_model.deployment,
        "target_params": payload.target_model.params,
        "system_message": payload.system_message,
        "prompt_id": payload.prompt_id,
        "status": "pending",
        "total_cases": len(dataset.get("cases", [])),
        "completed_cases": 0,
        "source_avg_latency_ms": None,
        "target_avg_latency_ms": None,
        "source_total_cost_usd": None,
        "target_total_cost_usd": None,
        "avg_similarity": None,
        "avg_source_reference_score": None,
        "avg_target_reference_score": None,
        "pass_rate_source": None,
        "pass_rate_target": None,
        "recommendation": None,
        "created_at": now,
        "updated_at": now,
        "completed_at": None,
        "results": [],
    }
    return await create_item(CONTAINER, doc)


async def execute_migration_run(
    run: Dict[str, Any],
    similarity_threshold: float = 0.7,
) -> Dict[str, Any]:
    """Execute the full migration pipeline."""
    # Load dataset with cases
    dataset = await read_item(CONTAINER_GD, run["golden_dataset_id"])
    if not dataset:
        raise ValueError("Golden dataset not found")

    run["status"] = "running"
    await upsert_item(CONTAINER, run)

    source_params = run.get("source_params") or {}
    target_params = run.get("target_params") or {}
    results: List[Dict[str, Any]] = []

    try:
        cases = sorted(dataset.get("cases", []), key=lambda c: c.get("index", 0))
        for case in cases:
            messages: List[Dict[str, str]] = []
            if run.get("system_message"):
                messages.append({"role": "system", "content": run["system_message"]})
            messages.append({"role": "user", "content": case["question"]})

            # Call source model
            source_resp = await call_model(
                run["source_provider"],
                run["source_deployment"],
                messages,
                **source_params,
            )

            # Call target model
            target_resp = await call_model(
                run["target_provider"],
                run["target_deployment"],
                messages,
                **target_params,
            )

            # Compute costs
            source_cost = estimate_cost(
                run["source_deployment"],
                source_resp.tokens_prompt,
                source_resp.tokens_completion,
            )
            target_cost = estimate_cost(
                run["target_deployment"],
                target_resp.tokens_prompt,
                target_resp.tokens_completion,
            )

            # Evaluate responses
            sim_metrics = await compute_similarity_metrics(
                source_resp.text,
                target_resp.text,
                reference=case.get("expected_answer"),
            )

            # Reference scoring (how well each model matches expected answer)
            source_ref_score = None
            target_ref_score = None
            if case.get("expected_answer"):
                source_ref_score = await compute_reference_similarity(
                    source_resp.text, case["expected_answer"]
                )
                target_ref_score = await compute_reference_similarity(
                    target_resp.text, case["expected_answer"]
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

            mr = {
                "id": new_id(),
                "migration_run_id": run["id"],
                "case_index": case.get("index", 0),
                "question": case["question"],
                "expected_answer": case.get("expected_answer"),
                "category": case.get("category"),

                "source_response": source_resp.text,
                "source_latency_ms": source_resp.latency_ms,
                "source_tokens_prompt": source_resp.tokens_prompt,
                "source_tokens_completion": source_resp.tokens_completion,
                "source_cost_usd": source_cost,
                "source_error": source_resp.error,

                "target_response": target_resp.text,
                "target_latency_ms": target_resp.latency_ms,
                "target_tokens_prompt": target_resp.tokens_prompt,
                "target_tokens_completion": target_resp.tokens_completion,
                "target_cost_usd": target_cost,
                "target_error": target_resp.error,

                "similarity_score": sim_metrics.get("semantic_similarity"),
                "source_reference_score": source_ref_score,
                "target_reference_score": target_ref_score,
                "bleu_score": sim_metrics.get("bleu_score"),
                "rouge_l_score": sim_metrics.get("rouge_l_score"),

                "source_passed": source_passed,
                "target_passed": target_passed,
                "regression": regression,
            }
            results.append(mr)

            run["completed_cases"] = case.get("index", 0) + 1
            run["results"] = results
            await upsert_item(CONTAINER, run)

        # Aggregate results
        _aggregate_results(run, results)
        run["status"] = "completed"
        run["completed_at"] = utcnow_iso()

    except Exception as exc:
        logger.exception("Migration run failed: %s", exc)
        run["status"] = "failed"
        run["completed_at"] = utcnow_iso()

    run["results"] = results
    run["updated_at"] = utcnow_iso()
    await upsert_item(CONTAINER, run)
    return run


def _aggregate_results(run: Dict[str, Any], results: List[Dict[str, Any]]) -> None:
    """Compute aggregate metrics from individual results."""
    if not results:
        return

    source_latencies = [r["source_latency_ms"] for r in results if r.get("source_latency_ms") is not None]
    target_latencies = [r["target_latency_ms"] for r in results if r.get("target_latency_ms") is not None]
    source_costs = [r["source_cost_usd"] for r in results if r.get("source_cost_usd") is not None]
    target_costs = [r["target_cost_usd"] for r in results if r.get("target_cost_usd") is not None]
    similarities = [r["similarity_score"] for r in results if r.get("similarity_score") is not None]
    source_ref_scores = [r["source_reference_score"] for r in results if r.get("source_reference_score") is not None]
    target_ref_scores = [r["target_reference_score"] for r in results if r.get("target_reference_score") is not None]

    run["source_avg_latency_ms"] = round(sum(source_latencies) / len(source_latencies), 2) if source_latencies else None
    run["target_avg_latency_ms"] = round(sum(target_latencies) / len(target_latencies), 2) if target_latencies else None
    run["source_total_cost_usd"] = round(sum(source_costs), 6) if source_costs else None
    run["target_total_cost_usd"] = round(sum(target_costs), 6) if target_costs else None
    run["avg_similarity"] = round(sum(similarities) / len(similarities), 4) if similarities else None
    run["avg_source_reference_score"] = round(sum(source_ref_scores) / len(source_ref_scores), 4) if source_ref_scores else None
    run["avg_target_reference_score"] = round(sum(target_ref_scores) / len(target_ref_scores), 4) if target_ref_scores else None

    source_passes = sum(1 for r in results if r.get("source_passed") == "pass")
    target_passes = sum(1 for r in results if r.get("target_passed") == "pass")
    scoreable = sum(1 for r in results if r.get("source_passed") != "skip")

    run["pass_rate_source"] = round(source_passes / scoreable, 4) if scoreable > 0 else None
    run["pass_rate_target"] = round(target_passes / scoreable, 4) if scoreable > 0 else None

    # Generate recommendation
    major_regressions = sum(1 for r in results if r.get("regression") == "major")
    minor_regressions = sum(1 for r in results if r.get("regression") == "minor")

    if major_regressions > 0:
        run["recommendation"] = "not_ready"
    elif minor_regressions > len(results) * 0.2:
        run["recommendation"] = "needs_review"
    elif run["avg_similarity"] and run["avg_similarity"] >= 0.8:
        run["recommendation"] = "ready"
    elif run["avg_similarity"] and run["avg_similarity"] >= 0.6:
        run["recommendation"] = "needs_review"
    else:
        run["recommendation"] = "not_ready"


# ── Summary ─────────────────────────────────────────────────────
def compute_migration_summary(run: Dict[str, Any], results: List[Dict[str, Any]]) -> MigrationSummary:
    """Build a stakeholder-friendly summary from a completed migration run."""
    # Latency change
    latency_change = None
    if run.get("source_avg_latency_ms") and run.get("target_avg_latency_ms"):
        latency_change = round(
            ((run["target_avg_latency_ms"] - run["source_avg_latency_ms"]) / run["source_avg_latency_ms"]) * 100, 1
        )

    # Cost change
    cost_change = None
    if run.get("source_total_cost_usd") and run.get("target_total_cost_usd") and run["source_total_cost_usd"] > 0:
        cost_change = round(
            ((run["target_total_cost_usd"] - run["source_total_cost_usd"]) / run["source_total_cost_usd"]) * 100, 1
        )

    # Quality change
    quality_change = None
    if run.get("avg_source_reference_score") and run.get("avg_target_reference_score") and run["avg_source_reference_score"] > 0:
        quality_change = round(
            ((run["avg_target_reference_score"] - run["avg_source_reference_score"]) / run["avg_source_reference_score"]) * 100, 1
        )

    # Regression breakdown
    no_reg = sum(1 for r in results if r.get("regression") == "none")
    minor_reg = sum(1 for r in results if r.get("regression") == "minor")
    major_reg = sum(1 for r in results if r.get("regression") == "major")

    # Recommendation reason
    reason = _build_recommendation_reason(run, major_reg, minor_reg, len(results))

    return MigrationSummary(
        migration_run_id=run["id"],
        name=run.get("name", ""),
        source_deployment=run.get("source_deployment", ""),
        target_deployment=run.get("target_deployment", ""),
        total_cases=run.get("total_cases", 0),
        completed_cases=run.get("completed_cases", 0),
        source_avg_latency_ms=run.get("source_avg_latency_ms"),
        target_avg_latency_ms=run.get("target_avg_latency_ms"),
        latency_change_pct=latency_change,
        source_total_cost_usd=run.get("source_total_cost_usd"),
        target_total_cost_usd=run.get("target_total_cost_usd"),
        cost_change_pct=cost_change,
        avg_similarity=run.get("avg_similarity"),
        avg_source_reference_score=run.get("avg_source_reference_score"),
        avg_target_reference_score=run.get("avg_target_reference_score"),
        quality_change_pct=quality_change,
        pass_rate_source=run.get("pass_rate_source"),
        pass_rate_target=run.get("pass_rate_target"),
        no_regression_count=no_reg,
        minor_regression_count=minor_reg,
        major_regression_count=major_reg,
        recommendation=run.get("recommendation"),
        recommendation_reason=reason,
    )


def _build_recommendation_reason(run: Dict[str, Any], major: int, minor: int, total: int) -> str:
    """Generate a human-readable reason for the recommendation."""
    parts = []
    rec = run.get("recommendation", "")
    avg_sim = run.get("avg_similarity")

    if rec == "ready":
        if avg_sim is not None:
            parts.append(f"High similarity ({avg_sim:.1%}) between source and target responses.")
        if major == 0 and minor == 0:
            parts.append("No regressions detected.")
    elif rec == "needs_review":
        if minor > 0:
            parts.append(f"{minor} minor regression(s) found out of {total} test cases.")
        if avg_sim is not None and avg_sim < 0.8:
            parts.append(f"Average similarity ({avg_sim:.1%}) is below 80% threshold.")
        parts.append("Manual review recommended before migration.")
    elif rec == "not_ready":
        if major > 0:
            parts.append(f"{major} major regression(s) detected.")
        if avg_sim is not None and avg_sim < 0.6:
            parts.append(f"Low average similarity ({avg_sim:.1%}).")
        parts.append("Prompt tuning or model parameters adjustment needed.")
    return " ".join(parts) if parts else "Evaluation complete."


# ── Export ──────────────────────────────────────────────────────
def export_results_csv(run: Dict[str, Any], results: List[Dict[str, Any]]) -> str:
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

    for r in sorted(results, key=lambda x: x.get("case_index", 0)):
        writer.writerow([
            r.get("case_index"),
            r.get("question"),
            r.get("expected_answer", ""),
            r.get("category", ""),
            r.get("source_response", ""),
            r.get("target_response", ""),
            r.get("source_latency_ms"),
            r.get("target_latency_ms"),
            r.get("source_cost_usd"),
            r.get("target_cost_usd"),
            r.get("similarity_score"),
            r.get("source_reference_score"),
            r.get("target_reference_score"),
            r.get("bleu_score"),
            r.get("rouge_l_score"),
            r.get("source_passed"),
            r.get("target_passed"),
            r.get("regression"),
        ])

    return output.getvalue()


def export_results_json(run: Dict[str, Any], results: List[Dict[str, Any]]) -> str:
    """Export migration results as JSON string."""
    status_val = run.get("status", "")
    if hasattr(status_val, "value"):
        status_val = status_val.value

    created_at = run.get("created_at")
    completed_at = run.get("completed_at")
    if hasattr(created_at, "isoformat"):
        created_at = created_at.isoformat()
    if hasattr(completed_at, "isoformat"):
        completed_at = completed_at.isoformat()

    summary = {
        "migration_run": {
            "id": run.get("id"),
            "name": run.get("name"),
            "source": f"{run.get('source_provider', '')}/{run.get('source_deployment', '')}",
            "target": f"{run.get('target_provider', '')}/{run.get('target_deployment', '')}",
            "status": str(status_val),
            "total_cases": run.get("total_cases"),
            "completed_cases": run.get("completed_cases"),
            "recommendation": run.get("recommendation"),
            "created_at": created_at,
            "completed_at": completed_at,
        },
        "aggregate_metrics": {
            "source_avg_latency_ms": run.get("source_avg_latency_ms"),
            "target_avg_latency_ms": run.get("target_avg_latency_ms"),
            "source_total_cost_usd": run.get("source_total_cost_usd"),
            "target_total_cost_usd": run.get("target_total_cost_usd"),
            "avg_similarity": run.get("avg_similarity"),
            "avg_source_reference_score": run.get("avg_source_reference_score"),
            "avg_target_reference_score": run.get("avg_target_reference_score"),
            "pass_rate_source": run.get("pass_rate_source"),
            "pass_rate_target": run.get("pass_rate_target"),
        },
        "results": [],
    }

    for r in sorted(results, key=lambda x: x.get("case_index", 0)):
        summary["results"].append({
            "case_index": r.get("case_index"),
            "question": r.get("question"),
            "expected_answer": r.get("expected_answer"),
            "category": r.get("category"),
            "source_response": r.get("source_response"),
            "target_response": r.get("target_response"),
            "source_latency_ms": r.get("source_latency_ms"),
            "target_latency_ms": r.get("target_latency_ms"),
            "source_cost_usd": r.get("source_cost_usd"),
            "target_cost_usd": r.get("target_cost_usd"),
            "similarity_score": r.get("similarity_score"),
            "source_reference_score": r.get("source_reference_score"),
            "target_reference_score": r.get("target_reference_score"),
            "bleu_score": r.get("bleu_score"),
            "rouge_l_score": r.get("rouge_l_score"),
            "source_passed": r.get("source_passed"),
            "target_passed": r.get("target_passed"),
            "regression": r.get("regression"),
        })

    return json.dumps(summary, indent=2, default=str)


# ── List / Get ──────────────────────────────────────────────────
async def list_migration_runs() -> List[Dict[str, Any]]:
    """List migration runs (without embedded results for efficiency)."""
    return await query_items(
        CONTAINER,
        "SELECT c.id, c.name, c.description, c.golden_dataset_id, "
        "c.source_provider, c.source_deployment, c.target_provider, c.target_deployment, "
        "c.status, c.total_cases, c.completed_cases, c.recommendation, "
        "c.source_avg_latency_ms, c.target_avg_latency_ms, "
        "c.source_total_cost_usd, c.target_total_cost_usd, "
        "c.avg_similarity, c.avg_source_reference_score, c.avg_target_reference_score, "
        "c.pass_rate_source, c.pass_rate_target, "
        "c.created_at, c.updated_at, c.completed_at "
        "FROM c ORDER BY c.created_at DESC",
    )


async def get_migration_run(run_id: str) -> Optional[Dict[str, Any]]:
    """Get a migration run with its embedded results."""
    return await read_item(CONTAINER, run_id)
