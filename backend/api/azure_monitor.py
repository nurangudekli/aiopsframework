"""
Azure OpenAI Deployment Monitor — API routes.

Provides endpoints for subscription-level scanning of Azure OpenAI
accounts, deployment listing, metrics retrieval, and Log Analytics queries.
Inspired by github.com/pbubacz/ai-version-manager.
"""

from __future__ import annotations

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from backend.schemas.azure_monitor import (
    AccountOut,
    DeploymentOut,
    MetricsOut,
    ScanRequest,
    ScanResultOut,
    SubscriptionOut,
    TargetedDeploymentOut,
    TestDeploymentRequest,
    TestDeploymentResult,
    WorkspaceOut,
)
from backend.services.azure_monitor import (
    AzureOpenAIScanner,
    TargetModel,
)

router = APIRouter(prefix="/azure-monitor", tags=["Azure Monitor"])
logger = logging.getLogger(__name__)


# ── List Azure subscriptions ────────────────────────────────────
@router.get("/subscriptions", response_model=List[SubscriptionOut], summary="List Azure subscriptions")
async def list_subscriptions():
    """Return all Azure subscriptions accessible to the current credential."""
    from azure.mgmt.subscription import SubscriptionClient
    from backend.services.azure_monitor import get_azure_credential

    def _do_list():
        credential = get_azure_credential()
        client = SubscriptionClient(credential)
        subs = []
        for s in client.subscriptions.list():
            subs.append({
                "subscription_id": s.subscription_id,
                "display_name": s.display_name or s.subscription_id,
                "state": str(s.state) if s.state else "Unknown",
            })
        return subs

    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(_do_list),
            timeout=30.0,
        )
        return result
    except asyncio.TimeoutError:
        logger.error("List subscriptions timed out")
        raise HTTPException(status_code=504, detail="Request timed out. Check Azure credentials (run 'az login').")
    except Exception as exc:
        logger.exception("Failed to list subscriptions")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ── List Log Analytics workspaces ───────────────────────────────
@router.get("/workspaces", response_model=List[WorkspaceOut], summary="List Log Analytics workspaces")
async def list_workspaces(subscription_id: str = Query(...)):
    """Return all Log Analytics workspaces in the given subscription."""
    from azure.mgmt.loganalytics import LogAnalyticsManagementClient
    from backend.services.azure_monitor import get_azure_credential

    def _do_list():
        credential = get_azure_credential()
        client = LogAnalyticsManagementClient(credential, subscription_id)
        workspaces = []
        for w in client.workspaces.list():
            workspaces.append({
                "id": w.id or "",
                "name": w.name or "",
                "resource_group": (w.id or "").split("/")[4] if w.id and len((w.id or "").split("/")) > 4 else "",
                "location": w.location or "",
            })
        return workspaces
    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(_do_list),
            timeout=30.0,
        )
        return result
    except asyncio.TimeoutError:
        logger.error("List workspaces timed out")
        raise HTTPException(status_code=504, detail="Request timed out.")
    except Exception as exc:
        logger.exception("Failed to list workspaces")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ── Full subscription scan ──────────────────────────────────────
@router.post("/scan", response_model=ScanResultOut, summary="Full subscription audit")
async def scan_subscription(req: ScanRequest):
    """
    Scan an entire Azure subscription for OpenAI accounts, deployments,
    and usage metrics.
    """
    def _do_scan():
        scanner = AzureOpenAIScanner(req.subscription_id)
        targets = (
            [TargetModel(model_name=t.model_name, versions=t.versions) for t in req.target_models]
            if req.target_models
            else None
        )
        return scanner.scan(
            target_models=targets,
            log_analytics_workspace_id=req.log_analytics_workspace_id,
        )

    try:
        # Run in thread pool to avoid blocking async loop, with 120s timeout
        result = await asyncio.wait_for(
            asyncio.to_thread(_do_scan),
            timeout=120.0,
        )
        return result
    except asyncio.TimeoutError:
        logger.error("Scan timed out after 120 seconds")
        raise HTTPException(status_code=504, detail="Scan timed out. Check Azure credentials and subscription access.")
    except Exception as exc:
        logger.exception("Scan failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ── List accounts ───────────────────────────────────────────────
@router.get("/accounts", response_model=List[AccountOut], summary="List OpenAI accounts")
async def list_accounts(subscription_id: str = Query(...)):
    """Return all Azure OpenAI accounts in the given subscription."""
    def _do_list():
        scanner = AzureOpenAIScanner(subscription_id)
        return scanner.list_openai_accounts()

    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(_do_list),
            timeout=60.0,
        )
        return result
    except asyncio.TimeoutError:
        logger.error("List accounts timed out")
        raise HTTPException(status_code=504, detail="Request timed out. Check Azure credentials.")
    except Exception as exc:
        logger.exception("Failed to list accounts")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ── List deployments for one account ────────────────────────────
