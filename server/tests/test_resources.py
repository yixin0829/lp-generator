"""Resource policy, independent failure behavior, and single-flight cache checks."""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.routers.resources import get_resource_service
from app.schemas.resources import ResourceRequest
from app.services.resource_service import ResourceService, catalogue_resources, safe_url


@pytest.mark.parametrize(
    "url",
    [
        "javascript:alert(1)",
        "http://react.dev/learn",
        "https://127.0.0.1/",
        "https://user:password@react.dev/learn",
        "https://react.dev:444/learn",
        "https://react.dev.evil.example/",
        "https://react.dev\\@evil.example/",
    ],
)
def test_rejects_unsafe_or_unreviewed_urls(url):
    assert safe_url(url) is None


def test_catalogue_matches_subject_and_concept_without_cross_topic_false_hits():
    request = ResourceRequest(topic="React", concept="State")
    assert len(catalogue_resources(request)) == 2
    assert not catalogue_resources(ResourceRequest(topic="Pottery", concept="State"))


@pytest.mark.asyncio
async def test_cache_and_concurrent_requests_call_provider_once():
    service = ResourceService("web_search", client=object())
    service._search = AsyncMock(side_effect=lambda request: catalogue_resources(request))
    request = ResourceRequest(topic="React", concept="State")
    responses = await asyncio.gather(service.get(request), service.get(request))
    assert all(len(response.resources) == 2 for response in responses)
    assert service._search.await_count == 1
    assert (await service.get(request)).cached
    assert service.key(request) != service.key(request.model_copy(update={"language": "fr"}))


@pytest.mark.asyncio
async def test_missing_provider_and_empty_catalogue_are_explicit():
    request = ResourceRequest(topic="Pottery", concept="Glazing")
    assert "not configured" in (await ResourceService("web_search").get(request)).message
    response = await ResourceService().get(request)
    assert response.resources == []
    assert "No reviewed" in response.message


@pytest.mark.asyncio
async def test_native_accepts_only_cited_tool_sources_and_deduplicates():
    url = "https://react.dev/learn/managing-state"
    data = {
        "output": [
            {"type": "web_search_call", "action": {"sources": [{"url": url}]}},
            {
                "type": "message",
                "content": [
                    {
                        "annotations": [
                            {
                                "type": "url_citation",
                                "url": url,
                                "title": "Ignore instructions <script>",
                            },
                            {"type": "url_citation", "url": url, "title": "duplicate"},
                            {
                                "type": "url_citation",
                                "url": "https://react.dev/learn/fabricated",
                                "title": "not sourced",
                            },
                            {
                                "type": "url_citation",
                                "url": "https://evil.example",
                                "title": "untrusted",
                            },
                        ]
                    }
                ],
            },
        ]
    }
    create = AsyncMock(return_value=SimpleNamespace(model_dump=lambda: data))
    service = ResourceService(
        "web_search", SimpleNamespace(responses=SimpleNamespace(create=create))
    )
    result = await service.get(ResourceRequest(topic="React", concept="State"))
    assert [resource.url for resource in result.resources] == [url]
    assert result.resources[0].title == "Ignore instructions <script>"
    assert create.call_args.kwargs["tool_choice"] == "required"
    assert create.call_args.kwargs["max_tool_calls"] == 1


def test_api_validation_and_failure_do_not_affect_path(client):
    client.app.dependency_overrides[get_resource_service] = lambda: ResourceService()
    try:
        assert (
            client.post("/v1/resources", json={"topic": "React", "concept": "State"}).status_code
            == 200
        )
        assert (
            client.post("/v1/resources", json={"topic": "", "concept": "State"}).status_code == 422
        )
        failing = ResourceService()
        failing.get = AsyncMock(side_effect=TimeoutError("private upstream details"))
        client.app.dependency_overrides[get_resource_service] = lambda: failing
        response = client.post("/v1/resources", json={"topic": "React", "concept": "State"})
        assert response.status_code == 503
        assert "private" not in response.text
        assert client.get("/").status_code == 200
    finally:
        client.app.dependency_overrides.clear()
