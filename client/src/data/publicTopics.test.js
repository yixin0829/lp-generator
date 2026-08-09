import { describe, expect, it } from "vitest";
import { findPublicTopicByAlias, publicTopics, validatePublicTopics } from "./publicTopics";

describe("public topic catalog", () => {
  it("contains exactly 24 validated, published topics", () => {
    expect(publicTopics).toHaveLength(24);
    expect(validatePublicTopics()).toBe(true);
  });

  it("routes reviewed aliases but not arbitrary queries", () => {
    expect(findPublicTopicByAlias("  React JS ").slug).toBe("react");
    expect(findPublicTopicByAlias("How to make a website").slug).toBe("website-development");
    expect(findPublicTopicByAlias("quantum basket weaving")).toBeUndefined();
  });
});
