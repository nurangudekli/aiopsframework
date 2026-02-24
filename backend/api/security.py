"""
Security & Safety API routes.

POST /security/check        → full security check on input text
POST /security/injection    → prompt injection detection only
POST /security/pii          → PII detection + redaction
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from backend.services.security import (
    detect_pii,
    detect_prompt_injection,
    detect_toxicity,
    full_security_check,
)

router = APIRouter(prefix="/security", tags=["Security & Safety"])


class SecurityInput(BaseModel):
    text: str


class SecurityOutput(BaseModel):
    passed: bool
    risk_level: str
    flags: List[str]
    redacted_text: Optional[str] = None
    details: Optional[str] = None


@router.post("/check", response_model=SecurityOutput)
async def check(payload: SecurityInput):
    """Run all security checks (injection, toxicity, PII)."""
    result = full_security_check(payload.text)
    return SecurityOutput(
        passed=result.passed,
        risk_level=result.risk_level,
        flags=result.flags,
        redacted_text=result.redacted_text,
        details=result.details,
    )


@router.post("/injection", response_model=SecurityOutput)
async def check_injection(payload: SecurityInput):
    """Check for prompt injection patterns."""
    result = detect_prompt_injection(payload.text)
    return SecurityOutput(
        passed=result.passed,
        risk_level=result.risk_level,
        flags=result.flags,
        details=result.details,
    )


@router.post("/toxicity", response_model=SecurityOutput)
async def check_toxicity(payload: SecurityInput):
    """Check for toxic / harmful content."""
    result = detect_toxicity(payload.text)
    return SecurityOutput(
        passed=result.passed,
        risk_level=result.risk_level,
        flags=result.flags,
        details=result.details,
    )


@router.post("/pii", response_model=SecurityOutput)
async def check_pii(payload: SecurityInput):
    """Detect and redact PII."""
    result = detect_pii(payload.text)
    return SecurityOutput(
        passed=result.passed,
        risk_level=result.risk_level,
        flags=result.flags,
        redacted_text=result.redacted_text,
        details=result.details,
    )
