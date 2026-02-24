"""
RAG Pipeline Service.

Provides a pluggable Retrieval-Augmented Generation pipeline:
  1. Document ingestion (chunking, embedding)
  2. Vector search (via in-memory FAISS or external vector DB)
  3. Context-augmented generation
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import numpy as np

from backend.services.model_provider import call_model

logger = logging.getLogger(__name__)


# ── Data classes ────────────────────────────────────────────────
@dataclass
class Document:
    id: str
    text: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Chunk:
    doc_id: str
    chunk_index: int
    text: str
    embedding: Optional[np.ndarray] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RetrievalResult:
    chunk: Chunk
    score: float


# ── In-memory vector store ──────────────────────────────────────
class InMemoryVectorStore:
    """Simple in-memory vector store backed by numpy for development / small datasets."""

    def __init__(self):
        self.chunks: List[Chunk] = []
        self._embeddings: Optional[np.ndarray] = None

    def add_chunks(self, chunks: List[Chunk]) -> None:
        self.chunks.extend(chunks)
        self._embeddings = None  # invalidate cache

    def _build_index(self):
        if self._embeddings is None and self.chunks:
            vecs = [c.embedding for c in self.chunks if c.embedding is not None]
            if vecs:
                self._embeddings = np.vstack(vecs)

    def search(self, query_embedding: np.ndarray, top_k: int = 5) -> List[RetrievalResult]:
        self._build_index()
        if self._embeddings is None or len(self._embeddings) == 0:
            return []

        # Cosine similarity
        query_norm = query_embedding / (np.linalg.norm(query_embedding) + 1e-10)
        norms = np.linalg.norm(self._embeddings, axis=1, keepdims=True) + 1e-10
        normed = self._embeddings / norms
        scores = normed @ query_norm

        top_indices = np.argsort(scores)[::-1][:top_k]
        return [
            RetrievalResult(chunk=self.chunks[i], score=float(scores[i]))
            for i in top_indices
        ]

    def clear(self) -> None:
        self.chunks = []
        self._embeddings = None


# ── Chunking ────────────────────────────────────────────────────
def chunk_text(
    text: str,
    chunk_size: int = 512,
    chunk_overlap: int = 64,
) -> List[str]:
    """Split text into overlapping chunks by character count (word-boundary aware)."""
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk_words = words[start:end]
        chunks.append(" ".join(chunk_words))
        start += chunk_size - chunk_overlap
    return chunks


# ── Embedding helper ────────────────────────────────────────────
def _get_embed_model():
    try:
        from sentence_transformers import SentenceTransformer
        return SentenceTransformer("all-MiniLM-L6-v2")
    except ImportError:
        logger.warning("sentence-transformers not installed; RAG embedding unavailable.")
        return None


def embed_texts(texts: List[str]) -> Optional[np.ndarray]:
    model = _get_embed_model()
    if model is None:
        return None
    return model.encode(texts, convert_to_numpy=True, show_progress_bar=False)


# ── RAG Pipeline ────────────────────────────────────────────────
class RAGPipeline:
    """
    End-to-end Retrieval-Augmented Generation pipeline.

    Usage:
        pipeline = RAGPipeline(vector_store=InMemoryVectorStore())
        pipeline.ingest_documents([Document(id="1", text="...")])
        answer = await pipeline.query("What is ...?", provider="azure_openai", deployment="my-deployment")
    """

    def __init__(
        self,
        vector_store: Optional[InMemoryVectorStore] = None,
        chunk_size: int = 512,
        chunk_overlap: int = 64,
        top_k: int = 5,
    ):
        self.vector_store = vector_store or InMemoryVectorStore()
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.top_k = top_k

    def ingest_documents(self, documents: List[Document]) -> int:
        """Chunk, embed, and index documents. Returns number of chunks created."""
        all_chunks: List[Chunk] = []

        for doc in documents:
            texts = chunk_text(doc.text, self.chunk_size, self.chunk_overlap)
            for idx, t in enumerate(texts):
                all_chunks.append(Chunk(doc_id=doc.id, chunk_index=idx, text=t, metadata=doc.metadata))

        # Embed all chunks
        chunk_texts = [c.text for c in all_chunks]
        embeddings = embed_texts(chunk_texts)
        if embeddings is not None:
            for i, chunk in enumerate(all_chunks):
                chunk.embedding = embeddings[i]

        self.vector_store.add_chunks(all_chunks)
        logger.info("Ingested %d documents into %d chunks", len(documents), len(all_chunks))
        return len(all_chunks)

    def retrieve(self, query: str) -> List[RetrievalResult]:
        """Retrieve top-k relevant chunks for a query."""
        query_emb = embed_texts([query])
        if query_emb is None:
            return []
        return self.vector_store.search(query_emb[0], top_k=self.top_k)

    async def query(
        self,
        question: str,
        provider: str,
        deployment: str,
        system_message: Optional[str] = None,
        **model_params: Any,
    ) -> Dict[str, Any]:
        """Full RAG: retrieve context, augment prompt, call model."""
        retrieved = self.retrieve(question)
        context_parts = [r.chunk.text for r in retrieved]
        context = "\n\n---\n\n".join(context_parts)

        augmented_prompt = (
            f"Use the following context to answer the question. "
            f"If the context does not contain enough information, say so.\n\n"
            f"Context:\n{context}\n\n"
            f"Question: {question}"
        )

        messages = []
        if system_message:
            messages.append({"role": "system", "content": system_message})
        messages.append({"role": "user", "content": augmented_prompt})

        resp = await call_model(provider, deployment, messages, **model_params)
        return {
            "answer": resp.text,
            "latency_ms": resp.latency_ms,
            "tokens_prompt": resp.tokens_prompt,
            "tokens_completion": resp.tokens_completion,
            "retrieved_chunks": [
                {"text": r.chunk.text, "score": round(r.score, 4), "doc_id": r.chunk.doc_id}
                for r in retrieved
            ],
            "error": resp.error,
        }
