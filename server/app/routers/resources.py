"""Read-only, independently rate-limited resource discovery."""

import asyncio
from functools import lru_cache

from fastapi import APIRouter, Depends, HTTPException, Request
from openai import AsyncOpenAI

from app.core.config import get_config
from app.core.security import limiter, require_api_key
from app.schemas.resources import ResourceRequest, ResourceResponse
from app.services.resource_service import ResourceService

router = APIRouter(prefix="/resources", tags=["resources"], dependencies=[Depends(require_api_key)])


@lru_cache
def get_resource_service() -> ResourceService:
    config = get_config()
    provider = config.resource_provider
    client = None
    if provider in {"web_search", "hybrid"}:
        client = AsyncOpenAI(api_key=config.openai_api_key, max_retries=0, timeout=18)
    return ResourceService(provider=provider, client=client)


@router.post("", response_model=ResourceResponse)
# This is a coarse upstream-IP guard. Vercel callers may share a bucket;
# never treat unverified forwarded headers as per-user identity.
@limiter.limit("5/minute")
async def get_resources(
    request: Request,
    body: ResourceRequest,
    service: ResourceService = Depends(get_resource_service),
) -> ResourceResponse:
    try:
        return await asyncio.wait_for(service.get(body), timeout=20)
    except Exception as exc:
        # Keep provider responses/credentials out of user-visible failures.
        raise HTTPException(
            status_code=503,
            detail="Resources are temporarily unavailable. Your learning path is still available.",
        ) from exc
