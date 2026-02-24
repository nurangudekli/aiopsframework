"""
Azure OpenAI Deployment Scanner & Metrics Service.

Inspired by github.com/pbubacz/ai-version-manager, re-implemented in Python
using the Azure SDK.  Provides:

  - Discover all Azure OpenAI (Cognitive Services kind=OpenAI) accounts
  - List every deployment inside those accounts
  - Identify deployments matching configurable target models / versions
  - Retrieve 7-day usage metrics from Azure Monitor
    (API calls, prompt tokens, generated tokens)
  - Optionally query Log Analytics for detailed audit logs
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from azure.identity import DefaultAzureCredential, AzureCliCredential, ChainedTokenCredential
from azure.mgmt.cognitiveservices import CognitiveServicesManagementClient
from azure.mgmt.monitor import MonitorManagementClient
from azure.monitor.query import LogsQueryClient, LogsQueryStatus

logger = logging.getLogger(__name__)


def get_azure_credential():
    """
    Get Azure credential with optimized auth chain.
    Prioritizes: Environment vars → Azure CLI → Default chain
    """
    # Check if running with explicit credentials
    if os.environ.get("AZURE_CLIENT_ID") and os.environ.get("AZURE_CLIENT_SECRET"):
        logger.info("Using environment variable credentials (Service Principal)")
        return DefaultAzureCredential(
            exclude_interactive_browser_credential=True,
            exclude_visual_studio_code_credential=True,
            exclude_managed_identity_credential=True,
        )
    
    # Try Azure CLI first (fastest for local dev), then fall back to other methods
    logger.info("Using Azure CLI credentials (run 'az login' if not authenticated)")
    try:
        return ChainedTokenCredential(
            AzureCliCredential(),
            DefaultAzureCredential(
                exclude_interactive_browser_credential=True,
                exclude_visual_studio_code_credential=True,
            )
        )
    except Exception:
        return DefaultAzureCredential()


# ── Data classes ────────────────────────────────────────────────
@dataclass
class DeploymentInfo:
    account: str
    resource_group: str
    location: str
    deployment: str
    model_name: str
    model_version: str
    sku: str
    capacity: Optional[int] = None
    resource_id: str = ""
    deployment_type: str = "Standard"  # Standard | PTU | ProvisionedManaged | GlobalStandard | GlobalProvisionedManaged | DataZone


@dataclass
class DeploymentMetrics:
    total_calls: int = 0
    processed_tokens: int = 0
    generated_tokens: int = 0


@dataclass
class TargetedDeployment:
    """A deployment matching the target filter, enriched with metrics."""
    info: DeploymentInfo
    metrics: DeploymentMetrics = field(default_factory=DeploymentMetrics)


@dataclass
class DetailedLog:
    workspace_id: str
    time_generated: str
    resource_id: str
    operation: str
    caller_ip: str
    identity: str
    user_agent: str
    properties: str


@dataclass
class TargetModel:
    model_name: str
    versions: List[str]


@dataclass
class ScanResult:
    subscription_id: str
    scanned_at: str
    accounts_found: int
    total_deployments: int
    all_deployments: List[dict]
    targeted_deployments: List[dict]
    no_diagnostics: List[dict]
    detailed_logs: List[dict]


# ── Service ─────────────────────────────────────────────────────
class AzureOpenAIScanner:
    """Scans Azure OpenAI resources in a subscription."""

    def __init__(self, subscription_id: str) -> None:
        self.subscription_id = subscription_id
        logger.info(f"Initializing Azure scanner for subscription {subscription_id[:8]}...")
        self.credential = get_azure_credential()
        logger.info("Creating Cognitive Services client...")
        self.cs_client = CognitiveServicesManagementClient(
            self.credential, subscription_id,
        )
        logger.info("Creating Monitor client...")
        self.monitor_client = MonitorManagementClient(
            self.credential, subscription_id,
        )

    # ── Account discovery ───────────────────────────────────────
    def list_openai_accounts(self) -> List[dict]:
        """Return all Cognitive Services accounts of kind 'OpenAI'."""
        accounts = []
        logger.info("Listing Cognitive Services accounts...")
        try:
            for acc in self.cs_client.accounts.list():
                # Include both 'OpenAI' and 'AIServices' kinds (AIServices is the newer unified resource)
                kind = getattr(acc, "kind", "")
                if kind in ("OpenAI", "AIServices"):
                    accounts.append({
                        "name": acc.name,
                        "resource_group": acc.id.split("/")[4] if acc.id else "",
                        "location": acc.location,
                        "resource_id": acc.id,
                        "kind": kind,
                    })
            logger.info(f"Found {len(accounts)} OpenAI/AIServices account(s)")
        except Exception as exc:
            logger.error(f"Failed to list accounts: {exc}")
            raise
        return accounts

    # ── Deployment listing ──────────────────────────────────────
    def list_deployments(self, resource_group: str, account_name: str) -> List[DeploymentInfo]:
        """List all deployments for one OpenAI account."""
        deps: List[DeploymentInfo] = []
        try:
            for d in self.cs_client.deployments.list(resource_group, account_name):
                model = d.properties.model if d.properties else None
                sku_name = d.sku.name if d.sku else ""
                # Derive deployment type from SKU
                _PTU_SKUS = {"ProvisionedManaged", "GlobalProvisionedManaged"}
                dep_type = "PTU" if sku_name in _PTU_SKUS else (
                    sku_name if sku_name in {"GlobalStandard", "DataZone"} else "Standard"
                )
                deps.append(DeploymentInfo(
                    account=account_name,
                    resource_group=resource_group,
                    location="",  # filled by caller
                    deployment=d.name or "",
                    model_name=model.name if model else "",
                    model_version=model.version if model else "",
                    sku=sku_name,
                    capacity=d.sku.capacity if d.sku else None,
                    resource_id=d.id or "",
                    deployment_type=dep_type,
                ))
        except Exception as exc:
            logger.warning("Failed to list deployments for %s/%s: %s", resource_group, account_name, exc)
        return deps

    # ── Metrics retrieval ───────────────────────────────────────
    def get_deployment_metrics(
        self,
        resource_id: str,
        deployment_name: str,
        model_name: str,
        days: int = 7,
    ) -> DeploymentMetrics:
        """Retrieve usage metrics from Azure Monitor for a single deployment."""
        end = datetime.now(timezone.utc)
        start = end - timedelta(days=days)
        timespan = f"{start.isoformat()}/{end.isoformat()}"
        metrics = DeploymentMetrics()

        # -- Total API calls
        for metric_name in ("AzureOpenAIRequests", "Requests"):
            if metrics.total_calls > 0:
                break
            for dim_name, dim_value in [("DeploymentName", deployment_name), ("ModelName", model_name)]:
                if metrics.total_calls > 0:
                    break
                try:
                    resp = self.monitor_client.metrics.list(
                        resource_uri=resource_id,
                        timespan=timespan,
                        interval="PT1H",
                        metricnames=metric_name,
                        aggregation="Total",
                        filter=f"{dim_name} eq '{dim_value}'",
                    )
                    for ts in (resp.value or []):
                        for series in (ts.timeseries or []):
                            for dp in (series.data or []):
                                if dp.total:
                                    metrics.total_calls += int(dp.total)
                except Exception:
                    pass

        # -- Processed prompt tokens
        for dim_name, dim_value in [("DeploymentName", deployment_name), ("ModelName", model_name)]:
            if metrics.processed_tokens > 0:
                break
            try:
                resp = self.monitor_client.metrics.list(
                    resource_uri=resource_id,
                    timespan=timespan,
                    interval="PT1H",
                    metricnames="ProcessedPromptTokens",
                    aggregation="Total",
                    filter=f"{dim_name} eq '{dim_value}'",
                )
                for ts in (resp.value or []):
                    for series in (ts.timeseries or []):
                        for dp in (series.data or []):
                            if dp.total:
                                metrics.processed_tokens += int(dp.total)
            except Exception:
                pass

        # -- Generated completion tokens
        for dim_name, dim_value in [("DeploymentName", deployment_name), ("ModelName", model_name)]:
            if metrics.generated_tokens > 0:
                break
            try:
                resp = self.monitor_client.metrics.list(
                    resource_uri=resource_id,
                    timespan=timespan,
                    interval="PT1H",
                    metricnames="GeneratedTokens",
                    aggregation="Total",
                    filter=f"{dim_name} eq '{dim_value}'",
                )
                for ts in (resp.value or []):
                    for series in (ts.timeseries or []):
                        for dp in (series.data or []):
                            if dp.total:
                                metrics.generated_tokens += int(dp.total)
            except Exception:
                pass

        return metrics

    # ── Log Analytics query ─────────────────────────────────────
    def query_log_analytics(
        self,
        workspace_id: str,
        target_models: List[TargetModel],
        days: int = 7,
    ) -> List[DetailedLog]:
        """Query Log Analytics workspace for detailed audit/request logs."""
        logs_client = LogsQueryClient(self.credential)

        model_filter_parts = []
        versions_all = []
        for t in target_models:
            model_filter_parts.append(f'Props has "{t.model_name}"')
            versions_all.extend(t.versions)

        model_filter = " or ".join(model_filter_parts) if model_filter_parts else "true"
        versions_csv = ", ".join(f'"{v}"' for v in versions_all)

        kql = f"""
        AzureDiagnostics
        | where ResourceProvider == "MICROSOFT.COGNITIVESERVICES"
        | extend Props = coalesce(
            tostring(column_ifexists("properties_s","")),
            tostring(column_ifexists("Properties_s","")),
            tostring(column_ifexists("Properties","")),
            tostring(column_ifexists("properties",""))
          )
        | where {model_filter}
        | where Props has_any ({versions_csv})
        | extend CallerIP = tostring(column_ifexists("callerIp_s",""))
        | extend Identity = tostring(column_ifexists("identity_s",""))
        | extend UserAgent = tostring(column_ifexists("userAgent_s",""))
        | extend Op = coalesce(
            tostring(column_ifexists("operation_Name","")),
            tostring(column_ifexists("OperationName",""))
          )
        | project TimeGenerated, ResourceId=_ResourceId, Operation=Op,
                  CallerIP, Identity, UserAgent, Properties=Props
        | order by TimeGenerated desc
        | take 5000
        """

        end = datetime.now(timezone.utc)
        start = end - timedelta(days=days)

        results: List[DetailedLog] = []
        try:
            resp = logs_client.query_workspace(workspace_id, kql, timespan=(start, end))
            if resp.status == LogsQueryStatus.SUCCESS:
                for table in resp.tables:
                    for row in table.rows:
                        results.append(DetailedLog(
                            workspace_id=workspace_id,
                            time_generated=str(row[0]) if len(row) > 0 else "",
                            resource_id=str(row[1]) if len(row) > 1 else "",
                            operation=str(row[2]) if len(row) > 2 else "",
                            caller_ip=str(row[3]) if len(row) > 3 else "",
                            identity=str(row[4]) if len(row) > 4 else "",
                            user_agent=str(row[5]) if len(row) > 5 else "",
                            properties=str(row[6]) if len(row) > 6 else "",
                        ))
        except Exception as exc:
            logger.warning("Log Analytics query failed for workspace %s: %s", workspace_id, exc)
        return results

    # ── Full scan ───────────────────────────────────────────────
    def scan(
        self,
        target_models: Optional[List[TargetModel]] = None,
        log_analytics_workspace_id: Optional[str] = None,
    ) -> ScanResult:
        """
        Full subscription scan — discover all Azure OpenAI / AIServices
        accounts and deployments, with optional model-version filtering.
        When no target_models are given, all deployments get metrics.
        """

        logger.info("Scanning subscription %s for OpenAI/AIServices accounts…", self.subscription_id)
        accounts = self.list_openai_accounts()
        logger.info("Found %d OpenAI/AIServices account(s)", len(accounts))

        all_deployments: List[dict] = []
        targeted: List[dict] = []
        no_diag: List[dict] = []

        for acc in accounts:
            name = acc["name"]
            rg = acc["resource_group"]
            loc = acc["location"]
            rid = acc["resource_id"]

            # Check whether this account has diagnostic settings configured
            try:
                has_diag = False
                if hasattr(self.monitor_client, "diagnostic_settings"):
                    diag_iter = self.monitor_client.diagnostic_settings.list(resource_uri=rid)
                    settings = getattr(diag_iter, "value", None)
                    if settings is None:
                        settings = list(diag_iter)
                    has_diag = len(settings) > 0
                if not has_diag:
                    no_diag.append({
                        "resource_group": rg,
                        "account": name,
                        "resource_id": rid,
                    })
            except Exception as exc:
                logger.debug("Could not check diagnostic settings for %s: %s", name, exc)
                no_diag.append({
                    "resource_group": rg,
                    "account": name,
                    "resource_id": rid,
                })

            deps = self.list_deployments(rg, name)
            for d in deps:
                d.location = loc
                dep_dict = asdict(d)
                all_deployments.append(dep_dict)

                # If targets given — only enrich matching deployments
                # If no targets — enrich every deployment with metrics
                is_match = True
                if target_models:
                    is_match = any(
                        d.model_name == t.model_name and d.model_version in t.versions
                        for t in target_models
                    )

                if is_match:
                    logger.info("  → Fetching metrics for %s (%s %s)…",
                                d.deployment, d.model_name, d.model_version)
                    m = self.get_deployment_metrics(rid, d.deployment, d.model_name)
                    targeted.append({
                        **dep_dict,
                        "total_calls_7d": m.total_calls,
                        "processed_tokens_7d": m.processed_tokens,
                        "generated_tokens_7d": m.generated_tokens,
                    })

        # Log Analytics (optional)
        detailed_logs: List[dict] = []
        if log_analytics_workspace_id and target_models:
            logs = self.query_log_analytics(log_analytics_workspace_id, target_models)
            detailed_logs = [asdict(lg) for lg in logs]

        return ScanResult(
            subscription_id=self.subscription_id,
            scanned_at=datetime.now(timezone.utc).isoformat(),
            accounts_found=len(accounts),
            total_deployments=len(all_deployments),
            all_deployments=all_deployments,
            targeted_deployments=targeted,
            no_diagnostics=no_diag,
            detailed_logs=detailed_logs,
        )
