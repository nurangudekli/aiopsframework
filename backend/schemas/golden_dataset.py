"""Pydantic schemas for Golden Dataset management."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ── Input ───────────────────────────────────────────────────────
class GoldenTestCaseInput(BaseModel):
    question: str
    expected_answer: Optional[str] = None
    context: Optional[str] = None
    category: Optional[str] = None
    difficulty: Optional[str] = None
    language: Optional[str] = None
    tags: Optional[Dict[str, Any]] = None


class GoldenDatasetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    tags: Optional[Dict[str, Any]] = None
    cases: List[GoldenTestCaseInput] = Field(..., min_length=1)


class GoldenDatasetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


# ── Output ──────────────────────────────────────────────────────
class GoldenTestCaseOut(BaseModel):
    id: str
    dataset_id: str
    index: int
    question: str
    expected_answer: Optional[str] = None
    context: Optional[str] = None
    category: Optional[str] = None
    difficulty: Optional[str] = None
    language: Optional[str] = None
    tags: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class GoldenDatasetOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    source_filename: Optional[str] = None
    tags: Optional[Dict[str, Any]] = None
    total_cases: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GoldenDatasetDetailOut(GoldenDatasetOut):
    cases: List[GoldenTestCaseOut] = []
