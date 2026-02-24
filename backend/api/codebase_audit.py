"""
Codebase Audit API routes.

POST /audit/scan-text    → scan pasted code text for migration issues
POST /audit/scan-upload  → upload a file to scan
GET  /audit/patterns     → list all patterns checked
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from backend.services.codebase_audit import (
    AUDIT_PATTERNS,
    MODEL_FAMILIES,
    AuditFinding,
    detect_model_family,
    generate_fixed_code,
    generate_report,
    get_model_capabilities,
    scan_text,
)

router = APIRouter(prefix="/audit", tags=["Codebase Audit"])
logger = logging.getLogger(__name__)


# ── Schemas ─────────────────────────────────────────────────────
class ScanTextRequest(BaseModel):
    code: str = Field(..., description="Code/text to scan for migration issues")
    filename: str = Field("input.py", description="Virtual file name for reporting")
    target_deployment: str = Field("", description="Target deployment name — used to adjust finding severity based on model capabilities")


class FindingOut(BaseModel):
    file_path: str
    line_number: int
    line_content: str
    issue_type: str
    severity: str
    recommendation: str


class AuditReportOut(BaseModel):
    total_findings: int
    severity_counts: Dict[str, int]
    by_file: Dict[str, List[Dict[str, Any]]]
    by_type: Dict[str, int]
    recommended_actions: List[Dict[str, str]]
    ready_for_migration: bool
    findings: List[FindingOut]
    fixed_code: str = Field("", description="Auto-corrected version of the scanned code")
    target_model_family: str = Field("", description="Detected model family of the target deployment")
    target_deployment: str = Field("", description="Target deployment used for the scan")


class PatternInfo(BaseModel):
    name: str
    pattern: str
    severity: str
    recommendation: str


# ── Routes ──────────────────────────────────────────────────────
@router.post("/scan-text", response_model=AuditReportOut)
async def scan_code_text(payload: ScanTextRequest):
    """Scan pasted code text for model migration issues."""
    target = payload.target_deployment or None
    findings = scan_text(payload.code, payload.filename, target_deployment=target)
    report = generate_report(findings, target_deployment=target)
    report["findings"] = [
        FindingOut(
            file_path=f.file_path,
            line_number=f.line_number,
            line_content=f.line_content,
            issue_type=f.issue_type,
            severity=f.severity,
            recommendation=f.recommendation,
        ).__dict__
        for f in findings
    ]
    report["fixed_code"] = generate_fixed_code(payload.code, target_deployment=target) if findings else payload.code
    return report


@router.post("/scan-upload", response_model=AuditReportOut)
async def scan_uploaded_file(
    file: UploadFile = File(...),
    target_deployment: str = Form(""),
):
    """Upload a code file to scan for migration issues."""
    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be a text/code file (UTF-8)")

    target = target_deployment or None
    findings = scan_text(text, file.filename or "upload", target_deployment=target)
    report = generate_report(findings, target_deployment=target)
    report["findings"] = [
        FindingOut(
            file_path=f.file_path,
            line_number=f.line_number,
            line_content=f.line_content,
            issue_type=f.issue_type,
            severity=f.severity,
            recommendation=f.recommendation,
        ).__dict__
        for f in findings
    ]
    report["fixed_code"] = generate_fixed_code(text, target_deployment=target) if findings else text
    return report


@router.get("/patterns", response_model=List[PatternInfo])
async def list_patterns():
    """List all audit patterns checked during scanning."""
    return [
        PatternInfo(
            name=name,
            pattern=cfg["pattern"],
            severity=cfg["severity"],
            recommendation=cfg["recommendation"],
        )
        for name, cfg in AUDIT_PATTERNS.items()
    ]


@router.get("/model-families")
async def list_model_families():
    """List recognised model families and their capabilities."""
    return {
        family: {
            "display": cfg["display"],
            "supports_temperature": cfg["supports_temperature"],
            "supports_top_p": cfg["supports_top_p"],
            "supports_logprobs": cfg["supports_logprobs"],
            "uses_max_completion_tokens": cfg["uses_max_completion_tokens"],
            "prefers_developer_role": cfg["prefers_developer_role"],
            "supports_reasoning_effort": cfg["supports_reasoning_effort"],
        }
        for family, cfg in MODEL_FAMILIES.items()
    }
