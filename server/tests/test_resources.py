"""Resource policy, independent failure behavior, and single-flight cache checks."""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from openai import BadRequestError

from app.routers.resources import get_resource_service
from app.schemas.resources import ResourceRequest
from app.services.resource_service import (
    ResourceService,
    catalogue_resources,
    resource_identity,
    safe_url,
)


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


def test_navigation_retains_course_query_and_concept_anchor():
    url = "https://www.open.edu/openlearn/course/view.php?id=123&utm_source=search#lesson-2"
    assert safe_url(url) == url
    assert (
        resource_identity(url) == "https://www.open.edu/openlearn/course/view.php?id=123#lesson-2"
    )
    assert resource_identity(url) != resource_identity(url.replace("id=123", "id=456"))
    assert resource_identity(url) != resource_identity(url.replace("#lesson-2", "#lesson-3"))


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
    assert create.call_args.kwargs["model"] == "gpt-5.6-luna"
    assert create.call_args.kwargs["reasoning"] == {"effort": "low"}
    assert "react.dev" in create.call_args.kwargs["tools"][0]["filters"]["allowed_domains"]


@pytest.mark.asyncio
async def test_native_preserves_navigation_and_deduplicates_tracking_only():
    urls = [
        "https://www.open.edu/openlearn/course/view.php?id=123&utm_source=one#lesson-2",
        "https://www.open.edu/openlearn/course/view.php?id=123&utm_source=two#lesson-2",
        "https://www.open.edu/openlearn/course/view.php?id=456#lesson-2",
    ]
    data = {
        "output": [
            {"type": "web_search_call", "action": {"sources": [{"url": url} for url in urls]}},
            {
                "type": "message",
                "content": [
                    {
                        "annotations": [
                            {"type": "url_citation", "url": url, "title": "Course"} for url in urls
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
    assert [resource.url for resource in result.resources] == [urls[0], urls[2]]


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


@pytest.mark.asyncio
async def test_dated_mini_omits_rejected_filters_and_still_rejects_sourced_outside_publishers():
    approved = "https://react.dev/learn/managing-state"
    outside = "https://unreviewed.example/guide"
    data = {
        "output": [
            {
                "type": "web_search_call",
                "action": {"sources": [{"url": approved}, {"url": outside}]},
            },
            {
                "type": "message",
                "content": [
                    {
                        "annotations": [
                            {"type": "url_citation", "url": approved, "title": "React state"},
                            {"type": "url_citation", "url": outside, "title": "Outside source"},
                        ]
                    }
                ],
            },
        ]
    }

    async def fixture_provider(**kwargs):
        if "filters" in kwargs["tools"][0]:
            raise BadRequestError(
                "Unsupported filters",
                response=httpx.Response(
                    400, request=httpx.Request("POST", "https://api.openai.com/v1/responses")
                ),
                body={
                    "message": "Parameter 'filters' not supported with model 'gpt-4.1-mini-2025-04-14'",
                    "param": "tools",
                },
            )
        return SimpleNamespace(model_dump=lambda: data)

    create = AsyncMock(side_effect=fixture_provider)
    service = ResourceService(
        "web_search",
        SimpleNamespace(responses=SimpleNamespace(create=create)),
        model="gpt-4.1-mini-2025-04-14",
    )
    result = await service.get(ResourceRequest(topic="React", concept="State"))
    assert [resource.url for resource in result.resources] == [approved]
    assert create.await_count == 1
    assert create.call_args.kwargs["tools"] == [{"type": "web_search"}]
    assert "react.dev" in create.call_args.kwargs["instructions"]
