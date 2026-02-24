"""
Quality Gates Service — Azure AI Foundry–style evaluation.

Provides acceptance criteria checking, regression detection, and
quality-gate pass/fail decisions for model migration evaluations.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional


# ── Default quality gates (Azure AI Foundry style) ──────────────
DEFAULT_QUALITY_GATES: Dict[str, Dict[str, float]] = {
    "coherence": {"min": 4.0, "regression_threshold": 0.10},
    "fluency": {"min": 4.0, "regression_threshold": 0.10},
    "relevance": {"min": 4.0, "regression_threshold": 0.10},
    "groundedness": {"min": 3.5, "regression_threshold": 0.10},
    "similarity": {"min": 3.5, "regression_threshold": 0.15},
}

# ── Metric definitions (Azure AI Foundry metrics) ──────────────
METRIC_DEFINITIONS: List[Dict[str, Any]] = [
    {
        "name": "coherence",
        "scale": "1-5",
        "description": "Logical flow, clear transitions, well-organized response",
        "when_it_matters": "Any response longer than a sentence",
        "good_score": 4.0,
        "concern_threshold": 3.5,
        "examples": {
            "score_5": "Response flows naturally, ideas connect logically",
            "score_3": "Some disjointed parts, but overall understandable",
            "score_1": "Confusing, contradictory, hard to follow",
        },
    },
    {
        "name": "fluency",
        "scale": "1-5",
        "description": "Grammar, spelling, natural language quality",
        "when_it_matters": "Customer-facing text, professional communications",
        "good_score": 4.0,
        "concern_threshold": 3.5,
        "examples": {
            "score_5": "Perfect grammar, natural phrasing",
            "score_3": "Minor errors, slightly awkward phrasing",
            "score_1": "Major errors, broken sentences",
        },
    },
    {
        "name": "relevance",
        "scale": "1-5",
        "description": "How well the response addresses the query",
        "when_it_matters": "All responses — this is often the most important metric",
        "good_score": 4.0,
        "concern_threshold": 3.5,
        "examples": {
            "score_5": "Directly and completely addresses the question",
            "score_3": "Partially addresses, missing key points",
            "score_1": "Off-topic or irrelevant",
        },
    },
    {
        "name": "groundedness",
        "scale": "1-5",
        "description": "Factual alignment with provided context",
        "when_it_matters": "RAG applications, customer data lookups",
        "good_score": 4.0,
        "concern_threshold": 3.5,
        "examples": {
            "score_5": "All claims supported by context",
            "score_3": "Some unsupported claims",
            "score_1": "Significant hallucination",
        },
    },
    {
        "name": "similarity",
        "scale": "1-5",
        "description": "Semantic similarity to ground truth response",
        "when_it_matters": "Regression testing against known-good responses",
        "good_score": 3.5,
        "concern_threshold": 3.0,
        "examples": {
            "score_5": "Nearly identical meaning to ground truth",
            "score_3": "Same general idea, different details",
            "score_1": "Completely different response",
        },
    },
]


def check_quality_gates(
    candidate_scores: Dict[str, float],
    baseline_scores: Optional[Dict[str, float]] = None,
    criteria: Optional[Dict[str, Dict[str, float]]] = None,
) -> Dict[str, Any]:
    """
    Check if candidate scores meet acceptance criteria.

    Returns a dict with pass/fail status, per-metric details, and
    overall recommendation.
    """
    if criteria is None:
        criteria = DEFAULT_QUALITY_GATES

    results: List[Dict[str, Any]] = []
    all_passed = True

    for metric, thresholds in criteria.items():
        score = candidate_scores.get(metric, 0)
        baseline = baseline_scores.get(metric, 0) if baseline_scores else 0
        checks: List[Dict[str, Any]] = []

        # Check minimum score
        min_ok = score >= thresholds["min"]
        checks.append({
            "check": "minimum_score",
            "threshold": thresholds["min"],
            "actual": round(score, 2),
            "passed": min_ok,
        })
        if not min_ok:
            all_passed = False

        # Check regression if baseline provided
        if baseline_scores and baseline > 0:
            regression = (baseline - score) / baseline
            reg_ok = regression <= thresholds.get("regression_threshold", 0.10)
            checks.append({
                "check": "regression",
                "threshold": thresholds.get("regression_threshold", 0.10),
                "actual": round(regression, 4),
                "passed": reg_ok,
            })
            if not reg_ok:
                all_passed = False

        results.append({
            "metric": metric,
            "score": round(score, 2),
            "baseline": round(baseline, 2) if baseline_scores else None,
            "passed": all(c["passed"] for c in checks),
            "checks": checks,
        })

    return {
        "passed": all_passed,
        "recommendation": "APPROVE" if all_passed else "REJECT",
        "metrics": results,
    }


def compare_model_scores(
    baseline_scores: Dict[str, float],
    candidate_scores: Dict[str, float],
    threshold: float = 0.10,
) -> Dict[str, Any]:
    """
    Compare two sets of metric scores and detect regressions.

    Returns comparison table and list of regressions.
    """
    comparisons: List[Dict[str, Any]] = []
    regressions: List[str] = []

    for metric in set(list(baseline_scores.keys()) + list(candidate_scores.keys())):
        b = baseline_scores.get(metric, 0)
        c = candidate_scores.get(metric, 0)
        diff = c - b
        diff_pct = (diff / b * 100) if b > 0 else 0

        is_regression = diff < -threshold and b > 0
        if is_regression:
            regressions.append(metric)

        comparisons.append({
            "metric": metric,
            "baseline": round(b, 2),
            "candidate": round(c, 2),
            "difference": round(diff, 2),
            "difference_pct": round(diff_pct, 1),
            "status": "regression" if is_regression else "improved" if diff > threshold else "stable",
        })

    return {
        "comparisons": comparisons,
        "regressions": regressions,
        "has_regressions": len(regressions) > 0,
        "recommendation": "REJECT — regressions detected" if regressions else "APPROVE — no significant regressions",
    }


# ── Dataset size recommendations ────────────────────────────────
DATASET_SIZE_RECOMMENDATIONS: List[Dict[str, Any]] = [
    {"scenario": "Simple application", "minimum": 30, "recommended": 50},
    {"scenario": "Multiple use cases", "minimum": 50, "recommended": 100},
    {"scenario": "Complex / critical app", "minimum": 100, "recommended": 200},
]
