"""Pydantic schemas for Experiment (A/B testing) resources."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ModelConfig(BaseModel):
    provider: str = Field(..., description="azure_openai | openai | custom")
    deployment: str = Field(..., description="Model deployment / model name")
    deployment_type: Optional[str] = Field(None, description="Standard | PTU | GlobalStandard | ProvisionedManaged | GlobalProvisionedManaged | DataZone")
    params: Optional[Dict[str, Any]] = Field(None, description="temperature, max_tokens, etc.")


class ExperimentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    model_a: ModelConfig
    model_b: ModelConfig
    prompt_id: Optional[str] = None
    system_message_override: Optional[str] = None
    questions: List[str] = Field(..., min_length=1, description="List of questions to test")


class ExperimentResultOut(BaseModel):
    id: str
    experiment_id: str
    question_index: int
    question_text: str

    model_a_response: Optional[str] = None
    model_a_latency_ms: Optional[float] = None
    model_a_tokens_prompt: Optional[int] = None
    model_a_tokens_completion: Optional[int] = None

    model_b_response: Optional[str] = None
    model_b_latency_ms: Optional[float] = None
    model_b_tokens_prompt: Optional[int] = None
    model_b_tokens_completion: Optional[int] = None

    semantic_similarity: Optional[float] = None
    bleu_score: Optional[float] = None
    rouge_l_score: Optional[float] = None
    coherence_score_a: Optional[float] = None
    coherence_score_b: Optional[float] = None
    factual_alignment: Optional[float] = None

    model_a_cost_usd: Optional[float] = None
    model_b_cost_usd: Optional[float] = None

    human_preference: Optional[str] = None
    human_notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ExperimentOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    model_a_provider: str
    model_a_deployment: str
    model_b_provider: str
    model_b_deployment: str
    status: str
    total_questions: int
    completed_questions: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ExperimentDetailOut(ExperimentOut):
    results: List[ExperimentResultOut] = []
    summary: Optional[Dict[str, Any]] = None


class ExperimentSummary(BaseModel):
    """Aggregated metrics across all questions in an experiment."""
    experiment_id: str
    total_questions: int
    avg_semantic_similarity: Optional[float] = None
    avg_model_a_latency_ms: Optional[float] = None
    avg_model_b_latency_ms: Optional[float] = None
    total_model_a_cost_usd: Optional[float] = None
    total_model_b_cost_usd: Optional[float] = None
    model_a_wins: int = 0
    model_b_wins: int = 0
    ties: int = 0
    similarity_distribution: Optional[Dict[str, int]] = None


class HumanFeedback(BaseModel):
    preference: str = Field(..., pattern="^(A|B|tie)$")
    notes: Optional[str] = None
