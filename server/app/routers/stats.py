"""Stats API router."""

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger

from app.core.dependencies import get_counter_service
from app.schemas.stats import StatsResponse
from app.services.counter_service import BaseCounterService, CounterServiceError

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("", response_model=StatsResponse)
async def get_stats(
    counter_service: BaseCounterService = Depends(get_counter_service),
) -> StatsResponse:
    """Return current counters for frontend display."""
    try:
        count = counter_service.get_learning_paths_generated()
    except CounterServiceError as e:
        logger.warning("Stats read failed: {}", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stats are temporarily unavailable.",
        ) from e

    return StatsResponse(learning_paths_generated=count)
