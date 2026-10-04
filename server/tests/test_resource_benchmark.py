"""Budget reservations persist across smoke/restarts; no live API is involved."""

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from openai import BadRequestError

from scripts.benchmark_resources import Meter, sanitized_error


@pytest.mark.asyncio
async def test_api_rejection_exports_redacted_diagnostics_and_keeps_reservation(tmp_path):
    error = BadRequestError(
        "Do not export this raw exception",
        response=httpx.Response(
            400, request=httpx.Request("POST", "https://api.openai.com/v1/responses")
        ),
        body={
            "error": {
                "code": "unsupported_parameter",
                "param": "max_tool_calls",
                "type": "invalid_request_error",
                "message": "Unsupported max_tool_calls sk-synthetic-secret Bearer synthetic-token https://example.com/private person@example.com",
            }
        },
    )
    meter = Meter(
        SimpleNamespace(responses=SimpleNamespace(create=AsyncMock(side_effect=error))),
        5,
        tmp_path / "budget.json",
    )
    try:
        with pytest.raises(BadRequestError):
            await meter.create()
        diagnostic = meter.calls[0]
        assert diagnostic["http_status"] == 400
        assert diagnostic["api_param"] == "max_tool_calls"
        assert diagnostic["api_code"] == "unsupported_parameter"
        assert diagnostic["api_message"].startswith("Unsupported max_tool_calls")
        serialized = json.dumps(diagnostic)
        for sensitive in ("sk-synthetic-secret", "synthetic-token", "example.com", "raw exception"):
            assert sensitive not in serialized
        assert meter.spent == pytest.approx(0.1)
    finally:
        meter.close()


@pytest.mark.asyncio
@pytest.mark.parametrize("search_tokens,expected", [(800, 0.010582), (None, 0.1)])
async def test_luna_actual_search_and_cache_categories_without_fixed_block(
    tmp_path, search_tokens, expected
):
    usage = {
        "input_tokens": 1500,
        "output_tokens": 100,
        "input_tokens_details": {"cached_tokens": 100, "cache_write_tokens": 400},
    }
    if search_tokens is not None:
        usage["search_content_tokens"] = search_tokens
    response = SimpleNamespace(
        model_dump=lambda: {"usage": usage, "output": [{"type": "web_search_call"}]}
    )
    client = SimpleNamespace(responses=SimpleNamespace(create=AsyncMock(return_value=response)))
    meter = Meter(client, 5, tmp_path / "budget.json")
    try:
        await meter.create(model="gpt-5.6-luna")
        assert meter.spent == pytest.approx(expected)
        assert meter.calls[0]["metering_complete"] is (search_tokens is not None)
        assert meter.calls[0]["input_tokens_details"]["cache_write_tokens"] == 400
    finally:
        meter.close()


def test_diagnostics_never_export_arbitrary_exception_text_or_body():
    assert sanitized_error(RuntimeError("secret text")) == {"error_type": "RuntimeError"}
    error = SimpleNamespace(body={"request": {"api_key": "secret"}, "message": "x" * 900})
    diagnostic = sanitized_error(error)
    assert len(diagnostic["api_message"]) == 500
    assert "secret" not in json.dumps(diagnostic)
    error.body = {"message": "Rejected opaque-private-value"}
    assert sanitized_error(error, "opaque-private-value")["api_message"] == "Rejected [credential]"


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
        await meter.create(model="gpt-4.1-mini-2025-04-14")
        assert meter.spent == pytest.approx(0.01376)
        assert json.loads(ledger.read_text())["spent_upper_bound_usd"] == pytest.approx(meter.spent)
    finally:
        meter.close()
