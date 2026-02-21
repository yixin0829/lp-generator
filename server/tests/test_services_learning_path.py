"""Service tests for LearningPathService with mocked OpenAI."""

import pytest
from openai import AsyncOpenAI

from app.services.learning_path_service import (
    LearningPathError,
    LearningPathOutput,
    LearningPathService,
)


@pytest.fixture
def mock_client(mocker):
    return mocker.Mock(spec=AsyncOpenAI)


@pytest.fixture
def service(mock_client) -> LearningPathService:
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
        with pytest.raises(LearningPathError, match="exceeds maximum length") as exc_info:
            service.validate_topic_length("a" * 31)
        assert exc_info.value.status_code == 400


class TestCheckModeration:
    async def test_passes_when_not_flagged(
        self, service: LearningPathService, mock_client, mocker
    ):
        mock_client.moderations.create = mocker.AsyncMock(
            return_value=mocker.Mock(results=[mocker.Mock(flagged=False)])
        )
        await service.check_moderation("React")
        mock_client.moderations.create.assert_called_once_with(input="React")

    async def test_raises_when_flagged(
        self, service: LearningPathService, mock_client, mocker
    ):
        mock_client.moderations.create = mocker.AsyncMock(
            return_value=mocker.Mock(results=[mocker.Mock(flagged=True)])
        )
        with pytest.raises(LearningPathError, match="content policy") as exc_info:
            await service.check_moderation("badword")
        assert exc_info.value.status_code == 400


class TestGenerateLearningPath:
    async def test_success_returns_expected_structure(
        self, service: LearningPathService, mock_client, mocker
    ):
        lp_data = {"Beginner": ["A"], "Intermediate": [], "Advanced": []}
        mock_client.moderations.create = mocker.AsyncMock(
            return_value=mocker.Mock(results=[mocker.Mock(flagged=False)])
        )
        mock_client.responses.parse = mocker.AsyncMock(
            return_value=mocker.Mock(
                output_parsed=LearningPathOutput(**lp_data),
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
        assert result["completion"] == lp_data
        assert result["usage"]["total_tokens"] == 15
        assert result["usage"]["prompt_tokens"] == 10
        assert result["usage"]["completion_tokens"] == 5
        assert result["model"] == "gpt-5-mini"

    async def test_refusal_raises(
        self, service: LearningPathService, mock_client, mocker
    ):
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
