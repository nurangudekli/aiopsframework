"""
CostRecord — tracks token usage and API costs over time.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, Integer, String, Text

from backend.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class CostRecord(Base):
    __tablename__ = "cost_records"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    provider = Column(String(50), nullable=False, index=True)
    deployment = Column(String(255), nullable=False, index=True)
    operation = Column(String(50), nullable=True, doc="ab_test, test_run, chat, stress_test, etc.")
    reference_id = Column(String(36), nullable=True, doc="FK to experiment or test_run id")

    tokens_prompt = Column(Integer, default=0)
    tokens_completion = Column(Integer, default=0)
    tokens_reasoning = Column(Integer, default=0)
    tokens_total = Column(Integer, default=0)
    cost_usd = Column(Float, default=0.0)
    latency_ms = Column(Float, nullable=True)
    deployment_type = Column(String(50), nullable=True, doc="Standard | PTU | GlobalStandard | ProvisionedManaged | ...")

    metadata_json = Column(Text, nullable=True, doc="Extra metadata as JSON string")
    recorded_at = Column(DateTime(timezone=True), default=_utcnow, index=True)

    def __repr__(self) -> str:
        return f"<CostRecord {self.provider}/{self.deployment} ${self.cost_usd:.4f}>"
