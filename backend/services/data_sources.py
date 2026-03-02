"""
Data Source Connectors Service.

Pull data from external environment sources to feed golden datasets & RAG pipeline:
  - Azure Log Analytics  (KQL queries)
  - Azure Cosmos DB      (SQL queries)
  - Azure Blob Storage   (JSON / CSV / JSONL blobs)
  - HTTP / REST endpoint (any URL returning JSON)
"""

from __future__ import annotations

import csv
import io
import json
import logging
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ── Source Types ────────────────────────────────────────────────
class DataSourceType(str, Enum):
    LOG_ANALYTICS = "log_analytics"
    COSMOS_DB = "cosmos_db"
    BLOB_STORAGE = "blob_storage"
    HTTP = "http"


@dataclass
class DataSourceResult:
    """Unified result from any data source."""
    source_type: str
    record_count: int
    records: List[Dict[str, Any]]
    metadata: Dict[str, Any]


# ── Azure Log Analytics ────────────────────────────────────────
async def fetch_log_analytics(
    workspace_id: str,
    query: str,
    timespan: str = "P7D",
) -> DataSourceResult:
    """
    Execute a KQL query against an Azure Log Analytics workspace.
    Uses DefaultAzureCredential (Azure CLI / managed identity).
    """
    try:
        from azure.identity import DefaultAzureCredential
        from azure.monitor.query import LogsQueryClient, LogsQueryStatus
    except ImportError:
        raise RuntimeError(
            "azure-identity and azure-monitor-query are required. "
            "Install with: pip install azure-identity azure-monitor-query"
        )

    credential = DefaultAzureCredential()
    client = LogsQueryClient(credential)

    response = client.query_workspace(
        workspace_id=workspace_id,
        query=query,
        timespan=timespan,
    )

    records: List[Dict[str, Any]] = []
    if response.status == LogsQueryStatus.SUCCESS:
        for table in response.tables:
            columns = [col.name for col in table.columns]
            for row in table.rows:
                record = {}
                for col_name, value in zip(columns, row):
                    # Convert non-serialisable types to str
                    if hasattr(value, "isoformat"):
                        record[col_name] = value.isoformat()
                    else:
                        record[col_name] = value
                records.append(record)
    elif response.status == LogsQueryStatus.PARTIAL:
        for table in response.partial_data:
            columns = [col.name for col in table.columns]
            for row in table.rows:
                record = {}
                for col_name, value in zip(columns, row):
                    if hasattr(value, "isoformat"):
                        record[col_name] = value.isoformat()
                    else:
                        record[col_name] = value
                records.append(record)
        logger.warning("Log Analytics returned partial results: %s", response.partial_error)
    else:
        raise RuntimeError(f"Log Analytics query failed: {response}")

    return DataSourceResult(
        source_type=DataSourceType.LOG_ANALYTICS,
        record_count=len(records),
        records=records,
        metadata={
            "workspace_id": workspace_id,
            "query": query,
            "timespan": timespan,
        },
    )


# ── Azure Cosmos DB ────────────────────────────────────────────
async def fetch_cosmos_db(
    endpoint: str,
    database_name: str,
    container_name: str,
    query: str = "SELECT * FROM c",
    key: Optional[str] = None,
    max_items: int = 1000,
) -> DataSourceResult:
    """
    Execute a SQL query against an Azure Cosmos DB container.
    Supports both key-based and DefaultAzureCredential auth.
    """
    try:
        from azure.cosmos import CosmosClient
    except ImportError:
        raise RuntimeError(
            "azure-cosmos is required. Install with: pip install azure-cosmos"
        )

    if key:
        client = CosmosClient(endpoint, credential=key)
    else:
        try:
            from azure.identity import DefaultAzureCredential
            credential = DefaultAzureCredential()
            client = CosmosClient(endpoint, credential=credential)
        except Exception:
            raise RuntimeError(
                "No Cosmos DB key provided and DefaultAzureCredential failed. "
                "Set a key or log in via Azure CLI."
            )

    database = client.get_database_client(database_name)
    container = database.get_container_client(container_name)

    items = list(container.query_items(
        query=query,
        max_item_count=max_items,
    ))

    # Strip internal Cosmos fields
    records = []
    for item in items[:max_items]:
        clean = {k: v for k, v in item.items() if not k.startswith("_")}
        records.append(clean)

    return DataSourceResult(
        source_type=DataSourceType.COSMOS_DB,
        record_count=len(records),
        records=records,
        metadata={
            "endpoint": endpoint,
            "database": database_name,
            "container": container_name,
            "query": query,
        },
    )


# ── Azure Blob Storage ────────────────────────────────────────
async def fetch_blob_storage(
    account_url: str,
    container_name: str,
    blob_name: str,
    connection_string: Optional[str] = None,
) -> DataSourceResult:
    """
    Download a JSON / JSONL / CSV blob and parse into records.
    """
    try:
        from azure.storage.blob import BlobServiceClient
    except ImportError:
        raise RuntimeError(
            "azure-storage-blob is required. Install with: pip install azure-storage-blob"
        )

    if connection_string:
        service = BlobServiceClient.from_connection_string(connection_string)
    else:
        try:
            from azure.identity import DefaultAzureCredential
            credential = DefaultAzureCredential()
            service = BlobServiceClient(account_url, credential=credential)
        except Exception:
            raise RuntimeError("No connection string and DefaultAzureCredential failed.")

    blob_client = service.get_blob_client(container=container_name, blob=blob_name)
    raw = blob_client.download_blob().readall()
    text = raw.decode("utf-8-sig")

    records = _parse_text(text, blob_name)

    return DataSourceResult(
        source_type=DataSourceType.BLOB_STORAGE,
        record_count=len(records),
        records=records,
        metadata={
            "account_url": account_url,
            "container": container_name,
            "blob": blob_name,
        },
    )


