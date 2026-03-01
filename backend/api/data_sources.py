"""
Data Source API routes.

Pull data from external environment sources for golden datasets & RAG ingestion.

POST /data-sources/log-analytics   → query Azure Log Analytics
POST /data-sources/cosmos-db       → query Azure Cosmos DB
POST /data-sources/blob-storage    → fetch Azure Blob Storage
POST /data-sources/http            → call any HTTP/REST endpoint
POST /data-sources/preview         → auto-detect field mapping for golden datasets
POST /data-sources/to-golden       → convert records → golden dataset
POST /data-sources/to-rag          → convert records → RAG documents & ingest
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.schemas.golden_dataset import GoldenDatasetCreate, GoldenTestCaseInput
from backend.services.data_sources import (
    DataSourceType,
    fetch_blob_storage,
    fetch_cosmos_db,
    fetch_http,
    fetch_log_analytics,
    records_to_golden_cases,
    records_to_rag_documents,
    _auto_detect_mapping,
)
from backend.services.golden_dataset import create_golden_dataset

router = APIRouter(prefix="/data-sources", tags=["Data Sources"])
logger = logging.getLogger(__name__)


# ── Request schemas ────────────────────────────────────────────
class LogAnalyticsRequest(BaseModel):
    workspace_id: str = Field(..., description="Azure Log Analytics workspace ID (GUID)")
    query: str = Field(..., description="KQL query string")
    timespan: str = Field("P7D", description="ISO 8601 duration (e.g. P1D, P7D, PT1H)")


class CosmosDBRequest(BaseModel):
    endpoint: str = Field(..., description="Cosmos DB account endpoint URL")
    database_name: str = Field(..., description="Database name")
    container_name: str = Field(..., description="Container name")
    query: str = Field("SELECT * FROM c", description="SQL query")
    key: Optional[str] = Field(None, description="Cosmos DB account key (or uses DefaultAzureCredential)")
    max_items: int = Field(1000, ge=1, le=10000)


class BlobStorageRequest(BaseModel):
    account_url: str = Field(..., description="Storage account URL (https://<name>.blob.core.windows.net)")
    container_name: str = Field(..., description="Blob container name")
    blob_name: str = Field(..., description="Blob path (e.g. data/questions.jsonl)")
    connection_string: Optional[str] = Field(None, description="Connection string (or uses DefaultAzureCredential)")


class HttpRequest(BaseModel):
    url: str = Field(..., description="HTTP endpoint URL")
    method: str = Field("GET", description="HTTP method (GET or POST)")
    headers: Optional[Dict[str, str]] = None
    body: Optional[Dict[str, Any]] = None
    jmespath_expr: Optional[str] = Field(None, description="JMESPath or dot-path to extract array from response")


class FieldMappingPreview(BaseModel):
    records: List[Dict[str, Any]] = Field(..., min_length=1, description="Sample records to auto-detect mapping")


class ToGoldenRequest(BaseModel):
    records: List[Dict[str, Any]] = Field(..., min_length=1)
    dataset_name: str = Field(..., min_length=1)
    description: str = Field("")
    source_type: str = Field("")
    mapping: Optional[Dict[str, str]] = Field(None, description="Field mapping: golden_field → source_field")


class ToRAGRequest(BaseModel):
    records: List[Dict[str, Any]] = Field(..., min_length=1)
    id_field: str = Field("id", description="Field to use as document ID")
    text_field: str = Field("text", description="Field to use as document text")
    chunk_size: int = Field(512, ge=50, le=4096)
    chunk_overlap: int = Field(64, ge=0, le=1024)


# ── Endpoints ──────────────────────────────────────────────────
@router.post("/log-analytics")
async def query_log_analytics(payload: LogAnalyticsRequest):
    """Execute a KQL query against Azure Log Analytics and return records."""
    try:
        result = await fetch_log_analytics(
            workspace_id=payload.workspace_id,
            query=payload.query,
            timespan=payload.timespan,
        )
        return {
            "source_type": result.source_type,
            "record_count": result.record_count,
            "records": result.records,
            "metadata": result.metadata,
        }
    except Exception as e:
        logger.exception("Log Analytics fetch failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cosmos-db")
async def query_cosmos_db(payload: CosmosDBRequest):
    """Execute a SQL query against Azure Cosmos DB and return records."""
    try:
        result = await fetch_cosmos_db(
            endpoint=payload.endpoint,
            database_name=payload.database_name,
            container_name=payload.container_name,
            query=payload.query,
            key=payload.key,
            max_items=payload.max_items,
        )
        return {
            "source_type": result.source_type,
            "record_count": result.record_count,
            "records": result.records,
            "metadata": result.metadata,
        }
    except Exception as e:
        logger.exception("Cosmos DB fetch failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/blob-storage")
async def query_blob_storage(payload: BlobStorageRequest):
    """Download and parse a blob (JSON/JSONL/CSV) from Azure Blob Storage."""
    try:
        result = await fetch_blob_storage(
            account_url=payload.account_url,
            container_name=payload.container_name,
            blob_name=payload.blob_name,
            connection_string=payload.connection_string,
        )
        return {
            "source_type": result.source_type,
            "record_count": result.record_count,
            "records": result.records,
            "metadata": result.metadata,
        }
    except Exception as e:
        logger.exception("Blob Storage fetch failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/http")
async def query_http(payload: HttpRequest):
    """Call an HTTP/REST endpoint and parse JSON response into records."""
    try:
        result = await fetch_http(
            url=payload.url,
            method=payload.method,
            headers=payload.headers,
            body=payload.body,
            jmespath_expr=payload.jmespath_expr,
        )
        return {
            "source_type": result.source_type,
            "record_count": result.record_count,
            "records": result.records,
            "metadata": result.metadata,
        }
    except Exception as e:
        logger.exception("HTTP fetch failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/preview")
async def preview_mapping(payload: FieldMappingPreview):
    """Auto-detect field mapping from sample records for golden dataset conversion."""
    sample = payload.records[0]
    mapping = _auto_detect_mapping(sample)
    available_fields = list(sample.keys())
    return {
        "detected_mapping": mapping,
        "available_fields": available_fields,
        "golden_fields": ["question", "expected_answer", "context", "category", "difficulty", "language"],
        "sample_record": sample,
    }


@router.post("/to-golden")
async def convert_to_golden(payload: ToGoldenRequest):
    """Convert fetched records into a golden dataset and persist it."""
    cases_raw = records_to_golden_cases(payload.records, payload.mapping)
    if not cases_raw:
        raise HTTPException(status_code=400, detail="No valid cases found. Ensure records have a 'question' field or provide a mapping.")

    cases = [GoldenTestCaseInput(**c) for c in cases_raw]
    ds_payload = GoldenDatasetCreate(
        name=payload.dataset_name,
        description=payload.description or f"Imported from {payload.source_type}",
        tags={"source": payload.source_type},
        cases=cases,
    )
    dataset = await create_golden_dataset(ds_payload)
    return {
        "status": "ok",
        "dataset_id": dataset.get("id"),
        "dataset_name": dataset.get("name"),
        "cases_imported": len(cases),
        "cases_skipped": len(payload.records) - len(cases),
    }


@router.post("/to-rag")
async def convert_to_rag(payload: ToRAGRequest):
    """Convert fetched records into RAG documents and ingest them into the vector store."""
    from backend.api.rag import _pipeline
    from backend.services.rag_pipeline import Document

    docs_raw = records_to_rag_documents(
        payload.records,
        id_field=payload.id_field,
        text_field=payload.text_field,
    )
    if not docs_raw:
        raise HTTPException(status_code=400, detail="No documents could be created from the records.")

    _pipeline.chunk_size = payload.chunk_size
    _pipeline.chunk_overlap = payload.chunk_overlap

    documents = [
        Document(id=d["id"], text=d["text"], metadata=d.get("metadata", {}))
        for d in docs_raw
    ]
    num_chunks = _pipeline.ingest_documents(documents)

    return {
        "status": "ok",
        "documents_ingested": len(documents),
        "chunks_created": num_chunks,
        "source": "data_source_import",
    }
