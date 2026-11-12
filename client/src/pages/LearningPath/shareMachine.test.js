import { describe, expect, it } from "vitest";
import { initialShare, shareReducer } from "./shareMachine";

const run = (actions) => actions.reduce(shareReducer, initialShare);
const created = (url) => ({ type: "created", url });

describe("share link", () => {
  it("creates a link once", () => {
    expect(run([{ type: "requested" }]).phase).toBe("creating");
    expect(run([{ type: "requested" }, created("/share/a")])).toEqual({
      phase: "shared",
      url: "/share/a",
    });
  });

  it("does not create again while the path is unchanged", () => {
    const shared = run([{ type: "requested" }, created("/share/a")]);
    expect(shareReducer(shared, { type: "requested" })).toBe(shared);
  });

  it("goes stale on a reorder and can be shared again", () => {
    const stale = run([
      { type: "requested" },
      created("/share/a"),
      { type: "edited" },
    ]);
    expect(stale).toEqual({ phase: "stale", url: "/share/a" });
    const again = shareReducer(stale, { type: "requested" });
    expect(again.phase).toBe("creating");
    expect(shareReducer(again, created("/share/b"))).toEqual({
      phase: "shared",
      url: "/share/b",
    });
  });

  it("a reorder while saving makes the new link stale at once", () => {
    const state = run([
      { type: "requested" },
      { type: "edited" },
      created("/share/a"),
    ]);
    expect(state).toEqual({ phase: "stale", url: "/share/a" });
  });

  it("a failure returns to where sharing started", () => {
    expect(run([{ type: "requested" }, { type: "failed" }])).toEqual(
      initialShare,
    );
    const failedAgain = run([
      { type: "requested" },
      created("/share/a"),
      { type: "edited" },
      { type: "requested" },
      { type: "failed" },
    ]);
    expect(failedAgain).toEqual({ phase: "stale", url: "/share/a" });
  });

  it("a reorder before any share changes nothing", () => {
    expect(shareReducer(initialShare, { type: "edited" })).toBe(initialShare);
  });

  it("ignores answers that arrive when nothing is being created", () => {
    expect(shareReducer(initialShare, created("/share/a"))).toBe(initialShare);
    expect(shareReducer(initialShare, { type: "failed" })).toBe(initialShare);
  });
});
