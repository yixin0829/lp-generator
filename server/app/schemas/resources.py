"""On-demand learning resources."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class ResourceRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=120)
    concept: str = Field(min_length=1, max_length=120)
    level: Literal["Beginner", "Intermediate", "Advanced"] = "Beginner"
    language: str = Field(default="en", min_length=2, max_length=12)

    @field_validator("topic", "concept")
    @classmethod
    def nonblank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Topic and concept must not be blank")
        return value


class LearningResource(BaseModel):
    title: str
    url: str
    publisher: str
    format: str
    level: str
    why: str
    provenance: Literal["catalogue", "web_search"]
    retrieved_at: str


class ResourceResponse(BaseModel):
    resources: list[LearningResource]
    cached: bool = False
    provider: str
    message: str = ""