@router.get("/deployments", response_model=List[DeploymentOut], summary="List deployments")
async def list_deployments(
    subscription_id: str = Query(...),
    resource_group: str = Query(...),
    account_name: str = Query(...),
):
    """List all deployments for a single Azure OpenAI account."""
    try:
        scanner = AzureOpenAIScanner(subscription_id)
        deps = scanner.list_deployments(resource_group, account_name)
        return deps
    except Exception as exc:
        logger.exception("Failed to list deployments")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ── List ALL deployments across all accounts ────────────────────
@router.get("/all-deployments", response_model=List[DeploymentOut], summary="List all deployments in subscription")
async def list_all_deployments(subscription_id: str = Query(...)):
    """Discover all OpenAI / AIServices accounts and return every deployment."""
    def _do_list():
        scanner = AzureOpenAIScanner(subscription_id)
        accounts = scanner.list_openai_accounts()
        all_deps: list = []
        for acc in accounts:
            deps = scanner.list_deployments(acc["resource_group"], acc["name"])
            for d in deps:
                d.location = acc.get("location", "")
            all_deps.extend(deps)
        return all_deps

    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(_do_list),
            timeout=60.0,
        )
        return result
    except asyncio.TimeoutError:
        logger.error("List all deployments timed out")
        raise HTTPException(status_code=504, detail="Request timed out.")
    except Exception as exc:
        logger.exception("Failed to list all deployments")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ── Get metrics for one deployment ──────────────────────────────
@router.get("/metrics", response_model=MetricsOut, summary="Get deployment metrics")
async def get_deployment_metrics(
    subscription_id: str = Query(...),
    resource_id: str = Query(..., description="Full ARM resource ID of the OpenAI account"),
    deployment_name: str = Query(...),
    model_name: str = Query(...),
    days: int = Query(7, ge=1, le=90),
):
    """Retrieve Azure Monitor usage metrics for a specific deployment."""
    try:
        scanner = AzureOpenAIScanner(subscription_id)
        m = scanner.get_deployment_metrics(resource_id, deployment_name, model_name, days)
        return MetricsOut(
            total_calls=m.total_calls,
            processed_tokens=m.processed_tokens,
            generated_tokens=m.generated_tokens,
        )
    except Exception as exc:
        logger.exception("Failed to retrieve metrics")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ── Test a discovered deployment ────────────────────────────────
@router.post("/test-deployment", response_model=TestDeploymentResult, summary="Test a deployment")
async def test_deployment(req: TestDeploymentRequest):
    """
    Send a test prompt to a discovered deployment to verify it's working.
    Uses Azure AD authentication via DefaultAzureCredential.
    """
    import time
    from openai import AzureOpenAI
    from azure.identity import DefaultAzureCredential, get_bearer_token_provider
    
    try:
        # Extract account name from resource_id
        # Deployment format: /subscriptions/.../resourceGroups/.../providers/Microsoft.CognitiveServices/accounts/{account}/deployments/{deployment}
        # Account format: /subscriptions/.../resourceGroups/.../providers/Microsoft.CognitiveServices/accounts/{account}
        parts = req.resource_id.split("/")
        
        # Find the 'accounts' segment and get the next element
        account_name = "unknown"
        for i, part in enumerate(parts):
            if part.lower() == "accounts" and i + 1 < len(parts):
                account_name = parts[i + 1]
                break
        
        # Build endpoint - AIServices uses cognitiveservices.azure.com
        endpoint = f"https://{account_name}.cognitiveservices.azure.com"
        logger.info(f"Testing deployment {req.deployment_name} at {endpoint}")
        
        # Use Azure AD token-based authentication (works with az login)
        credential = DefaultAzureCredential()
        token_provider = get_bearer_token_provider(
            credential, "https://cognitiveservices.azure.com/.default"
        )
        
        client = AzureOpenAI(
            azure_endpoint=endpoint,
            azure_ad_token_provider=token_provider,
            api_version="2024-06-01",
        )
        
        start = time.perf_counter()
        response = client.chat.completions.create(
            model=req.deployment_name,
            messages=[
                {"role": "system", "content": req.system_message or "You are a helpful assistant."},
                {"role": "user", "content": req.prompt},
            ],
            max_tokens=req.max_tokens,
        )
        latency = (time.perf_counter() - start) * 1000
        
        return TestDeploymentResult(
            deployment_name=req.deployment_name,
            model_name=response.model or "unknown",
            model_version="unknown",
            prompt=req.prompt,
            response=response.choices[0].message.content or "",
            latency_ms=round(latency, 2),
            tokens_prompt=response.usage.prompt_tokens if response.usage else 0,
            tokens_completion=response.usage.completion_tokens if response.usage else 0,
            success=True,
            error=None,
        )
    except Exception as exc:
        logger.exception("Test deployment failed")
        return TestDeploymentResult(
            deployment_name=req.deployment_name,
            model_name="unknown",
            model_version="unknown",
            prompt=req.prompt,
            response="",
            latency_ms=0,
            tokens_prompt=0,
            tokens_completion=0,
            success=False,
            error=str(exc),
        )
