"""Pydantic schemas for TestRun (batch/regression testing) resources."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class TestCaseInput(BaseModel):
    question: str
    expected_answer: Optional[str] = None
    context: Optional[str] = None
    tags: Optional[Dict[str, Any]] = None


class TestRunCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    model_provider: str
    model_deployment: str
    model_params: Optional[Dict[str, Any]] = None
    cases: List[TestCaseInput] = Field(..., min_length=1)


class TestCaseResultOut(BaseModel):
    id: str
    test_case_id: str
    model_label: str
    response: Optional[str] = None
    latency_ms: Optional[float] = None
    tokens_prompt: Optional[int] = None
    tokens_completion: Optional[int] = None
    cost_usd: Optional[float] = None
    similarity_to_expected: Optional[float] = None
    passed: Optional[bool] = None
    error_message: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TestCaseOut(BaseModel):
    id: str
    test_run_id: str
    index: int
    question: str
    expected_answer: Optional[str] = None
    context: Optional[str] = None
    tags: Optional[Dict[str, Any]] = None
    results: List[TestCaseResultOut] = []

    model_config = {"from_attributes": True}


class TestRunOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    source_filename: Optional[str] = None
    model_provider: str
    model_deployment: str
    status: str
    total_cases: int
    passed_cases: int
    failed_cases: int
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TestRunDetailOut(TestRunOut):
    cases: List[TestCaseOut] = []
