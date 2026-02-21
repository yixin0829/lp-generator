"""Stats API router."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from loguru import logger

from app.core.config import get_config
from app.core.dependencies import get_counter_service
from app.core.security import limiter, require_api_key
from app.schemas.learning_path import HTTPError
from app.schemas.stats import StatsResponse
from app.services.counter_service import BaseCounterService, CounterServiceError

config = get_config()
router = APIRouter(
    prefix="/stats",
    tags=["stats"],
    dependencies=[Depends(require_api_key)],
)


@router.get(
    "",
    response_model=StatsResponse,
    responses={
        status.HTTP_200_OK: {"model": StatsResponse},
        status.HTTP_503_SERVICE_UNAVAILABLE: {"model": HTTPError},
    },
)
@limiter.limit(config.stats_rate_limit)
async def get_stats(
    request: Request,
    counter_service: BaseCounterService = Depends(get_counter_service),
) -> StatsResponse:
    """Return current counters for frontend display."""
    try:
        count = counter_service.get_learning_paths_generated()
    except CounterServiceError as e:
        logger.exception("Stats read failed: {}", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stats are temporarily unavailable.",
        ) from e

    return StatsResponse(learning_paths_generated=count)
