"""
Experiment & ExperimentResult ORM models.

An Experiment represents an A/B test comparing two model configurations.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, JSON, Enum as SAEnum
from sqlalchemy.orm import relationship
import enum

from backend.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ExperimentStatus(str, enum.Enum):
    CREATED = "created"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Experiment(Base):
    __tablename__ = "experiments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)

    # Model A config
    model_a_provider = Column(String(50), nullable=False, doc="e.g. azure_openai, openai")
    model_a_deployment = Column(String(255), nullable=False)
    model_a_params = Column(JSON, nullable=True, doc="temperature, max_tokens, etc.")

    # Model B config
    model_b_provider = Column(String(50), nullable=False)
    model_b_deployment = Column(String(255), nullable=False)
    model_b_params = Column(JSON, nullable=True)

    # Prompt
    prompt_id = Column(String(36), ForeignKey("prompts.id"), nullable=True)
    system_message_override = Column(Text, nullable=True)

    status = Column(SAEnum(ExperimentStatus), default=ExperimentStatus.CREATED)
    total_questions = Column(Integer, default=0)
    completed_questions = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    # Relationships
    results = relationship("ExperimentResult", back_populates="experiment", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Experiment {self.name!r} [{self.status}]>"


class ExperimentResult(Base):
    __tablename__ = "experiment_results"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    experiment_id = Column(String(36), ForeignKey("experiments.id", ondelete="CASCADE"), nullable=False)
    question_index = Column(Integer, nullable=False)
    question_text = Column(Text, nullable=False)

    # Model A response
    model_a_response = Column(Text, nullable=True)
    model_a_latency_ms = Column(Float, nullable=True)
    model_a_tokens_prompt = Column(Integer, nullable=True)
    model_a_tokens_completion = Column(Integer, nullable=True)

    # Model B response
    model_b_response = Column(Text, nullable=True)
    model_b_latency_ms = Column(Float, nullable=True)
    model_b_tokens_prompt = Column(Integer, nullable=True)
    model_b_tokens_completion = Column(Integer, nullable=True)

    # Evaluation metrics
    semantic_similarity = Column(Float, nullable=True, doc="0.0–1.0 cosine similarity")
    bleu_score = Column(Float, nullable=True)
    rouge_l_score = Column(Float, nullable=True)
    coherence_score_a = Column(Float, nullable=True)
    coherence_score_b = Column(Float, nullable=True)
    factual_alignment = Column(Float, nullable=True, doc="How factually aligned the two responses are")

    # Cost
    model_a_cost_usd = Column(Float, nullable=True)
    model_b_cost_usd = Column(Float, nullable=True)

    # Human evaluation
    human_preference = Column(String(10), nullable=True, doc="'A', 'B', 'tie', or None")
    human_notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=_utcnow)

    # Relationships
    experiment = relationship("Experiment", back_populates="results")

    def __repr__(self) -> str:
        return f"<ExperimentResult exp={self.experiment_id} q={self.question_index}>"
