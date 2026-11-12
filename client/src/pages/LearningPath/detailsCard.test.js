import { describe, expect, it } from "vitest";
import { isDetailsOpen, nextDetails } from "./detailsCard";

const run = (events, from = "closed") => events.reduce(nextDetails, from);

describe("details card", () => {
  it("peeks while hovered and shuts when the pointer leaves", () => {
    expect(run(["enter"])).toBe("peek");
    expect(run(["enter", "leave"])).toBe("closed");
  });

  it("stays open once pinned, wherever the pointer goes", () => {
    expect(run(["enter", "toggle"])).toBe("pinned");
    expect(run(["enter", "toggle", "leave", "enter", "leave"])).toBe("pinned");
  });

  it("a click on a pinned card shuts it while the pointer is still over it", () => {
    const mode = run(["enter", "toggle", "toggle"]);
    expect(mode).toBe("dismissed");
    expect(isDetailsOpen(mode)).toBe(false);
  });

  it("a shut card peeks again only after the pointer has left", () => {
    expect(run(["enter", "toggle", "toggle", "leave"])).toBe("closed");
    expect(run(["enter", "toggle", "toggle", "leave", "enter"])).toBe("peek");
  });

  it("toggles between pinned and shut without a pointer", () => {
    expect(run(["toggle"])).toBe("pinned");
    expect(run(["toggle", "toggle"])).toBe("dismissed");
    expect(run(["toggle", "toggle", "toggle"])).toBe("pinned");
    // Shut from the keyboard, so the next hover is a fresh one.
    expect(run(["toggle", "toggle", "enter"])).toBe("peek");
  });

  it("Escape shuts an open card and leaves a shut one alone", () => {
    expect(run(["enter", "escape"])).toBe("dismissed");
    expect(run(["toggle", "escape"])).toBe("dismissed");
    expect(run(["escape"])).toBe("closed");
  });

  it("is open only when peeking or pinned", () => {
    expect(["closed", "peek", "pinned", "dismissed"].filter(isDetailsOpen)).toEqual([
      "peek",
      "pinned",
    ]);
  });
});
