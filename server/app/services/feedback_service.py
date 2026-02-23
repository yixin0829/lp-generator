"""Feedback service for storing user feedback."""

from dataclasses import dataclass
from datetime import UTC, datetime

from google.cloud import firestore


class FeedbackServiceError(Exception):
    """Raised when feedback operations fail."""


@dataclass(frozen=True)
class FeedbackConfig:
    """Configuration for feedback storage."""

    collection: str


class BaseFeedbackService:
    """Common interface for feedback providers."""

    def submit_feedback(self, text: str) -> None:
        raise NotImplementedError


class NoopFeedbackService(BaseFeedbackService):
    """Fallback feedback provider for local dev or disabled mode."""

    def submit_feedback(self, text: str) -> None:
        return


class FirestoreFeedbackService(BaseFeedbackService):
    """Firestore-backed feedback provider."""

    def __init__(self, client: firestore.Client, config: FeedbackConfig) -> None:
        self._client = client
        self._config = config

    def submit_feedback(self, text: str) -> None:
        try:
            self._client.collection(self._config.collection).add(
                {
                    "text": text,
                    "created_at": datetime.now(UTC).isoformat(),
                }
            )
        except Exception as e:
            raise FeedbackServiceError(f"Failed to store feedback: {e}") from e
