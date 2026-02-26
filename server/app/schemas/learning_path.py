"""Learning path API schemas."""

from pydantic import BaseModel, ConfigDict


class LearningPathResponse(BaseModel):
    """Response model for /v1/lp/{topic}."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "topic": "React",
                "completion": {
                    "Beginner": [
                        {
                            "name": "JSX",
                            "summary": "A syntax extension that lets you write HTML-like code inside JavaScript.",
                            "why": "JSX is the foundation of React UI — every component uses it to describe what to render.",
                            "connection": "Required before learning Components, which are built entirely with JSX.",
                        }
                    ],
                    "Intermediate": [
                        {
                            "name": "Hooks",
                            "summary": "Functions like useState and useEffect that let functional components manage state and side effects.",
                            "why": "Hooks replaced class-based patterns and are now the standard way to add interactivity.",
                            "connection": "Enables State management and Custom Hooks, which build on the core hook primitives.",
                        }
                    ],
                    "Advanced": [
                        {
                            "name": "Performance",
                            "summary": "Techniques like memoization, code splitting, and virtualization to optimize React apps.",
                            "why": "Critical for production apps that need to stay fast as they grow in complexity.",
                            "connection": "Applies knowledge from all prior levels to diagnose and fix real-world bottlenecks.",
                        }
                    ],
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
