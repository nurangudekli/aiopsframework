"""
Prompt Manager Service.

Handles CRUD for prompts, versioning, variable interpolation,
and A/B variant selection.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.models.prompt import Prompt, PromptVersion
from backend.schemas.prompt import PromptCreate, PromptUpdate, PromptVersionCreate

logger = logging.getLogger(__name__)


# ── CRUD ────────────────────────────────────────────────────────
async def create_prompt(db: AsyncSession, payload: PromptCreate) -> Prompt:
    prompt = Prompt(
        name=payload.name,
        description=payload.description,
        system_message=payload.system_message,
        tags=payload.tags,
    )
    db.add(prompt)
    await db.flush()

    version = PromptVersion(
        prompt_id=prompt.id,
        version=1,
        content=payload.initial_content,
        variables=_extract_variables(payload.initial_content),
        is_current=True,
    )
    db.add(version)
    await db.commit()
    await db.refresh(prompt)
    return prompt


async def list_prompts(db: AsyncSession, active_only: bool = True) -> List[Prompt]:
    stmt = select(Prompt).options(selectinload(Prompt.versions))
    if active_only:
        stmt = stmt.where(Prompt.is_active == True)
    stmt = stmt.order_by(Prompt.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_prompt(db: AsyncSession, prompt_id: str) -> Optional[Prompt]:
    stmt = select(Prompt).options(selectinload(Prompt.versions)).where(Prompt.id == prompt_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def update_prompt(db: AsyncSession, prompt_id: str, payload: PromptUpdate) -> Optional[Prompt]:
    prompt = await get_prompt(db, prompt_id)
    if not prompt:
        return None
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(prompt, field, value)
    await db.commit()
    await db.refresh(prompt)
    return prompt


async def delete_prompt(db: AsyncSession, prompt_id: str) -> bool:
    prompt = await get_prompt(db, prompt_id)
    if not prompt:
        return False
    await db.delete(prompt)
    await db.commit()
    return True


# ── Versioning ──────────────────────────────────────────────────
async def add_version(db: AsyncSession, prompt_id: str, payload: PromptVersionCreate) -> Optional[PromptVersion]:
    prompt = await get_prompt(db, prompt_id)
    if not prompt:
        return None

    # Determine next version number
    max_ver_stmt = select(func.max(PromptVersion.version)).where(PromptVersion.prompt_id == prompt_id)
    result = await db.execute(max_ver_stmt)
    max_ver = result.scalar() or 0

    # Unset current flag on existing versions
    for v in prompt.versions:
        v.is_current = False

    new_version = PromptVersion(
        prompt_id=prompt_id,
        version=max_ver + 1,
        content=payload.content,
        variables=payload.variables or _extract_variables(payload.content),
        change_note=payload.change_note,
        is_current=True,
    )
    db.add(new_version)
    await db.commit()
    await db.refresh(new_version)
    return new_version


async def get_current_version(db: AsyncSession, prompt_id: str) -> Optional[PromptVersion]:
    stmt = (
        select(PromptVersion)
        .where(PromptVersion.prompt_id == prompt_id, PromptVersion.is_current == True)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def set_current_version(db: AsyncSession, prompt_id: str, version_id: str) -> bool:
    prompt = await get_prompt(db, prompt_id)
    if not prompt:
        return False
    for v in prompt.versions:
        v.is_current = v.id == version_id
    await db.commit()
    return True


# ── Template Rendering ──────────────────────────────────────────
def render_template(template: str, variables: Dict[str, Any]) -> str:
    """
    Render a prompt template by substituting {{variable_name}} placeholders.
    """
    def _replace(match):
        key = match.group(1).strip()
        return str(variables.get(key, match.group(0)))

    return re.sub(r"\{\{(\s*\w+\s*)\}\}", _replace, template)


def _extract_variables(template: str) -> List[str]:
    """Extract variable names from {{var}} placeholders."""
    return list(set(m.strip() for m in re.findall(r"\{\{(\s*\w+\s*)\}\}", template)))
