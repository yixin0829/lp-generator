"""Service tests for LearningPathService with mocked OpenAI."""

import json
from unittest.mock import AsyncMock, MagicMock

import pytest
from openai import AsyncOpenAI

from app.services.learning_path_service import (
    ContentModerationError,
    LearningPathService,
    MalformedResponseError,
)


@pytest.fixture
def mock_client() -> MagicMock:
    return MagicMock(spec=AsyncOpenAI)


@pytest.fixture
def service(mock_client: MagicMock) -> LearningPathService:
    return LearningPathService(client=mock_client, model="gpt-5-mini", max_topic_length=30)


class TestNormalizeTopic:
    def test_removes_punctuation(self, service: LearningPathService):
        assert service.normalize_topic("react!!!") == "React"
        assert service.normalize_topic("python...") == "Python"

    def test_title_case(self, service: LearningPathService):
        assert service.normalize_topic("javascript") == "Javascript"


class TestValidateTopicLength:
    def test_accepts_valid_length(self, service: LearningPathService):
        service.validate_topic_length("a" * 30)

    def test_rejects_too_long(self, service: LearningPathService):
        with pytest.raises(ValueError, match="exceeds maximum length"):
            service.validate_topic_length("a" * 31)


class TestCheckModeration:
    async def test_passes_when_not_flagged(self, service: LearningPathService, mock_client):
        mock_client.moderations.create = AsyncMock(
            return_value=MagicMock(results=[MagicMock(flagged=False)])
        )
        await service.check_moderation("React")
        mock_client.moderations.create.assert_called_once_with(input="React")

    async def test_raises_when_flagged(self, service: LearningPathService, mock_client):
        mock_client.moderations.create = AsyncMock(
            return_value=MagicMock(results=[MagicMock(flagged=True)])
        )
        with pytest.raises(ContentModerationError, match="content policy"):
            await service.check_moderation("badword")


class TestGenerateLearningPath:
    async def test_success_returns_expected_structure(self, service: LearningPathService, mock_client):
        lp_data = {"Beginner": ["A"], "Intermediate": [], "Advanced": []}
        mock_client.moderations.create = AsyncMock(
            return_value=MagicMock(results=[MagicMock(flagged=False)])
        )
        mock_client.responses.create = AsyncMock(
            return_value=MagicMock(
                output_text=json.dumps(lp_data),
                usage=MagicMock(
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
        assert result["completion"] == lp_data
        assert result["usage"]["total_tokens"] == 15
        assert result["usage"]["prompt_tokens"] == 10
        assert result["usage"]["completion_tokens"] == 5
        assert result["model"] == "gpt-5-mini"

    async def test_malformed_json_raises(self, service: LearningPathService, mock_client):
        mock_client.moderations.create = AsyncMock(
            return_value=MagicMock(results=[MagicMock(flagged=False)])
        )
        mock_client.responses.create = AsyncMock(
            return_value=MagicMock(
                output_text="not valid json",
                usage=MagicMock(model_dump=lambda: {}),
                model="gpt-5-mini",
            )
        )

        with pytest.raises(MalformedResponseError, match="parsing"):
            await service.generate_learning_path("react")
