"""
Codebase Audit Service.

Scans uploaded code or text for patterns that may need updating when migrating models.
Based on the audit_codebase.py script from the migration guide.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Set


@dataclass
class AuditFinding:
    """A single migration issue found in code."""

    file_path: str
    line_number: int
    line_content: str
    issue_type: str
    severity: str  # HIGH, MEDIUM, INFO
    recommendation: str


# ── Model family capabilities ────────────────────────────────
# Which sampling/parameter features each model family supports.
# If a parameter is supported by the target model, the audit finding is
# either downgraded to INFO or skipped entirely.

MODEL_FAMILIES: Dict[str, Dict[str, Any]] = {
    "o-series": {
        "match": r"^o[134]",  # o1, o3, o4-mini, etc.
        "display": "o-series (o1 / o3 / o4-mini)",
        "supports_temperature": False,
        "supports_top_p": False,
        "supports_frequency_penalty": False,
        "supports_presence_penalty": False,
        "supports_logprobs": False,
        "uses_max_completion_tokens": True,
        "prefers_developer_role": True,
        "supports_reasoning_effort": True,
    },
    "gpt-4.1": {
        "match": r"gpt-?4[\.\-]?1",
        "display": "GPT-4.1 series (gpt-4.1 / gpt-4.1-mini / gpt-4.1-nano)",
        "supports_temperature": True,
        "supports_top_p": True,
        "supports_frequency_penalty": True,
        "supports_presence_penalty": True,
        "supports_logprobs": True,
        "uses_max_completion_tokens": True,
        "prefers_developer_role": True,
        "supports_reasoning_effort": False,
    },
    "gpt-4o": {
        "match": r"gpt-?4o",
        "display": "GPT-4o series",
        "supports_temperature": True,
        "supports_top_p": True,
        "supports_frequency_penalty": True,
        "supports_presence_penalty": True,
        "supports_logprobs": True,
        "uses_max_completion_tokens": True,
        "prefers_developer_role": False,
        "supports_reasoning_effort": False,
    },
}

# Default family used when no target model is specified (most restrictive)
DEFAULT_FAMILY = "o-series"


def detect_model_family(deployment_name: str) -> str:
    """Detect the model family from a deployment name."""
    name = deployment_name.lower().strip()
    for family, cfg in MODEL_FAMILIES.items():
        if re.search(cfg["match"], name, re.IGNORECASE):
            return family
    # Default to o-series (most restrictive) for unknown models
    return DEFAULT_FAMILY


def get_model_capabilities(deployment_name: Optional[str] = None) -> Dict[str, Any]:
    """Return capability map for a deployment."""
    family = detect_model_family(deployment_name) if deployment_name else DEFAULT_FAMILY
    caps = dict(MODEL_FAMILIES[family])
    caps["family"] = family
    return caps


# ── Patterns to search for ───────────────────────────────────
# Each pattern now includes a "capability_key" that maps to the model
# family capabilities dict.  When the target model supports that
# capability the finding severity is downgraded to INFO.
AUDIT_PATTERNS: Dict[str, Dict[str, str]] = {
    "temperature": {
        "pattern": r"temperature\s*[=:]\s*[\d.]+",
        "severity": "HIGH",
        "recommendation": "Remove this parameter — may not be supported in candidate model",
        "capability_key": "supports_temperature",
    },
    "top_p": {
        "pattern": r"top_p\s*[=:]\s*[\d.]+",
        "severity": "HIGH",
        "recommendation": "Remove this parameter — may not be supported in candidate model",
        "capability_key": "supports_top_p",
    },
    "frequency_penalty": {
        "pattern": r"frequency_penalty\s*[=:]\s*[\d.]+",
        "severity": "HIGH",
        "recommendation": "Remove this parameter — may not be supported in candidate model",
        "capability_key": "supports_frequency_penalty",
    },
    "presence_penalty": {
        "pattern": r"presence_penalty\s*[=:]\s*[\d.]+",
        "severity": "HIGH",
        "recommendation": "Remove this parameter — may not be supported in candidate model",
        "capability_key": "supports_presence_penalty",
    },
    "max_tokens": {
        "pattern": r"max_tokens\s*[=:]\s*\d+",
        "severity": "HIGH",
        "recommendation": "Rename to 'max_completion_tokens'",
        "capability_key": "uses_max_completion_tokens",  # always flagged when True
    },
    "system_role": {
        "pattern": r"""[\"']role[\"']\s*:\s*[\"']system[\"']""",
        "severity": "MEDIUM",
        "recommendation": "Change to 'developer' role (system still works but deprecated)",
        "capability_key": "prefers_developer_role",
    },
    "old_model_ref": {
        "pattern": r"""[\"']gpt-4o[\"']""",
        "severity": "INFO",
        "recommendation": "Update model reference to candidate deployment after code changes are complete",
        "capability_key": None,  # always applies
    },
    "old_api_version": {
        "pattern": r"""api_version\s*[=:]\s*[\"']2024""",
        "severity": "MEDIUM",
        "recommendation": "Update to api_version='2025-06-01'",
        "capability_key": None,  # always applies
    },
    "logprobs": {
        "pattern": r"logprobs\s*[=:]\s*(True|true|\d+)",
        "severity": "HIGH",
        "recommendation": "Remove this parameter — may not be supported in candidate model",
        "capability_key": "supports_logprobs",
    },
}

