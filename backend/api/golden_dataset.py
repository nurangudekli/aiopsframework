"""
Golden Dataset API routes.

POST   /golden-datasets              → create dataset (JSON body)
POST   /golden-datasets/upload       → upload file (Excel/CSV/JSON)
GET    /golden-datasets              → list datasets
GET    /golden-datasets/{id}         → get dataset detail with cases
PATCH  /golden-datasets/{id}         → update metadata
DELETE /golden-datasets/{id}         → delete dataset
POST   /golden-datasets/{id}/cases   → add more cases
"""

from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.schemas.golden_dataset import (
    GoldenDatasetCreate,
    GoldenDatasetDetailOut,
    GoldenDatasetOut,
    GoldenDatasetUpdate,
    GoldenTestCaseInput,
)
from backend.services.golden_dataset import (
    add_cases_to_dataset,
    create_golden_dataset,
    create_golden_dataset_from_file,
    delete_golden_dataset,
    get_golden_dataset,
    list_golden_datasets,
    update_golden_dataset,
)

router = APIRouter(prefix="/golden-datasets", tags=["Golden Datasets"])
logger = logging.getLogger(__name__)


# ── Sample / seed data ──────────────────────────────────────────
SAMPLE_DATASETS = [
    {
        "name": "Customer Service QA",
        "description": "20 customer-service test cases covering billing, tech support, plans, roaming, and edge cases.",
        "tags": {"domain": "customer_service", "language": "en+ar"},
        "cases": [
            {"question": "What are my charges for this month?", "expected_answer": "Your February charges include your base plan fee of $49.99 and any additional usage charges.", "context": "Customer: Premium plan, account since Jan 2024, no overdue balance.", "category": "billing", "difficulty": "easy"},
            {"question": "How can I pay my bill online?", "expected_answer": "You can pay via the mobile app or on our website under Billing & Payments.", "category": "billing", "difficulty": "easy"},
            {"question": "My internet is very slow. What should I do?", "expected_answer": "Try restarting your router, check for service outages in your area, and ensure no bandwidth-heavy apps are running.", "context": "Customer: Home Fiber 100 Mbps plan.", "category": "tech_support", "difficulty": "medium"},
            {"question": "I want to upgrade from Standard to Premium plan.", "expected_answer": "Go to Settings > Plan & Billing > Change Plan. Select Premium ($45.99/mo). Changes take effect next billing cycle.", "category": "plan_change", "difficulty": "easy"},
            {"question": "Will my phone work in Japan?", "expected_answer": "Yes, your device supports international roaming in Japan. Daily rate: $10/day on Premium. Enable roaming in Settings > Roaming before travel.", "category": "roaming", "difficulty": "medium"},
            {"question": "Can I add a second line to my plan?", "expected_answer": "Yes, additional lines are $20/month each. Go to Settings > Add Line.", "category": "plan_change", "difficulty": "easy"},
            {"question": "How do I reset my voicemail PIN?", "expected_answer": "Dial *86, select option 4 for personal options, then option 2 to change your PIN.", "category": "tech_support", "difficulty": "easy"},
            {"question": "What happens if I exceed my data limit?", "expected_answer": "You'll be throttled to 2G speeds until the next billing cycle. You can buy a data add-on ($10/5GB) anytime.", "category": "billing", "difficulty": "medium"},
            {"question": "I need a copy of my last three invoices.", "expected_answer": "You can download invoices from the Billing section of your account page or the mobile app under Payment History.", "category": "billing", "difficulty": "easy"},
            {"question": "Is 5G available in my area?", "expected_answer": "Check our coverage map at coverage.example.com. Enter your zip code to see available network types.", "category": "tech_support", "difficulty": "medium"},
        ],
    },
    {
        "name": "General Knowledge QA",
        "description": "10 general-knowledge questions for baseline model evaluation.",
        "tags": {"domain": "general", "language": "en"},
        "cases": [
            {"question": "What is the capital of France?", "expected_answer": "Paris", "category": "geography", "difficulty": "easy"},
            {"question": "Explain photosynthesis in one sentence.", "expected_answer": "Photosynthesis is the process by which green plants convert sunlight, carbon dioxide, and water into glucose and oxygen.", "category": "science", "difficulty": "easy"},
            {"question": "What is the time complexity of binary search?", "expected_answer": "O(log n)", "category": "computer_science", "difficulty": "easy"},
            {"question": "Summarise the theory of relativity.", "expected_answer": "Einstein's theory of relativity states that the laws of physics are the same for all non-accelerating observers, and the speed of light is constant regardless of the observer's motion.", "category": "physics", "difficulty": "medium"},
            {"question": "What are the SOLID principles in software engineering?", "expected_answer": "Single Responsibility, Open-Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion.", "category": "computer_science", "difficulty": "medium"},
            {"question": "Who wrote 'To Kill a Mockingbird'?", "expected_answer": "Harper Lee", "category": "literature", "difficulty": "easy"},
            {"question": "What is the difference between TCP and UDP?", "expected_answer": "TCP is connection-oriented with guaranteed delivery; UDP is connectionless with no delivery guarantee but lower latency.", "category": "computer_science", "difficulty": "medium"},
            {"question": "Explain the water cycle.", "expected_answer": "Water evaporates from bodies of water, forms clouds through condensation, falls as precipitation, and collects in bodies of water again.", "category": "science", "difficulty": "easy"},
        ],
    },
]


