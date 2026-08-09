"""FastAPI dependencies."""

from functools import lru_cache

from google.cloud import firestore
from loguru import logger
from openai import AsyncOpenAI

from app.core.config import get_config
from app.services.cache_service import (
    BaseCacheService,
    CacheConfig,
    FirestoreCacheService,
    NoopCacheService,
)
from app.services.counter_service import (
    BaseCounterService,
    CounterConfig,
    FirestoreCounterService,
    NoopCounterService,
)
from app.services.feedback_service import (
    BaseFeedbackService,
    FeedbackConfig,
    FirestoreFeedbackService,
    NoopFeedbackService,
)
from app.services.learning_path_service import LearningPathService
from app.services.share_service import (
    BaseShareService,
    FirestoreShareService,
    NoopShareService,
    ShareConfig,
)


@lru_cache
def get_learning_path_service() -> LearningPathService:
    """Provide LearningPathService with injected OpenAI client."""
    config = get_config()
    return LearningPathService(
        client=AsyncOpenAI(api_key=config.openai_api_key),
        model=config.openai_model,
        max_topic_length=config.max_topic_length,
    )


@lru_cache
def get_counter_service() -> BaseCounterService:
    """Provide a counter service implementation from runtime settings."""
    config = get_config()
    fallback_count = 666

    if config.counter_backend != "firestore":
        return NoopCounterService(fallback_count=fallback_count)

    counter_config = CounterConfig(
        collection=config.firestore_counter_collection,
        document=config.firestore_counter_document,
        field=config.firestore_counter_field,
        fallback_count=fallback_count,
    )

    try:
        client = firestore.Client()
        return FirestoreCounterService(client=client, config=counter_config)
    except Exception as e:
        logger.warning(
            "Firestore counter unavailable, falling back to noop counter: {}",
            e,
        )
        return NoopCounterService(fallback_count=fallback_count)


@lru_cache
def get_cache_service() -> BaseCacheService:
    """Provide a cache service implementation from runtime settings."""
    config = get_config()

    if config.cache_backend != "firestore":
        return NoopCacheService()

    cache_config = CacheConfig(
        collection=config.firestore_cache_collection,
        ttl_seconds=config.cache_ttl_seconds,
    )

    try:
        client = firestore.Client()
        return FirestoreCacheService(client=client, config=cache_config)
    except Exception as e:
        logger.warning(
            "Firestore cache unavailable, falling back to noop cache: {}",
            e,
        )
        return NoopCacheService()


@lru_cache
def get_feedback_service() -> BaseFeedbackService:
    """Provide a feedback service implementation from runtime settings."""
    config = get_config()

    if config.feedback_backend != "firestore":
        return NoopFeedbackService()

    feedback_config = FeedbackConfig(
        collection=config.firestore_feedback_collection,
    )

    try:
        client = firestore.Client()
        return FirestoreFeedbackService(client=client, config=feedback_config)
    except Exception as e:
        logger.warning(
            "Firestore feedback unavailable, falling back to noop feedback: {}",
            e,
        )
        return NoopFeedbackService()


@lru_cache
def get_share_service() -> BaseShareService:
    """Provide immutable share storage without falling back to cache storage."""
    config = get_config()
    if config.share_backend != "firestore":
        return NoopShareService()

    try:
        client = firestore.Client()
        return FirestoreShareService(
            client=client,
            config=ShareConfig(collection=config.firestore_share_collection),
        )
    except Exception as e:
        logger.warning("Firestore share storage unavailable: {}", e)
        return NoopShareService()