# Patterns where the capability_key means "parameter is unsupported if False"
_UNSUPPORTED_WHEN_FALSE: Set[str] = {
    "supports_temperature",
    "supports_top_p",
    "supports_frequency_penalty",
    "supports_presence_penalty",
    "supports_logprobs",
}

# Patterns where the capability_key means "should be flagged when True"
_FLAG_WHEN_TRUE: Set[str] = {
    "uses_max_completion_tokens",
    "prefers_developer_role",
}


def _adjusted_severity(
    base_severity: str,
    capability_key: Optional[str],
    caps: Dict[str, Any],
) -> str:
    """Adjust finding severity based on target model capabilities."""
    if capability_key is None:
        return base_severity  # always applies as-is

    if capability_key in _UNSUPPORTED_WHEN_FALSE:
        # Parameter is unsupported when capability is False → keep severity
        # Parameter IS supported when capability is True  → downgrade to INFO
        if caps.get(capability_key, False):
            return "INFO"
        return base_severity

    if capability_key in _FLAG_WHEN_TRUE:
        # These are flagged unconditionally (max_tokens rename, developer role)
        if not caps.get(capability_key, True):
            return "INFO"
        return base_severity

    return base_severity


def _adjusted_recommendation(
    issue_type: str,
    base_rec: str,
    severity: str,
    caps: Dict[str, Any],
    target_name: str = "",
) -> str:
    """Generate a target-model-specific recommendation."""
    family_display = caps.get("display", caps.get("family", "target model"))
    target_label = target_name or family_display

    # When the target supports the parameter, severity was downgraded to INFO
    if severity == "INFO" and issue_type in (
        "temperature", "top_p", "frequency_penalty", "presence_penalty", "logprobs"
    ):
        return f"\u2705 Supported by {target_label} \u2014 no change required for this migration"

    # Target-specific recommendations for HIGH/MEDIUM items
    recs: Dict[str, str] = {
        "temperature": f"Remove this parameter \u2014 not supported by {target_label}",
        "top_p": f"Remove this parameter \u2014 not supported by {target_label}",
        "frequency_penalty": f"Remove this parameter \u2014 not supported by {target_label}",
        "presence_penalty": f"Remove this parameter \u2014 not supported by {target_label}",
        "logprobs": f"Remove this parameter \u2014 not supported by {target_label}",
        "max_tokens": f"Rename to 'max_completion_tokens' \u2014 required by {target_label}",
        "system_role": f"Change to 'developer' role \u2014 recommended for {target_label} (system still works but is deprecated)",
        "old_api_version": f"Update to api_version='2025-06-01' \u2014 latest stable version for {target_label}",
        "old_model_ref": f"Update model reference to your {target_label} deployment name",
    }
    return recs.get(issue_type, base_rec)

# File extensions to scan
SCAN_EXTENSIONS = {".py", ".js", ".ts", ".jsx", ".tsx", ".cs", ".java", ".go", ".rb"}


def scan_text(
    text: str,
    filename: str = "input.py",
    target_deployment: Optional[str] = None,
) -> List[AuditFinding]:
    """Scan a block of text/code for migration issues.

    If *target_deployment* is provided, finding severities are adjusted
    based on the capabilities of that model family.
    """
    caps = get_model_capabilities(target_deployment)
    findings: List[AuditFinding] = []
    lines = text.splitlines()

    for line_num, line in enumerate(lines, 1):
        for issue_type, config in AUDIT_PATTERNS.items():
            if re.search(config["pattern"], line, re.IGNORECASE):
                cap_key = config.get("capability_key")
                severity = _adjusted_severity(config["severity"], cap_key, caps)
                recommendation = _adjusted_recommendation(
                    issue_type, config["recommendation"], severity, caps,
                    target_name=target_deployment or "",
                )
                findings.append(
                    AuditFinding(
                        file_path=filename,
                        line_number=line_num,
                        line_content=line.strip()[:200],
                        issue_type=issue_type,
                        severity=severity,
                        recommendation=recommendation,
                    )
                )
    return findings


