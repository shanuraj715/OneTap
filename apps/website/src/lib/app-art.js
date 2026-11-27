/**
 * How each Rasoi Pulse app looks on the website: its icon (the same artwork as the phone app, from brand/rasoi-pulse) and the colour
 * its card glows with. A new app only needs its icon in public/app-icons/<id>.svg and a line here; until then it shows the Rasoi Pulse
 * tile and the site's own brand colour.
 */
const ART = {
  oma: { icon: "/app-icons/oma.svg", accent: "#4b5bd6" }, // the navy app → indigo
  kda: { icon: "/app-icons/kda.svg", accent: "#12a58a" }, // the teal app
  rda: { icon: "/app-icons/rda.svg", accent: "#8b5cf6" }, // the plum app → violet
  admin: { icon: "/app-icons/admin.svg", accent: "#d9822b" }, // the platform team's app → amber (private unless made public in the console)  business: { icon: "/app-icons/business.svg", accent: "#d6336c" }, // the owners' app → rose (private until made public in the console)
};
const FALLBACK = { icon: "/app-icons/rasoi-pulse.svg", accent: "var(--brand)" };

export const appArt = (id) => ART[id] ?? FALLBACK;
export const BRAND_TILE = "/app-icons/rasoi-pulse.svg";

/** Where the nth of `count` icons sits on the orbit, as percentages of a square box (the first one at the top, then clockwise). */
export function orbitPlace(n, count) {
  const angle = ((-90 + (360 / Math.max(count, 1)) * n) * Math.PI) / 180;
  return { x: Math.round((50 + 36 * Math.cos(angle)) * 100) / 100, y: Math.round((50 + 36 * Math.sin(angle)) * 100) / 100 };
}
