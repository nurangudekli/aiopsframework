"""
Model Endpoint Registry — API routes.

Developer/tester focused CRUD for model endpoints.
No Azure subscription required — just provide a model endpoint URL + API key.

Routes:
  POST   /model-endpoints             → Register a new model endpoint
  GET    /model-endpoints             → List registered model endpoints
  GET    /model-endpoints/{id}        → Get model endpoint details
  PUT    /model-endpoints/{id}        → Update model endpoint
  DELETE /model-endpoints/{id}        → Remove model endpoint
  POST   /model-endpoints/{id}/test   → Quick connectivity test
  GET    /model-endpoints/deployments → All model endpoints shaped as DeploymentInfo
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.services.endpoint_registry import registry

router = APIRouter(prefix="/model-endpoints", tags=["Model Endpoints"])
logger = logging.getLogger(__name__)


# ── Request / Response schemas ──────────────────────────────────
class EndpointCreate(BaseModel):
    name: str = Field(..., description="Human-readable label, e.g. 'GPT-4o Staging'")
    provider: str = Field("azure_openai", description="azure_openai | openai | custom")
    endpoint_url: str = Field(..., description="Full model endpoint URL, e.g. https://myaccount.openai.azure.com")
    api_key: str = Field(..., description="API key for the model endpoint")
    deployment_name: str = Field(..., description="Deployment / model name")
    model_name: str = Field("", description="Display model name, e.g. gpt-4o")
    model_version: str = Field("", description="Model version")
    api_version: str = Field("2024-06-01", description="API version (Azure OpenAI)")
    tags: Optional[Dict[str, str]] = None


class EndpointUpdate(BaseModel):
    name: Optional[str] = None
    provider: Optional[str] = None
    endpoint_url: Optional[str] = None
    api_key: Optional[str] = None
    deployment_name: Optional[str] = None
    model_name: Optional[str] = None
    model_version: Optional[str] = None
    api_version: Optional[str] = None
    is_active: Optional[bool] = None
    tags: Optional[Dict[str, str]] = None


class EndpointOut(BaseModel):
    id: str
    name: str
    provider: str
    endpoint_url: str
    api_key_hint: str = Field("", description="Last 4 chars of the key for identification")
    deployment_name: str
    model_name: str
    model_version: str
    api_version: str
    is_active: bool
    tags: Dict[str, str]
    created_at: str
    updated_at: str


class EndpointTestRequest(BaseModel):
    prompt: str = Field("Hello, are you working?", description="Test prompt to send")


def _to_out(ep) -> EndpointOut:
    key = registry.get_api_key(ep.id)
    hint = f"****{key[-4:]}" if len(key) >= 4 else "****"
    return EndpointOut(
        id=ep.id,
        name=ep.name,
        provider=ep.provider,
        endpoint_url=ep.endpoint_url,
        api_key_hint=hint,
        deployment_name=ep.deployment_name,
        model_name=ep.model_name,
        model_version=ep.model_version,
        api_version=ep.api_version,
        is_active=ep.is_active,
        tags=ep.tags,
        created_at=ep.created_at,
        updated_at=ep.updated_at,
    )


# ── Routes ──────────────────────────────────────────────────────
@router.post("", response_model=EndpointOut, summary="Register model endpoint")
async def register_endpoint(req: EndpointCreate):
    """Register a new model endpoint with URL + API key."""
    ep = await registry.register(
        name=req.name,
        provider=req.provider,
        endpoint_url=req.endpoint_url,
        api_key=req.api_key,
        deployment_name=req.deployment_name,
        model_name=req.model_name,
        model_version=req.model_version,
        api_version=req.api_version,
        tags=req.tags,
    )
    return _to_out(ep)


@router.get("", response_model=List[EndpointOut], summary="List model endpoints")
async def list_endpoints(active_only: bool = True):
    """List all registered model endpoints (optionally including inactive ones)."""
    return [_to_out(ep) for ep in await registry.list_all(active_only=active_only)]


@router.get("/deployments", summary="Model deployments for dropdown")
async def list_as_deployments():
    """Return registered model endpoints shaped as DeploymentInfo for the DeploymentSelect component."""
    return await registry.list_as_deployments()


@router.get("/{endpoint_id}", response_model=EndpointOut, summary="Get model endpoint")
async def get_endpoint(endpoint_id: str):
    ep = await registry.get(endpoint_id)
    if not ep:
        raise HTTPException(status_code=404, detail="Model endpoint not found")
    return _to_out(ep)


@router.put("/{endpoint_id}", response_model=EndpointOut, summary="Update model endpoint")
async def update_endpoint(endpoint_id: str, req: EndpointUpdate):
    try:
        updates = {k: v for k, v in req.model_dump().items() if v is not None}
        ep = await registry.update(endpoint_id, **updates)
        return _to_out(ep)
    except KeyError:
        raise HTTPException(status_code=404, detail="Model endpoint not found")


@router.delete("/{endpoint_id}", summary="Delete model endpoint")
async def delete_endpoint(endpoint_id: str):
    if not await registry.get(endpoint_id):
        raise HTTPException(status_code=404, detail="Model endpoint not found")
    await registry.delete(endpoint_id)
    return {"status": "deleted", "id": endpoint_id}


@router.post("/{endpoint_id}/test", summary="Test model endpoint connectivity")
async def test_endpoint(endpoint_id: str, req: EndpointTestRequest = EndpointTestRequest()):
    """Send a quick test prompt to verify the model endpoint is working."""
    if not await registry.get(endpoint_id):
        raise HTTPException(status_code=404, detail="Model endpoint not found")
    result = await registry.test_endpoint(endpoint_id, prompt=req.prompt)
    return result
