import { apiServerUrl } from "./api-config.js";

/**
 * The contact form's two requests (get a spam-guard challenge, send the
 * enquiry) go through this site's own server to the API.
 *
 * Why not a plain rewrite: the API would then see this server as the sender of
 * every enquiry, so its "no more than N per visitor" limits would count all
 * visitors as one. Here the visitor's address is passed along, with the secret
 * the API shares with this site so it knows the address is ours to vouch for.
 * Anyone posting to the API directly can't do that — they're counted by their
 * own connection.
 */
const SECRET = process.env.WEBSITE_REVALIDATE_SECRET || "dev-only-website-revalidate-secret";
const MAX_BODY = 20_000;

/** The visitor's address as our own reverse proxy (nginx) saw it: its X-Real-IP, else the hop it appended to X-Forwarded-For. */
function visitorIp(request) {
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  const chain = request.headers.get("x-forwarded-for");
  return chain ? chain.split(",").pop().trim() : "";
}

export async function forward(request, path, { method }) {
  const headers = { "x-site-secret": SECRET };
  const ip = visitorIp(request);
  if (ip) headers["x-client-ip"] = ip;

  let body;
  if (method === "POST") {
    body = await request.text();
    if (body.length > MAX_BODY) return Response.json({ error: "That's more than we can take in one go." }, { status: 413 });
    headers["content-type"] = "application/json";
  }
  try {
    const res = await fetch(`${apiServerUrl()}${path}`, { method, headers, body, cache: "no-store", signal: AbortSignal.timeout(10_000) });
    return new Response(await res.text(), { status: res.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "We couldn't send that just now — please try again, or call us." }, { status: 502 });
  }
}
