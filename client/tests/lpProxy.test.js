import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../api/v1/lp/[topic].js";

function response() {
  return {
    status: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
}

describe("learning path proxy topic", () => {
  beforeEach(() => {
    vi.stubEnv("BACKEND_BASE_URL", "https://backend.example");
    vi.stubEnv("BACKEND_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("does not append Vercel routing query parameters to the topic", async () => {
    const topic = encodeURIComponent("JavaScript closures for a timer widget");
    await handler(
      { method: "GET", url: `/api/v1/lp/${topic}?topic=${topic}` },
      response(),
    );
    expect(fetch).toHaveBeenCalledWith(
      `https://backend.example/v1/lp/${topic}`,
      expect.any(Object),
    );
  });

  it("preserves encoded question marks and slashes within the topic", async () => {
    const topic = encodeURIComponent("C++ / C#? basics");
    await handler(
      { method: "GET", url: `/api/v1/lp/${topic}?topic=${topic}` },
      response(),
    );
    expect(fetch).toHaveBeenCalledWith(
      `https://backend.example/v1/lp/${topic}`,
      expect.any(Object),
    );
  });

  it("returns a safe 400 for malformed URI encoding", async () => {
    const res = response();
    await handler({ method: "GET", url: "/api/v1/lp/%E0%A4%A" }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("learning path proxy failures", () => {
  beforeEach(() => {
    vi.stubEnv("BACKEND_BASE_URL", "https://backend.example");
    vi.stubEnv("BACKEND_API_KEY", "test-key");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("says a malformed topic is the topic's fault", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const res = response();
    await handler({ method: "GET", url: "/api/v1/lp/%E0%A4%A" }, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "topic_invalid" }),
    );
  });

  it("says a missing backend setting is on our side", async () => {
    vi.stubEnv("BACKEND_API_KEY", "");
    vi.stubGlobal("fetch", vi.fn());
    const res = response();
    await handler({ method: "GET", url: "/api/v1/lp/React" }, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "misconfigured" }),
    );
  });

  it("says an unreachable backend can be retried", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const res = response();
    await handler({ method: "GET", url: "/api/v1/lp/React" }, res);
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "upstream_down" }),
    );
  });

  it("passes the backend's status and body through untouched", async () => {
    const body = JSON.stringify({ detail: "Flagged.", code: "moderated" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(body, { status: 400 })),
    );
    const res = response();
    await handler({ method: "GET", url: "/api/v1/lp/React" }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(body);
  });
});
