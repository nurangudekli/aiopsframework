"""Tests for the performance service (unit-level)."""

import pytest
import numpy as np

from backend.schemas.evaluation import PerformanceTestRequest


def test_performance_test_request_defaults():
    """PerformanceTestRequest has correct defaults."""
    req = PerformanceTestRequest(
        model_provider="azure_openai",
        model_deployment="my-deployment",
        questions=["How are you?"],
    )
    assert req.concurrency == 5
    assert req.total_requests == 50
    assert req.timeout_seconds == 30.0


def test_performance_test_request_validation():
    """PerformanceTestRequest validates bounds."""
    import pydantic
    with pytest.raises(pydantic.ValidationError):
        PerformanceTestRequest(
            model_provider="azure_openai",
            model_deployment="my-deployment",
            questions=[],  # min_length=1
        )


def test_performance_test_request_custom():
    """PerformanceTestRequest accepts custom values."""
    req = PerformanceTestRequest(
        model_provider="openai",
        model_deployment="gpt-3.5-turbo",
        questions=["Q1", "Q2"],
        concurrency=10,
        total_requests=100,
        timeout_seconds=60.0,
    )
    assert req.concurrency == 10
    assert req.total_requests == 100
    assert len(req.questions) == 2
