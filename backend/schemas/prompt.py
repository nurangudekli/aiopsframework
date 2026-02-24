"""Pydantic schemas for Prompt resources."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ── Prompt Version ──────────────────────────────────────────────
class PromptVersionCreate(BaseModel):
    content: str = Field(..., description="Prompt template text")
    variables: Optional[List[str]] = None
    change_note: Optional[str] = None


class PromptVersionOut(BaseModel):
    id: str
    prompt_id: str
    version: int
    content: str
    variables: Optional[List[str]] = None
    change_note: Optional[str] = None
    is_current: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Prompt ──────────────────────────────────────────────────────
class PromptCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    system_message: Optional[str] = None
    tags: Optional[Dict[str, Any]] = None
    initial_content: str = Field(..., description="Content for version 1")


class PromptUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    system_message: Optional[str] = None
    tags: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class PromptOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    system_message: Optional[str] = None
    tags: Optional[Dict[str, Any]] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    versions: List[PromptVersionOut] = []

    model_config = {"from_attributes": True}


class PromptListOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    is_active: bool
    version_count: int = 0
    created_at: datetime
