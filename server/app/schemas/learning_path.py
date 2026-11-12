"""Learning path API schemas."""

from enum import StrEnum

from pydantic import BaseModel, ConfigDict


class FailureCode(StrEnum):
    """Why a learning path request failed.

    Sent as `code` beside `detail`. The client picks its error screen from the
    code, so `detail` can be reworded freely. Adding a code needs a matching
    entry in the client's generationFailure.js; an unknown code falls back to
    the HTTP status there.
    """

    MODERATED = "moderated"
    TOPIC_TOO_LONG = "topic_too_long"
    TOPIC_INVALID = "topic_invalid"
    RATE_LIMITED = "rate_limited"
    UPSTREAM_DOWN = "upstream_down"
    UPSTREAM_REJECTED = "upstream_rejected"
    MISCONFIGURED = "misconfigured"
    GENERATION_FAILED = "generation_failed"


class LearningPathResponse(BaseModel):
    """Response model for /v1/lp/{topic}."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "topic": "React",
                "completion": {
                    "nodes": [
                        {
                            "id": "jsx",
                            "label": "JSX",
                            "level": "Beginner",
                            "summary": "A syntax extension that lets you write HTML-like code inside JavaScript.",
                            "why": "JSX is the foundation of React UI.",
                        },
                        {
                            "id": "hooks",
                            "label": "Hooks",
                            "level": "Intermediate",
                            "summary": "Functions like useState and useEffect for state and side effects.",
                            "why": "Standard way to add interactivity.",
                        },
                    ],
                    "edges": [
                        {
                            "source": "jsx",
                            "target": "hooks",
                            "relationship": "Understanding JSX is needed before learning hook-driven component logic.",
                        }
                    ],
                    "Beginner": [
                        {
                            "name": "JSX",
                            "summary": "A syntax extension that lets you write HTML-like code inside JavaScript.",
                            "why": "JSX is the foundation of React UI.",
                            "connection": "Leads to Hooks: Understanding JSX is needed before learning hook-driven component logic.",
                        }
                    ],
                    "Intermediate": [
                        {
                            "name": "Hooks",
                            "summary": "Functions like useState and useEffect for state and side effects.",
                            "why": "Standard way to add interactivity.",
                            "connection": "",
                        }
                    ],
                    "Advanced": [],
                },
                "usage": {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30},
                "model": "gpt-6-luna",
                "cached": False,
            },
        }
    )

    topic: str
    completion: dict
    usage: dict
    model: str
    cached: bool = False


class HTTPError(BaseModel):
    """Generic HTTP error response."""

    model_config = ConfigDict(json_schema_extra={"example": {"detail": "HTTPException raised."}})

    detail: str
    code: FailureCode | None = None
