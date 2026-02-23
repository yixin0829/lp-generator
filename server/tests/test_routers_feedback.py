"""Router tests for feedback endpoint."""

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import get_feedback_service
from app.main import app
from app.services.feedback_service import FeedbackServiceError


@pytest.fixture(autouse=True)
def _reset_overrides():
    yield
    app.dependency_overrides.clear()


class TestSubmitFeedbackSuccess:
    """Success cases for POST /v1/feedback."""

    def test_returns_201_and_calls_service(self, client: TestClient, mocker):
        mock_svc = mocker.Mock()
        app.dependency_overrides[get_feedback_service] = lambda: mock_svc

        resp = client.post("/v1/feedback", json={"text": "Great app!"})
        assert resp.status_code == 201
        data = resp.json()
        assert "message" in data
        mock_svc.submit_feedback.assert_called_once_with("Great app!")


class TestSubmitFeedbackValidation:
    """Validation error cases."""

    def test_empty_text_422(self, client: TestClient, mocker):
        mock_svc = mocker.Mock()
        app.dependency_overrides[get_feedback_service] = lambda: mock_svc

        resp = client.post("/v1/feedback", json={"text": ""})
        assert resp.status_code == 422

    def test_missing_text_422(self, client: TestClient, mocker):
        mock_svc = mocker.Mock()
        app.dependency_overrides[get_feedback_service] = lambda: mock_svc

        resp = client.post("/v1/feedback", json={})
        assert resp.status_code == 422

    def test_text_too_long_422(self, client: TestClient, mocker):
        mock_svc = mocker.Mock()
        app.dependency_overrides[get_feedback_service] = lambda: mock_svc

        resp = client.post("/v1/feedback", json={"text": "a" * 2001})
        assert resp.status_code == 422


class TestSubmitFeedbackError:
    """Service failure cases."""

    def test_firestore_failure_503(self, client: TestClient, mocker):
        mock_svc = mocker.Mock()
        mock_svc.submit_feedback.side_effect = FeedbackServiceError("Firestore down")
        app.dependency_overrides[get_feedback_service] = lambda: mock_svc

        resp = client.post("/v1/feedback", json={"text": "test"})
        assert resp.status_code == 503
        assert "unavailable" in resp.json()["detail"].lower()
