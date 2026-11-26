import type { MenuItem } from "@/api/schemas";

const LOCAL = /^(localhost|127\.0\.0\.1|10\.0\.2\.2|0\.0\.0\.0)$/;

/**
 * A picture address the phone can open. The server may send it three ways:
 *   "/uploads/abc.webp"            a path on the API itself      → the API's address in front
 *   "https://cdn.example/abc.webp" a full address                → as it is
 *   "http://localhost:3097/…"      made on a developer machine   → that machine is the API this app talks to
 * Anything else (empty, not an address) gives null and the dish simply has no picture.
 */
export function resolveImageUrl(url: string | null | undefined, apiUrl: string): string | null {
  const raw = (url ?? "").trim();
  if (!raw) return null;
  if (raw.startsWith("//")) return `https:${raw}`;
  const api = apiUrl.replace(/\/$/, "");
  if (raw.startsWith("/")) return `${api}${raw}`;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (LOCAL.test(u.hostname)) {
      const a = new URL(api);
      u.protocol = a.protocol;
      u.hostname = a.hostname;
      u.port = a.port; // (an empty port clears the old one — setting only `host` would have kept ":3072" on https://api…)
      return u.toString();
    }
    return raw;
  } catch {
    return null;
  }
}

/** The picture to show on a dish row: the square (1:1) one if the dish has one (it fits the row), else the first. */
export function pictureOf(item: Pick<MenuItem, "images">, apiUrl: string): string | null {
  const images = item.images ?? [];
  const best = images.find((i) => !i.ratio || i.ratio === "1:1") ?? images[0];
  return resolveImageUrl(best?.url, apiUrl);
}
