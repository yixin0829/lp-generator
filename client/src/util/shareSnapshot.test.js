import { describe, expect, it } from "vitest";
import { createShareSnapshot } from "./shareSnapshot";

describe("share snapshots", () => {
  it("preserves reordered levels and the selected default view exactly", () => {
    const levels = { Beginner: ["Second", "First"], Intermediate: ["Third"], Advanced: [] };
    const snapshot = createShareSnapshot({
      topic: "Example",
      levels,
      conceptDetails: { First: { summary: "One", why: "Why", connection: "Next" } },
      graph: { nodes: [{ id: "first" }], edges: [] },
      defaultView: "list",
    });
    expect(snapshot.levels).toEqual(levels);
    expect(snapshot.default_view).toBe("list");
    expect(snapshot.concept_details.First.summary).toBe("One");
  });
});
