"""Tests for evaluation service metrics."""

import asyncio
import pytest

from backend.services.evaluation import (
    compute_similarity_metrics,
    compute_reference_similarity,
    _bleu_score,
    _rouge_l,
    _coherence_score,
)


def test_bleu_identical():
    text = "The quick brown fox jumps over the lazy dog"
    assert _bleu_score(text, text) == 1.0


def test_bleu_different():
    a = "The quick brown fox"
    b = "A slow red cat"
    score = _bleu_score(a, b)
    assert 0.0 <= score < 0.5


def test_rouge_l_identical():
    text = "Hello world this is a test"
    assert _rouge_l(text, text) == 1.0


def test_rouge_l_partial():
    a = "The quick brown fox jumps over the lazy dog"
    b = "The brown fox jumps over the dog"
    score = _rouge_l(a, b)
    assert 0.5 < score < 1.0


def test_coherence_score():
    text = "This is a well-formed sentence. It has good structure. The ideas flow naturally."
    score = _coherence_score(text)
    assert 0.0 <= score <= 1.0


def test_coherence_empty():
    assert _coherence_score("") == 0.0


@pytest.mark.asyncio
async def test_compute_similarity_identical():
    metrics = await compute_similarity_metrics(
        "Azure OpenAI provides cloud-based AI services.",
        "Azure OpenAI provides cloud-based AI services.",
    )
    assert metrics["semantic_similarity"] >= 0.95
    assert metrics["verdict"] == "similar"


@pytest.mark.asyncio
async def test_compute_similarity_different():
    metrics = await compute_similarity_metrics(
        "Azure OpenAI provides cloud-based AI services.",
        "The weather today is sunny with a high of 75 degrees.",
    )
    assert metrics["semantic_similarity"] < 0.7
    assert metrics["verdict"] in ("divergent", "needs_review")
