/**
 * How each Rasoi Pulse app looks on the website: its icon (the same artwork as the phone app, from brand/rasoi-pulse) and the colour
 * its card glows with. An app added in the console needs nothing here: it gets a tile with its code on it, in a colour picked from its
 * address (add its own artwork in public/app-icons/<id>.svg and a line here when it has some).
 */
const ART = {
  oma: { icon: "/app-icons/oma.svg", accent: "#4b5bd6" }, // the navy app → indigo
  kda: { icon: "/app-icons/kda.svg", accent: "#12a58a" }, // the teal app
  rda: { icon: "/app-icons/rda.svg", accent: "#8b5cf6" }, // the plum app → violet
  admin: { icon: "/app-icons/admin.svg", accent: "#d9822b" }, // the platform team's app → amber (private unless made public in the console)
  business: { icon: "/app-icons/business.svg", accent: "#d6336c" }, // the owners' app → rose (private until made public in the console)
};
const FALLBACK = { icon: "/app-icons/rasoi-pulse.svg", accent: "var(--brand)" };

// colours for an app added in the console: one is picked from its address, so the same app always wears the same colour
const PALETTE = ["#2563eb", "#0d9488", "#c026d3", "#e11d48", "#ea580c", "#4d7c0f", "#0891b2", "#7c3aed", "#b45309", "#db2777"];
const hash = (text) => [...String(text)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
/** A plain app icon made from the app's code: a rounded tile in the app's colour with the code on it (the app's own artwork is added when it has some). */
export function generatedIcon(code, accent) {
  const letters = esc(String(code || "APP").slice(0, 5).toUpperCase());
  const size = letters.length > 3 ? 52 : letters.length > 2 ? 64 : 78;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="44" fill="${accent}"/><rect width="192" height="96" rx="44" fill="#fff" opacity="0.14"/><text x="96" y="${96 + size * 0.36}" font-family="system-ui,Segoe UI,Arial,sans-serif" font-weight="800" font-size="${size}" text-anchor="middle" fill="#fff" letter-spacing="2">${letters}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** An app's icon and colour. The built-in apps have artwork; an app added in the console (pass it as `meta`) gets a tile with its code. */
export function appArt(id, meta) {
  if (ART[id]) return ART[id];
  if (!meta?.code) return FALLBACK;
  const accent = PALETTE[hash(id) % PALETTE.length];
  return { icon: generatedIcon(meta.code, accent), accent };
}
export const BRAND_TILE = "/app-icons/rasoi-pulse.svg";

/** Where the nth of `count` icons sits on the orbit, as percentages of a square box (the first one at the top, then clockwise). */
export function orbitPlace(n, count) {
  const angle = ((-90 + (360 / Math.max(count, 1)) * n) * Math.PI) / 180;
  return { x: Math.round((50 + 36 * Math.cos(angle)) * 100) / 100, y: Math.round((50 + 36 * Math.sin(angle)) * 100) / 100 };
}
