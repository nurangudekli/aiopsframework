"""Tests for the RAG pipeline service."""

import pytest
import numpy as np

from backend.services.rag_pipeline import (
    Chunk,
    Document,
    InMemoryVectorStore,
    RAGPipeline,
    chunk_text,
)


def test_chunk_text_basic():
    """chunk_text splits text into overlapping word-count-based chunks."""
    text = " ".join(f"word{i}" for i in range(100))
    chunks = chunk_text(text, chunk_size=50, chunk_overlap=10)
    assert len(chunks) > 1
    # Each chunk should have at most 50 words
    for c in chunks:
        assert len(c.split()) <= 50


def test_chunk_text_short():
    """Short text yields a single chunk."""
    chunks = chunk_text("Hello world", chunk_size=512, chunk_overlap=64)
    assert len(chunks) == 1
    assert chunks[0] == "Hello world"


def test_vector_store_add_and_search():
    """InMemoryVectorStore can store and retrieve via add_chunks."""
    store = InMemoryVectorStore()
    chunks = [
        Chunk(doc_id="d1", chunk_index=0, text="chunk one", embedding=np.array([1.0, 0.0, 0.0])),
        Chunk(doc_id="d1", chunk_index=1, text="chunk two", embedding=np.array([0.0, 1.0, 0.0])),
        Chunk(doc_id="d1", chunk_index=2, text="chunk three", embedding=np.array([0.9, 0.1, 0.0])),
    ]
    store.add_chunks(chunks)

    results = store.search(np.array([1.0, 0.0, 0.0]), top_k=2)
    assert len(results) == 2
    # First result should be the most similar (chunk one)
    assert results[0].chunk.text == "chunk one"
    assert results[0].score >= 0.9


def test_vector_store_clear():
    """clear() empties the vector store."""
    store = InMemoryVectorStore()
    store.add_chunks([
        Chunk(doc_id="d1", chunk_index=0, text="test", embedding=np.array([1.0, 0.0])),
    ])
    store.clear()
    assert len(store.chunks) == 0


def test_ingest_documents():
    """RAGPipeline.ingest_documents creates chunks."""
    pipeline = RAGPipeline(vector_store=InMemoryVectorStore())
    docs = [
        Document(id="d1", text="Hello world. This is a test document for the RAG pipeline.", metadata={}),
        Document(id="d2", text="Another document with different content about Azure OpenAI.", metadata={}),
    ]
    num_chunks = pipeline.ingest_documents(docs)
    assert num_chunks >= 2  # at least one chunk per doc
