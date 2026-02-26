"""Service tests for LearningPathService with mocked OpenAI."""

import pytest
from openai import AsyncOpenAI

from app.services.learning_path_service import (
    LearningPathError,
    LearningPathGraphOutput,
    LearningPathService,
    break_cycles,
    graph_to_levels,
)


@pytest.fixture
def mock_client(mocker):
    return mocker.Mock(spec=AsyncOpenAI)


@pytest.fixture
def service(mock_client) -> LearningPathService:
    return LearningPathService(client=mock_client, model="gpt-5-mini", max_topic_length=120)


SAMPLE_GRAPH_DATA = {
    "nodes": [
        {"id": "variables", "label": "Variables", "level": "Beginner",
         "summary": "Named containers for data.", "why": "Fundamental building block."},
        {"id": "data_types", "label": "Data Types", "level": "Beginner",
         "summary": "Categories of values.", "why": "Prevents bugs."},
        {"id": "functions", "label": "Functions", "level": "Intermediate",
         "summary": "Reusable code blocks.", "why": "Key abstraction mechanism."},
    ],
    "edges": [
        {"source": "variables", "target": "data_types",
         "relationship": "Variable storage precedes type understanding."},
        {"source": "data_types", "target": "functions",
         "relationship": "Type knowledge needed for function parameters."},
    ],
}


class TestNormalizeTopic:
    def test_removes_punctuation(self, service: LearningPathService):
        assert service.normalize_topic("react!!!") == "React"
        assert service.normalize_topic("python...") == "Python"

    def test_title_case(self, service: LearningPathService):
        assert service.normalize_topic("javascript") == "Javascript"


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
    async def test_success_returns_graph_structure(
        self, service: LearningPathService, mock_client, mocker
    ):
        mock_client.moderations.create = mocker.AsyncMock(
            return_value=mocker.Mock(results=[mocker.Mock(flagged=False)])
        )
        mock_client.responses.parse = mocker.AsyncMock(
            return_value=mocker.Mock(
                output_parsed=LearningPathGraphOutput(**SAMPLE_GRAPH_DATA),
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
        assert len(completion["edges"]) == 2
        assert result["usage"]["total_tokens"] == 15
        assert result["usage"]["prompt_tokens"] == 10
        assert result["usage"]["completion_tokens"] == 5
        assert result["model"] == "gpt-5-mini"

    async def test_refusal_raises(self, service: LearningPathService, mock_client, mocker):
        mock_client.moderations.create = mocker.AsyncMock(
            return_value=mocker.Mock(results=[mocker.Mock(flagged=False)])
        )
        refusal_block = mocker.Mock(type="refusal", refusal="Content refused")
        output_item = mocker.Mock(content=[refusal_block])
        mock_client.responses.parse = mocker.AsyncMock(
            return_value=mocker.Mock(
                output_parsed=None,
                output=[output_item],
                usage=mocker.Mock(model_dump=lambda: {}),
                model="gpt-5-mini",
            )
        )

        with pytest.raises(LearningPathError, match="parsing") as exc_info:
            await service.generate_learning_path("react")
        assert exc_info.value.status_code == 500

    async def test_none_output_parsed_raises(
        self, service: LearningPathService, mock_client, mocker
    ):
        mock_client.moderations.create = mocker.AsyncMock(
            return_value=mocker.Mock(results=[mocker.Mock(flagged=False)])
        )
        mock_client.responses.parse = mocker.AsyncMock(
            return_value=mocker.Mock(
                output_parsed=None,
                output=[],
                usage=mocker.Mock(model_dump=lambda: {}),
                model="gpt-5-mini",
            )
        )

        with pytest.raises(LearningPathError, match="parsing") as exc_info:
            await service.generate_learning_path("react")
        assert exc_info.value.status_code == 500
