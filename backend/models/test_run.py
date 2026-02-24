"""
TestRun, TestCase & TestCaseResult — regression / batch testing models.

Customers upload a file (Excel / CSV / JSON) with questions. A TestRun
executes them against one or more models and stores results.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
import enum

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, JSON, Enum as SAEnum, Boolean
from sqlalchemy.orm import relationship

from backend.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TestRunStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class TestRun(Base):
    __tablename__ = "test_runs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Source file info
    source_filename = Column(String(512), nullable=True)
    source_format = Column(String(20), nullable=True, doc="csv, xlsx, json")

    # Model config
    model_provider = Column(String(50), nullable=False)
    model_deployment = Column(String(255), nullable=False)
    model_params = Column(JSON, nullable=True)

    status = Column(SAEnum(TestRunStatus), default=TestRunStatus.PENDING)
    total_cases = Column(Integer, default=0)
    passed_cases = Column(Integer, default=0)
    failed_cases = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), default=_utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    cases = relationship("TestCase", back_populates="test_run", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<TestRun {self.name!r} [{self.status}]>"


class TestCase(Base):
    __tablename__ = "test_cases"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    test_run_id = Column(String(36), ForeignKey("test_runs.id", ondelete="CASCADE"), nullable=False)
    index = Column(Integer, nullable=False)
    question = Column(Text, nullable=False)
    expected_answer = Column(Text, nullable=True, doc="Ground-truth / reference answer")
    context = Column(Text, nullable=True, doc="Optional context for RAG scenarios")
    tags = Column(JSON, nullable=True)

    # Relationships
    test_run = relationship("TestRun", back_populates="cases")
    results = relationship("TestCaseResult", back_populates="test_case", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<TestCase run={self.test_run_id} idx={self.index}>"


class TestCaseResult(Base):
    __tablename__ = "test_case_results"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    test_case_id = Column(String(36), ForeignKey("test_cases.id", ondelete="CASCADE"), nullable=False)
    model_label = Column(String(50), nullable=False, doc="e.g. 'model_a', 'model_b'")

    response = Column(Text, nullable=True)
    latency_ms = Column(Float, nullable=True)
    tokens_prompt = Column(Integer, nullable=True)
    tokens_completion = Column(Integer, nullable=True)
    cost_usd = Column(Float, nullable=True)

    # Quality metrics
    similarity_to_expected = Column(Float, nullable=True)
    passed = Column(Boolean, nullable=True, doc="True if similarity >= threshold")
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=_utcnow)

    # Relationships
    test_case = relationship("TestCase", back_populates="results")

    def __repr__(self) -> str:
        return f"<TestCaseResult case={self.test_case_id} model={self.model_label}>"
