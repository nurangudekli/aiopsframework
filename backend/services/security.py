"""
Security & Safety Service.

Provides:
  - Prompt injection detection
  - Content moderation (toxicity / safety) heuristics
  - PII detection and redaction
  - Jailbreak pattern detection
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import List, Optional

logger = logging.getLogger(__name__)


# ── Results ─────────────────────────────────────────────────────
@dataclass
class SecurityCheckResult:
    passed: bool
    risk_level: str  # "low", "medium", "high"
    flags: List[str]
    redacted_text: Optional[str] = None
    details: Optional[str] = None


# ── Prompt Injection Detection ──────────────────────────────────
_INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?previous\s+instructions",
    r"ignore\s+(all\s+)?above\s+instructions",
    r"disregard\s+(all\s+)?previous",
    r"forget\s+(all\s+)?prior\s+instructions",
    r"you\s+are\s+now\s+(a\s+)?DAN",
    r"pretend\s+you\s+are\s+(?!.*assistant)",
    r"act\s+as\s+if\s+you\s+have\s+no\s+(restrictions|rules|guidelines)",
    r"override\s+(your|system)\s+(prompt|instructions|rules)",
    r"system\s*:\s*you\s+are",
    r"\[SYSTEM\]",
    r"<\|im_start\|>system",
    r"###\s*Instruction:",
    r"Do\s+anything\s+now",
    r"jailbreak",
]

_INJECTION_RE = re.compile("|".join(_INJECTION_PATTERNS), re.IGNORECASE)


def detect_prompt_injection(text: str) -> SecurityCheckResult:
    """Scan text for common prompt injection patterns."""
    matches = _INJECTION_RE.findall(text)
    if matches:
        return SecurityCheckResult(
            passed=False,
            risk_level="high",
            flags=["prompt_injection"],
            details=f"Detected {len(matches)} injection pattern(s).",
        )
    return SecurityCheckResult(passed=True, risk_level="low", flags=[])


# ── Toxicity / Safety Keywords ──────────────────────────────────
_TOXICITY_KEYWORDS = [
    "kill", "murder", "suicide", "bomb", "terrorist", "exploit children",
    "hate speech", "racial slur", "violence against",
]

_TOXICITY_RE = re.compile(
    "|".join(re.escape(kw) for kw in _TOXICITY_KEYWORDS),
    re.IGNORECASE,
)


def detect_toxicity(text: str) -> SecurityCheckResult:
    """Basic keyword-based toxicity check (should be supplemented with ML model in prod)."""
    matches = _TOXICITY_RE.findall(text)
    if matches:
        return SecurityCheckResult(
            passed=False,
            risk_level="high",
            flags=["toxicity"],
            details=f"Found {len(matches)} potentially toxic keyword(s).",
        )
    return SecurityCheckResult(passed=True, risk_level="low", flags=[])


# ── PII Detection & Redaction ──────────────────────────────────
_PII_PATTERNS = {
    "email": r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}",
    "phone": r"\b(\+?\d{1,3}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}\b",
    "ssn": r"\b\d{3}-\d{2}-\d{4}\b",
    "credit_card": r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b",
    "ip_address": r"\b(?:\d{1,3}\.){3}\d{1,3}\b",
}


def detect_pii(text: str) -> SecurityCheckResult:
    """Detect common PII patterns in text."""
    flags = []
    redacted = text

    for pii_type, pattern in _PII_PATTERNS.items():
        found = re.findall(pattern, text) if isinstance(re.findall(pattern, text), list) else []
        if re.search(pattern, text):
            flags.append(f"pii_{pii_type}")
            redacted = re.sub(pattern, f"[REDACTED_{pii_type.upper()}]", redacted)

    if flags:
        return SecurityCheckResult(
            passed=False,
            risk_level="medium",
            flags=flags,
            redacted_text=redacted,
            details=f"Detected PII types: {', '.join(flags)}",
        )
    return SecurityCheckResult(passed=True, risk_level="low", flags=[])


# ── Combined Check ──────────────────────────────────────────────
def full_security_check(text: str) -> SecurityCheckResult:
    """Run all security checks and return aggregated result."""
    injection = detect_prompt_injection(text)
    toxicity = detect_toxicity(text)
    pii = detect_pii(text)

    all_flags = injection.flags + toxicity.flags + pii.flags
    passed = injection.passed and toxicity.passed and pii.passed

    # Highest risk level
    levels = {"low": 0, "medium": 1, "high": 2}
    max_level = max(
        levels.get(injection.risk_level, 0),
        levels.get(toxicity.risk_level, 0),
        levels.get(pii.risk_level, 0),
    )
    risk = {0: "low", 1: "medium", 2: "high"}[max_level]

    details_parts = []
    if injection.details:
        details_parts.append(injection.details)
    if toxicity.details:
        details_parts.append(toxicity.details)
    if pii.details:
        details_parts.append(pii.details)

    return SecurityCheckResult(
        passed=passed,
        risk_level=risk,
        flags=all_flags,
        redacted_text=pii.redacted_text,
        details=" | ".join(details_parts) if details_parts else None,
    )
