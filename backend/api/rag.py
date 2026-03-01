"""
RAG Pipeline API routes.

POST   /rag/ingest       → ingest documents (JSON)
POST   /rag/upload        → ingest a file (PDF, DOCX, TXT, CSV, JSON, Markdown)
POST   /rag/scrape        → scrape a URL and ingest the text
POST   /rag/query         → retrieve + generate
GET    /rag/stats         → vector store stats
DELETE /rag/store          → clear store
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel, Field

from backend.services.rag_pipeline import (
    Document,
    RAGPipeline,
    InMemoryVectorStore,
    parse_file_to_text,
    scrape_url,
)

router = APIRouter(prefix="/rag", tags=["RAG Pipeline"])

# Module-level pipeline instance (in production, use a persistent vector DB)
_pipeline = RAGPipeline(vector_store=InMemoryVectorStore())


class IngestRequest(BaseModel):
    documents: List[Dict[str, Any]] = Field(
        ...,
        min_length=1,
        description='Each dict must have "id" and "text"; optional "metadata".',
    )
    chunk_size: int = Field(512, ge=50, le=4096)
    chunk_overlap: int = Field(64, ge=0, le=1024)


class QueryRequest(BaseModel):
    question: str
    provider: str = "azure_openai"
    deployment: str = ""
    system_message: Optional[str] = None
    top_k: int = Field(5, ge=1, le=50)
    temperature: Optional[float] = Field(None, ge=0, le=2)
    max_tokens: Optional[int] = Field(None, ge=1, le=16000)


class ScrapeRequest(BaseModel):
    url: str
    doc_id: Optional[str] = None
    chunk_size: int = Field(512, ge=50, le=4096)
    chunk_overlap: int = Field(64, ge=0, le=1024)


@router.post("/ingest")
async def ingest(payload: IngestRequest):
    """Ingest documents into the RAG vector store."""
    _pipeline.chunk_size = payload.chunk_size
    _pipeline.chunk_overlap = payload.chunk_overlap

    docs = [
        Document(
            id=d["id"],
            text=d["text"],
            metadata=d.get("metadata", {}),
        )
        for d in payload.documents
    ]
    num_chunks = _pipeline.ingest_documents(docs)
    return {
        "status": "ok",
        "documents_ingested": len(docs),
        "chunks_created": num_chunks,
    }


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    doc_id: str = Form(""),
    chunk_size: int = Form(512),
    chunk_overlap: int = Form(64),
):
    """Upload and ingest a file (PDF, DOCX, TXT, CSV, JSON, MD)."""
    content = await file.read()
    text = parse_file_to_text(file.filename or "file.txt", content)

    final_id = doc_id or file.filename or str(uuid.uuid4())
    _pipeline.chunk_size = chunk_size
    _pipeline.chunk_overlap = chunk_overlap

    doc = Document(id=final_id, text=text, metadata={"source": "file_upload", "filename": file.filename})
    num_chunks = _pipeline.ingest_documents([doc])

    return {
        "status": "ok",
        "document_id": final_id,
        "filename": file.filename,
        "text_length": len(text),
        "documents_ingested": 1,
        "chunks_created": num_chunks,
    }


@router.post("/scrape")
async def scrape(payload: ScrapeRequest):
    """Scrape a URL and ingest the extracted text."""
    text = await scrape_url(payload.url)

    final_id = payload.doc_id or payload.url
    _pipeline.chunk_size = payload.chunk_size
    _pipeline.chunk_overlap = payload.chunk_overlap

    doc = Document(id=final_id, text=text, metadata={"source": "url_scrape", "url": payload.url})
    num_chunks = _pipeline.ingest_documents([doc])

    return {
        "status": "ok",
        "document_id": final_id,
        "url": payload.url,
        "text_length": len(text),
        "documents_ingested": 1,
        "chunks_created": num_chunks,
    }


@router.post("/query")
async def query(payload: QueryRequest):
    """Query the RAG pipeline: retrieve context + generate answer."""
    _pipeline.top_k = payload.top_k
    model_params: Dict[str, Any] = {}
    if payload.temperature is not None:
        model_params["temperature"] = payload.temperature
    if payload.max_tokens is not None:
        model_params["max_tokens"] = payload.max_tokens

    result = await _pipeline.query(
        question=payload.question,
        provider=payload.provider,
        deployment=payload.deployment,
        system_message=payload.system_message,
        **model_params,
    )
    return result


@router.get("/stats")
async def get_stats():
    """Return vector store stats."""
    return _pipeline.get_stats()


@router.delete("/store")
async def clear_store():
    """Clear the in-memory vector store."""
    _pipeline.vector_store.clear()
    return {"status": "cleared"}
