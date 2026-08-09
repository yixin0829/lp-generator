"""Validated immutable learning-path share snapshots."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class SharedConceptDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str = Field(max_length=1200)
    why: str = Field(max_length=1200)
    connection: str = Field(max_length=1200)


class SharedGraphNode(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=80, pattern=r"^[A-Za-z0-9_-]+$")
    label: str = Field(min_length=1, max_length=120)
    level: Literal["Beginner", "Intermediate", "Advanced"]
    summary: str = Field(max_length=1200)
    why: str = Field(max_length=1200)


class SharedGraphEdge(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source: str = Field(min_length=1, max_length=80)
    target: str = Field(min_length=1, max_length=80)
    relationship: str = Field(max_length=1200)

    @model_validator(mode="after")
    def validate_direction(self):
        if self.source == self.target:
            raise ValueError("Graph edges cannot point to the same node.")
        return self


class SharedGraph(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nodes: list[SharedGraphNode] = Field(min_length=1, max_length=50)
    edges: list[SharedGraphEdge] = Field(max_length=120)

    @model_validator(mode="after")
    def validate_references(self):
        node_ids = [node.id for node in self.nodes]
        if len(node_ids) != len(set(node_ids)):
            raise ValueError("Graph node IDs must be unique.")
        labels = [node.label for node in self.nodes]
        if len(labels) != len(set(labels)):
            raise ValueError("Graph node labels must be unique.")
        known = set(node_ids)
        if any(edge.source not in known or edge.target not in known for edge in self.edges):
            raise ValueError("Every graph edge must reference existing nodes.")
        return self


class SharedLevels(BaseModel):
    model_config = ConfigDict(extra="forbid")

    Beginner: list[str] = Field(max_length=50)
    Intermediate: list[str] = Field(max_length=50)
    Advanced: list[str] = Field(max_length=50)

    @field_validator("Beginner", "Intermediate", "Advanced")
    @classmethod
    def validate_concepts(cls, concepts: list[str]) -> list[str]:
        if any(not concept.strip() or len(concept) > 120 for concept in concepts):
            raise ValueError("Concept names must contain 1 to 120 characters.")
        return concepts


class ShareSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    topic: str = Field(min_length=1, max_length=120)
    levels: SharedLevels
    concept_details: dict[str, SharedConceptDetail] = Field(default_factory=dict)
    graph: SharedGraph
    default_view: Literal["graph", "list"] = "graph"

    @field_validator("topic")
    @classmethod
    def validate_topic(cls, topic: str) -> str:
        if not topic.strip():
            raise ValueError("Topic must not be blank.")
        return topic

    @model_validator(mode="after")
    def validate_snapshot(self):
        concepts = self.levels.Beginner + self.levels.Intermediate + self.levels.Advanced
        if not concepts:
            raise ValueError("A share must contain at least one concept.")
        if len(concepts) != len(set(concepts)):
            raise ValueError("Concept names must be unique across levels.")
        if len(self.concept_details) > 150:
            raise ValueError("Too many concept details.")
        if any(len(name) > 120 for name in self.concept_details):
            raise ValueError("Concept detail keys must not exceed 120 characters.")
        graph_labels = {node.label for node in self.graph.nodes}
        if set(concepts) != graph_labels:
            raise ValueError("Level concepts must match graph node labels.")
        if not set(self.concept_details).issubset(set(concepts)):
            raise ValueError("Concept details must belong to concepts in the shared path.")
        return self


class ShareCreateResponse(BaseModel):
    share_id: str


class ShareResponse(BaseModel):
    share_id: str
    snapshot: ShareSnapshot
