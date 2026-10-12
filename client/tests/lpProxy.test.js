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
