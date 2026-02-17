"""Learning path API router."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from loguru import logger
from openai import (
    APIConnectionError,
    APITimeoutError,
    AuthenticationError,
    BadRequestError,
    InternalServerError,
    PermissionDeniedError,
    RateLimitError,
)

from app.core.config import get_config
from app.core.dependencies import get_counter_service, get_learning_path_service
from app.core.security import limiter, require_api_key
from app.schemas.learning_path import HTTPError, LearningPathResponse
from app.services.counter_service import BaseCounterService, CounterServiceError
from app.services.learning_path_service import (
    ContentModerationError,
    LearningPathService,
    MalformedResponseError,
)

config = get_config()
router = APIRouter(
    prefix="/lp",
    tags=["learning-paths"],
    dependencies=[Depends(require_api_key)],
)


def _http_error(status_code: int, detail: str) -> HTTPException:
    """Create an HTTPException with standard fields."""
    return HTTPException(status_code=status_code, detail=detail)


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
        payload = service.generate_learning_path(topic)
        try:
            counter_service.increment_learning_paths_generated()
        except CounterServiceError as e:
            logger.warning("Learning path counter increment failed: {}", e)
        return payload
    except ValueError as e:
        raise _http_error(status.HTTP_400_BAD_REQUEST, str(e)) from e
    except ContentModerationError as e:
        raise _http_error(status.HTTP_400_BAD_REQUEST, str(e)) from e
    except MalformedResponseError as e:
        logger.error("Malformed OpenAI response: {}", e)
        raise _http_error(status.HTTP_500_INTERNAL_SERVER_ERROR, str(e)) from e
    except RateLimitError as e:
        logger.warning("OpenAI rate limit: {}", e)
        raise _http_error(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Rate limit exceeded. Please try again later.",
        ) from e
    except (AuthenticationError, PermissionDeniedError) as e:
        logger.error("OpenAI auth/permission error: {}", e)
        raise _http_error(
            status.HTTP_502_BAD_GATEWAY,
            "Service configuration error. Please contact support.",
        ) from e
    except BadRequestError as e:
        logger.warning("OpenAI bad request: {}", e)
        raise _http_error(
            status.HTTP_400_BAD_REQUEST,
            str(e) or "Invalid request to AI service.",
        ) from e
    except (APIConnectionError, APITimeoutError, InternalServerError) as e:
        logger.exception("OpenAI service failure: {}", e)
        raise _http_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "AI service temporarily unavailable. Please try again later.",
        ) from e
    except Exception as e:
        logger.exception("Unexpected error generating learning path: {}", e)
        raise _http_error(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "An unexpected error occurred while generating the learning path.",
        ) from e
