"""
Prompt & PromptVersion ORM models.

Supports versioning, tagging, and A/B selection of prompts.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, Boolean, JSON
from sqlalchemy.orm import relationship

from backend.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Prompt(Base):
    __tablename__ = "prompts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    system_message = Column(Text, nullable=True, doc="Default system prompt")
    tags = Column(JSON, nullable=True, doc="Arbitrary tags for filtering")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    # Relationships
    versions = relationship("PromptVersion", back_populates="prompt", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Prompt {self.name!r}>"


class PromptVersion(Base):
    __tablename__ = "prompt_versions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    prompt_id = Column(String(36), ForeignKey("prompts.id", ondelete="CASCADE"), nullable=False)
    version = Column(Integer, nullable=False, doc="Monotonically increasing version number")
    content = Column(Text, nullable=False, doc="The actual prompt template text")
    variables = Column(JSON, nullable=True, doc='List of variable names, e.g. ["user_name", "context"]')
    change_note = Column(Text, nullable=True)
    is_current = Column(Boolean, default=False, doc="True for the active version")
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    # Relationships
    prompt = relationship("Prompt", back_populates="versions")

    def __repr__(self) -> str:
        return f"<PromptVersion prompt={self.prompt_id} v{self.version}>"
