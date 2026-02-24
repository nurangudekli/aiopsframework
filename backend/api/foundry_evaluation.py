"""
Foundry Evaluation API routes.

POST /foundry-eval/evaluate         → evaluate a single response (all AI-assisted quality metrics)
POST /foundry-eval/metric           → evaluate a specific AI-assisted metric
POST /foundry-eval/nlp              → run NLP metrics (F1, BLEU, ROUGE, GLEU, METEOR)
POST /foundry-eval/content-safety   → content safety evaluation (violence, sexual, hate, self-harm + advanced)
POST /foundry-eval/dataset          → batch evaluate a dataset with multiple evaluators
POST /foundry-eval/simulate         → run adversarial simulation
GET  /foundry-eval/status           → check SDK availability & capabilities
"""

from __future__ import annotations

from typing import Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.services.foundry_evaluation import (
    evaluate_all,
    evaluate_content_safety,
    evaluate_dataset,
    evaluate_nlp_all,
    evaluate_single,
    get_sdk_capabilities,
    is_foundry_sdk_available,
    run_adversarial_simulation,
)

router = APIRouter(prefix="/foundry-eval", tags=["Foundry Evaluation"])


# ── Schemas ────────────────────────────────────────────────────
class FoundryEvalRequest(BaseModel):
    query: str = Field("", description="The user question / prompt")
    response: str = Field(..., description="Model response to evaluate")
    context: str = Field("", description="Retrieved context (for groundedness / retrieval)")
    ground_truth: str = Field("", description="Reference / expected answer (for similarity)")
    metrics: Optional[List[str]] = Field(
        None,
        description="Specific metrics to run (default: all). Options: coherence, fluency, relevance, groundedness, similarity, retrieval",
    )


class SingleMetricRequest(BaseModel):
    metric: str = Field(..., description="Metric name: coherence | fluency | relevance | groundedness | similarity | retrieval")
    query: str = ""
    response: str = ""
    context: str = ""
    ground_truth: str = ""


class NlpEvalRequest(BaseModel):
    response: str = Field(..., description="Model response to evaluate")
    ground_truth: str = Field(..., description="Reference / expected answer")
    metrics: Optional[List[str]] = Field(
        None,
        description="NLP metrics to run. Options: f1_score, bleu_score, rouge_score, gleu_score, meteor_score (default: all)",
    )


class ContentSafetyRequest(BaseModel):
    query: str = ""
    response: str = ""
    include_advanced: bool = Field(False, description="Include indirect_attack and protected_material evaluators")


class DatasetEvalRequest(BaseModel):
    data: List[Dict[str, str]] = Field(
        ...,
        description="Dataset rows — each dict should have keys like query, response, context, ground_truth",
    )
    evaluators: List[str] = Field(
        ...,
        description="Evaluator names to run: coherence, fluency, f1_score, bleu_score, violence, etc.",
    )
    column_mapping: Optional[Dict[str, Dict[str, str]]] = Field(
        None,
        description="Optional per-evaluator column mapping, e.g. {'relevance': {'query': 'question'}}",
    )


class SimulateRequest(BaseModel):
    scenario: str = Field(
        "adversarial_qa",
        description="Simulation scenario: adversarial_qa, adversarial_conversation, adversarial_summarization, adversarial_rewrite, adversarial_content_gen_ungrounded",
    )
    max_conversation_turns: int = Field(1, ge=1, le=10, description="Max turns per conversation")
    max_simulation_results: int = Field(5, ge=1, le=50, description="Number of simulated conversations")
    target_endpoint: Optional[str] = Field(None, description="Optional target endpoint URL")


# ── Endpoints ──────────────────────────────────────────────────
@router.get("/status")
async def sdk_status():
    """Check whether the Azure AI Foundry Evaluation SDK is available and its capabilities."""
    capabilities = get_sdk_capabilities()
    return {
        **capabilities,
        "fallback_mode": not capabilities["configured"],
        "note": (
            "Foundry SDK is active — LLM-as-judge metrics available."
            if capabilities["configured"]
            else "SDK not fully configured — using heuristic fallback metrics."
        ),
        "available_evaluators": {
            "ai_quality": ["coherence", "fluency", "relevance", "groundedness", "similarity", "retrieval"],
            "nlp": ["f1_score", "bleu_score", "rouge_score", "gleu_score", "meteor_score"],
            "safety": ["violence", "sexual", "hate_unfairness", "self_harm"]
                + (["indirect_attack", "protected_material"] if capabilities.get("advanced_safety") else []),
            "simulator": ["adversarial_qa", "adversarial_conversation", "adversarial_summarization",
                          "adversarial_rewrite", "adversarial_content_gen_ungrounded"]
                if capabilities.get("simulator") else [],
        },
    }


@router.post("/evaluate")
async def evaluate(payload: FoundryEvalRequest):
    """Run all (or specified) AI-assisted quality metrics on a response."""
    result = await evaluate_all(
        query=payload.query,
        response=payload.response,
        context=payload.context,
        ground_truth=payload.ground_truth,
        metrics=payload.metrics,
    )
    return result


@router.post("/metric")
async def evaluate_metric(payload: SingleMetricRequest):
    """Evaluate a single AI-assisted metric."""
    result = await evaluate_single(
        payload.metric,
        query=payload.query,
        response=payload.response,
        context=payload.context,
        ground_truth=payload.ground_truth,
    )
    return result


@router.post("/nlp")
async def evaluate_nlp_metrics(payload: NlpEvalRequest):
    """Run NLP-based evaluators (no LLM required): F1, BLEU, ROUGE, GLEU, METEOR."""
    result = await evaluate_nlp_all(
        response=payload.response,
        ground_truth=payload.ground_truth,
        metrics=payload.metrics,
    )
    return result


@router.post("/content-safety")
async def content_safety(payload: ContentSafetyRequest):
    """Run content safety evaluators (violence, sexual, hate, self-harm + optional advanced)."""
    result = await evaluate_content_safety(
        query=payload.query,
        response=payload.response,
        include_advanced=payload.include_advanced,
    )
    return result


@router.post("/dataset")
async def batch_evaluate_dataset(payload: DatasetEvalRequest):
    """
    Batch evaluate a dataset with multiple evaluators (SDK evaluate() API).

    Send a list of rows and evaluator names to run on each row.
    Returns aggregate metrics and row-level results.
    """
    result = await evaluate_dataset(
        data=payload.data,
        evaluator_names=payload.evaluators,
        column_mapping=payload.column_mapping,
    )
    return result


@router.post("/simulate")
async def run_simulation(payload: SimulateRequest):
    """Run adversarial simulation to generate test data for safety evaluation."""
    result = await run_adversarial_simulation(
        scenario_name=payload.scenario,
        target_endpoint=payload.target_endpoint,
        max_conversation_turns=payload.max_conversation_turns,
        max_simulation_results=payload.max_simulation_results,
    )
    return result
