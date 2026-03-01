"""
Azure Cosmos DB async client — singleton for the GenAI Ops Framework.

Provides typed container access and generic CRUD helpers so every service
can perform database operations without knowing Cosmos SDK internals.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from azure.cosmos.aio import CosmosClient, DatabaseProxy, ContainerProxy
from azure.cosmos import exceptions

from backend.config import settings

logger = logging.getLogger(__name__)

# ── Module-level singleton ──────────────────────────────────────
_client: Optional[CosmosClient] = None
_database: Optional[DatabaseProxy] = None
_containers: Dict[str, ContainerProxy] = {}

CONTAINER_NAMES = [
    "prompts",
    "experiments",
    "test_runs",
    "cost_records",
    "golden_datasets",
    "migration_runs",
    "users",
    "endpoint_registry",
]


# ── Lifecycle ───────────────────────────────────────────────────
async def init_cosmos() -> None:
    """Initialise the Cosmos DB client and get container references."""
    global _client, _database

    if not settings.cosmos_db_endpoint or not settings.cosmos_db_key:
        logger.warning(
            "Cosmos DB not configured — set COSMOS_DB_ENDPOINT and COSMOS_DB_KEY"
        )
        return

    _client = CosmosClient(settings.cosmos_db_endpoint, settings.cosmos_db_key)
    _database = _client.get_database_client(settings.cosmos_db_database)

    for name in CONTAINER_NAMES:
        _containers[name] = _database.get_container_client(name)

    logger.info(
        "Cosmos DB initialised: %s / %s (%d containers)",
        settings.cosmos_db_endpoint,
        settings.cosmos_db_database,
        len(_containers),
    )


async def close_cosmos() -> None:
    """Close the Cosmos DB client gracefully."""
    global _client
    if _client:
        await _client.close()
        _client = None
        _containers.clear()
        logger.info("Cosmos DB client closed.")


def get_container(name: str) -> ContainerProxy:
    """Return a container proxy.  Raises if not initialised."""
    if name not in _containers:
        raise RuntimeError(
            f"Container '{name}' not available. "
            "Ensure COSMOS_DB_ENDPOINT / COSMOS_DB_KEY are set and init_cosmos() was called."
        )
    return _containers[name]


# ── Helpers ─────────────────────────────────────────────────────
def new_id() -> str:
    """Generate a new UUID-4 string."""
    return str(uuid.uuid4())


def utcnow_iso() -> str:
    """ISO-8601 UTC timestamp."""
    return datetime.now(timezone.utc).isoformat()


# ── Generic CRUD ────────────────────────────────────────────────
async def create_item(container_name: str, item: Dict[str, Any]) -> Dict[str, Any]:
    """Create a new document.  Assigns ``id`` if missing."""
    container = get_container(container_name)
    if "id" not in item:
        item["id"] = new_id()
    return await container.create_item(body=item)


async def upsert_item(container_name: str, item: Dict[str, Any]) -> Dict[str, Any]:
    """Create-or-replace a document."""
    container = get_container(container_name)
    return await container.upsert_item(body=item)


async def read_item(
    container_name: str,
    item_id: str,
    partition_key: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Point-read a document.  Returns ``None`` on 404."""
    container = get_container(container_name)
    pk = partition_key if partition_key is not None else item_id
    try:
        return await container.read_item(item=item_id, partition_key=pk)
    except exceptions.CosmosResourceNotFoundError:
        return None


async def delete_item(
    container_name: str,
    item_id: str,
    partition_key: Optional[str] = None,
) -> bool:
    """Delete a document.  Returns ``False`` on 404."""
    container = get_container(container_name)
    pk = partition_key if partition_key is not None else item_id
    try:
        await container.delete_item(item=item_id, partition_key=pk)
        return True
    except exceptions.CosmosResourceNotFoundError:
        return False


async def query_items(
    container_name: str,
    query: str,
    parameters: Optional[List[Dict[str, Any]]] = None,
    partition_key: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Run a SQL query and return all matching documents."""
    container = get_container(container_name)
    kwargs: Dict[str, Any] = {}
    if partition_key is not None:
        kwargs["partition_key"] = partition_key

    items: List[Dict[str, Any]] = []
    async for item in container.query_items(
        query=query,
        parameters=parameters or [],
        enable_cross_partition_query=(partition_key is None),
        **kwargs,
    ):
        items.append(item)
    return items


async def query_all(container_name: str) -> List[Dict[str, Any]]:
    """Return every document in a container (small-collection helper)."""
    return await query_items(container_name, "SELECT * FROM c")
