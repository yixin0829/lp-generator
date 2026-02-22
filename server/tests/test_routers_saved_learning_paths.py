"""Router tests for saved learning path endpoints."""

from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.core.dependencies import get_saved_lp_service
from app.main import app
from app.services.saved_lp_service import SavedLPServiceError


def _make_saved_lp(topic_slug="react"):
    now = datetime.now(timezone.utc)
    return {
        "topic": "React",
        "topicSlug": topic_slug,
        "completion": {
            "Beginner": ["JSX", "Components"],
            "Intermediate": ["Hooks", "State"],
            "Advanced": ["Performance", "Testing"],
        },
        "model": "gpt-5-mini",
        "createdAt": now,
        "updatedAt": now,
        "published": True,
    }


class TestListSavedLps:
    """GET /v1/lp_saved."""

    def test_returns_published_list(self, client: TestClient, mocker):
        mock_svc = mocker.Mock()
        mock_svc.list_published.return_value = [
            {"topic": "React", "topicSlug": "react", "updatedAt": datetime.now(timezone.utc)},
        ]
        app.dependency_overrides[get_saved_lp_service] = lambda: mock_svc

        try:
            resp = client.get("/v1/lp_saved")
            assert resp.status_code == 200
            data = resp.json()
            assert isinstance(data, list)
            assert len(data) == 1
            assert data[0]["topicSlug"] == "react"
        finally:
            app.dependency_overrides.clear()

    def test_returns_503_on_service_error(self, client: TestClient, mocker):
        mock_svc = mocker.Mock()
        mock_svc.list_published.side_effect = SavedLPServiceError("boom")
        app.dependency_overrides[get_saved_lp_service] = lambda: mock_svc

        try:
            resp = client.get("/v1/lp_saved")
            assert resp.status_code == 503
        finally:
            app.dependency_overrides.clear()


class TestGetSavedLp:
    """GET /v1/lp_saved/{topic_slug}."""

    def test_returns_saved_lp(self, client: TestClient, mocker):
        mock_svc = mocker.Mock()
        mock_svc.get.return_value = _make_saved_lp()
        app.dependency_overrides[get_saved_lp_service] = lambda: mock_svc

        try:
            resp = client.get("/v1/lp_saved/react")
            assert resp.status_code == 200
            data = resp.json()
            assert data["topic"] == "React"
            assert data["topicSlug"] == "react"
            assert data["published"] is True
        finally:
            app.dependency_overrides.clear()

    def test_not_found_404(self, client: TestClient, mocker):
        mock_svc = mocker.Mock()
        mock_svc.get.return_value = None
        app.dependency_overrides[get_saved_lp_service] = lambda: mock_svc

        try:
            resp = client.get("/v1/lp_saved/nonexistent")
            assert resp.status_code == 404
        finally:
            app.dependency_overrides.clear()

    def test_returns_503_on_service_error(self, client: TestClient, mocker):
        mock_svc = mocker.Mock()
        mock_svc.get.side_effect = SavedLPServiceError("boom")
        app.dependency_overrides[get_saved_lp_service] = lambda: mock_svc

        try:
            resp = client.get("/v1/lp_saved/react")
            assert resp.status_code == 503
        finally:
            app.dependency_overrides.clear()


class TestUpsertSavedLp:
    """PUT /v1/lp_saved/{topic_slug}."""

    def test_saves_lp(self, client: TestClient, mocker):
        mock_svc = mocker.Mock()
        mock_svc.upsert.return_value = _make_saved_lp()
        app.dependency_overrides[get_saved_lp_service] = lambda: mock_svc

        body = {
            "topic": "React",
            "completion": {
                "Beginner": ["JSX", "Components"],
                "Intermediate": ["Hooks", "State"],
                "Advanced": ["Performance", "Testing"],
            },
            "model": "gpt-5-mini",
            "published": True,
        }
        try:
            resp = client.put("/v1/lp_saved/react", json=body)
            assert resp.status_code == 200
            mock_svc.upsert.assert_called_once()
        finally:
            app.dependency_overrides.clear()

    def test_topic_slug_mismatch_400(self, client: TestClient, mocker):
        mock_svc = mocker.Mock()
        app.dependency_overrides[get_saved_lp_service] = lambda: mock_svc

        body = {
            "topic": "Python",
            "completion": {"Beginner": ["Variables"]},
            "model": "gpt-5-mini",
            "published": False,
        }
        try:
            resp = client.put("/v1/lp_saved/react", json=body)
            assert resp.status_code == 400
            mock_svc.upsert.assert_not_called()
        finally:
            app.dependency_overrides.clear()

    def test_returns_503_on_service_error(self, client: TestClient, mocker):
        mock_svc = mocker.Mock()
        mock_svc.upsert.side_effect = SavedLPServiceError("boom")
        app.dependency_overrides[get_saved_lp_service] = lambda: mock_svc

        body = {
            "topic": "React",
            "completion": {"Beginner": ["JSX"]},
            "model": "gpt-5-mini",
            "published": True,
        }
        try:
            resp = client.put("/v1/lp_saved/react", json=body)
            assert resp.status_code == 503
        finally:
            app.dependency_overrides.clear()
