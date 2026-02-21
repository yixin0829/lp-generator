"""Router tests for stats endpoint."""

from fastapi.testclient import TestClient

from app.core.dependencies import get_counter_service
from app.main import app


def test_stats_returns_counter_value(client: TestClient, mocker):
    mock_counter = mocker.Mock()
    mock_counter.get_learning_paths_generated.return_value = 1234
    app.dependency_overrides[get_counter_service] = lambda: mock_counter

    try:
        resp = client.get("/v1/stats")
        assert resp.status_code == 200
        assert resp.json() == {"learning_paths_generated": 1234}
    finally:
        app.dependency_overrides.clear()
