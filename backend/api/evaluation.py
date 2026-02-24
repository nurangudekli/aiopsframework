"""
Evaluation API routes.

POST /evaluate         → compare two responses
POST /evaluate/batch   → batch compare
"""

from __future__ import annotations

from fastapi import APIRouter

from backend.schemas.evaluation import (
    BatchEvaluationRequest,
    BatchEvaluationResult,
    EvaluationRequest,
    EvaluationResult,
)
from backend.services.evaluation import compute_similarity_metrics

router = APIRouter(prefix="/evaluate", tags=["Evaluation"])


@router.post("", response_model=EvaluationResult)
async def evaluate_pair(payload: EvaluationRequest):
    """Evaluate similarity between two model responses."""
    metrics = await compute_similarity_metrics(
        payload.response_a,
        payload.response_b,
        reference=payload.reference_answer,
    )
    return EvaluationResult(**metrics)


@router.post("/batch", response_model=BatchEvaluationResult)
async def evaluate_batch(payload: BatchEvaluationRequest):
    """Evaluate similarity for multiple response pairs."""
    results = []
    for pair in payload.pairs:
        metrics = await compute_similarity_metrics(pair.response_a, pair.response_b)
        results.append(EvaluationResult(**metrics))

    sims = [r.semantic_similarity for r in results]
    avg_sim = sum(sims) / len(sims) if sims else 0.0
    bleus = [r.bleu_score for r in results if r.bleu_score is not None]
    avg_bleu = sum(bleus) / len(bleus) if bleus else None

    if avg_sim >= 0.90:
        summary = "similar"
    elif avg_sim >= 0.70:
        summary = "needs_review"
    else:
        summary = "divergent"

    return BatchEvaluationResult(
        results=results,
        avg_semantic_similarity=round(avg_sim, 4),
        avg_bleu_score=round(avg_bleu, 4) if avg_bleu is not None else None,
        summary_verdict=summary,
    )
