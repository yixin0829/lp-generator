from unittest.mock import AsyncMock

from app.core.dependencies import get_learning_path_service, get_share_service
from app.main import app
from app.services.learning_path_service import LearningPathError
from app.services.share_service import BaseShareService, NoopShareService
from tests.test_services_share import sample_snapshot


class MemoryShareService(BaseShareService):
    def __init__(self):
        self.values = {}

    def create(self, snapshot):
        share_id = "a" * 22
        self.values[share_id] = snapshot.model_copy(deep=True)
        return share_id

    def get(self, share_id):
        value = self.values.get(share_id)
        return value.model_copy(deep=True) if value else None


def test_create_and_retrieve_immutable_snapshot(client):
    storage = MemoryShareService()
    moderation = AsyncMock()
    app.dependency_overrides[get_share_service] = lambda: storage
    app.dependency_overrides[get_learning_path_service] = lambda: type(
        "Moderation", (), {"check_moderation": moderation}
    )()
    try:
        response = client.post("/v1/shares", json=sample_snapshot().model_dump())
        assert response.status_code == 201
        assert response.json() == {"share_id": "a" * 22}
        moderation.assert_awaited_once()

        retrieved = client.get(f"/v1/shares/{'a' * 22}")
        assert retrieved.status_code == 200
        assert retrieved.json()["snapshot"]["levels"]["Beginner"] == ["JSX"]
    finally:
        app.dependency_overrides.clear()


def test_unknown_and_malformed_ids_return_404(client):
    app.dependency_overrides[get_share_service] = MemoryShareService
    try:
        assert client.get(f"/v1/shares/{'z' * 22}").status_code == 404
        assert client.get("/v1/shares/not-valid").status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_disabled_storage_returns_503(client):
    app.dependency_overrides[get_share_service] = NoopShareService
    try:
        response = client.get(f"/v1/shares/{'a' * 22}")
        assert response.status_code == 503
    finally:
        app.dependency_overrides.clear()


def test_malformed_graph_is_rejected_before_storage(client):
    payload = sample_snapshot().model_dump()
    payload["graph"]["edges"] = [
        {"source": "missing", "target": "jsx", "relationship": "invalid"}
    ]
    response = client.post("/v1/shares", json=payload)
    assert response.status_code == 422


def test_oversized_graph_is_rejected(client):
    payload = sample_snapshot().model_dump()
    payload["graph"]["nodes"] = [
        {
            "id": f"node_{index}",
            "label": f"Node {index}",
            "level": "Beginner",
            "summary": "Summary",
            "why": "Reason",
        }
        for index in range(51)
    ]
    assert client.post("/v1/shares", json=payload).status_code == 422


def test_moderation_failure_prevents_storage(client):
    storage = MemoryShareService()
    moderation = AsyncMock(side_effect=LearningPathError("Flagged by moderation.", 400))
    app.dependency_overrides[get_share_service] = lambda: storage
    app.dependency_overrides[get_learning_path_service] = lambda: type(
        "Moderation", (), {"check_moderation": moderation}
    )()
    try:
        response = client.post("/v1/shares", json=sample_snapshot().model_dump())
        assert response.status_code == 400
        assert storage.values == {}
    finally:
        app.dependency_overrides.clear()
