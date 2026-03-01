"""
Prompt Manager Service.

Handles CRUD for prompts, versioning, variable interpolation,
and A/B variant selection.  Backed by Azure Cosmos DB.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

from backend.cosmos_client import (
    create_item,
    delete_item,
    new_id,
    query_items,
    read_item,
    upsert_item,
    utcnow_iso,
)
from backend.schemas.prompt import PromptCreate, PromptUpdate, PromptVersionCreate

logger = logging.getLogger(__name__)

CONTAINER = "prompts"


# ── CRUD ────────────────────────────────────────────────────────
async def create_prompt(payload: PromptCreate) -> Dict[str, Any]:
    now = utcnow_iso()
    prompt_id = new_id()
    version_id = new_id()

    version = {
        "id": version_id,
        "prompt_id": prompt_id,
        "version": 1,
        "content": payload.initial_content,
        "variables": _extract_variables(payload.initial_content),
        "change_note": None,
        "is_current": True,
        "created_at": now,
    }

    doc = {
        "id": prompt_id,
        "name": payload.name,
        "description": payload.description,
        "system_message": payload.system_message,
        "tags": payload.tags,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
        "versions": [version],
    }
    return await create_item(CONTAINER, doc)


async def list_prompts(active_only: bool = True) -> List[Dict[str, Any]]:
    if active_only:
        query = "SELECT * FROM c WHERE c.is_active = true ORDER BY c.created_at DESC"
    else:
        query = "SELECT * FROM c ORDER BY c.created_at DESC"
    return await query_items(CONTAINER, query)


async def get_prompt(prompt_id: str) -> Optional[Dict[str, Any]]:
    return await read_item(CONTAINER, prompt_id)


async def update_prompt(prompt_id: str, payload: PromptUpdate) -> Optional[Dict[str, Any]]:
    doc = await read_item(CONTAINER, prompt_id)
    if not doc:
        return None
    for field, value in payload.model_dump(exclude_unset=True).items():
        doc[field] = value
    doc["updated_at"] = utcnow_iso()
    return await upsert_item(CONTAINER, doc)


async def delete_prompt(prompt_id: str) -> bool:
    return await delete_item(CONTAINER, prompt_id)


# ── Versioning ──────────────────────────────────────────────────
async def add_version(prompt_id: str, payload: PromptVersionCreate) -> Optional[Dict[str, Any]]:
    doc = await read_item(CONTAINER, prompt_id)
    if not doc:
        return None

    versions: List[Dict[str, Any]] = doc.get("versions", [])
    max_ver = max((v.get("version", 0) for v in versions), default=0)

    # Un-set current flag on existing versions
    for v in versions:
        v["is_current"] = False

    new_version = {
        "id": new_id(),
        "prompt_id": prompt_id,
        "version": max_ver + 1,
        "content": payload.content,
        "variables": payload.variables or _extract_variables(payload.content),
        "change_note": payload.change_note,
        "is_current": True,
        "created_at": utcnow_iso(),
    }
    versions.append(new_version)
    doc["versions"] = versions
    doc["updated_at"] = utcnow_iso()
    await upsert_item(CONTAINER, doc)
    return new_version


async def get_current_version(prompt_id: str) -> Optional[Dict[str, Any]]:
    doc = await read_item(CONTAINER, prompt_id)
    if not doc:
        return None
    for v in doc.get("versions", []):
        if v.get("is_current"):
            return v
    return None


async def set_current_version(prompt_id: str, version_id: str) -> bool:
    doc = await read_item(CONTAINER, prompt_id)
    if not doc:
        return False
    found = False
    for v in doc.get("versions", []):
        v["is_current"] = v["id"] == version_id
        if v["id"] == version_id:
            found = True
    if not found:
        return False
    doc["updated_at"] = utcnow_iso()
    await upsert_item(CONTAINER, doc)
    return True


# ── Template Rendering ──────────────────────────────────────────
def render_template(template: str, variables: Dict[str, Any]) -> str:
    """Render a prompt template by substituting {{variable_name}} placeholders."""

    def _replace(match):
        key = match.group(1).strip()
        return str(variables.get(key, match.group(0)))

    return re.sub(r"\{\{(\s*\w+\s*)\}\}", _replace, template)


def _extract_variables(template: str) -> List[str]:
    """Extract variable names from {{var}} placeholders."""
    return list(set(m.strip() for m in re.findall(r"\{\{(\s*\w+\s*)\}\}", template)))
