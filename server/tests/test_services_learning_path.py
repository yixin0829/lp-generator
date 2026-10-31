"""Service tests for LearningPathService with mocked OpenAI."""

import pytest
from openai import AsyncOpenAI
from pydantic import ValidationError

from app.services.learning_path_service import (
    LearningPathError,
    LearningPathGraphOutput,
    LearningPathService,
    break_cycles,
    graph_to_levels,
    parse_graph_output,
)


@pytest.fixture
def mock_client(mocker):
    return mocker.Mock(spec=AsyncOpenAI)


@pytest.fixture
def service(mock_client) -> LearningPathService:
    return LearningPathService(client=mock_client, model="gpt-5-mini", max_topic_length=120)


def message_output(mocker, *texts):
    """A Responses API output list with one message holding these output_text parts."""
    parts = [mocker.Mock(type="output_text", text=text) for text in texts]
    return [mocker.Mock(type="message", content=parts)]


SAMPLE_GRAPH_DATA = {
    "nodes": [
        {
            "id": "variables",
            "label": "Variables",
            "level": "Beginner",
            "summary": "Named containers for data.",
            "why": "Fundamental building block.",
        },
        {
            "id": "data_types",
            "label": "Data Types",
            "level": "Beginner",
            "summary": "Categories of values.",
            "why": "Prevents bugs.",
        },
        {
            "id": "functions",
            "label": "Functions",
            "level": "Intermediate",
            "summary": "Reusable code blocks.",
            "why": "Key abstraction mechanism.",
        },
    ],
    "edges": [
        {
            "source": "variables",
            "target": "data_types",
            "relationship": "Variable storage precedes type understanding.",
        },
        {
            "source": "data_types",
            "target": "functions",
            "relationship": "Type knowledge needed for function parameters.",
        },
    ],
}


class TestNormalizeTopic:
    def test_removes_punctuation(self, service: LearningPathService):
        assert service.normalize_topic("react!!!") == "React"
        assert service.normalize_topic("python...") == "Python"

    def test_title_case(self, service: LearningPathService):
        assert service.normalize_topic("javascript") == "Javascript"

    def test_removes_slashes_so_cache_keys_are_valid_document_ids(
        self, service: LearningPathService
    ):
        assert service.normalize_topic("CI/CD") == "Cicd"


class TestValidateTopicLength:
    def test_accepts_valid_length(self, service: LearningPathService):
        service.validate_topic_length("a" * 120)

    def test_rejects_too_long(self, service: LearningPathService):
        with pytest.raises(LearningPathError, match="exceeds maximum length") as exc_info:
            service.validate_topic_length("a" * 121)
        assert exc_info.value.status_code == 400


class TestCheckModeration:
    async def test_passes_when_not_flagged(self, service: LearningPathService, mock_client, mocker):
        mock_client.moderations.create = mocker.AsyncMock(
            return_value=mocker.Mock(results=[mocker.Mock(flagged=False)])
        )
        await service.check_moderation("React")
        mock_client.moderations.create.assert_called_once_with(input="React")

    async def test_raises_when_flagged(self, service: LearningPathService, mock_client, mocker):
        mock_client.moderations.create = mocker.AsyncMock(
            return_value=mocker.Mock(results=[mocker.Mock(flagged=True)])
        )
        with pytest.raises(LearningPathError, match="content policy") as exc_info:
            await service.check_moderation("badword")
        assert exc_info.value.status_code == 400


