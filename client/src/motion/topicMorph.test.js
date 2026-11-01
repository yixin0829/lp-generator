import { afterEach, describe, expect, it, vi } from "vitest";
import { rememberTopicMorph, takeTopicMorph } from "./topicMorph";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("topic morph", () => {
  it("hands the record over once", () => {
    const source = {};
    rememberTopicMorph("Machine learning", source);
    expect(takeTopicMorph()).toEqual({ topic: "Machine learning", source });
    expect(takeTopicMorph()).toBeNull();
  });

  it("drops a stale record, consuming it anyway", () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);
    rememberTopicMorph("Rust", {});
    now.mockReturnValue(4001);
    expect(takeTopicMorph()).toBeNull();
    now.mockReturnValue(1000);
    expect(takeTopicMorph()).toBeNull();
  });

  it("honours a custom maximum age", () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(0);
    rememberTopicMorph("Rust", {});
    now.mockReturnValue(500);
    expect(takeTopicMorph(400)).toBeNull();
    rememberTopicMorph("Rust", {});
    now.mockReturnValue(3500);
    expect(takeTopicMorph()?.topic).toBe("Rust");
  });
});
