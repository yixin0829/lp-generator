"""Learning path API router."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from loguru import logger

from app.core.config import get_config
from app.core.dependencies import get_counter_service, get_learning_path_service
from app.core.security import limiter, require_api_key
from app.schemas.learning_path import HTTPError, LearningPathResponse
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
    service: LearningPathService = Depends(get_learning_path_service),
    counter_service: BaseCounterService = Depends(get_counter_service),
) -> dict:
    """Take any topic and call OpenAI to generate a learning path in JSON format."""
    try:
        payload = await service.generate_learning_path(topic)
        try:
            counter_service.increment_learning_paths_generated()
        except CounterServiceError as e:
            logger.warning("Learning path counter increment failed: {}", e)
        return payload
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