class TestBreakCycles:
    def test_no_cycles_unchanged(self):
        nodes = [
            {"id": "a", "level": "Beginner"},
            {"id": "b", "level": "Intermediate"},
        ]
        edges = [{"source": "a", "target": "b", "relationship": "a to b"}]
        result = break_cycles(nodes, edges)
        assert len(result) == 1

    def test_simple_cycle_broken(self):
        nodes = [
            {"id": "a", "level": "Beginner"},
            {"id": "b", "level": "Intermediate"},
        ]
        edges = [
            {"source": "a", "target": "b", "relationship": "a to b"},
            {"source": "b", "target": "a", "relationship": "b to a"},
        ]
        result = break_cycles(nodes, edges)
        assert len(result) == 1

    def test_removes_edges_with_invalid_node_ids(self):
        nodes = [{"id": "a", "level": "Beginner"}]
        edges = [{"source": "a", "target": "nonexistent", "relationship": "bad"}]
        result = break_cycles(nodes, edges)
        assert len(result) == 0

    def test_three_node_cycle(self):
        nodes = [
            {"id": "a", "level": "Beginner"},
            {"id": "b", "level": "Intermediate"},
            {"id": "c", "level": "Advanced"},
        ]
        edges = [
            {"source": "a", "target": "b", "relationship": "a to b"},
            {"source": "b", "target": "c", "relationship": "b to c"},
            {"source": "c", "target": "a", "relationship": "c to a"},
        ]
        result = break_cycles(nodes, edges)
        assert len(result) == 2


class TestGraphToLevels:
    def test_preserves_all_incoming_and_outgoing_dependencies(self):
        nodes = [
            {"id": name.lower(), "label": name, "level": "Beginner", "summary": name, "why": name}
            for name in ("Variables", "Functions", "Scope", "Closures")
        ]
        edges = [
            {
                "source": "variables",
                "target": "functions",
                "relationship": "Parameters hold values.",
            },
            {
                "source": "variables",
                "target": "scope",
                "relationship": "Scope controls access to variables.",
            },
            {
                "source": "functions",
                "target": "closures",
                "relationship": "A closure includes a function.",
            },
            {
                "source": "scope",
                "target": "closures",
                "relationship": "A closure retains its lexical scope.",
            },
        ]
        assert break_cycles(nodes, edges) == edges
        concepts = {
            concept["name"]: concept for concept in graph_to_levels(nodes, edges)["Beginner"]
        }
        assert "Leads to Functions:" in concepts["Variables"]["connection"]
        assert "Leads to Scope:" in concepts["Variables"]["connection"]
        assert "Requires Functions:" in concepts["Closures"]["connection"]
        assert "Requires Scope:" in concepts["Closures"]["connection"]

    def test_produces_three_levels(self):
        nodes = SAMPLE_GRAPH_DATA["nodes"]
        edges = SAMPLE_GRAPH_DATA["edges"]
        levels = graph_to_levels(nodes, edges)
        assert "Beginner" in levels
        assert "Intermediate" in levels
        assert "Advanced" in levels
        assert len(levels["Beginner"]) == 2
        assert len(levels["Intermediate"]) == 1
        assert len(levels["Advanced"]) == 0

    def test_level_entries_have_name_and_summary(self):
        nodes = SAMPLE_GRAPH_DATA["nodes"]
        edges = SAMPLE_GRAPH_DATA["edges"]
        levels = graph_to_levels(nodes, edges)
        first = levels["Beginner"][0]
        assert "name" in first
        assert "summary" in first
        assert "why" in first


