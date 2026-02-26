"""Router tests for learning path endpoints."""

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import get_cache_service, get_counter_service, get_learning_path_service
from app.main import app
from app.services.cache_service import NoopCacheService


@pytest.fixture(autouse=True)
def _reset_overrides():
    app.dependency_overrides[get_cache_service] = lambda: NoopCacheService()
    yield
    app.dependency_overrides.clear()


class TestGetLpSuccess:
    """Success cases for GET /v1/lp/{topic}."""

    def test_returns_learning_path(self, client: TestClient, mocker):
        mock_svc = mocker.Mock()
        mock_counter = mocker.Mock()
        mock_svc.generate_learning_path = mocker.AsyncMock(
            return_value={
                "topic": "React",
                "completion": {
                    "Beginner": [
                        {
                            "name": "JSX",
                            "summary": "A syntax extension for JavaScript.",
                            "why": "Foundation of React UI.",
                            "connection": "Required before Components.",
                        }
                    ],
                    "Intermediate": [],
                    "Advanced": [],
                },
                "usage": {
                    "prompt_tokens": 10,
                    "completion_tokens": 20,
                    "total_tokens": 30,
                },
                "model": "gpt-5-mini",
            }
        )
        app.dependency_overrides[get_learning_path_service] = lambda: mock_svc
        app.dependency_overrides[get_counter_service] = lambda: mock_counter

        resp = client.get("/v1/lp/react")
        assert resp.status_code == 200
        data = resp.json()
        assert data["topic"] == "React"
        assert "Beginner" in data["completion"]
        assert data["usage"]["total_tokens"] == 30
        mock_counter.increment_learning_paths_generated.assert_called_once()


class TestGetLpValidation:
    """Validation error cases."""

    def test_topic_too_long_400(self, client: TestClient, mocker):
        from app.services.learning_path_service import LearningPathError

        mock_svc = mocker.Mock()
        mock_svc.generate_learning_path = mocker.AsyncMock(
            side_effect=LearningPathError(
                "Input path parameter exceeds maximum length allowed (120 characters).",
                status_code=400,
            )
        )
        app.dependency_overrides[get_learning_path_service] = lambda: mock_svc

        resp = client.get("/v1/lp/" + "a" * 121)
        assert resp.status_code == 400
        assert "exceeds maximum length" in resp.json()["detail"]


class TestGetLpModerationFlagged:
    """Content moderation flagged cases."""

    def test_moderation_flagged_400(self, client: TestClient, mocker):
        from app.services.learning_path_service import LearningPathError

        mock_svc = mocker.Mock()
        mock_svc.generate_learning_path = mocker.AsyncMock(
            side_effect=LearningPathError(
                "User input does not complies with OpenAI's content policy.",
                status_code=400,
            )
        )
        app.dependency_overrides[get_learning_path_service] = lambda: mock_svc

        resp = client.get("/v1/lp/badword")
        assert resp.status_code == 400
        assert "content policy" in resp.json()["detail"]


class TestGetLpError:
    """Server error cases."""

    def test_malformed_response_500(self, client: TestClient, mocker):
        from app.services.learning_path_service import LearningPathError

        mock_svc = mocker.Mock()
        mock_svc.generate_learning_path = mocker.AsyncMock(
            side_effect=LearningPathError(
                "Error while parsing OpenAI's response for learning path.",
                status_code=500,
            )
        )
        app.dependency_overrides[get_learning_path_service] = lambda: mock_svc

        resp = client.get("/v1/lp/python")
        assert resp.status_code == 500
        assert "parsing" in resp.json()["detail"]

    def test_openai_rate_limit_429(self, client: TestClient, mocker):
        from app.services.learning_path_service import LearningPathError

        mock_svc = mocker.Mock()
        mock_svc.generate_learning_path = mocker.AsyncMock(
            side_effect=LearningPathError(
                "Rate limit exceeded. Please try again later.",
                status_code=429,
            )
        )
        app.dependency_overrides[get_learning_path_service] = lambda: mock_svc

        resp = client.get("/v1/lp/react")
        assert resp.status_code == 429
        assert "rate limit" in resp.json()["detail"].lower()

    def test_openai_service_unavailable_503(self, client: TestClient, mocker):
        from app.services.learning_path_service import LearningPathError

        mock_svc = mocker.Mock()
        mock_svc.generate_learning_path = mocker.AsyncMock(
            side_effect=LearningPathError(
                "AI service temporarily unavailable. Please try again later.",
                status_code=503,
            )
        )
        app.dependency_overrides[get_learning_path_service] = lambda: mock_svc

        resp = client.get("/v1/lp/react")
        assert resp.status_code == 503
        assert "unavailable" in resp.json()["detail"].lower()


