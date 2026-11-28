// Small rings that rise through a hero like steam off a pass: left position (%), size (px), delay (s), duration (s). Pure decoration.
const BUBBLES = [
  { x: 6, s: 10, d: 0, t: 17 }, { x: 14, s: 16, d: 5, t: 21 }, { x: 24, s: 8, d: 9, t: 15 }, { x: 33, s: 13, d: 2, t: 19 },
  { x: 47, s: 9, d: 7, t: 16 }, { x: 58, s: 18, d: 11, t: 23 }, { x: 68, s: 11, d: 3, t: 18 }, { x: 77, s: 8, d: 13, t: 14 },
  { x: 86, s: 15, d: 6, t: 20 }, { x: 94, s: 10, d: 10, t: 17 },
];

// The heartbeat: a flat line, then a small bump, a dip, a tall peak, a dip and back to flat (x 0–1200, y 0–160; the line is stretched to the hero's width).
const BEAT = [[0, 92], [360, 92], [392, 92], [412, 42], [440, 140], [470, 12], [500, 132], [522, 92], [1200, 92]];
const num = (n) => Math.round(n * 100) / 100;
/**
 * The line as a path whose corners are softly rounded instead of sharp points: each corner is cut `radius` short on both sides and the two cuts are joined by a
 * little curve that bends towards the corner. A corner between two short sides gets a smaller cut so the curves never overlap.
 */
function roundedPath(points, radius) {
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1];
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    const before = Math.hypot(x - px, y - py);
    const after = Math.hypot(nx - x, ny - y);
    if (Math.abs((x - px) * (ny - y) - (y - py) * (nx - x)) < 1e-6) { d += ` L${x} ${y}`; continue; } // straight on: no corner
    const k = Math.min(radius, before / 2, after / 2);
    d += ` L${num(x - ((x - px) / before) * k)} ${num(y - ((y - py) / before) * k)} Q${x} ${y} ${num(x + ((nx - x) / after) * k)} ${num(y + ((ny - y) / after) * k)}`;
  }
  const [lx, ly] = points[points.length - 1];
  return `${d} L${lx} ${ly}`;
}
const BEAT_PATH = roundedPath(BEAT, 14);

/**
 * The moving background of the apps heroes: drifting colour, a slow dotted grid, rising rings and a heartbeat line that draws itself.
 * All aria-hidden, no script. `soft` is the quieter version behind the homepage hero (fainter line and dots, so the text stays the star). `solo` paints every blob in the page's own colour (`--app`, an app's page) instead of the three apps' colours (the index).
 */
export function AppsBackdrop({ solo = false, soft = false }) {
  return (
    <div className={`apps-bg${solo ? " apps-bg-solo" : ""}${soft ? " apps-bg-soft" : ""}`} aria-hidden="true">
      {/* the colour and the dots fade out towards the bottom of the hero, so the glow melts into the page instead of ending in a straight edge */}
      <span className="apps-fade">
        <span className="apps-blob apps-blob-a" />
        <span className="apps-blob apps-blob-b" />
        <span className="apps-blob apps-blob-c" />
        <span className="apps-dots" />
      </span>
      <svg className="apps-beat" viewBox="0 0 1200 160" preserveAspectRatio="none" focusable="false">
        <path className="apps-beat-glow" pathLength="1" vectorEffect="non-scaling-stroke" d={BEAT_PATH} />
        <path className="apps-beat-line" pathLength="1" vectorEffect="non-scaling-stroke" d={BEAT_PATH} />
      </svg>
      {BUBBLES.map((b, i) => (
        <i key={i} className="apps-bubble" style={{ "--x": `${b.x}%`, "--s": `${b.s}px`, "--d": `${b.d}s`, "--t": `${b.t}s` }} />
      ))}
    </div>
  );
}
