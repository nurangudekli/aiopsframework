"""
Golden Dataset Service.

CRUD for reusable test case datasets with expected answers.
Supports file upload (Excel/CSV/JSON) and manual creation.
Backed by Azure Cosmos DB.
"""

from __future__ import annotations

import logging
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
from backend.schemas.golden_dataset import (
    GoldenDatasetCreate,
    GoldenDatasetUpdate,
    GoldenTestCaseInput,
)
from backend.utils.file_parser import parse_uploaded_file

logger = logging.getLogger(__name__)

CONTAINER = "golden_datasets"


# ── CRUD ────────────────────────────────────────────────────────
async def create_golden_dataset(payload: GoldenDatasetCreate) -> Dict[str, Any]:
    """Create a golden dataset with embedded test cases."""
    now = utcnow_iso()
    dataset_id = new_id()

    cases = []
    for idx, case_input in enumerate(payload.cases):
        cases.append({
            "id": new_id(),
            "dataset_id": dataset_id,
            "index": idx,
            "question": case_input.question,
            "expected_answer": case_input.expected_answer,
            "context": case_input.context,
            "category": case_input.category,
            "difficulty": case_input.difficulty,
            "language": None,
            "tags": case_input.tags,
            "created_at": now,
        })

    doc = {
        "id": dataset_id,
        "name": payload.name,
        "description": payload.description,
        "source_filename": None,
        "tags": payload.tags,
        "total_cases": len(payload.cases),
        "is_active": True,
        "created_at": now,
        "updated_at": now,
        "cases": cases,
    }
    return await create_item(CONTAINER, doc)


async def create_golden_dataset_from_file(
    name: str,
    description: str,
    content: bytes,
    filename: str,
) -> Dict[str, Any]:
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
    dataset = await create_golden_dataset(payload)

    # Update source filename
    dataset["source_filename"] = filename
    dataset["updated_at"] = utcnow_iso()
    await upsert_item(CONTAINER, dataset)
    return dataset


async def list_golden_datasets(active_only: bool = True) -> List[Dict[str, Any]]:
    if active_only:
        query = "SELECT * FROM c WHERE c.is_active = true ORDER BY c.created_at DESC"
    else:
        query = "SELECT * FROM c ORDER BY c.created_at DESC"
    return await query_items(CONTAINER, query)


async def get_golden_dataset(dataset_id: str) -> Optional[Dict[str, Any]]:
    return await read_item(CONTAINER, dataset_id)


async def update_golden_dataset(
    dataset_id: str,
    payload: GoldenDatasetUpdate,
) -> Optional[Dict[str, Any]]:
    doc = await read_item(CONTAINER, dataset_id)
    if not doc:
        return None
    for field, value in payload.model_dump(exclude_unset=True).items():
        doc[field] = value
    doc["updated_at"] = utcnow_iso()
    return await upsert_item(CONTAINER, doc)


async def delete_golden_dataset(dataset_id: str) -> bool:
    return await delete_item(CONTAINER, dataset_id)


async def add_cases_to_dataset(
    dataset_id: str,
    cases: List[GoldenTestCaseInput],
) -> Optional[Dict[str, Any]]:
    """Add additional test cases to an existing golden dataset."""
    doc = await read_item(CONTAINER, dataset_id)
    if not doc:
        return None

    existing_cases: List[Dict[str, Any]] = doc.get("cases", [])
    current_max_idx = len(existing_cases)
    now = utcnow_iso()

    for idx, case_input in enumerate(cases):
        existing_cases.append({
            "id": new_id(),
            "dataset_id": dataset_id,
            "index": current_max_idx + idx,
            "question": case_input.question,
            "expected_answer": case_input.expected_answer,
            "context": case_input.context,
            "category": case_input.category,
            "difficulty": case_input.difficulty,
            "language": None,
            "tags": case_input.tags,
            "created_at": now,
        })

    doc["cases"] = existing_cases
    doc["total_cases"] = len(existing_cases)
    doc["updated_at"] = now
    return await upsert_item(CONTAINER, doc)