# ── HTTP / REST ────────────────────────────────────────────────
async def fetch_http(
    url: str,
    method: str = "GET",
    headers: Optional[Dict[str, str]] = None,
    body: Optional[Dict[str, Any]] = None,
    jmespath_expr: Optional[str] = None,
) -> DataSourceResult:
    """
    Call any HTTP endpoint and parse the JSON response into records.
    Optionally apply a JMESPath expression to extract an array from the response.
    """
    import httpx

    async with httpx.AsyncClient(timeout=60) as client:
        if method.upper() == "GET":
            resp = await client.get(url, headers=headers)
        else:
            resp = await client.post(url, headers=headers, json=body)

    resp.raise_for_status()
    data = resp.json()

    # Extract records from the response
    if jmespath_expr:
        try:
            import jmespath as jmp
            data = jmp.search(jmespath_expr, data)
        except ImportError:
            # Fallback: simple key path (e.g. "value" or "data.items")
            for key in jmespath_expr.split("."):
                if isinstance(data, dict):
                    data = data.get(key, data)

    if isinstance(data, list):
        records = [r if isinstance(r, dict) else {"value": r} for r in data]
    elif isinstance(data, dict):
        records = [data]
    else:
        records = [{"value": data}]

    return DataSourceResult(
        source_type=DataSourceType.HTTP,
        record_count=len(records),
        records=records,
        metadata={"url": url, "method": method},
    )


# ── Helpers ────────────────────────────────────────────────────
def _parse_text(text: str, filename: str) -> List[Dict[str, Any]]:
    """Parse text as JSON, JSONL, or CSV based on file extension."""
    lower = filename.lower()
    if lower.endswith(".jsonl") or lower.endswith(".ndjson"):
        records = []
        for line in text.strip().splitlines():
            line = line.strip()
            if line:
                records.append(json.loads(line))
        return records
    elif lower.endswith(".csv"):
        reader = csv.DictReader(io.StringIO(text))
        return [dict(row) for row in reader]
    else:
        # Try JSON
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return parsed
        return [parsed]


def records_to_golden_cases(
    records: List[Dict[str, Any]],
    mapping: Optional[Dict[str, str]] = None,
) -> List[Dict[str, Any]]:
    """
    Transform raw records into golden test case format.

    mapping: allows users to specify which source field maps to which golden field.
    e.g. {"question": "user_query", "expected_answer": "bot_response", "context": "session_context"}
    """
    if not mapping:
        # Auto-detect common field patterns
        mapping = _auto_detect_mapping(records[0] if records else {})

    cases = []
    for rec in records:
        case: Dict[str, Any] = {}
        for golden_field, source_field in mapping.items():
            if source_field in rec:
                case[golden_field] = rec[source_field]
        # Must have at least a question
        if case.get("question"):
            cases.append(case)
    return cases


def records_to_rag_documents(
    records: List[Dict[str, Any]],
    id_field: str = "id",
    text_field: str = "text",
) -> List[Dict[str, Any]]:
    """
    Transform raw records into RAG document format {id, text, metadata}.
    """
    docs = []
    for idx, rec in enumerate(records):
        doc_id = str(rec.get(id_field, f"doc-{idx}"))
        # Build text from specified field or concatenate all string fields
        text = rec.get(text_field)
        if not text:
            # Concatenate all string values
            parts = []
            for k, v in rec.items():
                if isinstance(v, str) and v.strip():
                    parts.append(f"{k}: {v}")
            text = "\n".join(parts)
        metadata = {k: v for k, v in rec.items() if k not in (id_field, text_field)}
        docs.append({"id": doc_id, "text": text, "metadata": metadata})
    return docs


def _auto_detect_mapping(sample: Dict[str, Any]) -> Dict[str, str]:
    """Best-effort mapping from source fields → golden dataset fields."""
    mapping: Dict[str, str] = {}
    keys_lower = {k.lower(): k for k in sample}

    # Question patterns
    for pattern in ("question", "query", "user_query", "input", "prompt", "user_message", "request"):
        if pattern in keys_lower:
            mapping["question"] = keys_lower[pattern]
            break

    # Expected answer patterns
    for pattern in ("expected_answer", "answer", "response", "bot_response", "output",
                    "assistant_message", "completion", "expected_output", "ground_truth"):
        if pattern in keys_lower:
            mapping["expected_answer"] = keys_lower[pattern]
            break

    # Context
    for pattern in ("context", "session_context", "system_prompt", "system_message", "background"):
        if pattern in keys_lower:
            mapping["context"] = keys_lower[pattern]
            break

    # Category
    for pattern in ("category", "type", "topic", "domain", "intent"):
        if pattern in keys_lower:
            mapping["category"] = keys_lower[pattern]
            break

    # Difficulty
    for pattern in ("difficulty", "level", "complexity"):
        if pattern in keys_lower:
            mapping["difficulty"] = keys_lower[pattern]
            break

    return mapping
