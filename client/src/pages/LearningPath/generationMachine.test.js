import { describe, expect, it } from "vitest";
import { generationReducer, initialGeneration } from "./generationMachine";

const path = {
  levels: { Beginner: ["A", "B"], Intermediate: [], Advanced: [] },
  details: { A: { summary: "First" } },
  graph: { nodes: [], edges: [] },
};
const run = (actions, topic = "React") =>
  actions.reduce(generationReducer, initialGeneration(topic));

describe("generation lifecycle", () => {
  it("starts loading when there is a topic, so the first frame is the bar", () => {
    expect(initialGeneration("React")).toEqual({
      topic: "React",
      phase: "loading",
      attempt: 0,
    });
    expect(initialGeneration("").phase).toBe("idle");
  });

  it("holds the path while the bar finishes, then shows it", () => {
    const completing = run([{ type: "succeeded", path }]);
    expect(completing).toMatchObject({ phase: "completing", path });
    const ready = generationReducer(completing, { type: "revealed" });
    expect(ready).toMatchObject({ phase: "ready", path });
  });

  it("fails with the reason and no path", () => {
    const failed = run([{ type: "failed", reason: "upstream_down" }]);
    expect(failed).toEqual({
      topic: "React",
      attempt: 0,
      phase: "failed",
      reason: "upstream_down",
    });
  });

  it("retries into a new attempt only when the reason allows", () => {
    const retried = run([
      { type: "failed", reason: "upstream_down" },
      { type: "retried" },
    ]);
    expect(retried).toEqual({ topic: "React", attempt: 1, phase: "loading" });

    const flagged = run([{ type: "failed", reason: "moderated" }]);
    expect(generationReducer(flagged, { type: "retried" })).toBe(flagged);
  });

  it("reorders only a path that is on screen", () => {
    const levels = { Beginner: ["B", "A"], Intermediate: [], Advanced: [] };
    const completing = run([{ type: "succeeded", path }]);
    expect(generationReducer(completing, { type: "reordered", levels })).toBe(
      completing,
    );
    const ready = generationReducer(completing, { type: "revealed" });
    const reordered = generationReducer(ready, { type: "reordered", levels });
    expect(reordered.path).toEqual({ ...path, levels });
    expect(reordered.phase).toBe("ready");
  });

  it("ignores events that do not belong to the current phase", () => {
    const ready = run([{ type: "succeeded", path }, { type: "revealed" }]);
    // A late answer, a second reveal, a stray retry.
    for (const action of [
      { type: "succeeded", path: { ...path, levels: {} } },
      { type: "failed", reason: "timeout" },
      { type: "revealed" },
      { type: "retried" },
    ]) {
      expect(generationReducer(ready, action)).toBe(ready);
    }
    const loading = initialGeneration("React");
    expect(generationReducer(loading, { type: "revealed" })).toBe(loading);
  });

  it("starts over for a new topic", () => {
    const ready = run([{ type: "succeeded", path }, { type: "revealed" }]);
    expect(
      generationReducer(ready, { type: "topicChanged", topic: "Vue" }),
    ).toEqual({ topic: "Vue", phase: "loading", attempt: 0 });
    expect(
      generationReducer(ready, { type: "topicChanged", topic: "" }).phase,
    ).toBe("idle");
  });
});
