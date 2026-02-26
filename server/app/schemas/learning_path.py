"""Learning path API schemas."""

from pydantic import BaseModel, ConfigDict


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
                "model": "gpt-5-mini",
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
