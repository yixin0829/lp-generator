"""Learning Path Generator API - app wiring."""

import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.api.router import router
from app.core.config import get_config

# Structured logging
logger.remove()
logger.add(
    sys.stdout,
    level="INFO",
    format="{time:YYYY-MM-DDTHH:mm:ss} {level} [{name}] {message}",
)

app = FastAPI(
    title="Learning Path Generator API",
    description="An intermediary API that leverage OpenAI's GPT API to generate learning path for any topic (e.g. React).",
    version="v1",
)

config = get_config()
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
async def get_root():
    return {"Hello": f"this is Learning Path Generator's BE v1!"}


@app.get("/health")
async def health():
    """Health check endpoint for load balancers and orchestration."""
    return {"status": "ok", "version": "v1"}
