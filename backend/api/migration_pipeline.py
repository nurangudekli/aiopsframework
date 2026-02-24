"""
Migration Pipeline API routes.

POST   /migration/runs                      → create + execute a migration evaluation
GET    /migration/runs                      → list migration runs
GET    /migration/runs/{id}                 → get migration run detail + results
GET    /migration/runs/{id}/summary         → stakeholder-friendly summary
GET    /migration/runs/{id}/export          → export results (CSV or JSON)
POST   /migration/parameter-diff            → compare model parameters
"""

from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.schemas.migration_pipeline import (
    MigrationRunCreate,
    MigrationRunOut,
    MigrationRunDetailOut,
    MigrationResultOut,
    MigrationSummary,
    ParameterDiffRequest,
    ParameterDiffOut,
)
from backend.services.migration_pipeline import (
    create_migration_run,
    execute_migration_run,
    list_migration_runs,
    get_migration_run,
    compute_migration_summary,
    compute_parameter_diff,
    export_results_csv,
    export_results_json,
)

router = APIRouter(prefix="/migration", tags=["Migration Pipeline"])
logger = logging.getLogger(__name__)


@router.post("/runs", response_model=MigrationRunOut, status_code=201)
async def create_and_run(payload: MigrationRunCreate, db: AsyncSession = Depends(get_db)):
    """Create a migration evaluation run and execute it."""
    try:
        run = await create_migration_run(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    run = await execute_migration_run(db, run, similarity_threshold=payload.similarity_threshold)
    return run


@router.get("/runs", response_model=List[MigrationRunOut])
async def list_runs(db: AsyncSession = Depends(get_db)):
    return await list_migration_runs(db)


@router.get("/runs/{run_id}", response_model=MigrationRunDetailOut)
async def get_run(run_id: str, db: AsyncSession = Depends(get_db)):
    run = await get_migration_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Migration run not found")
    return run


@router.get("/runs/{run_id}/summary", response_model=MigrationSummary)
async def get_summary(run_id: str, db: AsyncSession = Depends(get_db)):
    """Get a stakeholder-friendly summary with recommendation."""
    run = await get_migration_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Migration run not found")
    return compute_migration_summary(run, run.results)


@router.get("/runs/{run_id}/export")
async def export_run(
    run_id: str,
    format: str = Query("csv", pattern="^(csv|json)$"),
    db: AsyncSession = Depends(get_db),
):
    """Export migration results for stakeholder review."""
    run = await get_migration_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Migration run not found")

    if format == "csv":
        content = export_results_csv(run, run.results)
        return PlainTextResponse(
            content=content,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="migration_{run_id}.csv"'},
        )
    else:
        content = export_results_json(run, run.results)
        return JSONResponse(
            content={"data": content},
            headers={"Content-Disposition": f'attachment; filename="migration_{run_id}.json"'},
        )


@router.post("/parameter-diff", response_model=ParameterDiffOut)
async def parameter_diff(payload: ParameterDiffRequest):
    """Compare parameters between source and target models."""
    return compute_parameter_diff(payload.source_model.deployment, payload.target_model.deployment)
