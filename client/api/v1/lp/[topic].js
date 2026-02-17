function getBackendConfig() {
  const backendBaseUrl = process.env.BACKEND_BASE_URL?.trim().replace(/\/$/, "");
  const backendApiKey = process.env.BACKEND_API_KEY?.trim();

  if (!backendBaseUrl || !backendApiKey) {
    return null;
  }

  return { backendBaseUrl, backendApiKey };
}

function getTopicParam(queryValue) {
  if (Array.isArray(queryValue)) {
    return queryValue[0] ?? "";
  }
  return typeof queryValue === "string" ? queryValue : "";
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ detail: "Method not allowed." });
  }

  const config = getBackendConfig();
  if (!config) {
    return res.status(500).json({ detail: "Backend proxy is not configured." });
  }

  const topic = getTopicParam(req.query.topic).trim();
  if (!topic) {
    return res.status(400).json({ detail: "Missing topic." });
  }

  try {
    const upstream = await fetch(
      `${config.backendBaseUrl}/v1/lp/${encodeURIComponent(topic)}`,
      {
        method: "GET",
        headers: {
          "X-API-Key": config.backendApiKey,
        },
      }
    );

    const body = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "application/json";
    res.setHeader("content-type", contentType);
    return res.status(upstream.status).send(body);
  } catch {
    return res.status(502).json({ detail: "Failed to reach backend service." });
  }
}
