"""
GenAI Ops Framework — Database Setup (async SQLAlchemy).
"""

from __future__ import annotations

import logging

from sqlalchemy import inspect as sa_inspect, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from backend.config import settings

logger = logging.getLogger(__name__)

engine = create_async_engine(
    settings.database_url,
    echo=settings.app_debug,
    future=True,
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""
    pass


async def _add_missing_columns(conn) -> None:
    """Inspect every ORM table and ALTER TABLE to add columns that are missing in SQLite."""
    inspector = sa_inspect(conn)
    for table in Base.metadata.sorted_tables:
        if table.name not in inspector.get_table_names():
            continue  # table doesn't exist yet — create_all will handle it
        existing_cols = {c["name"] for c in inspector.get_columns(table.name)}
        for col in table.columns:
            if col.name not in existing_cols:
                col_type = col.type.compile(dialect=conn.dialect)
                sql = f'ALTER TABLE {table.name} ADD COLUMN {col.name} {col_type}'
                conn.execute(text(sql))
                logger.info("Added missing column %s.%s (%s)", table.name, col.name, col_type)


async def init_db() -> None:
    """Create all tables and add any missing columns (lightweight auto-migration)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_add_missing_columns)


async def get_db() -> AsyncSession:  # type: ignore[misc]
    """FastAPI dependency — yields an async session."""
    async with async_session() as session:
        yield session
