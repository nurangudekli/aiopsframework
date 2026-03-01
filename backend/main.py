"""
GenAI Ops Framework — FastAPI Application Entry Point.

Mounts all API routers and initialises the database on startup.
Includes Prometheus metrics, JWT auth middleware, and Foundry evaluation.
"""

from __future__ import annotations

import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

from backend.config import settings
from backend.database import init_db

# Import all routers
from backend.api.ab_testing import router as ab_testing_router
from backend.api.prompts import router as prompts_router
from backend.api.evaluation import router as evaluation_router
from backend.api.performance import router as performance_router
from backend.api.security import router as security_router
from backend.api.cost import router as cost_router
from backend.api.rag import router as rag_router
from backend.api.azure_monitor import router as azure_monitor_router
from backend.api.golden_dataset import router as golden_dataset_router
from backend.api.migration_pipeline import router as migration_pipeline_router
from backend.api.codebase_audit import router as codebase_audit_router
from backend.api.migration_guide import router as migration_guide_router
from backend.api.shadow_testing import router as shadow_testing_router
from backend.api.foundry_evaluation import router as foundry_eval_router
from backend.api.continuous_evaluation import router as continuous_eval_router
from backend.api.endpoint_registry import router as endpoint_registry_router
from backend.api.auth import router as auth_router
from backend.api.data_sources import router as data_sources_router

# ── Prometheus metrics ──────────────────────────────────────────
REQUEST_COUNT = Counter(
    "genaiops_http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"],
)
REQUEST_LATENCY = Histogram(
    "genaiops_http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "endpoint"],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)
TOKENS_COUNTER = Counter(
    "genaiops_tokens_total",
    "Total tokens consumed (prompt + completion)",
    ["deployment", "operation"],
)

# ── Logging ─────────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifespan ────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initialising database…")
    await init_db()
    logger.info("GenAI Ops Framework ready.")
    yield
    logger.info("Shutting down GenAI Ops Framework.")


# ── App ─────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.app_name,
    description=(
        "A developer & tester focused GenAI Ops platform.  Bring your model endpoint URL + API key "
        "to run A/B testing, prompt management, evaluation, performance testing, RAG pipelines, "
        "security scans, and cost optimisation — no Azure subscription-owner access required."
    ),
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routers ───────────────────────────────────────────
app.include_router(ab_testing_router, prefix="/api")
app.include_router(prompts_router, prefix="/api")
app.include_router(evaluation_router, prefix="/api")
app.include_router(performance_router, prefix="/api")
app.include_router(security_router, prefix="/api")
app.include_router(cost_router, prefix="/api")
app.include_router(rag_router, prefix="/api")
app.include_router(azure_monitor_router, prefix="/api")
app.include_router(golden_dataset_router, prefix="/api")
app.include_router(migration_pipeline_router, prefix="/api")
app.include_router(codebase_audit_router, prefix="/api")
app.include_router(migration_guide_router, prefix="/api")
app.include_router(shadow_testing_router, prefix="/api")
app.include_router(foundry_eval_router, prefix="/api")
app.include_router(continuous_eval_router, prefix="/api")
app.include_router(endpoint_registry_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(data_sources_router, prefix="/api")


# ── Prometheus middleware ───────────────────────────────────────
@app.middleware("http")
async def prometheus_middleware(request: Request, call_next):
    """Track request count and latency for Prometheus."""
    start = time.perf_counter()
    response: Response = await call_next(request)
    duration = time.perf_counter() - start
    endpoint = request.url.path
    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=endpoint,
        status=response.status_code,
    ).inc()
    REQUEST_LATENCY.labels(
        method=request.method,
        endpoint=endpoint,
    ).observe(duration)
    return response


# ── Prometheus /metrics endpoint ───────────────────────────────
@app.get("/metrics", tags=["Monitoring"], include_in_schema=True)
async def metrics():
    """Prometheus-compatible metrics endpoint."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


# ── Health ──────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy", "service": settings.app_name}


@app.get("/", tags=["Health"])
async def root():
    return {
        "service": settings.app_name,
        "version": "0.1.0",
        "docs": "/docs",
        "endpoints": {
            "A/B Testing": "/api/experiments",
            "Prompts": "/api/prompts",
            "Evaluation": "/api/evaluate",
            "Foundry Evaluation": "/api/foundry-eval/evaluate",
            "Continuous Evaluation": "/api/continuous-eval/runs",
            "Performance": "/api/performance/test",
            "Security": "/api/security/check",
            "Costs": "/api/costs/summary",
            "RAG": "/api/rag/query",
            "Model Endpoints": "/api/model-endpoints",
            "Azure Monitor (optional)": "/api/azure-monitor/scan",
            "Golden Datasets": "/api/golden-datasets",
            "Migration Pipeline": "/api/migration/runs",
            "Codebase Audit": "/api/audit/scan-text",
            "Migration Guide": "/api/migration-guide",
            "Shadow Testing": "/api/shadow-testing",
            "Auth": "/api/auth/login",
            "Prometheus Metrics": "/metrics",
        },
    }


# ── Serve frontend SPA in production ──────────────────────────
# When the built frontend exists at /app/static (Docker production image),
# serve it and fall back to index.html for SPA client-side routing.
_STATIC_DIR = Path(os.environ.get("STATIC_DIR", "/app/static"))

if _STATIC_DIR.is_dir() and (_STATIC_DIR / "index.html").exists():
    from fastapi.responses import FileResponse

    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=_STATIC_DIR / "assets"), name="assets")

    # SPA catch-all: any non-API, non-file route returns index.html
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        file_path = _STATIC_DIR / full_path
        if full_path and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(_STATIC_DIR / "index.html")
