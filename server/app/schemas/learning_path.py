"""Learning path API schemas."""

from pydantic import BaseModel, ConfigDict


class LearningPathResponse(BaseModel):
    """Response model for /v1/lp/{topic}."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "topic": "React",
                "completion": {
                    "Beginner": ["JSX", "Components"],
                    "Intermediate": ["Hooks", "State"],
                    "Advanced": ["Performance", "Testing"],
                },
                "usage": {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30},
                "model": "gpt-5-mini",
            },
        }
    )

    topic: str
    completion: dict
    usage: dict
    model: str


class HTTPError(BaseModel):
    """Generic HTTP error response."""

    model_config = ConfigDict(json_schema_extra={"example": {"detail": "HTTPException raised."}})

    detail: str
