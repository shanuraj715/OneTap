/**
 * How an app that has no artwork of its own looks: a rounded tile in a colour picked from its address with its short code on it ("RPP"). The website's
 * /apps pages and the platform console both use this, so an app added in the console wears the same icon and colour in both places.
 * (The built-in apps have real artwork: apps/website/public/app-icons and apps/admin/public/app-icons.)
 */
export const APP_ACCENT_PALETTE = ["#2563eb", "#0d9488", "#c026d3", "#e11d48", "#ea580c", "#4d7c0f", "#0891b2", "#7c3aed", "#b45309", "#db2777"];

const hash = (text) => [...String(text)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** The colour an app gets: picked from its address, so the same app always wears the same one. */
export const appAccentFor = (slug) => APP_ACCENT_PALETTE[hash(slug) % APP_ACCENT_PALETTE.length];

/** A plain app icon made from the app's code: a rounded tile in `accent` with the code on it, as an image address (`data:image/svg+xml…`). */
export function generatedAppIcon(code, accent) {
  const letters = esc(String(code || "APP").slice(0, 5).toUpperCase());
  const size = letters.length > 3 ? 52 : letters.length > 2 ? 64 : 78;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="44" fill="${accent}"/><rect width="192" height="96" rx="44" fill="#fff" opacity="0.14"/><text x="96" y="${96 + size * 0.36}" font-family="system-ui,Segoe UI,Arial,sans-serif" font-weight="800" font-size="${size}" text-anchor="middle" fill="#fff" letter-spacing="2">${letters}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
