"""
Golden Dataset Service.

CRUD for reusable test case datasets with expected answers.
Supports file upload (Excel/CSV/JSON) and manual creation.
"""

from __future__ import annotations

import logging
from typing import List, Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.models.golden_dataset import GoldenDataset, GoldenTestCase
from backend.schemas.golden_dataset import (
    GoldenDatasetCreate,
    GoldenDatasetUpdate,
    GoldenTestCaseInput,
)
from backend.utils.file_parser import parse_uploaded_file

logger = logging.getLogger(__name__)


# ── CRUD ────────────────────────────────────────────────────────
async def create_golden_dataset(
    db: AsyncSession,
    payload: GoldenDatasetCreate,
) -> GoldenDataset:
    """Create a golden dataset with test cases."""
    dataset = GoldenDataset(
        name=payload.name,
        description=payload.description,
        tags=payload.tags,
        total_cases=len(payload.cases),
    )
    db.add(dataset)
    await db.flush()

    for idx, case_input in enumerate(payload.cases):
        case = GoldenTestCase(
            dataset_id=dataset.id,
            index=idx,
            question=case_input.question,
            expected_answer=case_input.expected_answer,
            context=case_input.context,
            category=case_input.category,
            difficulty=case_input.difficulty,
            tags=case_input.tags,
        )
        db.add(case)

    await db.commit()
    await db.refresh(dataset)
    return dataset


async def create_golden_dataset_from_file(
    db: AsyncSession,
    name: str,
    description: str,
    content: bytes,
    filename: str,
) -> GoldenDataset:
    """Create a golden dataset by parsing an uploaded file."""
    cases_raw = parse_uploaded_file(content, filename)
    if not cases_raw:
        raise ValueError("No test cases found in uploaded file.")

    cases = []
    for raw in cases_raw:
        if "question" not in raw:
            continue
        cases.append(
            GoldenTestCaseInput(
                question=raw["question"],
                expected_answer=raw.get("expected_answer"),
                context=raw.get("context"),
                category=raw.get("tags", {}).get("category") if isinstance(raw.get("tags"), dict) else None,
                difficulty=raw.get("tags", {}).get("type") if isinstance(raw.get("tags"), dict) else None,
            )
        )

    if not cases:
        raise ValueError("No valid test cases (with 'question' field) found in file.")

    payload = GoldenDatasetCreate(name=name, description=description, cases=cases)
    dataset = await create_golden_dataset(db, payload)

    # Update source filename
    dataset.source_filename = filename
    await db.commit()
    await db.refresh(dataset)
    return dataset


async def list_golden_datasets(
    db: AsyncSession,
    active_only: bool = True,
) -> List[GoldenDataset]:
    stmt = select(GoldenDataset)
    if active_only:
        stmt = stmt.where(GoldenDataset.is_active == True)
    stmt = stmt.order_by(GoldenDataset.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_golden_dataset(
    db: AsyncSession,
    dataset_id: str,
) -> Optional[GoldenDataset]:
    stmt = (
        select(GoldenDataset)
        .options(selectinload(GoldenDataset.cases))
        .where(GoldenDataset.id == dataset_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def update_golden_dataset(
    db: AsyncSession,
    dataset_id: str,
    payload: GoldenDatasetUpdate,
) -> Optional[GoldenDataset]:
    dataset = await get_golden_dataset(db, dataset_id)
    if not dataset:
        return None
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(dataset, field, value)
    await db.commit()
    await db.refresh(dataset)
    return dataset


async def delete_golden_dataset(
    db: AsyncSession,
    dataset_id: str,
) -> bool:
    dataset = await get_golden_dataset(db, dataset_id)
    if not dataset:
        return False
    await db.delete(dataset)
    await db.commit()
    return True


async def add_cases_to_dataset(
    db: AsyncSession,
    dataset_id: str,
    cases: List[GoldenTestCaseInput],
) -> Optional[GoldenDataset]:
    """Add additional test cases to an existing golden dataset."""
    dataset = await get_golden_dataset(db, dataset_id)
    if not dataset:
        return None

    current_max_idx = len(dataset.cases)
    for idx, case_input in enumerate(cases):
        case = GoldenTestCase(
            dataset_id=dataset.id,
            index=current_max_idx + idx,
            question=case_input.question,
            expected_answer=case_input.expected_answer,
            context=case_input.context,
            category=case_input.category,
            difficulty=case_input.difficulty,
            tags=case_input.tags,
        )
        db.add(case)

    dataset.total_cases = current_max_idx + len(cases)
    await db.commit()
    await db.refresh(dataset)
    return dataset
