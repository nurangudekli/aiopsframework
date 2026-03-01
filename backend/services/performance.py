"""
Performance / Stress Testing Service.

Fires concurrent requests against a model endpoint and collects
latency, throughput, and error metrics.  Optionally persists results
to Azure Cosmos DB.
"""

from __future__ import annotations

import asyncio
import logging
import random
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import numpy as np

from backend.cosmos_client import create_item, new_id, query_items, utcnow_iso
from backend.schemas.evaluation import PerformanceTestRequest, PerformanceTestResult
from backend.services.model_provider import ModelResponse, call_model, estimate_cost

logger = logging.getLogger(__name__)

CONTAINER = "test_runs"


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
    persist: bool = True,
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

    # ── Persist to Cosmos DB ────────────────────────────────
    if persist:
        try:
            await _persist_performance_results(request, perf_result, results)
        except Exception as exc:
            logger.warning("Failed to persist performance results: %s", exc)

    return perf_result


async def _persist_performance_results(
    request: PerformanceTestRequest,
    result: PerformanceTestResult,
    raw_results: List[Dict[str, Any]],
) -> None:
    """Save performance test run + individual case results to Cosmos DB."""
    now = utcnow_iso()
    run_id = new_id()

    cases = []
    for i, r in enumerate(raw_results):
        question = request.questions[i % len(request.questions)]
        case_id = new_id()
        case = {
            "id": case_id,
            "test_run_id": run_id,
            "index": i,
            "question": question,
            "expected_answer": None,
            "context": None,
            "tags": None,
            "results": [
                {
                    "id": new_id(),
                    "test_case_id": case_id,
                    "model_label": request.model_deployment,
                    "response": None,
                    "latency_ms": r.get("latency_ms"),
                    "tokens_prompt": r.get("tokens_prompt"),
                    "tokens_completion": r.get("tokens_completion"),
                    "cost_usd": r.get("cost_usd"),
                    "similarity_to_expected": None,
                    "passed": r.get("success"),
                    "error_message": r.get("error"),
                    "created_at": now,
                }
            ],
        }
        cases.append(case)

    doc = {
        "id": run_id,
        "name": f"PerfTest {request.model_deployment} ({request.total_requests}req)",
        "description": f"Performance test: {request.concurrency} concurrency, {request.timeout_seconds}s timeout",
        "source_filename": None,
        "source_format": None,
        "model_provider": request.model_provider,
        "model_deployment": request.model_deployment,
        "model_params": request.model_params,
        "status": "completed",
        "total_cases": result.total_requests,
        "passed_cases": result.successful_requests,
        "failed_cases": result.failed_requests,
        "created_at": now,
        "completed_at": now,
        "cases": cases,
    }
    await create_item(CONTAINER, doc)
    logger.info("Persisted performance test run %s (%d results)", run_id, len(raw_results))


async def list_performance_runs(limit: int = 20) -> List[Dict[str, Any]]:
    """List recent performance test runs from Cosmos DB."""
    docs = await query_items(
        CONTAINER,
        "SELECT c.id, c.name, c.model_provider, c.model_deployment, c.status, "
        "c.total_cases, c.passed_cases, c.failed_cases, c.created_at, c.completed_at "
        "FROM c ORDER BY c.created_at DESC OFFSET 0 LIMIT @limit",
        parameters=[{"name": "@limit", "value": limit}],
    )
    return docs
