import { Link } from "react-router-dom";
import { ArrowRight, CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { useServerHealth } from "../../lib/usePlatform";
import "./viz/viz.css";

/**
 * The server's health, drawn: ten boxes lit up to the score, in the colour of its level — green (7–10), yellow
 * (4–6), red (0–3). The colour is never the only signal: there is always the number, the word, and an icon.
 */
export function HealthBoxes({ boxes = 0, level, size = 18 }) {
  return (
    <span className={`viz viz-boxes ${level ?? ""}`} style={{ "--bs": `${size}px` }} role="img" aria-label={`${boxes} out of 10`}>
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className={`viz-box ${i < boxes ? "on" : ""}`} />
      ))}
    </span>
  );
}

export const LEVEL_ICON = { good: CircleCheck, warning: TriangleAlert, critical: CircleX };

/** "✓ Healthy" / "⚠ Needs attention" / "✕ Critical". */
export function LevelLabel({ level, label, size = 17 }) {
  const Icon = LEVEL_ICON[level] ?? CircleCheck;
  return (
    <span className={`viz srv-level ${level}`}>
      <Icon size={size} aria-hidden /> {label}
    </span>
  );
}

/** One line for the dashboard: the score, and a link to the Server page. */
export function ServerStrip() {
  const q = useServerHealth();
  const h = q.data?.health;
  const parts = h?.ready ? Object.fromEntries(h.parts.map((p) => [p.id, p])) : {};
  return (
    <Link to="/platform/server" className="viz viz-tile srv-strip" title="Open the Server page">
      <div style={{ minWidth: 150 }}>
        <div className="viz-tile-label">Server health{q.data?.hostname ? ` · ${q.data.hostname}` : ""}</div>
        {h?.ready ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
            <span className="viz-tile-value">
              {h.boxes}
              <span style={{ fontSize: 15, fontWeight: 500, color: "var(--viz-ink-muted)" }}>/10</span>
            </span>
            <HealthBoxes boxes={h.boxes} level={h.level} size={14} />
            <LevelLabel level={h.level} label={h.label} size={15} />
          </div>
        ) : (
          <div className="viz-tile-note" style={{ marginTop: 6 }}>{q.isError ? "Couldn't read the server just now." : "Measuring…"}</div>
        )}
      </div>
      {h?.ready ? (
        <div className="srv-strip-facts">
          {parts.cpu ? <span>CPU <b>{parts.cpu.value}</b></span> : null}
          {parts.memory ? <span>Memory <b>{parts.memory.value}</b></span> : null}
          {parts.disk ? <span>Disk <b>{parts.disk.value}</b> full</span> : null}
          {parts.api ? <span>Database <b>{parts.api.value}</b></span> : null}
        </div>
      ) : null}
      <span style={{ color: "var(--viz-ink-muted)", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5 }}>
        Details <ArrowRight size={14} aria-hidden />
      </span>
    </Link>
  );
}
