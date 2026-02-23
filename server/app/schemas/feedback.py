"""Feedback API schemas."""

from pydantic import BaseModel, Field


class FeedbackRequest(BaseModel):
    """Request body for POST /v1/feedback."""

    text: str = Field(min_length=1, max_length=2000)


class FeedbackResponse(BaseModel):
    """Response model for POST /v1/feedback."""

    message: str
