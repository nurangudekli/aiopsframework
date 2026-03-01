"""
Performance / Stress Testing API routes.

POST /performance/test  → run a load test
GET  /performance/runs  → list past performance test runs
"""

from __future__ import annotations

from fastapi import APIRouter

from backend.schemas.evaluation import PerformanceTestRequest, PerformanceTestResult
from backend.services.performance import run_performance_test, list_performance_runs

router = APIRouter(prefix="/performance", tags=["Performance Testing"])


@router.post("/test", response_model=PerformanceTestResult)
async def stress_test(payload: PerformanceTestRequest):
    """
    Run a stress / performance test against the specified model.

    Fires `total_requests` using `concurrency` workers and returns
    latency percentiles, throughput, and error rates.
    Results are persisted to the database.
    """
    result = await run_performance_test(payload)
    return result


@router.get("/runs")
async def list_runs(limit: int = 20):
    """List recent performance test runs."""
    return await list_performance_runs(limit=limit)
