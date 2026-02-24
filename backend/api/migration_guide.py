"""
Migration Guide API routes.

GET /migration-guide                  → full migration guide
GET /migration-guide/checklist        → migration checklist
GET /migration-guide/faq              → FAQ (optional ?category= filter)
GET /migration-guide/code-examples    → before/after code examples
GET /migration-guide/parameter-changes → API parameter changes reference
GET /migration-guide/key-dates        → key dates & timeline
GET /migration-guide/phases           → 5-phase migration process
GET /migration-guide/reasoning-effort → reasoning_effort guide
GET /migration-guide/cost-comparison  → cost comparison baseline vs candidate
GET /migration-guide/error-messages   → common error messages & fixes
POST /migration-guide/quality-gates   → check quality gates
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from backend.services.migration_guide import (
    CODE_EXAMPLES,
    COST_COMPARISON,
    ERROR_MESSAGES,
    FAQ_ITEMS,
    KEY_DATES,
    MIGRATION_CHECKLIST,
    MIGRATION_PHASES,
    PARAMETER_CHANGES,
    REASONING_EFFORT_GUIDE,
    ROLLOUT_TIMELINE,
    get_checklist,
    get_code_examples,
    get_faq,
    get_migration_guide,
    get_dynamic_migration_guide,
    get_parameter_changes,
    get_dataset_recommendations,
    get_rollback_procedures,
    get_acceptance_criteria,
    get_monitoring_guidance,
)
from backend.services.quality_gates import (
    DEFAULT_QUALITY_GATES,
    DATASET_SIZE_RECOMMENDATIONS,
    METRIC_DEFINITIONS,
    check_quality_gates,
    compare_model_scores,
)

router = APIRouter(prefix="/migration-guide", tags=["Migration Guide"])
logger = logging.getLogger(__name__)


# ── Schemas ─────────────────────────────────────────────────────
class QualityGateRequest(BaseModel):
    candidate_scores: Dict[str, float] = Field(..., description="Candidate model metric scores")
    baseline_scores: Optional[Dict[str, float]] = Field(None, description="Baseline model metric scores")
    criteria: Optional[Dict[str, Dict[str, float]]] = Field(None, description="Custom quality gate criteria")


class ScoreComparisonRequest(BaseModel):
    baseline_scores: Dict[str, float] = Field(..., description="Baseline model scores")
    candidate_scores: Dict[str, float] = Field(..., description="Candidate model scores")
    threshold: float = Field(0.10, description="Regression threshold (fraction)")


# ── Routes ──────────────────────────────────────────────────────
@router.get("")
async def full_guide(
    baseline: Optional[str] = Query(None, description="Baseline deployment name"),
    target: Optional[str] = Query(None, description="Target deployment name"),
):
    """Return migration guide data, dynamically tailored when baseline & target are given."""
    return get_dynamic_migration_guide(baseline, target)


@router.get("/checklist")
async def checklist():
    """Return the migration checklist items."""
    return get_checklist()


@router.get("/faq")
async def faq(category: Optional[str] = Query(None, description="Filter by category")):
    """Return FAQ items, optionally filtered by category."""
    return get_faq(category)


@router.get("/code-examples")
async def code_examples():
    """Return before/after code examples for model migration."""
    return get_code_examples()


@router.get("/parameter-changes")
async def parameter_changes():
    """Return API parameter changes reference."""
    return get_parameter_changes()


@router.get("/key-dates")
async def key_dates():
    """Return key migration dates and timeline."""
    return {"key_dates": KEY_DATES, "rollout_timeline": ROLLOUT_TIMELINE}


@router.get("/phases")
async def migration_phases():
    """Return the 5-phase migration process."""
    return MIGRATION_PHASES


@router.get("/reasoning-effort")
async def reasoning_effort():
    """Return the reasoning_effort parameter guide."""
    return REASONING_EFFORT_GUIDE


@router.get("/cost-comparison")
async def cost_comparison():
    """Return cost comparison between baseline and candidate models."""
    return COST_COMPARISON


@router.get("/error-messages")
async def error_messages():
    """Return common error messages and fixes."""
    return ERROR_MESSAGES


@router.get("/metric-definitions")
async def metric_definitions():
    """Return Azure AI Foundry evaluation metric definitions."""
    return METRIC_DEFINITIONS


@router.get("/quality-gate-defaults")
async def quality_gate_defaults():
    """Return default quality gate criteria."""
    return {"gates": DEFAULT_QUALITY_GATES, "dataset_recommendations": DATASET_SIZE_RECOMMENDATIONS}


@router.post("/quality-gates")
async def evaluate_quality_gates(payload: QualityGateRequest):
    """Check candidate scores against quality gate criteria."""
    return check_quality_gates(
        candidate_scores=payload.candidate_scores,
        baseline_scores=payload.baseline_scores,
        criteria=payload.criteria,
    )


@router.post("/compare-scores")
async def compare_scores(payload: ScoreComparisonRequest):
    """Compare baseline and candidate model scores, detect regressions."""
    return compare_model_scores(
        baseline_scores=payload.baseline_scores,
        candidate_scores=payload.candidate_scores,
        threshold=payload.threshold,
    )


@router.get("/dataset-recommendations")
async def dataset_recommendations():
    """Return golden dataset size recommendations and test case categories."""
    return get_dataset_recommendations()


@router.get("/rollback-procedures")
async def rollback_procedures():
    """Return rollback procedures for different deployment types."""
    return get_rollback_procedures()


@router.get("/acceptance-criteria")
async def acceptance_criteria():
    """Return quality gate acceptance criteria thresholds."""
    return get_acceptance_criteria()


@router.get("/monitoring-guidance")
async def monitoring_guidance():
    """Return continuous production monitoring guidance."""
    return get_monitoring_guidance()
