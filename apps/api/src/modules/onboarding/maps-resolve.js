import { parseMapsPoint } from "@onetap/config-schema";
import { HttpError } from "../../middleware/error.js";

/**
 * Turn a pasted Google Maps address into coordinates. A full link carries them already; a SHORT link (maps.app.goo.gl/…)
 * has to be opened to find out where it goes. This is the only place the server fetches an address a person typed, so it
 * is strict: only Google's own map hosts, only https, a handful of redirects, a short timeout, and the answer is just a
 * pair of numbers — never the page itself.
 *
 * (The bench sets MAPS_RESOLVE_ALLOW_LOCAL=1 so a test can use a local stand-in for Google; never set it in production.)
 */
const MAX_HOPS = 5;
const TIMEOUT_MS = 4000;
const GOOGLE = [/^maps\.app\.goo\.gl$/, /^goo\.gl$/, /^maps\.google\.[a-z.]+$/, /^(www\.)?google\.[a-z.]+$/];

function allowed(url) {
  if (process.env.MAPS_RESOLVE_ALLOW_LOCAL === "1" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url.href)) return true;
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (!GOOGLE.some((rx) => rx.test(url.hostname))) return false;
  // goo.gl is Google's old shortener for everything — only its maps links
  if (url.hostname === "goo.gl" && !url.pathname.startsWith("/maps")) return false;
  return true;
}

export async function resolveMapsLink(raw) {
  const direct = parseMapsPoint(raw);
  if (direct) return { point: direct, from: "link" };

  let url;
  try {
    url = new URL(String(raw ?? "").trim());
  } catch {
    throw new HttpError(400, "That isn't a link or coordinates. Paste a Google Maps link, or type latitude and longitude like 28.6139, 77.2090.");
  }
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    if (!allowed(url)) throw new HttpError(400, "Only Google Maps links can be opened. Paste a link from Google Maps, or type the coordinates.");
    let res;
    try {
      res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "user-agent": "Mozilla/5.0 (compatible; TablePeBot/1.0)", accept: "text/html" } });
    } catch {
      throw new HttpError(502, "Couldn't open that link from the server. Paste the full Google Maps address (open the link in a browser, then copy the address bar), or type the coordinates.");
    }
    const location = res.headers.get("location");
    if (location && res.status >= 300 && res.status < 400) {
      const next = new URL(location, url);
      const point = parseMapsPoint(next.href);
      if (point) return { point, from: "short link" };
      url = next;
      continue;
    }
    // some pages answer 200 and keep the pin in the page itself
    const body = (await res.text().catch(() => "")).slice(0, 300_000);
    const found = parseMapsPoint(body.match(/@-?\d+\.\d+,-?\d+\.\d+/)?.[0] ?? "") ?? parseMapsPoint(body.match(/!3d-?\d+\.\d+!4d-?\d+\.\d+/)?.[0] ?? "");
    if (found) return { point: found, from: "short link" };
    break;
  }
  throw new HttpError(422, "That link didn't lead to a map pin. Open it in a browser and paste the full address, or type the coordinates.");
}
