export const config = { runtime: "edge" };

export default async function handler(request) {
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ detail: "Method not allowed." }), {
      status: 405,
      headers: { Allow: "GET", "content-type": "application/json" },
    });
  }

  const backendBaseUrl = process.env.BACKEND_BASE_URL?.trim().replace(/\/$/, "");
  const backendApiKey = process.env.BACKEND_API_KEY?.trim();
  if (!backendBaseUrl || !backendApiKey) {
    return new Response(JSON.stringify({ detail: "Backend proxy is not configured." }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const upstream = await fetch(`${backendBaseUrl}/v1/stats`, {
      method: "GET",
      headers: { "X-API-Key": backendApiKey },
    });

    const body = await upstream.text();
    const contentType = upstream.headers.get("content-type") ?? "application/json";
    return new Response(body, {
      status: upstream.status,
      headers: { "content-type": contentType },
    });
  } catch {
    return new Response(JSON.stringify({ detail: "Failed to reach backend service." }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}
