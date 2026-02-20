"""FastAPI dependencies."""

from functools import lru_cache

from google.cloud import firestore
from loguru import logger
from openai import AsyncOpenAI

from app.core.config import Settings, get_config
from app.services.counter_service import (
    BaseCounterService,
    CounterConfig,
    FirestoreCounterService,
    NoopCounterService,
)
from app.services.learning_path_service import LearningPathService


def get_openai_client(config: Settings) -> AsyncOpenAI:
    """Provide async OpenAI client with explicit API key injection."""
    return AsyncOpenAI(api_key=config.openai_api_key)


@lru_cache
def get_learning_path_service() -> LearningPathService:
    """Provide LearningPathService with injected OpenAI client."""
    config = get_config()
    return LearningPathService(
        client=get_openai_client(config),
        model=config.openai_model,
        max_topic_length=config.max_topic_length,
    )


@lru_cache
def get_counter_service() -> BaseCounterService:
    """Provide a counter service implementation from runtime settings."""
    config = get_config()

    if config.counter_backend != "firestore":
        return NoopCounterService(fallback_count=config.counter_seed)

    counter_config = CounterConfig(
        collection=config.firestore_counter_collection,
        document=config.firestore_counter_document,
        field=config.firestore_counter_field,
        fallback_count=config.counter_seed,
    )

    try:
        client = firestore.Client()
        return FirestoreCounterService(client=client, config=counter_config)
    except Exception as e:
        logger.warning(
            "Firestore counter unavailable, falling back to noop counter: {}",
            e,
        )
        return NoopCounterService(fallback_count=config.counter_seed)
