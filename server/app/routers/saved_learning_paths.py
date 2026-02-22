"""Saved learning paths API router."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from loguru import logger

from app.core.config import get_config
from app.core.dependencies import get_saved_lp_service
from app.core.security import limiter, require_api_key
from app.schemas.learning_path import HTTPError
from app.schemas.saved_learning_path import (
    SavedLPListItem,
    SavedLPResponse,
    SavedLPUpsertRequest,
)
from app.services.saved_lp_service import SavedLPServiceError, to_slug

config = get_config()
router = APIRouter(
    prefix="/lp_saved",
    tags=["saved-learning-paths"],
    dependencies=[Depends(require_api_key)],
)


@router.get(
    "",
    response_model=list[SavedLPListItem],
    responses={
        status.HTTP_200_OK: {"model": list[SavedLPListItem]},
        status.HTTP_503_SERVICE_UNAVAILABLE: {"model": HTTPError},
    },
)
@limiter.limit(config.stats_rate_limit)
async def list_saved_lps(request: Request, service=Depends(get_saved_lp_service)):
    """Return all published saved learning paths (lightweight)."""
    try:
        return service.list_published()
    except SavedLPServiceError as e:
        logger.exception("Failed to list saved LPs: {}", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Saved learning paths are temporarily unavailable.",
        ) from e


@router.get(
    "/{topic_slug}",
    response_model=SavedLPResponse,
    responses={
        status.HTTP_200_OK: {"model": SavedLPResponse},
        status.HTTP_404_NOT_FOUND: {"model": HTTPError},
        status.HTTP_503_SERVICE_UNAVAILABLE: {"model": HTTPError},
    },
)
@limiter.limit(config.stats_rate_limit)
async def get_saved_lp(request: Request, topic_slug: str, service=Depends(get_saved_lp_service)):
    """Return a single saved learning path by slug."""
    try:
        doc = service.get(topic_slug)
    except SavedLPServiceError as e:
        logger.exception("Failed to read saved LP: {}", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Saved learning paths are temporarily unavailable.",
        ) from e

    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No saved learning path found for '{topic_slug}'.",
        )
    return doc


@router.put(
    "/{topic_slug}",
    response_model=SavedLPResponse,
    responses={
        status.HTTP_200_OK: {"model": SavedLPResponse},
        status.HTTP_503_SERVICE_UNAVAILABLE: {"model": HTTPError},
    },
)
@limiter.limit(config.lp_rate_limit)
async def upsert_saved_lp(
    request: Request,
    topic_slug: str,
    body: SavedLPUpsertRequest,
    service=Depends(get_saved_lp_service),
):
    """Create or update a saved learning path."""
    expected_slug = to_slug(body.topic)
    if expected_slug != topic_slug:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"URL slug '{topic_slug}' does not match topic '{body.topic}' (expected '{expected_slug}').",
        )

    try:
        doc = service.upsert(
            topic=body.topic,
            completion=body.completion,
            model=body.model,
            usage=body.usage,
            published=body.published,
        )
    except SavedLPServiceError as e:
        logger.exception("Failed to upsert saved LP: {}", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to save learning path.",
        ) from e

    return doc
