function getBackendConfig() {
  const backendBaseUrl = process.env.BACKEND_BASE_URL?.trim().replace(/\/$/, "");
  const backendApiKey = process.env.BACKEND_API_KEY?.trim();

  if (!backendBaseUrl || !backendApiKey) {
    return null;
  }

  return { backendBaseUrl, backendApiKey };
}

export default async function handler(req, res) {
  const config = getBackendConfig();
  if (!config) {
    return res.status(500).json({ detail: "Backend proxy is not configured." });
  }

  const { topicSlug } = req.query;
  const slug = Array.isArray(topicSlug) ? topicSlug[0] : topicSlug;
  if (!slug || typeof slug !== "string" || !slug.trim()) {
    return res.status(400).json({ detail: "Missing topic slug." });
  }

  const upstreamUrl = `${config.backendBaseUrl}/v1/lp_saved/${encodeURIComponent(slug.trim())}`;

  try {
    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers: {
        "X-API-Key": config.backendApiKey,
        ...(req.method === "PUT" ? { "Content-Type": "application/json" } : {}),
      },
      ...(req.method === "PUT" ? { body: JSON.stringify(req.body) } : {}),
    });

    const body = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "application/json";
    res.setHeader("content-type", contentType);
    return res.status(upstream.status).send(body);
  } catch {
    return res.status(502).json({ detail: "Failed to reach backend service." });
  }
}
