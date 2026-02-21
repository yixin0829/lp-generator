"""Counter service for tracking generated learning paths."""

from dataclasses import dataclass

from google.cloud import firestore


class CounterServiceError(Exception):
    """Raised when counter operations fail."""


@dataclass(frozen=True)
class CounterConfig:
    """Configuration for learning path counter storage."""

    collection: str
    document: str
    field: str
    fallback_count: int


class BaseCounterService:
    """Common interface for counter providers."""

    def increment_learning_paths_generated(self) -> None:
        raise NotImplementedError

    def get_learning_paths_generated(self) -> int:
        raise NotImplementedError


class NoopCounterService(BaseCounterService):
    """Fallback counter provider for local/dev or disabled mode."""

    def __init__(self, fallback_count: int = 0) -> None:
        self._fallback_count = fallback_count

    def increment_learning_paths_generated(self) -> None:
        return

    def get_learning_paths_generated(self) -> int:
        return self._fallback_count


class FirestoreCounterService(BaseCounterService):
    """Firestore-backed counter provider."""

    def __init__(self, client: firestore.Client, config: CounterConfig) -> None:
        self._client = client
        self._config = config

    def _doc_ref(self):
        return self._client.collection(self._config.collection).document(self._config.document)

    def increment_learning_paths_generated(self) -> None:
        try:
            self._doc_ref().set(
                {self._config.field: firestore.Increment(1)},
                merge=True,
            )
        except Exception as e:
            raise CounterServiceError(f"Failed to increment learning path counter: {e}") from e

    def get_learning_paths_generated(self) -> int:
        try:
            snapshot = self._doc_ref().get()
            if not snapshot.exists:
                return self._config.fallback_count

            payload = snapshot.to_dict() or {}
            value = payload.get(self._config.field, self._config.fallback_count)
            if not isinstance(value, int):
                return self._config.fallback_count
            return value
        except Exception as e:
            raise CounterServiceError(f"Failed to read learning path counter: {e}") from e
