"""Model migration checks using the real SDK over synthetic HTTP transports."""

import asyncio
import json

import httpx
import pytest
from openai import AsyncOpenAI

from app.core.config import Settings
from app.core.dependencies import get_learning_path_service
from app.services.learning_path_service import LearningPathError, LearningPathService


@pytest.mark.parametrize("override", [None, "gpt-4.1-mini"])
def test_settings_and_dependency_model(monkeypatch, mocker, override):
    monkeypatch.delenv("OPENAI_MODEL", raising=False)
    if override:
        monkeypatch.setenv("OPENAI_MODEL", override)
    settings = Settings(_env_file=None, APP_ENV="test", OPENAI_API_KEY="synthetic-key")
    expected = override or "gpt-6-luna"
    assert settings.openai_model == expected
    mocker.patch("app.core.dependencies.get_config", return_value=settings)
    mocker.patch("app.core.dependencies.AsyncOpenAI")
    get_learning_path_service.cache_clear()
    try:
        assert get_learning_path_service()._model == expected
    finally:
        get_learning_path_service.cache_clear()


def response_payload(model, refusal=False):
    content = (
        {"type": "refusal", "refusal": "Synthetic refusal"}
        if refusal
        else {
            "type": "output_text",
            "text": json.dumps(
                {
                    "nodes": [
                        {
                            "id": "basics",
                            "label": "Basics",
                            "level": "Beginner",
                            "summary": "Synthetic summary.",
                            "why": "Synthetic reason.",
                        }
                    ],
                    "edges": [],
                }
            ),
            "annotations": [],
        }
    )
    return {
        "id": "resp_synthetic",
        "object": "response",
        "created_at": 0,
        "status": "completed",
        "model": model,
        "output": [
            {
                "id": "msg_synthetic",
                "type": "message",
                "role": "assistant",
                "status": "completed",
                "content": [content],
            }
        ],
        "usage": {"input_tokens": 10, "output_tokens": 20, "total_tokens": 30},
    }


@pytest.mark.parametrize(
    "model,outcome",
    [(None, "success"), ("gpt-4.1-mini", "success"), (None, "refusal"), (None, "rate-limit")],
)
@pytest.mark.asyncio
async def test_generation_wire_contract(model, outcome):
    seen = {}
    expected_model = model or "gpt-6-luna"

    def respond(request):
        body = json.loads(request.content)
        seen[request.url.path] = body
        assert request.url.host == "api.openai.com"
        if request.url.path == "/v1/moderations":
            # Generation-model selection must not change moderation routing.
            assert body == {"input": "React"}
            return httpx.Response(
                200, json={"id": "mod_synthetic", "results": [{"flagged": False}]}
            )
        assert request.url.path == "/v1/responses"
        assert body["model"] == expected_model
        assert body["store"] is True
        assert [item["role"] for item in body["input"]] == ["system", "user"]
        assert body["text"]["format"]["type"] == "json_schema"
        assert body["text"]["format"]["strict"] is True
        assert set(body["text"]["format"]["schema"]["required"]) == {"nodes", "edges"}
        assert not {"temperature", "top_p", "top_logprobs", "max_tokens", "include"} & body.keys()
        if expected_model == "gpt-6-luna":
            assert body["reasoning"] == {"effort": "none"}
        else:
            assert "reasoning" not in body
        if outcome == "rate-limit":
            return httpx.Response(
                429, json={"error": {"message": "Synthetic limit", "type": "rate_limit_error"}}
            )
        return httpx.Response(200, json=response_payload(expected_model, outcome == "refusal"))

    async with AsyncOpenAI(
        api_key="synthetic-key",
        base_url="https://api.openai.com/v1",
        max_retries=0,
        http_client=httpx.AsyncClient(transport=httpx.MockTransport(respond)),
    ) as sdk:
        service = LearningPathService(sdk, **({"model": model} if model else {}))
        if outcome != "success":
            with pytest.raises(LearningPathError) as error:
                await service.generate_learning_path("react")
            assert error.value.status_code == (429 if outcome == "rate-limit" else 500)
        else:
            result = await service.generate_learning_path("react")
            assert result["model"] == expected_model
            assert result["usage"] == {
                "prompt_tokens": 10,
                "completion_tokens": 20,
                "total_tokens": 30,
            }
            assert result["completion"]["nodes"][0]["id"] == "basics"
            assert result["completion"]["Beginner"][0]["name"] == "Basics"
    assert set(seen) == {"/v1/moderations", "/v1/responses"}


@pytest.mark.asyncio
async def test_flagged_moderation_cancels_luna_generation():
    started = asyncio.Event()
    cancelled = asyncio.Event()

    async def respond(request):
        if request.url.path == "/v1/moderations":
            assert json.loads(request.content) == {"input": "React"}
            await asyncio.wait_for(started.wait(), timeout=2)
            return httpx.Response(200, json={"id": "mod_synthetic", "results": [{"flagged": True}]})
        assert json.loads(request.content)["model"] == "gpt-6-luna"
        started.set()
        try:
            await asyncio.Event().wait()
        except asyncio.CancelledError:
            cancelled.set()
            raise

    async with AsyncOpenAI(
        api_key="synthetic-key",
        base_url="https://api.openai.com/v1",
        max_retries=0,
        http_client=httpx.AsyncClient(transport=httpx.MockTransport(respond)),
    ) as sdk:
        with pytest.raises(LearningPathError) as error:
            await asyncio.wait_for(
                LearningPathService(sdk).generate_learning_path("react"), timeout=5
            )
        assert error.value.status_code == 400
        assert cancelled.is_set()
