"""
A/B Testing Service.

Runs an experiment: sends N questions to two model configurations in parallel,
records responses, and computes evaluation metrics for each pair.
Backed by Azure Cosmos DB.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional

from backend.cosmos_client import (
    create_item,
    new_id,
    query_items,
    read_item,
    upsert_item,
    utcnow_iso,
)
from backend.schemas.experiment import ExperimentCreate, ExperimentSummary
from backend.services.model_provider import ModelResponse, call_model, estimate_cost
from backend.services.evaluation import compute_similarity_metrics

logger = logging.getLogger(__name__)

CONTAINER = "experiments"


async def _run_single_question(
    experiment: Dict[str, Any],
    index: int,
    question: str,
    system_msg: Optional[str],
) -> Dict[str, Any]:
    """Run one question against both models and build a result dict."""

    messages_a: List[Dict[str, str]] = []
    messages_b: List[Dict[str, str]] = []

    if system_msg:
        messages_a.append({"role": "system", "content": system_msg})
        messages_b.append({"role": "system", "content": system_msg})

    messages_a.append({"role": "user", "content": question})
    messages_b.append({"role": "user", "content": question})

    resp_a: ModelResponse
    resp_b: ModelResponse
    resp_a, resp_b = await asyncio.gather(
        call_model(
            experiment["model_a_provider"],
            experiment["model_a_deployment"],
            messages_a,
            **(experiment.get("model_a_params") or {}),
        ),
        call_model(
            experiment["model_b_provider"],
            experiment["model_b_deployment"],
            messages_b,
            **(experiment.get("model_b_params") or {}),
        ),
    )

    metrics: Dict[str, Any] = {}
    if resp_a.text and resp_b.text:
        metrics = await compute_similarity_metrics(resp_a.text, resp_b.text)

    cost_a = estimate_cost(experiment["model_a_deployment"], resp_a.tokens_prompt, resp_a.tokens_completion)
    cost_b = estimate_cost(experiment["model_b_deployment"], resp_b.tokens_prompt, resp_b.tokens_completion)

    return {
        "id": new_id(),
        "experiment_id": experiment["id"],
        "question_index": index,
        "question_text": question,
        "model_a_response": resp_a.text or f"[ERROR] {resp_a.error}",
        "model_a_latency_ms": resp_a.latency_ms,
        "model_a_tokens_prompt": resp_a.tokens_prompt,
        "model_a_tokens_completion": resp_a.tokens_completion,
        "model_b_response": resp_b.text or f"[ERROR] {resp_b.error}",
        "model_b_latency_ms": resp_b.latency_ms,
        "model_b_tokens_prompt": resp_b.tokens_prompt,
        "model_b_tokens_completion": resp_b.tokens_completion,
        "semantic_similarity": metrics.get("semantic_similarity"),
        "bleu_score": metrics.get("bleu_score"),
        "rouge_l_score": metrics.get("rouge_l_score"),
        "model_a_cost_usd": cost_a,
        "model_b_cost_usd": cost_b,
        "human_preference": None,
        "human_notes": None,
        "created_at": utcnow_iso(),
    }


async def create_experiment(payload: ExperimentCreate) -> Dict[str, Any]:
    """Persist a new Experiment document."""
    now = utcnow_iso()
    doc = {
        "id": new_id(),
        "name": payload.name,
        "description": payload.description,
        "model_a_provider": payload.model_a.provider,
        "model_a_deployment": payload.model_a.deployment,
        "model_a_params": payload.model_a.params,
        "model_b_provider": payload.model_b.provider,
        "model_b_deployment": payload.model_b.deployment,
        "model_b_params": payload.model_b.params,
        "prompt_id": payload.prompt_id,
        "system_message_override": payload.system_message_override,
        "status": "created",
        "total_questions": len(payload.questions),
        "completed_questions": 0,
        "created_at": now,
        "updated_at": now,
        "results": [],
    }
    return await create_item(CONTAINER, doc)


async def run_experiment(experiment: Dict[str, Any], questions: List[str]) -> Dict[str, Any]:
    """Execute the A/B test for all questions."""
    experiment["status"] = "running"
    await upsert_item(CONTAINER, experiment)

    system_msg = experiment.get("system_message_override")
    results: List[Dict[str, Any]] = []

    try:
        for idx, question in enumerate(questions):
            logger.info("Experiment %s — question %d/%d", experiment["id"], idx + 1, len(questions))
            result = await _run_single_question(experiment, idx, question, system_msg)
            results.append(result)
            experiment["completed_questions"] = idx + 1
            experiment["results"] = results
            await upsert_item(CONTAINER, experiment)

        experiment["status"] = "completed"
    except Exception:
        logger.exception("Experiment %s failed", experiment["id"])
        experiment["status"] = "failed"

    experiment["updated_at"] = utcnow_iso()
    experiment["results"] = results
    await upsert_item(CONTAINER, experiment)
    return experiment


async def list_experiments() -> List[Dict[str, Any]]:
    """List all experiments (without embedded results for lighter payload)."""
    docs = await query_items(
        CONTAINER,
        "SELECT c.id, c.name, c.description, c.model_a_provider, c.model_a_deployment, "
        "c.model_b_provider, c.model_b_deployment, c.status, c.total_questions, "
        "c.completed_questions, c.created_at, c.updated_at FROM c ORDER BY c.created_at DESC",
    )
    return docs


async def get_experiment(experiment_id: str) -> Optional[Dict[str, Any]]:
    """Get an experiment with its results."""
    return await read_item(CONTAINER, experiment_id)


def compute_experiment_summary(experiment: Dict[str, Any], results: List[Dict[str, Any]]) -> ExperimentSummary:
    """Aggregate metrics across all results."""
    similarities = [r["semantic_similarity"] for r in results if r.get("semantic_similarity") is not None]
    a_latencies = [r["model_a_latency_ms"] for r in results if r.get("model_a_latency_ms") is not None]
    b_latencies = [r["model_b_latency_ms"] for r in results if r.get("model_b_latency_ms") is not None]
    a_costs = [r["model_a_cost_usd"] for r in results if r.get("model_a_cost_usd") is not None]
    b_costs = [r["model_b_cost_usd"] for r in results if r.get("model_b_cost_usd") is not None]

    wins_a = sum(1 for r in results if r.get("human_preference") == "A")
    wins_b = sum(1 for r in results if r.get("human_preference") == "B")
    ties = sum(1 for r in results if r.get("human_preference") == "tie")

    dist = {"0-50%": 0, "50-70%": 0, "70-90%": 0, "90-100%": 0}
    for s in similarities:
        pct = s * 100
        if pct < 50:
            dist["0-50%"] += 1
        elif pct < 70:
            dist["50-70%"] += 1
        elif pct < 90:
            dist["70-90%"] += 1
        else:
            dist["90-100%"] += 1

    return ExperimentSummary(
        experiment_id=experiment["id"],
        total_questions=len(results),
        avg_semantic_similarity=round(sum(similarities) / len(similarities), 4) if similarities else None,
        avg_model_a_latency_ms=round(sum(a_latencies) / len(a_latencies), 2) if a_latencies else None,
        avg_model_b_latency_ms=round(sum(b_latencies) / len(b_latencies), 2) if b_latencies else None,
        total_model_a_cost_usd=round(sum(a_costs), 6) if a_costs else None,
        total_model_b_cost_usd=round(sum(b_costs), 6) if b_costs else None,
        model_a_wins=wins_a,
        model_b_wins=wins_b,
        ties=ties,
        similarity_distribution=dist,
    )