def scan_directory(root_path: str, exclude_dirs: Optional[List[str]] = None) -> List[AuditFinding]:
    """Recursively scan directory for migration issues."""
    if exclude_dirs is None:
        exclude_dirs = ["node_modules", ".git", "__pycache__", "venv", ".venv", "dist", "build"]

    root = Path(root_path)
    all_findings: List[AuditFinding] = []

    for file_path in root.rglob("*"):
        if any(excluded in file_path.parts for excluded in exclude_dirs):
            continue
        if file_path.suffix.lower() in SCAN_EXTENSIONS:
            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
                findings = scan_text(content, str(file_path.relative_to(root)))
                all_findings.extend(findings)
            except Exception:
                continue

    return all_findings


def generate_report(
    findings: List[AuditFinding],
    target_deployment: Optional[str] = None,
) -> Dict[str, Any]:
    """Generate a structured audit report from findings."""
    high = sum(1 for f in findings if f.severity == "HIGH")
    medium = sum(1 for f in findings if f.severity == "MEDIUM")
    info = sum(1 for f in findings if f.severity == "INFO")

    by_file: Dict[str, List[Dict[str, Any]]] = {}
    for f in findings:
        by_file.setdefault(f.file_path, []).append(asdict(f))

    by_type: Dict[str, int] = {}
    for f in findings:
        by_type[f.issue_type] = by_type.get(f.issue_type, 0) + 1

    caps = get_model_capabilities(target_deployment)
    family_display = caps.get("display", caps.get("family", "target model"))
    target_label = target_deployment or family_display

    # Recommended actions — target-specific
    actions: List[Dict[str, str]] = []
    if high > 0:
        # Build a list of unsupported parameters for this target
        unsupported = [
            it for it in ("temperature", "top_p", "frequency_penalty",
                          "presence_penalty", "logprobs")
            if by_type.get(it) and not caps.get(AUDIT_PATTERNS[it].get("capability_key", ""), False)
        ]
        rename_needed = "max_tokens" in by_type
        parts = []
        if unsupported:
            parts.append(f"Remove unsupported parameters ({', '.join(unsupported)}) — not available on {target_label}")
        if rename_needed:
            parts.append(f"Rename max_tokens → max_completion_tokens (required by {target_label})")
        actions.append({
            "priority": "REQUIRED",
            "description": f"Fix all HIGH severity issues for {target_label}",
            "details": ". ".join(parts) + "." if parts else f"Resolve all HIGH findings before migrating to {target_label}.",
        })
    if medium > 0:
        actions.append({
            "priority": "RECOMMENDED",
            "description": f"Fix all MEDIUM severity issues for {target_label}",
            "details": f"Update API version to 2025-06-01. Change 'system' role to 'developer' (recommended for {target_label}).",
        })
    if info > 0:
        actions.append({
            "priority": "OPTIONAL",
            "description": "Review INFO-level findings",
            "details": "These are informational — the code will work, but consider updating for best practices.",
        })
    actions.append({
        "priority": "AFTER FIXES",
        "description": f"Update model/deployment name to {target_label}",
        "details": "Only switch the deployment reference after all code changes are tested and verified.",
    })
    actions.append({
        "priority": "TESTING",
        "description": "Run evaluation tests before deploying",
        "details": f"Use golden datasets and the evaluation pipeline to verify quality against {target_label}.",
    })
    return {
        "total_findings": len(findings),
        "severity_counts": {"HIGH": high, "MEDIUM": medium, "INFO": info},
        "by_file": by_file,
        "by_type": by_type,
        "recommended_actions": actions,
        "ready_for_migration": high == 0 and medium == 0,
        "target_model_family": caps.get("display", caps.get("family", "o-series")),
        "target_deployment": target_deployment or "",
    }


