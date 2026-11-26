// Small rings that rise through a hero like steam off a pass: left position (%), size (px), delay (s), duration (s). Pure decoration.
const BUBBLES = [
  { x: 6, s: 10, d: 0, t: 17 }, { x: 14, s: 16, d: 5, t: 21 }, { x: 24, s: 8, d: 9, t: 15 }, { x: 33, s: 13, d: 2, t: 19 },
  { x: 47, s: 9, d: 7, t: 16 }, { x: 58, s: 18, d: 11, t: 23 }, { x: 68, s: 11, d: 3, t: 18 }, { x: 77, s: 8, d: 13, t: 14 },
  { x: 86, s: 15, d: 6, t: 20 }, { x: 94, s: 10, d: 10, t: 17 },
];

/**
 * The moving background of the apps heroes: drifting colour, a slow dotted grid, rising rings and a heartbeat line that draws itself.
 * All aria-hidden, no script. `solo` paints every blob in the page's own colour (`--app`, an app's page) instead of the three apps' colours (the index).
 */
export function AppsBackdrop({ solo = false }) {
  return (
    <div className={`apps-bg${solo ? " apps-bg-solo" : ""}`} aria-hidden="true">
      <span className="apps-blob apps-blob-a" />
      <span className="apps-blob apps-blob-b" />
      <span className="apps-blob apps-blob-c" />
      <span className="apps-dots" />
      <svg className="apps-beat" viewBox="0 0 1200 160" preserveAspectRatio="none" focusable="false">
        <path className="apps-beat-glow" pathLength="1" vectorEffect="non-scaling-stroke" d="M0 92 H360 L392 92 L412 42 L440 140 L470 12 L500 132 L522 92 H1200" />
        <path className="apps-beat-line" pathLength="1" vectorEffect="non-scaling-stroke" d="M0 92 H360 L392 92 L412 42 L440 140 L470 12 L500 132 L522 92 H1200" />
      </svg>
      {BUBBLES.map((b, i) => (
        <i key={i} className="apps-bubble" style={{ "--x": `${b.x}%`, "--s": `${b.s}px`, "--d": `${b.d}s`, "--t": `${b.t}s` }} />
      ))}
    </div>
  );
}
