"""Pydantic schemas for evaluation / metrics payloads."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class EvaluationRequest(BaseModel):
    """Compare two responses for a given question."""
    question: str
    response_a: str
    response_b: str
    reference_answer: Optional[str] = None


class EvaluationResult(BaseModel):
    semantic_similarity: float = Field(..., ge=0.0, le=1.0)
    bleu_score: Optional[float] = None
    rouge_l_score: Optional[float] = None
    coherence_score_a: Optional[float] = None
    coherence_score_b: Optional[float] = None
    verdict: str = Field(..., description="similar | divergent | needs_review")
    details: Optional[Dict[str, Any]] = None


class BatchEvaluationRequest(BaseModel):
    pairs: List[EvaluationRequest] = Field(..., min_length=1)


class BatchEvaluationResult(BaseModel):
    results: List[EvaluationResult]
    avg_semantic_similarity: float
    avg_bleu_score: Optional[float] = None
    summary_verdict: str


class PerformanceTestRequest(BaseModel):
    """Stress / load test configuration."""
    model_provider: str
    model_deployment: str
    model_params: Optional[Dict[str, Any]] = None
    system_message: Optional[str] = None
    questions: List[str] = Field(..., min_length=1)
    concurrency: int = Field(5, ge=1, le=200, description="Concurrent requests")
    total_requests: int = Field(50, ge=1, le=10000)
    timeout_seconds: float = Field(30.0, ge=1.0)


class PerformanceTestResult(BaseModel):
    total_requests: int
    successful_requests: int
    failed_requests: int
    avg_latency_ms: float
    p50_latency_ms: float
    p90_latency_ms: float
    p99_latency_ms: float
    min_latency_ms: float
    max_latency_ms: float
    requests_per_second: float
    avg_tokens_per_second: Optional[float] = None
    total_cost_usd: Optional[float] = None
    error_details: Optional[List[Dict[str, Any]]] = None


class CostSummaryRequest(BaseModel):
    provider: Optional[str] = None
    deployment: Optional[str] = None
    days: int = Field(30, ge=1, le=365)


class CostSummary(BaseModel):
    total_cost_usd: float
    total_tokens: int
    total_requests: int
    daily_breakdown: List[Dict[str, Any]]
    by_deployment: List[Dict[str, Any]]
