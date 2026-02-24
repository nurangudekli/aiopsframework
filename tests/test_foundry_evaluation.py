"""Tests for Foundry Evaluation service (heuristic fallback)."""

import pytest

from backend.services.foundry_evaluation import (
    evaluate_single,
    evaluate_all,
    evaluate_content_safety,
    is_foundry_sdk_available,
    _heuristic_coherence,
    _heuristic_fluency,
    _heuristic_relevance,
    _heuristic_groundedness,
    _heuristic_similarity,
)


# ── Heuristic unit tests ────────────────────────────────────────
def test_heuristic_coherence_well_formed():
    text = "This is a well-formed paragraph with diverse vocabulary. It covers multiple topics clearly and concisely."
    score = _heuristic_coherence(text)
    assert 1.0 <= score <= 5.0


def test_heuristic_coherence_empty():
    score = _heuristic_coherence("")
    assert score == 1.0


def test_heuristic_fluency_normal():
    text = "The deployment provides high throughput for production workloads. It scales automatically based on demand."
    score = _heuristic_fluency(text)
    assert 1.0 <= score <= 5.0


def test_heuristic_fluency_very_short():
    score = _heuristic_fluency("Ok.")
    assert score <= 3.0


def test_heuristic_relevance_high():
    query = "What is Azure OpenAI?"
    response = "Azure OpenAI is a cloud service that provides access to OpenAI models including GPT-4."
    score = _heuristic_relevance(query, response)
    assert score >= 2.5


def test_heuristic_relevance_low():
    query = "What is Azure OpenAI?"
    response = "The weather today is sunny with no clouds."
    score = _heuristic_relevance(query, response)
    assert score < 3.0


def test_heuristic_groundedness_grounded():
    context = "Azure OpenAI supports multiple models for text generation tasks."
    response = "Azure OpenAI supports multiple models for text generation."
    score = _heuristic_groundedness(response, context)
    assert score >= 3.0


def test_heuristic_groundedness_ungrounded():
    context = "Azure OpenAI supports GPT models."
    response = "Kubernetes orchestrates container workloads across cloud environments."
    score = _heuristic_groundedness(response, context)
    assert score < 3.0


def test_heuristic_similarity_identical():
    text = "Azure OpenAI provides cloud-based AI services."
    score = _heuristic_similarity(text, text)
    assert score >= 4.5


def test_heuristic_similarity_different():
    a = "Azure OpenAI provides cloud-based AI services."
    b = "The weather in Seattle is often rainy."
    score = _heuristic_similarity(a, b)
    assert score < 3.5


# ── Async integration tests (heuristic mode) ───────────────────
@pytest.mark.asyncio
async def test_evaluate_single_coherence():
    result = await evaluate_single(
        "coherence",
        response="This is a coherent response with good structure and vocabulary diversity.",
    )
    assert result["metric"] == "coherence"
    assert 1.0 <= result["score"] <= 5.0
    assert result["method"] in ("foundry_sdk", "heuristic")


@pytest.mark.asyncio
async def test_evaluate_single_fluency():
    result = await evaluate_single(
        "fluency",
        response="The model generates fluent and natural sounding text outputs.",
    )
    assert result["metric"] == "fluency"
    assert 1.0 <= result["score"] <= 5.0


@pytest.mark.asyncio
async def test_evaluate_all():
    result = await evaluate_all(
        query="What is GPT-4?",
        response="GPT-4 is a large language model by OpenAI.",
        context="OpenAI develops large language models including GPT-4.",
        ground_truth="GPT-4 is OpenAI's latest large language model.",
    )
    assert "coherence" in result
    assert "fluency" in result
    assert "relevance" in result
    assert "groundedness" in result
    assert "similarity" in result
    assert "_sdk_available" in result
    for metric in ["coherence", "fluency", "relevance", "groundedness", "similarity"]:
        assert "score" in result[metric]
        assert "method" in result[metric]


@pytest.mark.asyncio
async def test_evaluate_content_safety():
    result = await evaluate_content_safety(
        query="How do I deploy a model?",
        response="You can deploy a model using the Azure portal or CLI.",
    )
    assert "violence" in result
    assert "sexual" in result
    assert "hate_unfairness" in result
    assert "self_harm" in result
    # Safe content should have low scores
    for key in ["violence", "sexual", "hate_unfairness", "self_harm"]:
        assert result[key]["score"] <= 2


def test_sdk_availability_check():
    """is_foundry_sdk_available should return bool."""
    result = is_foundry_sdk_available()
    assert isinstance(result, bool)
