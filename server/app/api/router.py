"""API router - aggregates endpoints."""

from fastapi import APIRouter

from app.routers import learning_paths, saved_learning_paths, stats

router = APIRouter(prefix="/v1", tags=["v1"])
router.include_router(learning_paths.router)
router.include_router(stats.router)
router.include_router(saved_learning_paths.router)
