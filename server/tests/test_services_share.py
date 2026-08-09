from unittest.mock import MagicMock

import pytest
from google.api_core.exceptions import Conflict

from app.schemas.share import ShareSnapshot
from app.services.share_service import (
    FirestoreShareService,
    NoopShareService,
    ShareConfig,
    ShareServiceError,
    ShareStorageDisabled,
)


def sample_snapshot() -> ShareSnapshot:
    return ShareSnapshot.model_validate(
        {
            "topic": "React",
            "levels": {"Beginner": ["JSX"], "Intermediate": [], "Advanced": []},
            "concept_details": {
                "JSX": {"summary": "UI syntax.", "why": "Builds UI.", "connection": ""}
            },
            "graph": {
                "nodes": [
                    {
                        "id": "jsx",
                        "label": "JSX",
                        "level": "Beginner",
                        "summary": "UI syntax.",
                        "why": "Builds UI.",
                    }
                ],
                "edges": [],
            },
            "default_view": "list",
        }
    )


def test_noop_storage_is_explicitly_disabled():
    service = NoopShareService()
    with pytest.raises(ShareStorageDisabled):
        service.create(sample_snapshot())
    with pytest.raises(ShareStorageDisabled):
        service.get("x" * 22)


def test_firestore_create_uses_stable_url_safe_id_and_immutable_create():
    client = MagicMock()
    service = FirestoreShareService(client, ShareConfig(collection="shares"))
    first = service.create(sample_snapshot())
    second = service.create(sample_snapshot())
    assert first == second
    assert len(first) == len(second) == 22
    assert first.replace("-", "").replace("_", "").isalnum()
    assert client.collection.return_value.document.return_value.create.call_count == 2
    client.collection.return_value.document.return_value.set.assert_not_called()


def test_firestore_create_changes_id_when_snapshot_changes():
    client = MagicMock()
    service = FirestoreShareService(client, ShareConfig(collection="shares"))
    first = service.create(sample_snapshot())
    changed = sample_snapshot().model_copy(update={"default_view": "graph"})
    second = service.create(changed)
    assert first != second


def test_firestore_create_reuses_existing_identical_snapshot():
    client = MagicMock()
    document = client.collection.return_value.document.return_value
    document.create.side_effect = Conflict("already shared")
    document.get.return_value.exists = True
    document.get.return_value.to_dict.return_value = {"snapshot": sample_snapshot().model_dump()}
    service = FirestoreShareService(client, ShareConfig(collection="shares"))
    assert service.create(sample_snapshot()) == service._snapshot_id(sample_snapshot())


def test_firestore_get_returns_exact_validated_snapshot():
    client = MagicMock()
    document = client.collection.return_value.document.return_value.get.return_value
    document.exists = True
    document.to_dict.return_value = {"snapshot": sample_snapshot().model_dump()}
    service = FirestoreShareService(client, ShareConfig(collection="shares"))
    assert service.get("a" * 22) == sample_snapshot()


def test_firestore_failures_are_request_safe():
    client = MagicMock()
    client.collection.return_value.document.return_value.create.side_effect = RuntimeError("secret")
    service = FirestoreShareService(client, ShareConfig(collection="shares"))
    with pytest.raises(ShareServiceError, match="Failed to store"):
        service.create(sample_snapshot())