@router.post("/seed-samples", response_model=List[GoldenDatasetOut], status_code=201)
async def seed_sample_datasets(db: AsyncSession = Depends(get_db)):
    """Create built-in sample golden datasets so users can try the Migration Pipeline immediately."""
    created = []
    for sample in SAMPLE_DATASETS:
        # Skip if a dataset with the same name already exists
        existing = await list_golden_datasets(db, active_only=False)
        if any(d.name == sample["name"] for d in existing):
            # Return existing one instead of creating duplicate
            match = next(d for d in existing if d.name == sample["name"])
            created.append(match)
            continue
        payload = GoldenDatasetCreate(
            name=sample["name"],
            description=sample["description"],
            tags=sample.get("tags"),
            cases=[GoldenTestCaseInput(**c) for c in sample["cases"]],
        )
        ds = await create_golden_dataset(db, payload)
        created.append(ds)
        logger.info("Seeded sample golden dataset: %s (%d cases)", ds.name, ds.total_cases)
    return created


@router.post("", response_model=GoldenDatasetOut, status_code=201)
async def create(payload: GoldenDatasetCreate, db: AsyncSession = Depends(get_db)):
    """Create a golden dataset with test cases."""
    return await create_golden_dataset(db, payload)


@router.post("/upload", response_model=GoldenDatasetOut, status_code=201)
async def upload(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: str = Form(""),
    db: AsyncSession = Depends(get_db),
):
    """Upload an Excel/CSV/JSON file to create a golden dataset."""
    content = await file.read()
    try:
        dataset = await create_golden_dataset_from_file(
            db, name, description, content, file.filename or "upload.csv"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return dataset


@router.get("", response_model=List[GoldenDatasetOut])
async def list_all(active_only: bool = True, db: AsyncSession = Depends(get_db)):
    return await list_golden_datasets(db, active_only=active_only)


@router.get("/{dataset_id}", response_model=GoldenDatasetDetailOut)
async def get_one(dataset_id: str, db: AsyncSession = Depends(get_db)):
    dataset = await get_golden_dataset(db, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Golden dataset not found")
    return dataset


@router.patch("/{dataset_id}", response_model=GoldenDatasetOut)
async def update(
    dataset_id: str,
    payload: GoldenDatasetUpdate,
    db: AsyncSession = Depends(get_db),
):
    dataset = await update_golden_dataset(db, dataset_id, payload)
    if not dataset:
        raise HTTPException(status_code=404, detail="Golden dataset not found")
    return dataset


@router.delete("/{dataset_id}", status_code=204)
async def delete(dataset_id: str, db: AsyncSession = Depends(get_db)):
    ok = await delete_golden_dataset(db, dataset_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Golden dataset not found")


@router.post("/{dataset_id}/cases", response_model=GoldenDatasetOut)
async def add_cases(
    dataset_id: str,
    cases: List[GoldenTestCaseInput],
    db: AsyncSession = Depends(get_db),
):
    """Add additional test cases to an existing golden dataset."""
    dataset = await add_cases_to_dataset(db, dataset_id, cases)
    if not dataset:
        raise HTTPException(status_code=404, detail="Golden dataset not found")
    return dataset
