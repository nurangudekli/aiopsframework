"""
Performance / Stress Testing Service.

Fires concurrent requests against a model endpoint and collects
latency, throughput, and error metrics.  Optionally persists results
to the TestRun / TestCaseResult tables.
"""

from __future__ import annotations

import asyncio
import logging
import random
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession

from backend.schemas.evaluation import PerformanceTestRequest, PerformanceTestResult
from backend.services.model_provider import ModelResponse, call_model, estimate_cost

logger = logging.getLogger(__name__)


async def _single_request(
    provider: str,
    deployment: str,
    question: str,
    system_message: Optional[str],
    params: Dict[str, Any],
    timeout: float,
) -> Dict[str, Any]:
    """Execute a single model request and return metrics dict."""
    messages: List[Dict[str, str]] = []
    if system_message:
        messages.append({"role": "system", "content": system_message})
    messages.append({"role": "user", "content": question})

    try:
        resp: ModelResponse = await asyncio.wait_for(
            call_model(provider, deployment, messages, **params),
            timeout=timeout,
        )
        cost = estimate_cost(deployment, resp.tokens_prompt, resp.tokens_completion)
        return {
            "success": resp.error is None,
            "latency_ms": resp.latency_ms,
            "tokens_prompt": resp.tokens_prompt,
            "tokens_completion": resp.tokens_completion,
            "cost_usd": cost,
            "error": resp.error,
        }
    except asyncio.TimeoutError:
        return {
            "success": False,
            "latency_ms": timeout * 1000,
            "tokens_prompt": 0,
            "tokens_completion": 0,
            "cost_usd": 0,
            "error": "Timeout",
        }
    except Exception as exc:
        return {
            "success": False,
            "latency_ms": 0,
            "tokens_prompt": 0,
            "tokens_completion": 0,
            "cost_usd": 0,
            "error": str(exc),
        }


async def run_performance_test(
    request: PerformanceTestRequest,
    db: Optional[AsyncSession] = None,
) -> PerformanceTestResult:
    """
    Execute a load / stress test against the specified model.

    Sends `total_requests` with `concurrency` workers, rotating through
    the provided questions.
    """
    semaphore = asyncio.Semaphore(request.concurrency)
    results: List[Dict[str, Any]] = []
    params = request.model_params or {}

    async def _bounded_request(question: str):
        async with semaphore:
            return await _single_request(
                request.model_provider,
                request.model_deployment,
                question,
                request.system_message,
                params,
                request.timeout_seconds,
            )

    start_time = time.perf_counter()

    tasks = []
    for i in range(request.total_requests):
        q = request.questions[i % len(request.questions)]
        tasks.append(_bounded_request(q))

    results = await asyncio.gather(*tasks)
    total_time = time.perf_counter() - start_time

    # Aggregate
    successes = [r for r in results if r["success"]]
    failures = [r for r in results if not r["success"]]

    latencies = [r["latency_ms"] for r in successes]
    if not latencies:
        latencies = [0.0]

    lat_arr = np.array(latencies)
    total_tokens = sum(r["tokens_prompt"] + r["tokens_completion"] for r in successes)
    total_cost = sum(r["cost_usd"] for r in results)

    error_details = [{"error": r["error"], "latency_ms": r["latency_ms"]} for r in failures] if failures else None

    perf_result = PerformanceTestResult(
        total_requests=request.total_requests,
        successful_requests=len(successes),
        failed_requests=len(failures),
        avg_latency_ms=round(float(np.mean(lat_arr)), 2),
        p50_latency_ms=round(float(np.percentile(lat_arr, 50)), 2),
        p90_latency_ms=round(float(np.percentile(lat_arr, 90)), 2),
        p99_latency_ms=round(float(np.percentile(lat_arr, 99)), 2),
        min_latency_ms=round(float(np.min(lat_arr)), 2),
        max_latency_ms=round(float(np.max(lat_arr)), 2),
        requests_per_second=round(len(successes) / total_time, 2) if total_time > 0 else 0,
        avg_tokens_per_second=round(total_tokens / total_time, 2) if total_time > 0 else None,
        total_cost_usd=round(total_cost, 6),
        error_details=error_details,
    )

    # ── Persist to DB ───────────────────────────────────────
    if db is not None:
        try:
            await _persist_performance_results(db, request, perf_result, results)
        except Exception as exc:
            logger.warning("Failed to persist performance results: %s", exc)

    return perf_result


async def _persist_performance_results(
    db: AsyncSession,
    request: PerformanceTestRequest,
    result: PerformanceTestResult,
    raw_results: List[Dict[str, Any]],
) -> None:
    """Save performance test run + individual case results to the database."""
    from backend.models.test_run import TestRun, TestCase, TestCaseResult, TestRunStatus

    test_run = TestRun(
        name=f"PerfTest {request.model_deployment} ({request.total_requests}req)",
        description=f"Performance test: {request.concurrency} concurrency, {request.timeout_seconds}s timeout",
        model_provider=request.model_provider,
        model_deployment=request.model_deployment,
        model_params=request.model_params,
        status=TestRunStatus.COMPLETED,
        total_cases=result.total_requests,
        passed_cases=result.successful_requests,
        failed_cases=result.failed_requests,
        completed_at=datetime.now(timezone.utc),
    )
    db.add(test_run)
    await db.flush()

    for i, r in enumerate(raw_results):
        question = request.questions[i % len(request.questions)]
        case = TestCase(
            test_run_id=test_run.id,
            index=i,
            question=question,
        )
        db.add(case)
        await db.flush()

        case_result = TestCaseResult(
            test_case_id=case.id,
            model_label=request.model_deployment,
            latency_ms=r.get("latency_ms"),
            tokens_prompt=r.get("tokens_prompt"),
            tokens_completion=r.get("tokens_completion"),
            cost_usd=r.get("cost_usd"),
            passed=r.get("success"),
            error_message=r.get("error"),
        )
        db.add(case_result)

    await db.commit()
    logger.info("Persisted performance test run %s (%d results)", test_run.id, len(raw_results))


async def list_performance_runs(db: AsyncSession, limit: int = 20) -> List[Dict[str, Any]]:
    """List recent performance test runs from the database."""
    from backend.models.test_run import TestRun
    from sqlalchemy import select

    stmt = select(TestRun).order_by(TestRun.created_at.desc()).limit(limit)
    result = await db.execute(stmt)
    runs = result.scalars().all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "model_provider": r.model_provider,
            "model_deployment": r.model_deployment,
            "status": r.status.value if hasattr(r.status, "value") else r.status,
            "total_cases": r.total_cases,
            "passed_cases": r.passed_cases,
            "failed_cases": r.failed_cases,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        }
        for r in runs
    ]