SAMPLE_LP = {
    "topic": "React",
    "completion": {
        "Beginner": [
            {
                "name": "JSX",
                "summary": "A syntax extension for JavaScript.",
                "why": "Foundation of React UI.",
                "connection": "Required before Components.",
            }
        ],
        "Intermediate": [],
        "Advanced": [],
    },
    "usage": {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30},
    "model": "gpt-5-mini",
}


class TestGetLpCacheHit:
    """Cache hit cases — OpenAI should NOT be called."""

    def test_cache_hit_returns_cached_data(self, client: TestClient, mocker):
        mock_svc = mocker.Mock()
        mock_svc.normalize_topic.return_value = "React"
        mock_counter = mocker.Mock()
        mock_cache = mocker.Mock()
        mock_cache.get.return_value = {**SAMPLE_LP}

        app.dependency_overrides[get_learning_path_service] = lambda: mock_svc
        app.dependency_overrides[get_counter_service] = lambda: mock_counter
        app.dependency_overrides[get_cache_service] = lambda: mock_cache

        resp = client.get("/v1/lp/react")
        assert resp.status_code == 200
        data = resp.json()
        assert data["cached"] is True
        assert data["topic"] == "React"
        mock_svc.generate_learning_path.assert_not_called()
        mock_counter.increment_learning_paths_generated.assert_called_once()

    def test_cache_read_failure_falls_through_to_generation(self, client: TestClient, mocker):
        from app.services.cache_service import CacheServiceError

        mock_svc = mocker.Mock()
        mock_svc.normalize_topic.return_value = "React"
        mock_svc.generate_learning_path = mocker.AsyncMock(return_value={**SAMPLE_LP})
        mock_counter = mocker.Mock()
        mock_cache = mocker.Mock()
        mock_cache.get.side_effect = CacheServiceError("Firestore down")

        app.dependency_overrides[get_learning_path_service] = lambda: mock_svc
        app.dependency_overrides[get_counter_service] = lambda: mock_counter
        app.dependency_overrides[get_cache_service] = lambda: mock_cache

        resp = client.get("/v1/lp/react")
        assert resp.status_code == 200
        data = resp.json()
        assert data["cached"] is False
        mock_svc.generate_learning_path.assert_called_once()


class TestGetLpCacheMiss:
    """Cache miss cases — OpenAI is called, result is cached."""

    def test_cache_miss_generates_and_caches(self, client: TestClient, mocker):
        mock_svc = mocker.Mock()
        mock_svc.normalize_topic.return_value = "React"
        mock_svc.generate_learning_path = mocker.AsyncMock(return_value={**SAMPLE_LP})
        mock_counter = mocker.Mock()
        mock_cache = mocker.Mock()
        mock_cache.get.return_value = None

        app.dependency_overrides[get_learning_path_service] = lambda: mock_svc
        app.dependency_overrides[get_counter_service] = lambda: mock_counter
        app.dependency_overrides[get_cache_service] = lambda: mock_cache

        resp = client.get("/v1/lp/react")
        assert resp.status_code == 200
        data = resp.json()
        assert data["cached"] is False
        mock_svc.generate_learning_path.assert_called_once()
        mock_cache.set.assert_called_once()
        cache_key, cache_value = mock_cache.set.call_args[0]
        assert cache_key == "React"
        assert cache_value["topic"] == "React"
        mock_counter.increment_learning_paths_generated.assert_called_once()

    def test_cache_write_failure_still_returns_response(self, client: TestClient, mocker):
        from app.services.cache_service import CacheServiceError

        mock_svc = mocker.Mock()
        mock_svc.normalize_topic.return_value = "React"
        mock_svc.generate_learning_path = mocker.AsyncMock(return_value={**SAMPLE_LP})
        mock_counter = mocker.Mock()
        mock_cache = mocker.Mock()
        mock_cache.get.return_value = None
        mock_cache.set.side_effect = CacheServiceError("Write failed")

        app.dependency_overrides[get_learning_path_service] = lambda: mock_svc
        app.dependency_overrides[get_counter_service] = lambda: mock_counter
        app.dependency_overrides[get_cache_service] = lambda: mock_cache

        resp = client.get("/v1/lp/react")
        assert resp.status_code == 200
        data = resp.json()
        assert data["topic"] == "React"
        assert data["cached"] is False
