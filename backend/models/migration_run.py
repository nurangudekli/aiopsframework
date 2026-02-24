"""
MigrationRun ORM model.

Tracks a full model migration evaluation pipeline run:
source model → target model, using a golden dataset.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
import enum

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, JSON, Enum as SAEnum
from sqlalchemy.orm import relationship

from backend.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MigrationStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class MigrationRun(Base):
    __tablename__ = "migration_runs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)

    # Dataset reference
    golden_dataset_id = Column(String(36), ForeignKey("golden_datasets.id"), nullable=False)

    # Source model (baseline)
    source_provider = Column(String(50), nullable=False)
    source_deployment = Column(String(255), nullable=False)
    source_params = Column(JSON, nullable=True)

    # Target model (candidate)
    target_provider = Column(String(50), nullable=False)
    target_deployment = Column(String(255), nullable=False)
    target_params = Column(JSON, nullable=True)

    # Prompt config
    system_message = Column(Text, nullable=True)
    prompt_id = Column(String(36), nullable=True)

    # Status & progress
    status = Column(SAEnum(MigrationStatus), default=MigrationStatus.PENDING)
    total_cases = Column(Integer, default=0)
    completed_cases = Column(Integer, default=0)

    # Aggregate results (filled after completion)
    source_avg_latency_ms = Column(Float, nullable=True)
    target_avg_latency_ms = Column(Float, nullable=True)
    source_total_cost_usd = Column(Float, nullable=True)
    target_total_cost_usd = Column(Float, nullable=True)
    avg_similarity = Column(Float, nullable=True)
    avg_source_reference_score = Column(Float, nullable=True)
    avg_target_reference_score = Column(Float, nullable=True)
    pass_rate_source = Column(Float, nullable=True)
    pass_rate_target = Column(Float, nullable=True)
    recommendation = Column(String(50), nullable=True, doc="ready | needs_review | not_ready")

    created_at = Column(DateTime(timezone=True), default=_utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    results = relationship("MigrationResult", back_populates="migration_run", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<MigrationRun {self.name!r} [{self.status}]>"


class MigrationResult(Base):
    __tablename__ = "migration_results"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    migration_run_id = Column(String(36), ForeignKey("migration_runs.id", ondelete="CASCADE"), nullable=False)
    case_index = Column(Integer, nullable=False)
    question = Column(Text, nullable=False)
    expected_answer = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)

    # Source model response
    source_response = Column(Text, nullable=True)
    source_latency_ms = Column(Float, nullable=True)
    source_tokens_prompt = Column(Integer, nullable=True)
    source_tokens_completion = Column(Integer, nullable=True)
    source_cost_usd = Column(Float, nullable=True)
    source_error = Column(Text, nullable=True)

    # Target model response
    target_response = Column(Text, nullable=True)
    target_latency_ms = Column(Float, nullable=True)
    target_tokens_prompt = Column(Integer, nullable=True)
    target_tokens_completion = Column(Integer, nullable=True)
    target_cost_usd = Column(Float, nullable=True)
    target_error = Column(Text, nullable=True)

    # Evaluation metrics
    similarity_score = Column(Float, nullable=True, doc="Similarity between source & target responses")
    source_reference_score = Column(Float, nullable=True, doc="Source vs expected answer similarity")
    target_reference_score = Column(Float, nullable=True, doc="Target vs expected answer similarity")
    bleu_score = Column(Float, nullable=True)
    rouge_l_score = Column(Float, nullable=True)

    # Verdict per case
    source_passed = Column(String(10), nullable=True, doc="pass / fail / skip")
    target_passed = Column(String(10), nullable=True, doc="pass / fail / skip")
    regression = Column(String(10), nullable=True, doc="none / minor / major")

    created_at = Column(DateTime(timezone=True), default=_utcnow)

    # Relationships
    migration_run = relationship("MigrationRun", back_populates="results")

    def __repr__(self) -> str:
        return f"<MigrationResult run={self.migration_run_id} idx={self.case_index}>"