# ── Fix-rule transformations (pattern → replacement) ───────────
# Each rule now has an optional "skip_if_cap" key.  When the target model
# supports that capability the rule is skipped (parameter is fine as-is).
_FIX_RULES: List[Dict[str, Any]] = [
    # Remove temperature line entirely
    {"pattern": r"^(\s*).*temperature\s*[=:]\s*[\d.]+.*,?\s*$", "replacement": "", "delete_line": True,
     "skip_if_cap": "supports_temperature"},
    # Remove top_p line entirely
    {"pattern": r"^(\s*).*top_p\s*[=:]\s*[\d.]+.*,?\s*$", "replacement": "", "delete_line": True,
     "skip_if_cap": "supports_top_p"},
    # Remove frequency_penalty line entirely
    {"pattern": r"^(\s*).*frequency_penalty\s*[=:]\s*[\d.]+.*,?\s*$", "replacement": "", "delete_line": True,
     "skip_if_cap": "supports_frequency_penalty"},
    # Remove presence_penalty line entirely
    {"pattern": r"^(\s*).*presence_penalty\s*[=:]\s*[\d.]+.*,?\s*$", "replacement": "", "delete_line": True,
     "skip_if_cap": "supports_presence_penalty"},
    # Remove logprobs line entirely
    {"pattern": r"^(\s*).*logprobs\s*[=:]\s*(True|true|\d+).*,?\s*$", "replacement": "", "delete_line": True,
     "skip_if_cap": "supports_logprobs"},
    # Rename max_tokens → max_completion_tokens
    {"pattern": r"max_tokens(\s*[=:])", "replacement": r"max_completion_tokens\1", "delete_line": False},
    # Change "system" role → "developer" role
    {"pattern": r"([\"'])system([\"'])", "replacement": r"\1developer\2", "delete_line": False,
     "context": r"role",  # only when "role" is on the same line
     "skip_if_cap_false": "prefers_developer_role"},
    # Update api_version to latest
    {"pattern": r"(api_version\s*[=:]\s*[\"'])2024[^\"']*([\"'])",
     "replacement": r"\g<1>2025-06-01\2", "delete_line": False},
]


def generate_fixed_code(
    original_code: str,
    target_deployment: Optional[str] = None,
) -> str:
    """Apply fixes to the original code for the target model and return the corrected version."""
    caps = get_model_capabilities(target_deployment)
    lines = original_code.splitlines()
    fixed_lines: List[str] = []

    for line in lines:
        new_line = line
        deleted = False

        for rule in _FIX_RULES:
            # Skip this rule if the target model supports the capability
            skip_cap = rule.get("skip_if_cap")
            if skip_cap and caps.get(skip_cap, False):
                continue
            # Skip this rule if the target model does NOT have the flag
            skip_cap_false = rule.get("skip_if_cap_false")
            if skip_cap_false and not caps.get(skip_cap_false, True):
                continue

            ctx = rule.get("context")
            if ctx and not re.search(ctx, line, re.IGNORECASE):
                continue

            if re.search(rule["pattern"], new_line, re.IGNORECASE):
                if rule["delete_line"]:
                    deleted = True
                    break
                else:
                    new_line = re.sub(rule["pattern"], rule["replacement"], new_line, flags=re.IGNORECASE)

        if not deleted:
            fixed_lines.append(new_line)

    # Add reasoning_effort parameter only if the target supports it
    result = "\n".join(fixed_lines)
    if (caps.get("supports_reasoning_effort", False)
            and "reasoning_effort" not in result
            and "chat.completions.create" in original_code):
        result = re.sub(
            r"(messages\s*=\s*\[.*?\]\s*,?)",
            r"\1\n    reasoning_effort=\"medium\",",
            result,
            count=1,
            flags=re.DOTALL,
        )
    return result


def generate_text_report(findings: List[AuditFinding]) -> str:
    """Generate a human-readable text report."""
    if not findings:
        return (
            "="*60 + "\n"
            "  ✅ No migration issues found!\n"
            "  Your code appears ready for the candidate model.\n"
            "  Remember to update the model name when deploying.\n"
            "="*60
        )

    report = generate_report(findings)
    lines: List[str] = []
    lines.append("=" * 70)
    lines.append("AZURE OPENAI MIGRATION AUDIT REPORT")
    lines.append("=" * 70)
    lines.append("")
    lines.append(f"Total findings: {report['total_findings']}")
    lines.append(f"  🔴 HIGH:   {report['severity_counts']['HIGH']} (will cause errors)")
    lines.append(f"  🟡 MEDIUM: {report['severity_counts']['MEDIUM']} (should fix)")
    lines.append(f"  🔵 INFO:   {report['severity_counts']['INFO']} (informational)")
    lines.append("")
    lines.append("-" * 70)
    lines.append("FINDINGS BY FILE")
    lines.append("-" * 70)

    for file_path, file_findings in sorted(report["by_file"].items()):
        lines.append("")
        lines.append(f"📄 {file_path}")
        for f in sorted(file_findings, key=lambda x: x["line_number"]):
            icon = {"HIGH": "🔴", "MEDIUM": "🟡", "INFO": "🔵"}[f["severity"]]
            lines.append(f"   Line {f['line_number']}: {icon} {f['issue_type']}")
            lines.append(f"      Code: {f['line_content']}")
            lines.append(f"      Fix:  {f['recommendation']}")

    lines.append("")
    lines.append("-" * 70)
    lines.append("RECOMMENDED ACTIONS")
    lines.append("-" * 70)
    for action in report["recommended_actions"]:
        lines.append(f"  [{action['priority']}] {action['description']}")
        lines.append(f"    {action['details']}")
    lines.append("=" * 70)

    return "\n".join(lines)
