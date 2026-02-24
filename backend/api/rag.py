"""
RAG Pipeline API routes.

POST /rag/ingest  → ingest documents
POST /rag/query   → retrieve + generate
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.services.rag_pipeline import Document, RAGPipeline, InMemoryVectorStore

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


@router.post("/query")
async def query(payload: QueryRequest):
    """Query the RAG pipeline: retrieve context + generate answer."""
    _pipeline.top_k = payload.top_k
    result = await _pipeline.query(
        question=payload.question,
        provider=payload.provider,
        deployment=payload.deployment,
        system_message=payload.system_message,
    )
    return result


@router.delete("/store")
async def clear_store():
    """Clear the in-memory vector store."""
    _pipeline.vector_store.clear()
    return {"status": "cleared"}
