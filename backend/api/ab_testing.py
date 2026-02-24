"""
A/B Testing API routes.

POST /experiments           → create + run an A/B experiment
GET  /experiments           → list experiments
GET  /experiments/{id}      → get experiment detail + results
POST /experiments/upload    → upload Excel/CSV/JSON and run A/B test
PUT  /experiments/{id}/results/{rid}/feedback → submit human preference
"""

from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.database import get_db
from backend.models.experiment import Experiment, ExperimentResult
from backend.schemas.experiment import (
    ExperimentCreate,
    ExperimentDetailOut,
    ExperimentOut,
    ExperimentSummary,
    HumanFeedback,
    ExperimentResultOut,
    ModelConfig,
)
from backend.services.ab_testing import create_experiment, run_experiment, compute_experiment_summary
from backend.utils.file_parser import parse_uploaded_file

router = APIRouter(prefix="/experiments", tags=["A/B Testing"])
logger = logging.getLogger(__name__)


@router.post("", response_model=ExperimentOut, status_code=201)
async def create_and_run(payload: ExperimentCreate, db: AsyncSession = Depends(get_db)):
    """Create an A/B experiment and execute it immediately."""
    experiment = await create_experiment(db, payload)
    experiment = await run_experiment(db, experiment, payload.questions)
    return experiment


@router.post("/upload", response_model=ExperimentOut, status_code=201)
async def upload_and_run(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: str = Form(""),
    model_a_provider: str = Form(...),
    model_a_deployment: str = Form(...),
    model_b_provider: str = Form(...),
    model_b_deployment: str = Form(...),
    system_message: str = Form(""),
    db: AsyncSession = Depends(get_db),
):
    """Upload a file with questions and run an A/B experiment."""
    content = await file.read()
    try:
        cases = parse_uploaded_file(content, file.filename or "upload.csv")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    questions = [c["question"] for c in cases]
    payload = ExperimentCreate(
        name=name,
        description=description,
        model_a=ModelConfig(provider=model_a_provider, deployment=model_a_deployment),
        model_b=ModelConfig(provider=model_b_provider, deployment=model_b_deployment),
        system_message_override=system_message or None,
        questions=questions,
    )
    experiment = await create_experiment(db, payload)
    experiment = await run_experiment(db, experiment, questions)
    return experiment


@router.get("", response_model=List[ExperimentOut])
async def list_experiments(db: AsyncSession = Depends(get_db)):
    stmt = select(Experiment).order_by(Experiment.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{experiment_id}", response_model=ExperimentDetailOut)
async def get_experiment(experiment_id: str, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Experiment)
        .options(selectinload(Experiment.results))
        .where(Experiment.id == experiment_id)
    )
    result = await db.execute(stmt)
    experiment = result.scalar_one_or_none()
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    summary = compute_experiment_summary(experiment, experiment.results)
    return ExperimentDetailOut(
        **{k: v for k, v in ExperimentOut.model_validate(experiment).model_dump().items()},
        results=[ExperimentResultOut.model_validate(r) for r in experiment.results],
        summary=summary.model_dump(),
    )


@router.get("/{experiment_id}/summary", response_model=ExperimentSummary)
async def get_experiment_summary(experiment_id: str, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Experiment)
        .options(selectinload(Experiment.results))
        .where(Experiment.id == experiment_id)
    )
    result = await db.execute(stmt)
    experiment = result.scalar_one_or_none()
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return compute_experiment_summary(experiment, experiment.results)


@router.put("/{experiment_id}/results/{result_id}/feedback")
async def submit_feedback(
    experiment_id: str,
    result_id: str,
    feedback: HumanFeedback,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ExperimentResult).where(
        ExperimentResult.id == result_id,
        ExperimentResult.experiment_id == experiment_id,
    )
    result = await db.execute(stmt)
    er = result.scalar_one_or_none()
    if not er:
        raise HTTPException(status_code=404, detail="Result not found")
    er.human_preference = feedback.preference
    er.human_notes = feedback.notes
    await db.commit()
    return {"status": "ok"}
