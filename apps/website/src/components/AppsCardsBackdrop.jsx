import { appArt } from "@/lib/app-art";

// Where the soft circles sit in the cards section (centre, in % of the section), how big they are (px), how far they drift (px) and breathe (scale),
// how long a slow lap takes (s) and where in the lap they start (negative s, so nothing starts all at once). Pure decoration.
const ORBS = [
  { x: 5, y: 16, s: 480, dx: 70, dy: 46, k: 1.14, t: 27, d: -4 },
  { x: 84, y: 8, s: 400, dx: -60, dy: 56, k: 1.1, t: 31, d: -12 },
  { x: 95, y: 58, s: 540, dx: -50, dy: -40, k: 1.12, t: 35, d: -20 },
  { x: 24, y: 82, s: 440, dx: 64, dy: -36, k: 1.16, t: 29, d: -9 },
  { x: 55, y: 40, s: 320, dx: -46, dy: 40, k: 1.2, t: 24, d: -16 },
  { x: 70, y: 94, s: 380, dx: 52, dy: -30, k: 1.1, t: 33, d: -25 },
];
// thin outlined circles that slowly swell and fade, like ripples
const RINGS = [
  { x: 16, y: 44, s: 150, t: 9, d: -2 },
  { x: 74, y: 76, s: 220, t: 12, d: -7 },
  { x: 46, y: 6, s: 96, t: 8, d: -4 },
  { x: 90, y: 30, s: 120, t: 10, d: -6 },
];

/**
 * The moving background of the apps' cards: big soft gradient circles in the apps' own colours, very faint, drifting and breathing slowly, with a few thin
 * ripple rings. The cards are a little see-through, so the circles glow through them. All aria-hidden, no script; with "reduce motion" it simply stands still.
 */
export function AppsCardsBackdrop({ apps }) {
  const colours = apps.length ? apps.map((a) => appArt(a.id, a).accent) : ["var(--brand)"];
  return (
    <div className="apps-orbs" aria-hidden="true">
      {ORBS.map((o, i) => (
        <i key={`o${i}`} className="apps-orb-bg" style={{ "--c": colours[i % colours.length], "--x": `${o.x}%`, "--y": `${o.y}%`, "--s": `${o.s}px`, "--dx": `${o.dx}px`, "--dy": `${o.dy}px`, "--k": o.k, "--t": `${o.t}s`, "--d": `${o.d}s` }} />
      ))}
      {RINGS.map((r, i) => (
        <i key={`r${i}`} className="apps-ring-bg" style={{ "--c": colours[(i + 1) % colours.length], "--x": `${r.x}%`, "--y": `${r.y}%`, "--s": `${r.s}px`, "--t": `${r.t}s`, "--d": `${r.d}s` }} />
      ))}
    </div>
  );
}
