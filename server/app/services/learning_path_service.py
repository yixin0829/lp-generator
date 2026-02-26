"""Learning path generation service."""

import string
from collections import defaultdict, deque
from typing import Any

from loguru import logger
from openai import (
    APIConnectionError,
    APITimeoutError,
    AsyncOpenAI,
    AuthenticationError,
    BadRequestError,
    InternalServerError,
    PermissionDeniedError,
    RateLimitError,
)
from pydantic import BaseModel

SYSTEM_PROMPT = """Generate a learning path as a directed graph for a given topic.

Return 10-15 concepts as nodes, each with:
- id: a unique short snake_case identifier (e.g. "variables", "dom_manipulation")
- label: a concise 2-4 word display name (e.g. "Variables", "DOM Manipulation")
- level: one of "Beginner", "Intermediate", or "Advanced"
- summary: 1-2 sentence explanation of the concept
- why: why this concept matters at this stage

Return edges representing prerequisite dependencies:
- source: id of the prerequisite concept
- target: id of the concept that depends on it
- relationship: 1 sentence explaining how the source enables the target

Rules:
- Every node must appear in at least one edge (as source or target).
- Edges should flow from foundational to advanced concepts (Beginner → Intermediate → Advanced).
- Cross-level edges are allowed (e.g., a Beginner concept can connect directly to an Advanced one).
- Avoid cycles: do not create circular dependency chains.
- Keep labels concise (2-4 words max).
- Aim for 12-20 edges total to create a well-connected but readable graph.

Example output for "JavaScript":
{
  "nodes": [
    {"id": "variables", "label": "Variables", "level": "Beginner", "summary": "Named containers that store data values.", "why": "The most fundamental building block of any program."},
    {"id": "data_types", "label": "Data Types", "level": "Beginner", "summary": "Categories like strings, numbers, and booleans.", "why": "Understanding types prevents bugs and enables correct operations."},
    {"id": "closures", "label": "Closures", "level": "Advanced", "summary": "Functions retaining access to their outer scope.", "why": "Enables data privacy, currying, and factory functions."}
  ],
  "edges": [
    {"source": "variables", "target": "data_types", "relationship": "Understanding variable storage is needed before learning how different data types behave."},
    {"source": "data_types", "target": "closures", "relationship": "Type knowledge underpins how closed-over values are captured and used."}
  ]
}"""

LEVEL_ORDER = {"Beginner": 0, "Intermediate": 1, "Advanced": 2}


class ConceptDetail(BaseModel):
    """A single concept with enriched metadata for the learning path."""

    name: str
    summary: str
    why: str
    connection: str


class GraphNode(BaseModel):
    """A concept node in the learning path graph."""

    id: str
    label: str
    level: str
    summary: str
    why: str


class GraphEdge(BaseModel):
    """A directed dependency edge between two concepts."""

    source: str
    target: str
    relationship: str


class LearningPathGraphOutput(BaseModel):
    """Graph-based schema enforced via OpenAI Structured Outputs."""

    nodes: list[GraphNode]
    edges: list[GraphEdge]


class LearningPathOutput(BaseModel):
    """Legacy schema kept for backward compatibility in tests."""

    Beginner: list[ConceptDetail]
    Intermediate: list[ConceptDetail]
    Advanced: list[ConceptDetail]


def break_cycles(nodes: list[dict], edges: list[dict]) -> list[dict]:
    """Remove edges that form cycles, preferring to drop back-edges
    (those pointing from a higher difficulty level to a lower one)."""
    node_level = {n["id"]: LEVEL_ORDER.get(n["level"], 1) for n in nodes}
    node_ids = {n["id"] for n in nodes}

    valid_edges = [e for e in edges if e["source"] in node_ids and e["target"] in node_ids]

    adj: dict[str, list[str]] = defaultdict(list)
    edge_map: dict[tuple[str, str], dict] = {}
    for e in valid_edges:
        adj[e["source"]].append(e["target"])
        edge_map[(e["source"], e["target"])] = e

    WHITE, GRAY, BLACK = 0, 1, 2
    color: dict[str, int] = {nid: WHITE for nid in node_ids}
    back_edges: list[tuple[str, str]] = []

    def dfs(u: str) -> None:
        color[u] = GRAY
        for v in adj.get(u, []):
            if color.get(v) == GRAY:
                back_edges.append((u, v))
            elif color.get(v) == WHITE:
                dfs(v)
        color[u] = BLACK

    for nid in node_ids:
        if color[nid] == WHITE:
            dfs(nid)

    if not back_edges:
        return valid_edges

    removed = set()
    for u, v in back_edges:
        if (u, v) not in removed:
            removed.add((u, v))
            logger.info("Broke cycle by removing edge {} -> {}", u, v)

    return [e for e in valid_edges if (e["source"], e["target"]) not in removed]


