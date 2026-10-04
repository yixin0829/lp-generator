"""Budget reservations persist across smoke/restarts; no live API is involved."""

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from scripts.benchmark_resources import Meter


@pytest.mark.asyncio
async def test_failed_call_reservation_survives_restart_and_blocks_cap(tmp_path):
    ledger = tmp_path / "budget.json"
    ledger.write_text(json.dumps({"spent_upper_bound_usd": 4.65, "cap_usd": 5}))
    create = AsyncMock(side_effect=TimeoutError("not exported"))
    client = SimpleNamespace(responses=SimpleNamespace(create=create))
    first = Meter(client, 5, ledger)
    try:
        with pytest.raises(TimeoutError):
            await first.create()
        assert json.loads(ledger.read_text())["spent_upper_bound_usd"] == pytest.approx(4.75)
    finally:
        first.close()
    second = Meter(client, 5, ledger)
    try:
        assert second.prior_spend == pytest.approx(4.75)
        with pytest.raises(RuntimeError, match="Budget"):
            await second.create()
        assert create.await_count == 1
    finally:
        second.close()


def test_shared_ledger_disallows_concurrent_runs(tmp_path):
    first = Meter(None, 5, tmp_path / "budget.json")
    try:
        with pytest.raises(FileExistsError):
            Meter(None, 5, tmp_path / "budget.json")
    finally:
        first.close()


@pytest.mark.asyncio
async def test_successful_usage_reconciles_persisted_reservation(tmp_path):
    ledger = tmp_path / "budget.json"
    response = SimpleNamespace(
        model_dump=lambda: {
            "usage": {"input_tokens": 1000, "output_tokens": 100},
            "output": [{"type": "web_search_call"}],
        }
    )
    create = AsyncMock(return_value=response)
    meter = Meter(SimpleNamespace(responses=SimpleNamespace(create=create)), 5, ledger)
    try:
        await meter.create()
        assert meter.spent == pytest.approx(0.01376)
        assert json.loads(ledger.read_text())["spent_upper_bound_usd"] == pytest.approx(meter.spent)
    finally:
        meter.close()
