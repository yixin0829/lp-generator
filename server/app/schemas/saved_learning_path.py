"""Schemas for saved learning path endpoints."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SavedLPResponse(BaseModel):
    """Full saved learning path document."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "topic": "React",
                "topicSlug": "react",
                "completion": {
                    "Beginner": ["JSX", "Components"],
                    "Intermediate": ["Hooks", "State"],
                    "Advanced": ["Performance", "Testing"],
                },
                "model": "gpt-5-mini",
                "createdAt": "2026-02-20T08:00:00Z",
                "updatedAt": "2026-02-21T10:30:00Z",
                "published": True,
            },
        }
    )

    topic: str
    topicSlug: str
    completion: dict[str, list[str]]
    model: str
    createdAt: datetime
    updatedAt: datetime
    published: bool = False
    usage: dict[str, int] | None = None


class SavedLPListItem(BaseModel):
    """Lightweight item for the listing endpoint."""

    topic: str
    topicSlug: str
    updatedAt: datetime


class SavedLPUpsertRequest(BaseModel):
    """Request body for creating/updating a saved LP."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "topic": "React",
                "completion": {
                    "Beginner": ["JSX", "Components"],
                    "Intermediate": ["Hooks", "State"],
                    "Advanced": ["Performance", "Testing"],
                },
                "model": "gpt-5-mini",
                "published": True,
            },
        }
    )

    topic: str
    completion: dict[str, list[str]]
    model: str
    usage: dict[str, int] | None = None
    published: bool = False
