import { describe, expect, it } from "vitest";
import { createShareSnapshot, shareErrorMessage } from "./shareSnapshot";

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

describe("share error messages", () => {
  it("explains content rejections instead of showing their details", () => {
    const detail = [{ loc: ["body", "graph"], type: "string_too_long" }];
    const message = shareErrorMessage(422, { detail });
    expect(message).toBe("This path can't be shared. Use Copy to save it instead.");
    expect(shareErrorMessage(413, { detail: "Share snapshot is too large." })).toBe(
      message,
    );
    const moderation =
      "User input does not complies with OpenAI's content policy. https://example.invalid";
    expect(shareErrorMessage(400, { detail: moderation })).toBe(message);
  });

  it("explains rate limits, which have no detail field", () => {
    expect(shareErrorMessage(429, { error: "Rate limit exceeded: 5 per 1 minute" })).toBe(
      "Too many share links in a short time. Wait a minute and try again.",
    );
  });

  it("shows string details and falls back otherwise", () => {
    const detail = "Share storage is temporarily unavailable.";
    expect(shareErrorMessage(503, { detail })).toBe(detail);
    expect(shareErrorMessage(502, {})).toBe("Unable to create share.");
    expect(shareErrorMessage(201, { detail: "" })).toBe("Unable to create share.");
  });
});
