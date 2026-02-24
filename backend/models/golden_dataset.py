"""
GoldenDataset & GoldenTestCase ORM models.

A GoldenDataset is a reusable collection of test cases with expected answers,
used as ground-truth for model migration evaluation.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
import enum

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, JSON, Boolean
from sqlalchemy.orm import relationship

from backend.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class GoldenDataset(Base):
    __tablename__ = "golden_datasets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    source_filename = Column(String(512), nullable=True)
    tags = Column(JSON, nullable=True)
    total_cases = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    # Relationships
    cases = relationship("GoldenTestCase", back_populates="dataset", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<GoldenDataset {self.name!r} ({self.total_cases} cases)>"


class GoldenTestCase(Base):
    __tablename__ = "golden_test_cases"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String(36), ForeignKey("golden_datasets.id", ondelete="CASCADE"), nullable=False)
    index = Column(Integer, nullable=False)
    question = Column(Text, nullable=False)
    expected_answer = Column(Text, nullable=True, doc="Ground-truth / reference answer")
    context = Column(Text, nullable=True, doc="Optional context for RAG scenarios")
    category = Column(String(100), nullable=True, doc="Test case category/tag")
    difficulty = Column(String(20), nullable=True, doc="easy / medium / hard")
    language = Column(String(10), nullable=True, doc="Language code: en / ar / mixed")
    tags = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    # Relationships
    dataset = relationship("GoldenDataset", back_populates="cases")

    def __repr__(self) -> str:
        return f"<GoldenTestCase ds={self.dataset_id} idx={self.index}>"
