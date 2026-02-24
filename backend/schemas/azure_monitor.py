"""
Pydantic schemas for Azure OpenAI deployment scanning & monitoring.
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


# ── Request schemas ─────────────────────────────────────────────
class TargetModelInput(BaseModel):
    model_name: str = Field(..., description="Model name to target")
    versions: List[str] = Field(..., description="Model versions to match, e.g. ['2025-08-06']")


class ScanRequest(BaseModel):
    subscription_id: str = Field(..., description="Azure subscription ID to scan")
    target_models: Optional[List[TargetModelInput]] = Field(
        None,
        description="Optional model name/version filters. If omitted, all deployments are returned with metrics.",
    )
    log_analytics_workspace_id: Optional[str] = Field(
        None,
        description="Optional Log Analytics workspace resource ID for detailed logs",
    )


# ── Response schemas ────────────────────────────────────────────
class DeploymentOut(BaseModel):
    account: str
    resource_group: str
    location: str
    deployment: str
    model_name: str
    model_version: str
    sku: str
    capacity: Optional[int] = None
    resource_id: str = ""
    deployment_type: str = Field("Standard", description="Standard | PTU | GlobalStandard | ProvisionedManaged | GlobalProvisionedManaged | DataZone")


class TargetedDeploymentOut(DeploymentOut):
    total_calls_7d: int = 0
    processed_tokens_7d: int = 0
    generated_tokens_7d: int = 0


class DetailedLogOut(BaseModel):
    workspace_id: str
    time_generated: str
    resource_id: str
    operation: str
    caller_ip: str
    identity: str
    user_agent: str
    properties: str


class NoDiagnosticsOut(BaseModel):
    resource_group: str
    account: str
    resource_id: str


class ScanResultOut(BaseModel):
    subscription_id: str
    scanned_at: str
    accounts_found: int
    total_deployments: int
    all_deployments: List[DeploymentOut]
    targeted_deployments: List[TargetedDeploymentOut]
    no_diagnostics: List[NoDiagnosticsOut]
    detailed_logs: List[DetailedLogOut]


# ── Lightweight list endpoints ──────────────────────────────────
class AccountOut(BaseModel):
    name: str
    resource_group: str
    location: str
    resource_id: str


class MetricsOut(BaseModel):
    total_calls: int = 0
    processed_tokens: int = 0
    generated_tokens: int = 0


# ── Subscription / Workspace discovery ──────────────────────────
class SubscriptionOut(BaseModel):
    subscription_id: str
    display_name: str
    state: str


class WorkspaceOut(BaseModel):
    id: str = Field(..., description="Full ARM resource ID")
    name: str
    resource_group: str
    location: str


# ── Test Deployment ─────────────────────────────────────────────
class TestDeploymentRequest(BaseModel):
    """Request to run a quick test on a discovered deployment."""
    resource_id: str = Field(..., description="Full ARM resource ID of the OpenAI account")
    deployment_name: str = Field(..., description="Deployment name to test")
    prompt: str = Field("Hello, can you confirm you're working correctly?", description="Test prompt to send")
    system_message: Optional[str] = Field(None, description="Optional system message")
    max_tokens: int = Field(100, ge=1, le=4096, description="Max tokens for response")


class TestDeploymentResult(BaseModel):
    """Result of a quick deployment test."""
    deployment_name: str
    model_name: str
    model_version: str
    prompt: str
    response: str
    latency_ms: float
    tokens_prompt: int
    tokens_completion: int
    success: bool
    error: Optional[str] = None
