"""Cache service for storing and retrieving generated learning paths."""

from dataclasses import dataclass
from datetime import UTC, datetime

from google.cloud import firestore


class CacheServiceError(Exception):
    """Raised when cache operations fail."""


@dataclass(frozen=True)
class CacheConfig:
    """Configuration for learning path cache storage."""

    collection: str
    ttl_seconds: int


class BaseCacheService:
    """Common interface for cache providers."""

    def get(self, key: str) -> dict | None:
        raise NotImplementedError

    def set(self, key: str, value: dict) -> None:
        raise NotImplementedError


class NoopCacheService(BaseCacheService):
    """Fallback cache provider that never caches (local dev / disabled mode)."""

    def get(self, key: str) -> dict | None:
        return None

    def set(self, key: str, value: dict) -> None:
        return


class FirestoreCacheService(BaseCacheService):
    """Firestore-backed cache provider."""

    def __init__(self, client: firestore.Client, config: CacheConfig) -> None:
        self._client = client
        self._config = config

    def _doc_ref(self, key: str):
        return self._client.collection(self._config.collection).document(key)

    def get(self, key: str) -> dict | None:
        try:
            snapshot = self._doc_ref(key).get()
            if not snapshot.exists:
                return None

            doc = snapshot.to_dict() or {}
            created_at_str = doc.get("created_at")
            if not created_at_str:
                return None

            created_at = datetime.fromisoformat(created_at_str)
            age_seconds = (datetime.now(UTC) - created_at).total_seconds()
            if age_seconds > self._config.ttl_seconds:
                return None

            return doc.get("payload")
        except Exception as e:
            raise CacheServiceError(f"Failed to read cache for key '{key}': {e}") from e

    def set(self, key: str, value: dict) -> None:
        try:
            self._doc_ref(key).set(
                {
                    "payload": value,
                    "created_at": datetime.now(UTC).isoformat(),
                }
            )
        except Exception as e:
            raise CacheServiceError(f"Failed to write cache for key '{key}': {e}") from e
