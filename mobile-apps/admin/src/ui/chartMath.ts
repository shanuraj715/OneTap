/** The arithmetic behind the charts — plain functions, so it can be tested without drawing anything. */
export interface Pt { x: number; y: number }

/** A "nice" top for an axis: 4.37 → 5, 87 → 100, 1230 → 1500 (so the highest value never touches the top and the ticks are round). */
export function niceMax(max: number): number {
  if (!(max > 0)) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  const f = max / pow;
  const step = f <= 1 ? 1 : f <= 1.5 ? 1.5 : f <= 2 ? 2 : f <= 3 ? 3 : f <= 5 ? 5 : f <= 7.5 ? 7.5 : 10;
  return step * pow;
}

/** Values → points in a box (padding all round); a flat or single series is drawn in the middle. */
export function toPoints(values: number[], width: number, height: number, pad = { l: 8, r: 8, t: 12, b: 12 }, max?: number): Pt[] {
  const top = max ?? niceMax(Math.max(...values, 0));
  const w = Math.max(1, width - pad.l - pad.r);
  const h = Math.max(1, height - pad.t - pad.b);
  return values.map((v, i) => ({ x: pad.l + (values.length === 1 ? w / 2 : (i / (values.length - 1)) * w), y: pad.t + h - (top > 0 ? (v / top) * h : 0) }));
}

/** A smooth line through the points (a Catmull-Rom curve turned into Béziers, kept from overshooting). */
export function smoothPath(pts: Pt[]): string {
  if (!pts.length) return "";
  if (pts.length === 1) return `M${pts[0]!.x} ${pts[0]!.y}`;
  let d = `M${pts[0]!.x.toFixed(1)} ${pts[0]!.y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!, p1 = pts[i]!, p2 = pts[i + 1]!, p3 = pts[i + 2] ?? p2;
    const t = 0.18;
    const c1 = { x: p1.x + (p2.x - p0.x) * t, y: p1.y + (p2.y - p0.y) * t };
    const c2 = { x: p2.x - (p3.x - p1.x) * t, y: p2.y - (p3.y - p1.y) * t };
    // never curve below/above the neighbours: the line must not suggest a dip that is not in the data
    const lo = Math.min(p1.y, p2.y), hi = Math.max(p1.y, p2.y);
    d += ` C${c1.x.toFixed(1)} ${Math.min(hi, Math.max(lo, c1.y)).toFixed(1)} ${c2.x.toFixed(1)} ${Math.min(hi, Math.max(lo, c2.y)).toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}
/** The same line closed down to the baseline, for the soft fill under it. */
export const areaPath = (pts: Pt[], baseline: number) => (pts.length ? `${smoothPath(pts)} L${pts[pts.length - 1]!.x.toFixed(1)} ${baseline} L${pts[0]!.x.toFixed(1)} ${baseline} Z` : "");
export const lineLength = (pts: Pt[]) => pts.reduce((n, p, i) => (i ? n + Math.hypot(p.x - pts[i - 1]!.x, p.y - pts[i - 1]!.y) : 0), 0) * 1.12; // a curve is a little longer than its chords

/** Which point is nearest to a finger at `x`? */
export const nearest = (pts: Pt[], x: number): number => pts.reduce((best, p, i) => (Math.abs(p.x - x) < Math.abs(pts[best]!.x - x) ? i : best), 0);

/** Donut segments → start/length fractions of the circle (zero and negative values are dropped). */
export function segments(values: number[]): { start: number; length: number }[] {
  const total = values.reduce((n, v) => n + Math.max(0, v), 0);
  let at = 0;
  return values.map((v) => { const length = total > 0 ? Math.max(0, v) / total : 0; const s = { start: at, length }; at += length; return s; });
}
