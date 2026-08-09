export const config = { runtime: "edge" };

function errorPage(status) {
  const message = status === 404 ? "This shared path was not found." : "Sharing is temporarily unavailable.";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${message}</title></head><body><main><h1>${message}</h1><p><a href="/">Create your own learning path</a></p></main></body></html>`;
}

export default async function handler(request) {
  const backendBaseUrl = process.env.BACKEND_BASE_URL?.trim().replace(/\/$/, "");
  const backendApiKey = process.env.BACKEND_API_KEY?.trim();
  const shareId = request.url.split("/").pop()?.split("?")[0] ?? "";
  const robotsHeaders = { "content-type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" };
  if (request.method !== "GET") return new Response(errorPage(404), { status: 405, headers: { ...robotsHeaders, Allow: "GET" } });
  if (!backendBaseUrl || !backendApiKey) return new Response(errorPage(503), { status: 503, headers: robotsHeaders });

  try {
    const upstream = await fetch(`${backendBaseUrl}/v1/shares/${encodeURIComponent(decodeURIComponent(shareId))}`, { headers: { "X-API-Key": backendApiKey } });
    if (!upstream.ok) {
      const status = upstream.status === 404 ? 404 : 503;
      return new Response(errorPage(status), { status, headers: robotsHeaders });
    }
    const shell = await fetch(`${new URL(request.url).origin}/share-shell.html`);
    if (!shell.ok) return new Response(errorPage(503), { status: 503, headers: robotsHeaders });
    return new Response(await shell.text(), { status: 200, headers: robotsHeaders });
  } catch {
    return new Response(errorPage(503), { status: 503, headers: robotsHeaders });
  }
}
