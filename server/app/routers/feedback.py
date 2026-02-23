"""Feedback API router."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from loguru import logger

from app.core.config import get_config
from app.core.dependencies import get_feedback_service
from app.core.security import limiter, require_api_key
from app.schemas.feedback import FeedbackRequest, FeedbackResponse
from app.services.feedback_service import BaseFeedbackService, FeedbackServiceError

config = get_config()
router = APIRouter(
    prefix="/feedback",
    tags=["feedback"],
    dependencies=[Depends(require_api_key)],
)


@router.post(
    "",
    response_model=FeedbackResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        status.HTTP_201_CREATED: {"model": FeedbackResponse},
        status.HTTP_422_UNPROCESSABLE_CONTENT: {"description": "Validation error"},
        status.HTTP_503_SERVICE_UNAVAILABLE: {"description": "Feedback storage unavailable"},
    },
)
@limiter.limit(config.feedback_rate_limit)
def submit_feedback(
    request: Request,
    body: FeedbackRequest,
    service: BaseFeedbackService = Depends(get_feedback_service),
) -> FeedbackResponse:
    """Accept user feedback and store it."""
    try:
        service.submit_feedback(body.text)
        return FeedbackResponse(message="Thank you for your feedback!")
    except FeedbackServiceError as e:
        logger.error("Feedback submission failed: {}", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Feedback service is temporarily unavailable. Please try again later.",
        ) from e
