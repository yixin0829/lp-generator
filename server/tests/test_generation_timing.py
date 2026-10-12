"""Timing estimates must exclude stale, cached, failed and different-model work."""

import pytest

from app.core.dependencies import (
    get_cache_service,
    get_generation_timing_service,
    get_learning_path_service,
)
from app.main import app
from app.services.generation_timing_service import GenerationTimingService
from app.services.learning_path_service import LearningPathError


def test_requires_history_and_expires_it(mocker):
    clock = mocker.patch("app.services.generation_timing_service.time.time", return_value=1000000)
    service = GenerationTimingService("model-a")
    for seconds in [10, 15, 20, 25]:
        service.record(seconds)
    assert service.estimate() is None
    service.record(30)
    estimate = service.estimate()
    assert (estimate.lower_seconds, estimate.median_seconds, estimate.upper_seconds) == (10, 20, 25)
    assert GenerationTimingService("model-b").estimate() is None
    clock.return_value += 7 * 86400
    assert service.estimate() is None


def test_bounded_history_ignores_invalid_durations():
    service = GenerationTimingService("model-a")
    for seconds in [0, -1, float("nan"), float("inf")]:
        service.record(seconds)
    for seconds in range(1, 111):
        service.record(seconds)
    estimate = service.estimate()
    assert estimate.sample_count == 100
    assert estimate.median_seconds == 60


def test_firestore_transaction_and_model_isolation(mocker):
    client = mocker.Mock()
    document = client.collection.return_value.document.return_value
    document.get.return_value.to_dict.return_value = {"samples": []}
    mocker.patch(
        "app.services.generation_timing_service.firestore.transactional", side_effect=lambda f: f
    )
    service = GenerationTimingService("model-a", client)
    key_a = client.collection.return_value.document.call_args.args[0]
    service.record(15)
    transaction = client.transaction.return_value
    document.get.assert_called_with(transaction=transaction, timeout=2, retry=None)
    assert transaction.set.call_args.args[1]["samples"][0]["seconds"] == 15
    GenerationTimingService("model-b", client)
    assert client.collection.return_value.document.call_args.args[0] != key_a
    document.get.side_effect = RuntimeError("offline")
    assert service.estimate() is None
    service.record(20)  # Storage failure is nonfatal.


@pytest.mark.parametrize("kind", ["fresh", "cached", "failed"])
def test_only_successful_cache_misses_are_recorded(client, mocker, kind):
    payload = {"topic": "Rust", "completion": {}, "usage": {}, "model": "model-a"}
    cache = mocker.Mock()
    cache.get.return_value = payload if kind == "cached" else None
    generator = mocker.Mock()
    generator.normalize_topic.return_value = "Rust"
    generator.generate_learning_path = mocker.AsyncMock(
        return_value=payload,
        side_effect=LearningPathError("Unavailable", status_code=503) if kind == "failed" else None,
    )
    timing = mocker.Mock()
    app.dependency_overrides[get_cache_service] = lambda: cache
    app.dependency_overrides[get_learning_path_service] = lambda: generator
    app.dependency_overrides[get_generation_timing_service] = lambda: timing
    try:
        response = client.get("/v1/lp/Rust")
        assert response.status_code == (503 if kind == "failed" else 200)
        assert timing.record.call_count == (1 if kind == "fresh" else 0)
    finally:
        app.dependency_overrides.clear()