class TestGenerateLearningPath:
    @pytest.mark.parametrize("multiple_prerequisites", [False, True])
    async def test_success_returns_graph_structure(
        self, service: LearningPathService, mock_client, mocker, multiple_prerequisites
    ):
        graph = {"nodes": SAMPLE_GRAPH_DATA["nodes"], "edges": list(SAMPLE_GRAPH_DATA["edges"])}
        if multiple_prerequisites:
            graph["edges"].append(
                {
                    "source": "variables",
                    "target": "functions",
                    "relationship": "Function parameters bind names to values.",
                }
            )
        mock_client.moderations.create = mocker.AsyncMock(
            return_value=mocker.Mock(results=[mocker.Mock(flagged=False)])
        )
        mock_client.responses.create = mocker.AsyncMock(
            return_value=mocker.Mock(
                output=message_output(mocker, LearningPathGraphOutput(**graph).model_dump_json()),
                usage=mocker.Mock(
                    model_dump=lambda: {
                        "input_tokens": 10,
                        "output_tokens": 5,
                        "total_tokens": 15,
                    }
                ),
                model="gpt-5-mini",
            )
        )

        result = await service.generate_learning_path("react")
        assert result["topic"] == "React"
        completion = result["completion"]
        assert "nodes" in completion
        assert "edges" in completion
        assert "Beginner" in completion
        assert "Intermediate" in completion
        assert "Advanced" in completion
        assert len(completion["nodes"]) == 3
        assert completion["edges"] == graph["edges"]
        assert result["usage"]["total_tokens"] == 15
        assert result["usage"]["prompt_tokens"] == 10
        assert result["usage"]["completion_tokens"] == 5
        assert result["model"] == "gpt-5-mini"

    async def test_refusal_raises(self, service: LearningPathService, mock_client, mocker):
        mock_client.moderations.create = mocker.AsyncMock(
            return_value=mocker.Mock(results=[mocker.Mock(flagged=False)])
        )
        refusal_block = mocker.Mock(type="refusal", refusal="Content refused")
        output_item = mocker.Mock(type="message", content=[refusal_block])
        mock_client.responses.create = mocker.AsyncMock(
            return_value=mocker.Mock(
                output=[output_item],
                usage=mocker.Mock(model_dump=lambda: {}),
                model="gpt-5-mini",
            )
        )

        with pytest.raises(LearningPathError, match="parsing") as exc_info:
            await service.generate_learning_path("react")
        assert exc_info.value.status_code == 500

    async def test_no_output_raises(self, service: LearningPathService, mock_client, mocker):
        mock_client.moderations.create = mocker.AsyncMock(
            return_value=mocker.Mock(results=[mocker.Mock(flagged=False)])
        )
        mock_client.responses.create = mocker.AsyncMock(
            return_value=mocker.Mock(
                output=[],
                usage=mocker.Mock(model_dump=lambda: {}),
                model="gpt-5-mini",
            )
        )

        with pytest.raises(LearningPathError, match="parsing") as exc_info:
            await service.generate_learning_path("react")
        assert exc_info.value.status_code == 500

    @pytest.mark.parametrize(
        "text", ["", '{"nodes": [', '{"nodes": []}'], ids=["empty", "truncated", "missing-edges"]
    )
    async def test_invalid_output_text_raises(
        self, service: LearningPathService, mock_client, mocker, text
    ):
        mock_client.moderations.create = mocker.AsyncMock(
            return_value=mocker.Mock(results=[mocker.Mock(flagged=False)])
        )
        mock_client.responses.create = mocker.AsyncMock(
            return_value=mocker.Mock(output=message_output(mocker, text))
        )

        with pytest.raises(LearningPathError, match="Unexpected upstream") as exc_info:
            await service.generate_learning_path("react")
        assert exc_info.value.status_code == 500


class TestParseGraphOutput:
    def test_first_of_several_parts_wins(self, mocker):
        first = LearningPathGraphOutput(**SAMPLE_GRAPH_DATA)
        second = LearningPathGraphOutput(nodes=[], edges=[])
        output = message_output(mocker, first.model_dump_json()) + message_output(
            mocker, second.model_dump_json()
        )
        assert parse_graph_output(mocker.Mock(output=output)) == first

    def test_any_invalid_part_raises(self, mocker):
        valid = LearningPathGraphOutput(**SAMPLE_GRAPH_DATA).model_dump_json()
        with pytest.raises(ValidationError):
            parse_graph_output(mocker.Mock(output=message_output(mocker, valid, "")))

    def test_skips_other_items_and_refusals(self, mocker):
        graph = LearningPathGraphOutput(**SAMPLE_GRAPH_DATA)
        message = mocker.Mock(
            type="message",
            content=[
                mocker.Mock(type="refusal", refusal="Content refused"),
                mocker.Mock(type="output_text", text=graph.model_dump_json()),
            ],
        )
        output = [mocker.Mock(type="reasoning"), message]
        assert parse_graph_output(mocker.Mock(output=output)) == graph
