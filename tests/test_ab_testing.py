"""Tests for the AB testing service / schemas."""

import pytest
from backend.schemas.experiment import ExperimentCreate


def test_experiment_create_valid():
    """ExperimentCreate accepts valid data."""
    data = ExperimentCreate(
        name="Test Experiment",
        model_a={"provider": "azure_openai", "deployment": "model-a-deployment"},
        model_b={"provider": "azure_openai", "deployment": "model-b-deployment"},
        questions=["What is AI?", "Explain ML"],
    )
    assert data.name == "Test Experiment"
    assert len(data.questions) == 2


def test_experiment_create_empty_questions():
    """ExperimentCreate rejects empty question list."""
    import pydantic
    with pytest.raises(pydantic.ValidationError):
        ExperimentCreate(
            name="Bad Experiment",
            model_a={"provider": "azure_openai", "deployment": "model-a-deployment"},
            model_b={"provider": "azure_openai", "deployment": "model-b-deployment"},
            questions=[],
        )
