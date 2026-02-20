"""Router tests for learning path endpoints."""

from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import get_counter_service, get_learning_path_service
from app.main import app


@pytest.fixture(autouse=True)
def _reset_overrides():
    yield
    app.dependency_overrides.clear()


class TestGetLpSuccess:
    """Success cases for GET /v1/lp/{topic}."""

    def test_returns_learning_path(self, client: TestClient):
        mock_svc = MagicMock()
        mock_counter = MagicMock()
        mock_svc.generate_learning_path = AsyncMock(return_value={
            "topic": "React",
            "completion": {"Beginner": ["JSX"], "Intermediate": [], "Advanced": []},
            "usage": {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30},
            "model": "gpt-5-mini",
        })
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

    def test_topic_too_long_400(self, client: TestClient):
        mock_svc = MagicMock()
        mock_svc.generate_learning_path = AsyncMock(
            side_effect=ValueError(
                "Input path parameter exceeds maximum length allowed (30 characters)."
            )
        )
        app.dependency_overrides[get_learning_path_service] = lambda: mock_svc

        resp = client.get("/v1/lp/" + "a" * 31)
        assert resp.status_code == 400
        assert "exceeds maximum length" in resp.json()["detail"]


class TestGetLpModerationFlagged:
    """Content moderation flagged cases."""

    def test_moderation_flagged_400(self, client: TestClient):
        from app.services.learning_path_service import ContentModerationError

        mock_svc = MagicMock()
        mock_svc.generate_learning_path = AsyncMock(
            side_effect=ContentModerationError(
                "User input does not complies with OpenAI's content policy."
            )
        )
        app.dependency_overrides[get_learning_path_service] = lambda: mock_svc

        resp = client.get("/v1/lp/badword")
        assert resp.status_code == 400
        assert "content policy" in resp.json()["detail"]


class TestGetLpError:
    """Server error cases."""

    def test_malformed_response_500(self, client: TestClient):
        from app.services.learning_path_service import MalformedResponseError

        mock_svc = MagicMock()
        mock_svc.generate_learning_path = AsyncMock(
            side_effect=MalformedResponseError(
                "Error while parsing OpenAI's response for learning path."
            )
        )
        app.dependency_overrides[get_learning_path_service] = lambda: mock_svc

        resp = client.get("/v1/lp/python")
        assert resp.status_code == 500
        assert "parsing" in resp.json()["detail"]

    def test_openai_rate_limit_429(self, client: TestClient):
        from openai import RateLimitError

        mock_req = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
        mock_resp = httpx.Response(429, request=mock_req)
        mock_svc = MagicMock()
        mock_svc.generate_learning_path = AsyncMock(
            side_effect=RateLimitError(
                "Rate limit exceeded", response=mock_resp, body=None
            )
        )
        app.dependency_overrides[get_learning_path_service] = lambda: mock_svc

        resp = client.get("/v1/lp/react")
        assert resp.status_code == 429
        assert "rate limit" in resp.json()["detail"].lower()

    def test_openai_service_unavailable_503(self, client: TestClient):
        from openai import APIConnectionError

        mock_req = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
        mock_svc = MagicMock()
        mock_svc.generate_learning_path = AsyncMock(
            side_effect=APIConnectionError(
                message="Connection failed", request=mock_req
            )
        )
        app.dependency_overrides[get_learning_path_service] = lambda: mock_svc

        resp = client.get("/v1/lp/react")
        assert resp.status_code == 503
        assert "unavailable" in resp.json()["detail"].lower()
