"""Pydantic schemas for Migration Pipeline."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ── Input ───────────────────────────────────────────────────────
class MigrationModelConfig(BaseModel):
    provider: str = Field(..., description="azure_openai | openai | custom")
    deployment: str = Field(..., description="Model deployment name")
    params: Optional[Dict[str, Any]] = Field(None, description="temperature, max_tokens, etc.")


class MigrationRunCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    golden_dataset_id: str = Field(..., description="ID of the golden dataset to use")
    source_model: MigrationModelConfig = Field(..., description="Current / baseline model deployment")
    target_model: MigrationModelConfig = Field(..., description="New / candidate model deployment")
    system_message: Optional[str] = None
    prompt_id: Optional[str] = None
    similarity_threshold: float = Field(0.7, ge=0.0, le=1.0, description="Minimum similarity to pass")


class ParameterDiffRequest(BaseModel):
    source_model: MigrationModelConfig
    target_model: MigrationModelConfig


# ── Output ──────────────────────────────────────────────────────
class MigrationResultOut(BaseModel):
    id: str
    migration_run_id: str
    case_index: int
    question: str
    expected_answer: Optional[str] = None
    category: Optional[str] = None

    source_response: Optional[str] = None
    source_latency_ms: Optional[float] = None
    source_tokens_prompt: Optional[int] = None
    source_tokens_completion: Optional[int] = None
    source_cost_usd: Optional[float] = None
    source_error: Optional[str] = None

    target_response: Optional[str] = None
    target_latency_ms: Optional[float] = None
    target_tokens_prompt: Optional[int] = None
    target_tokens_completion: Optional[int] = None
    target_cost_usd: Optional[float] = None
    target_error: Optional[str] = None

    similarity_score: Optional[float] = None
    source_reference_score: Optional[float] = None
    target_reference_score: Optional[float] = None
    bleu_score: Optional[float] = None
    rouge_l_score: Optional[float] = None

    source_passed: Optional[str] = None
    target_passed: Optional[str] = None
    regression: Optional[str] = None

    created_at: datetime

    model_config = {"from_attributes": True}


class MigrationRunOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    golden_dataset_id: str
    source_provider: str
    source_deployment: str
    target_provider: str
    target_deployment: str
    status: str
    total_cases: int
    completed_cases: int

    source_avg_latency_ms: Optional[float] = None
    target_avg_latency_ms: Optional[float] = None
    source_total_cost_usd: Optional[float] = None
    target_total_cost_usd: Optional[float] = None
    avg_similarity: Optional[float] = None
    avg_source_reference_score: Optional[float] = None
    avg_target_reference_score: Optional[float] = None
    pass_rate_source: Optional[float] = None
    pass_rate_target: Optional[float] = None
    recommendation: Optional[str] = None

    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class MigrationRunDetailOut(MigrationRunOut):
    results: List[MigrationResultOut] = []


class MigrationSummary(BaseModel):
    migration_run_id: str
    name: str
    source_deployment: str
    target_deployment: str
    total_cases: int
    completed_cases: int

    # Latency comparison
    source_avg_latency_ms: Optional[float] = None
    target_avg_latency_ms: Optional[float] = None
    latency_change_pct: Optional[float] = None

    # Cost comparison
    source_total_cost_usd: Optional[float] = None
    target_total_cost_usd: Optional[float] = None
    cost_change_pct: Optional[float] = None

    # Quality
    avg_similarity: Optional[float] = None
    avg_source_reference_score: Optional[float] = None
    avg_target_reference_score: Optional[float] = None
    quality_change_pct: Optional[float] = None

    # Pass rates
    pass_rate_source: Optional[float] = None
    pass_rate_target: Optional[float] = None

    # Regression breakdown
    no_regression_count: int = 0
    minor_regression_count: int = 0
    major_regression_count: int = 0

    recommendation: Optional[str] = None
    recommendation_reason: Optional[str] = None


class ParameterDiffOut(BaseModel):
    source_model: str
    target_model: str
    parameter_differences: List[Dict[str, Any]]
    compatibility_notes: List[str]
    migration_checklist: List[str]


class ExportFormat(BaseModel):
    format: str = Field("csv", description="csv | json")
