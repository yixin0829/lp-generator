export const config = { runtime: "edge" };

export default async function handler(request) {
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ detail: "Method not allowed." }), { status: 405, headers: { Allow: "GET", "content-type": "application/json" } });
  }
  const backendBaseUrl = process.env.BACKEND_BASE_URL?.trim().replace(/\/$/, "");
  const backendApiKey = process.env.BACKEND_API_KEY?.trim();
  const shareId = request.url.split("/").pop()?.split("?")[0] ?? "";
  if (!backendBaseUrl || !backendApiKey) return Response.json({ detail: "Backend proxy is not configured." }, { status: 500 });
  try {
    const upstream = await fetch(`${backendBaseUrl}/v1/shares/${encodeURIComponent(decodeURIComponent(shareId))}`, { headers: { "X-API-Key": backendApiKey } });
    return new Response(await upstream.text(), { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" } });
  } catch {
    return Response.json({ detail: "Failed to reach backend service." }, { status: 502 });
  }
}
