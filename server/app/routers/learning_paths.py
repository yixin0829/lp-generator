"""Learning path API router."""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool
from loguru import logger

from app.core.config import get_config
from app.core.dependencies import get_cache_service, get_counter_service, get_learning_path_service
from app.core.security import limiter, require_api_key
from app.schemas.learning_path import HTTPError, LearningPathResponse
from app.services.cache_service import BaseCacheService, CacheServiceError
from app.services.counter_service import BaseCounterService, CounterServiceError
from app.services.learning_path_service import (
    LearningPathError,
    LearningPathService,
)

config = get_config()
router = APIRouter(
    prefix="/lp",
    tags=["learning-paths"],
    dependencies=[Depends(require_api_key)],
)


def _safe_increment_counter(counter_service: BaseCounterService) -> None:
    """Increment the generation counter, swallowing failures (background-safe)."""
    try:
        counter_service.increment_learning_paths_generated()
    except CounterServiceError as e:
        logger.warning("Learning path counter increment failed: {}", e)
    except Exception as e:  # noqa: BLE001 - background task must never raise
        logger.warning("Unexpected learning path counter increment failure: {}", e)


def _safe_cache_set(cache_service: BaseCacheService, key: str, payload: dict) -> None:
    """Write to cache, swallowing failures (background-safe)."""
    try:
        cache_service.set(key, payload)
    except CacheServiceError as e:
        logger.warning("Cache write failed: {}", e)
    except Exception as e:  # noqa: BLE001 - background task must never raise
        logger.warning("Unexpected cache write failure: {}", e)


@router.get(
    "/{topic}",
    response_model=LearningPathResponse,
    responses={
        status.HTTP_200_OK: {"model": LearningPathResponse},
        status.HTTP_400_BAD_REQUEST: {"model": HTTPError},
        status.HTTP_429_TOO_MANY_REQUESTS: {"model": HTTPError},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": HTTPError},
        status.HTTP_502_BAD_GATEWAY: {"model": HTTPError},
        status.HTTP_503_SERVICE_UNAVAILABLE: {"model": HTTPError},
    },
)
@limiter.limit(config.lp_rate_limit)
async def get_lp(
    request: Request,
    topic: str,
    background_tasks: BackgroundTasks,
    service: LearningPathService = Depends(get_learning_path_service),
    counter_service: BaseCounterService = Depends(get_counter_service),
    cache_service: BaseCacheService = Depends(get_cache_service),
) -> dict:
    """Take any topic and call OpenAI to generate a learning path in JSON format."""
    normalized = service.normalize_topic(topic)

    # Try cache first. Cache reads are blocking network calls, so run them off
    # the event loop to avoid stalling other concurrent requests.
    try:
        cached = await run_in_threadpool(cache_service.get, normalized)
    except CacheServiceError as e:
        logger.warning("Cache read failed, proceeding without cache: {}", e)
        cached = None

    if cached is not None:
        cached["cached"] = True
        # Counter increment is not needed for the response; defer it so the
        # cached payload returns to the client immediately.
        background_tasks.add_task(_safe_increment_counter, counter_service)
        return cached

    # Cache miss — generate from OpenAI
    try:
        payload = await service.generate_learning_path(topic)
    except LearningPathError as e:
        if e.status_code >= status.HTTP_500_INTERNAL_SERVER_ERROR:
            logger.error("Learning path request failed: {}", e)
        else:
            logger.warning("Learning path request rejected: {}", e)
        raise HTTPException(status_code=e.status_code, detail=str(e)) from e
    except Exception as e:
        logger.exception("Unexpected error generating learning path: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while generating the learning path.",
        ) from e

    payload["cached"] = False

    # Cache write and counter increment are not on the critical path; run them
    # after the response is sent so generation latency is not inflated.
    background_tasks.add_task(_safe_cache_set, cache_service, normalized, payload)
    background_tasks.add_task(_safe_increment_counter, counter_service)

    return payload