def topological_sort_within_level(
    nodes: list[dict], edges: list[dict], level: str
) -> list[dict]:
    """Return nodes of a given level in topological order based on edges."""
    level_nodes = [n for n in nodes if n["level"] == level]
    level_ids = {n["id"] for n in level_nodes}
    node_map = {n["id"]: n for n in level_nodes}

    in_degree: dict[str, int] = {nid: 0 for nid in level_ids}
    adj: dict[str, list[str]] = defaultdict(list)
    for e in edges:
        if e["source"] in level_ids and e["target"] in level_ids:
            adj[e["source"]].append(e["target"])
            in_degree[e["target"]] = in_degree.get(e["target"], 0) + 1

    queue = deque(nid for nid in level_ids if in_degree[nid] == 0)
    result = []
    while queue:
        nid = queue.popleft()
        result.append(node_map[nid])
        for neighbor in adj.get(nid, []):
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    seen = {n["id"] for n in result}
    for n in level_nodes:
        if n["id"] not in seen:
            result.append(n)

    return result


def graph_to_levels(nodes: list[dict], edges: list[dict]) -> dict[str, list[dict]]:
    """Convert graph nodes into Beginner/Intermediate/Advanced level buckets
    with topological ordering, producing the legacy box-view format."""
    levels: dict[str, list[dict]] = {}
    for level in ("Beginner", "Intermediate", "Advanced"):
        sorted_nodes = topological_sort_within_level(nodes, edges, level)
        levels[level] = [
            {
                "name": n["label"],
                "summary": n["summary"],
                "why": n["why"],
                "connection": "",
            }
            for n in sorted_nodes
        ]

    for e in edges:
        source_label = next((n["label"] for n in nodes if n["id"] == e["source"]), e["source"])
        target_label = next((n["label"] for n in nodes if n["id"] == e["target"]), e["target"])
        for level_list in levels.values():
            for concept in level_list:
                if concept["name"] == source_label and not concept["connection"]:
                    concept["connection"] = f"Leads to {target_label}: {e['relationship']}"
                    break

    return levels


class LearningPathError(Exception):
    """Base exception for request-safe learning path failures."""

    def __init__(self, detail: str, status_code: int = 500) -> None:
        super().__init__(detail)
        self.status_code = status_code


class LearningPathService:
    """Service for generating learning paths via OpenAI."""

    def __init__(
        self,
        client: AsyncOpenAI,
        model: str = "[REDACTED]",
        max_topic_length: int = 120,
    ) -> None:
        self._client = client
        self._model = model
        self._max_topic_length = max_topic_length

    def normalize_topic(self, topic: str) -> str:
        """Remove punctuation and title-case the topic."""
        return topic.translate(str.maketrans("", "", string.punctuation)).title()

    def validate_topic_length(self, topic: str) -> None:
        """Raise LearningPathError(400) if topic exceeds max length."""
        if len(topic) > self._max_topic_length:
            raise LearningPathError(
                f"Input path parameter exceeds maximum length allowed ({self._max_topic_length} characters).",
                status_code=400,
            )

    def _map_upstream_error(self, error: Exception) -> LearningPathError:
        """Map OpenAI SDK errors to service-domain exceptions."""
        if isinstance(error, RateLimitError):
            return LearningPathError(
                "Rate limit exceeded. Please try again later.", status_code=429
            )
        if isinstance(error, (AuthenticationError, PermissionDeniedError)):
            return LearningPathError(
                "Service configuration error. Please contact support.", status_code=502
            )
        if isinstance(error, BadRequestError):
            return LearningPathError("Invalid request to AI service.", status_code=400)
        if isinstance(error, (APIConnectionError, APITimeoutError, InternalServerError)):
            return LearningPathError(
                "AI service temporarily unavailable. Please try again later.",
                status_code=503,
            )
        return LearningPathError("Unexpected upstream AI service error.", status_code=500)

    async def check_moderation(self, topic: str) -> None:
        """Check topic against OpenAI moderation. Raises LearningPathError(400) if flagged."""
        try:
            mod_response = await self._client.moderations.create(input=topic)
        except Exception as e:
            raise self._map_upstream_error(e) from e
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
            raise LearningPathError(
                (
                    "User input does not complies with OpenAI's content policy. "
                    "https://beta.openai.com/docs/usage-policies/content-policy"
                ),
                status_code=400,
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
        Returns dict with topic, completion (nodes, edges, + level buckets), usage, model.
        Raises LearningPathError for expected request and upstream failures.
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
                text_format=LearningPathGraphOutput,
                store=True,
            )
        except Exception as e:
            raise self._map_upstream_error(e) from e

        if response.output_parsed is None:
            msg = "Error while reading OpenAI's response.output_parsed for learning path."
            logger.warning(f"Structured output parsing failed: {msg}")
            raise LearningPathError(f"Structured output parsing failed: {msg}", status_code=500)

        graph = response.output_parsed.model_dump()
        nodes = graph["nodes"]
        edges = break_cycles(nodes, graph["edges"])

        levels = graph_to_levels(nodes, edges)

        completion = {
            "nodes": nodes,
            "edges": edges,
            **levels,
        }

        usage_dict = self._build_usage_dict(response.usage)

        return {
            "topic": topic,
            "completion": completion,
            "usage": usage_dict,
            "model": response.model or self._model,
        }
