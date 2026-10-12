"""Stats API schemas."""

from pydantic import BaseModel, ConfigDict


class GenerationEstimate(BaseModel):
    model: str
    sample_count: int
    median_seconds: float
    lower_seconds: int
    upper_seconds: int


class StatsResponse(BaseModel):
    """Response model for /v1/stats."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "learning_paths_generated": 6,
            },
        }
    )

    learning_paths_generated: int
    generation_estimate: GenerationEstimate | None = None
