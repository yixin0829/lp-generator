export const maxDuration = 60;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).setHeader("Allow", "GET").json({ detail: "Method not allowed." });
  }

  const backendBaseUrl = process.env.BACKEND_BASE_URL?.trim().replace(/\/$/, "");
  const backendApiKey = process.env.BACKEND_API_KEY?.trim();
  if (!backendBaseUrl || !backendApiKey) {
    return res.status(500).json({ detail: "Backend proxy is not configured." });
  }

  // Extract topic from URL path: /api/v1/lp/<topic>
  const pathSegment = req.url.split("/").pop() ?? "";
  const topic = decodeURIComponent(pathSegment).trim();
  if (!topic) {
    return res.status(400).json({ detail: "Missing topic." });
  }

  try {
    const upstream = await fetch(
      `${backendBaseUrl}/v1/lp/${encodeURIComponent(topic)}`,
      {
        method: "GET",
        headers: { "X-API-Key": backendApiKey },
      }
    );

    const body = await upstream.text();
    const contentType = upstream.headers.get("content-type") ?? "application/json";
    return res.status(upstream.status).setHeader("content-type", contentType).send(body);
  } catch {
    return res.status(502).json({ detail: "Failed to reach backend service." });
  }
}
