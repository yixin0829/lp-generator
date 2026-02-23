"""Unit tests for cache service."""

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import pytest

from app.services.cache_service import (
    CacheConfig,
    CacheServiceError,
    FirestoreCacheService,
    NoopCacheService,
)

SAMPLE_PAYLOAD = {
    "topic": "React",
    "completion": {"Beginner": ["JSX"], "Intermediate": [], "Advanced": []},
    "usage": {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30},
    "model": "gpt-5-mini",
}

DEFAULT_CONFIG = CacheConfig(collection="learning_path_cache", ttl_seconds=604800)


# ── Noop ────────────────────────────────────────────────────────


class TestNoopCacheService:
    def test_get_returns_none(self):
        svc = NoopCacheService()
        assert svc.get("React") is None

    def test_set_does_nothing(self):
        svc = NoopCacheService()
        svc.set("React", SAMPLE_PAYLOAD)  # should not raise


# ── Firestore: get ──────────────────────────────────────────────


class TestFirestoreCacheServiceGet:
    def _make_service(self, mock_client, config=None):
        return FirestoreCacheService(client=mock_client, config=config or DEFAULT_CONFIG)

    def test_cache_miss_doc_not_found(self):
        mock_client = MagicMock()
        snapshot = MagicMock()
        snapshot.exists = False
        mock_client.collection().document().get.return_value = snapshot

        svc = self._make_service(mock_client)
        assert svc.get("React") is None

    def test_cache_hit_within_ttl(self):
        mock_client = MagicMock()
        snapshot = MagicMock()
        snapshot.exists = True
        snapshot.to_dict.return_value = {
            "payload": SAMPLE_PAYLOAD,
            "created_at": datetime.now(UTC).isoformat(),
        }
        mock_client.collection().document().get.return_value = snapshot

        svc = self._make_service(mock_client)
        result = svc.get("React")
        assert result == SAMPLE_PAYLOAD

    def test_cache_expired_beyond_ttl(self):
        mock_client = MagicMock()
        snapshot = MagicMock()
        snapshot.exists = True
        old_time = datetime.now(UTC) - timedelta(seconds=DEFAULT_CONFIG.ttl_seconds + 1)
        snapshot.to_dict.return_value = {
            "payload": SAMPLE_PAYLOAD,
            "created_at": old_time.isoformat(),
        }
        mock_client.collection().document().get.return_value = snapshot

        svc = self._make_service(mock_client)
        assert svc.get("React") is None

    def test_cache_miss_no_created_at(self):
        mock_client = MagicMock()
        snapshot = MagicMock()
        snapshot.exists = True
        snapshot.to_dict.return_value = {"payload": SAMPLE_PAYLOAD}
        mock_client.collection().document().get.return_value = snapshot

        svc = self._make_service(mock_client)
        assert svc.get("React") is None

    def test_firestore_error_raises_cache_service_error(self):
        mock_client = MagicMock()
        mock_client.collection().document().get.side_effect = Exception("Firestore down")

        svc = self._make_service(mock_client)
        with pytest.raises(CacheServiceError, match="Failed to read cache"):
            svc.get("React")


# ── Firestore: set ──────────────────────────────────────────────


class TestFirestoreCacheServiceSet:
    def test_set_writes_document(self):
        mock_client = MagicMock()
        doc_ref = mock_client.collection().document()

        svc = FirestoreCacheService(client=mock_client, config=DEFAULT_CONFIG)
        svc.set("React", SAMPLE_PAYLOAD)

        doc_ref.set.assert_called_once()
        written = doc_ref.set.call_args[0][0]
        assert written["payload"] == SAMPLE_PAYLOAD
        assert "created_at" in written

    def test_firestore_error_raises_cache_service_error(self):
        mock_client = MagicMock()
        mock_client.collection().document().set.side_effect = Exception("Firestore down")

        svc = FirestoreCacheService(client=mock_client, config=DEFAULT_CONFIG)
        with pytest.raises(CacheServiceError, match="Failed to write cache"):
            svc.set("React", SAMPLE_PAYLOAD)
