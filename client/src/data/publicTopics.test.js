import { describe, expect, it } from "vitest";
import {
  findPublicTopicByAlias,
  publicTopicBySlug,
  publicTopics,
  validatePublicTopics,
} from "./publicTopics";

describe("public topic catalog", () => {
  it("keeps multiple prerequisites for algorithms in programming fundamentals", () => {
    const { graph } = publicTopicBySlug.get("programming-fundamentals");
    const prerequisiteIds = graph.edges
      .filter((edge) => edge.target === "algorithms")
      .map((edge) => edge.source);
    expect(prerequisiteIds).toEqual(
      expect.arrayContaining(["control_flow", "data_structures"]),
    );
  });

  it("models topic-specific dependencies instead of a single chain for every topic", () => {
    for (const topic of publicTopics) {
      const incoming = new Map();
      for (const edge of topic.graph.edges)
        incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
      expect(
        [...incoming.values()].some((count) => count > 1),
        topic.slug,
      ).toBe(true);
    }
  });
  it("contains exactly 24 validated, published topics", () => {
    expect(publicTopics).toHaveLength(24);
    expect(validatePublicTopics()).toBe(true);
  });

  it("keeps all prerequisites in the list and copy connection text", () => {
    const topic = publicTopicBySlug.get("programming-fundamentals");
    const algorithms = Object.values(topic.levels)
      .flat()
      .find((concept) => concept.name === "Algorithms");
    expect(algorithms.connection).toContain("Requires Control Flow:");
    expect(algorithms.connection).toContain("Requires Data Structures:");
    const variables = topic.levels.Beginner.find(
      (concept) => concept.name === "Variables and Data",
    );
    expect(variables.connection).toContain("Leads to Control Flow:");
    expect(variables.connection).toContain("Leads to Functions:");
    expect(variables.connection).toContain("Leads to Data Structures:");
  });

  it("rejects cycles and duplicate dependency edges", () => {
    const cyclic = structuredClone(publicTopics);
    const first = cyclic[0].graph.edges[0];
    cyclic[0].graph.edges.push({
      ...first,
      source: first.target,
      target: first.source,
    });
    expect(() => validatePublicTopics(cyclic)).toThrow("Cyclic dependencies");
    const duplicate = structuredClone(publicTopics);
    duplicate[0].graph.edges.push({ ...duplicate[0].graph.edges[0] });
    expect(() => validatePublicTopics(duplicate)).toThrow("Invalid dependency");
  });

  it("routes reviewed aliases but not arbitrary queries", () => {
    expect(findPublicTopicByAlias("  React JS ").slug).toBe("react");
    expect(findPublicTopicByAlias("How to make a website").slug).toBe(
      "website-development",
    );
    expect(findPublicTopicByAlias("quantum basket weaving")).toBeUndefined();
  });
});
