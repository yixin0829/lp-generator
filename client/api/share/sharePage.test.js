import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "./[shareId]";

describe("dynamic share document", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BACKEND_BASE_URL;
    delete process.env.BACKEND_API_KEY;
  });

  it("returns a real 404 with noindex headers for an unknown share", async () => {
    process.env.BACKEND_BASE_URL = "https://backend.example";
    process.env.BACKEND_API_KEY = "secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 404 })));
    const response = await handler(new Request(`https://example.com/api/share/${"a".repeat(22)}`));
    expect(response.status).toBe(404);
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(await response.text()).toContain("not found");
  });

  it("serves the noindex app shell only after the share exists", async () => {
    process.env.BACKEND_BASE_URL = "https://backend.example";
    process.env.BACKEND_API_KEY = "secret";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response('<meta name="robots" content="noindex,nofollow">', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await handler(new Request(`https://example.com/api/share/${"b".repeat(22)}`));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("noindex,nofollow");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
