"""
GenAI Ops Framework — Database Setup (Azure Cosmos DB).

Initialises the async Cosmos DB client on startup and exposes
``init_db`` / ``close_db`` for the FastAPI lifespan.

The legacy ``Base`` class and ``get_db`` dependency are kept so that
existing model files still import without errors, but all runtime I/O
now goes through ``backend.cosmos_client``.
"""

from __future__ import annotations

import logging

from backend.cosmos_client import init_cosmos, close_cosmos

logger = logging.getLogger(__name__)


# ── Legacy ORM base (models import this — kept as a no-op) ─────
class _BaseMeta(type):
    """Metaclass that silently swallows SQLAlchemy Column descriptors."""
    def __new__(mcs, name, bases, namespace, **kw):
        return super().__new__(mcs, name, bases, namespace)

class Base(metaclass=_BaseMeta):
    """Placeholder declarative base — not used at runtime with Cosmos DB."""
    __tablename__: str = ""
    metadata = type("_FakeMeta", (), {"sorted_tables": []})()


# ── Lifecycle ───────────────────────────────────────────────────
async def init_db() -> None:
    """Called at startup — connects to Cosmos DB."""
    await init_cosmos()
    logger.info("Database ready (Cosmos DB).")


async def close_db() -> None:
    """Called at shutdown — closes the Cosmos DB client."""
    await close_cosmos()
