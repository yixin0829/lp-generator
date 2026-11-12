import { describe, expect, it } from "vitest";
import {
  canRetry,
  failureCopy,
  failureReason,
  failureScreen,
} from "./generationFailure";

describe("failure reason", () => {
  it("is the code the server sent, whatever the status", () => {
    expect(failureReason(400, "moderated")).toBe("moderated");
    expect(failureReason(400, "upstream_rejected")).toBe("upstream_rejected");
    expect(failureReason(502, "misconfigured")).toBe("misconfigured");
  });

  it("falls back to the status when there is no known code", () => {
    expect(failureReason(400, undefined)).toBe("topic_invalid");
    expect(failureReason(429, undefined)).toBe("rate_limited");
    expect(failureReason(403, undefined)).toBe("misconfigured");
    expect(failureReason(503, undefined)).toBe("upstream_down");
    expect(failureReason(504, undefined)).toBe("timeout");
    expect(failureReason(500, "something_new")).toBe("generation_failed");
    // A 200 whose body is not a learning path.
    expect(failureReason(200, undefined)).toBe("generation_failed");
    expect(failureReason(400, "toString")).toBe("topic_invalid");
  });
});

describe("failure screen", () => {
  it("gives each reason the way forward that fits it", () => {
    expect(failureScreen("moderated")).toBe("flagged");
    expect(failureScreen("topic_too_long")).toBe("fixTopic");
    expect(failureScreen("rate_limited")).toBe("wait");
    expect(failureScreen("upstream_down")).toBe("retry");
    expect(failureScreen("timeout")).toBe("retry");
    expect(failureScreen("misconfigured")).toBe("outOfOrder");
    expect(failureScreen("upstream_rejected")).toBe("outOfOrder");
  });

  it("offers a retry only when one can succeed", () => {
    const retryable = [
      "rate_limited",
      "upstream_down",
      "timeout",
      "offline",
      "generation_failed",
    ];
    for (const reason of retryable) expect(canRetry(reason)).toBe(true);
    for (const reason of [
      "moderated",
      "topic_too_long",
      "topic_invalid",
      "upstream_rejected",
      "misconfigured",
    ]) {
      expect(canRetry(reason)).toBe(false);
    }
  });

  it("names a timeout and a lost connection in the retry copy", () => {
    expect(failureCopy("timeout").body).toBe(
      "The request timed out. Please try again.",
    );
    expect(failureCopy("offline").body).toContain("Check your connection");
    expect(failureCopy("upstream_down").body).toBe(
      "Try again with the same topic, or enter something else.",
    );
    expect(failureCopy("moderated").heading).toContain("content moderation");
    expect(failureCopy("rate_limited").body).toContain("Wait a minute");
  });
});
