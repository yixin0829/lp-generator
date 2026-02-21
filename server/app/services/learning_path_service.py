"""Learning path generation service."""

import string
from typing import Any

from loguru import logger
from openai import AsyncOpenAI
from pydantic import BaseModel

SYSTEM_PROMPT = """Generate a list of key concepts for learning a new topic and rank them from easiest to most difficult. The generated key concepts should then be grouped as "Beginner", "Intermediate", or "Advanced".

Example output for learning "JavaScript":
{
  "Beginner": ["Variables", "Data Types", "Operators", "Conditional Statements", "Arrays", "Loops", "Functions", "Scope", "Objects"],
  "Intermediate": ["Events", "DOM Manipulation", "Error Handling", "Regular Expressions", "JSON", "AJAX", "Promises"],
  "Advanced": ["Prototypal Inheritance", "Closures", "Currying", "Async/Await", "ES6 Features", "Webpack", "Babel", "TypeScript"]
}"""


class LearningPathOutput(BaseModel):
    """Schema enforced via OpenAI Structured Outputs."""

    Beginner: list[str]
    Intermediate: list[str]
    Advanced: list[str]


class ContentModerationError(Exception):
    """Raised when OpenAI content moderation flags the input."""

    pass


class MalformedResponseError(Exception):
    """Raised when OpenAI response cannot be parsed."""

    pass


class LearningPathService:
    """Service for generating learning paths via OpenAI."""

    def __init__(
        self,
        client: AsyncOpenAI,
        model: str = "gpt-5-mini",
        max_topic_length: int = 30,
    ) -> None:
        self._client = client
        self._model = model
        self._max_topic_length = max_topic_length

    def normalize_topic(self, topic: str) -> str:
        """Remove punctuation and title-case the topic."""
        return topic.translate(str.maketrans("", "", string.punctuation)).title()

    def validate_topic_length(self, topic: str) -> None:
        """Raise ValueError if topic exceeds max length."""
        if len(topic) > self._max_topic_length:
            raise ValueError("Input path parameter exceeds maximum length allowed (30 characters).")

    async def check_moderation(self, topic: str) -> None:
        """Check topic against OpenAI moderation. Raises ContentModerationError if flagged."""
        try:
            mod_response = await self._client.moderations.create(input=topic)
        except Exception as e:
            logger.exception("OpenAI moderation request failed: {}", e)
            raise
        results = (
            mod_response.results
            if hasattr(mod_response, "results")
            else mod_response.get("results", [])
        )
        if not results:
            logger.warning("Moderation returned no results for topic={}", topic)
            return
        first = results[0]
        flagged = first.flagged if hasattr(first, "flagged") else first.get("flagged", False)
        if flagged:
            logger.info("Content moderation flagged topic={}", topic)
            raise ContentModerationError(
                "User input does not complies with OpenAI's content policy. "
                "https://beta.openai.com/docs/usage-policies/content-policy"
            )

    def _build_usage_dict(self, usage: Any) -> dict[str, int]:
        """Normalize usage payload from SDK object/dict variants."""
        if hasattr(usage, "model_dump"):
            usage_obj = usage.model_dump()
        elif isinstance(usage, dict):
            usage_obj = usage
        else:
            usage_obj = {}

        input_tokens = usage_obj.get("input_tokens", getattr(usage, "input_tokens", 0))
        output_tokens = usage_obj.get("output_tokens", getattr(usage, "output_tokens", 0))
        total_tokens = usage_obj.get("total_tokens", getattr(usage, "total_tokens", 0))
        if not total_tokens:
            total_tokens = input_tokens + output_tokens

        return {
            "prompt_tokens": usage_obj.get("prompt_tokens", input_tokens),
            "completion_tokens": usage_obj.get("completion_tokens", output_tokens),
            "total_tokens": total_tokens,
        }

    async def generate_learning_path(self, topic: str) -> dict[str, Any]:
        """
        Generate learning path for the given topic.
        Returns dict with topic, completion, usage, model.
        Raises ContentModerationError, MalformedResponseError, or propagates OpenAI errors.
        """
        topic = self.normalize_topic(topic)
        self.validate_topic_length(topic)
        await self.check_moderation(topic)

        try:
            response = await self._client.responses.parse(
                model=self._model,
                input=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f'Generate a learning path for "{topic}".'},
                ],
                text_format=LearningPathOutput,
                reasoning={"effort": "minimal", "summary": "auto"},
                store=True,
            )
        except Exception as e:
            logger.exception("OpenAI responses API call failed: {}", e)
            raise

        if response.output_parsed is None:
            refusal = None
            for item in getattr(response, "output", None) or []:
                for block in getattr(item, "content", []):
                    if getattr(block, "type", "") == "refusal":
                        refusal = getattr(block, "refusal", None)
                        break
            msg = f"OpenAI refused the request: {refusal}" if refusal else (
                "Error while parsing OpenAI's response for learning path."
            )
            logger.warning("Structured output parsing failed: {}", msg)
            raise MalformedResponseError(msg)

        lp = response.output_parsed.model_dump()
        usage_dict = self._build_usage_dict(response.usage)

        return {
            "topic": topic,
            "completion": lp,
            "usage": usage_dict,
            "model": response.model or self._model,
        }
