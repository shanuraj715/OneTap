import { revalidateTag } from "next/cache";
import { timingSafeEqual } from "node:crypto";

/**
 * The API calls this after anything on the website changes in the console,
 * so the change is live in seconds instead of at the next 5-minute refresh.
 * Guarded by the secret shared with the API (WEBSITE_REVALIDATE_SECRET).
 */
const SECRET = process.env.WEBSITE_REVALIDATE_SECRET || "dev-only-website-revalidate-secret";

function sameSecret(given) {
  const a = Buffer.from(String(given ?? ""));
  const b = Buffer.from(SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request) {
  if (!sameSecret(request.headers.get("x-revalidate-secret"))) {
    return Response.json({ error: "Not allowed" }, { status: 401 });
  }
  revalidateTag("site");
  return Response.json({ revalidated: true, at: new Date().toISOString() });
}
