import { WEEKDAYS } from "@onetap/config-schema";
import { Lightbulb } from "lucide-react";
import { count, rupees } from "../platform/viz/format";

/** change in percent, one decimal; null when there is nothing to compare with */
export const pctChange = (now, before) => (before ? Math.round(((now - before) / before) * 1000) / 10 : null);

export const hour12 = (h) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "am" : "pm"}`;

/**
 * Orders for each weekday and hour as a grid of tinted cells — darker = busier. `cells[0]` is Sunday.
 * Reading it: the dark blocks are when to have everyone on shift and the kitchen ready.
 */
export function Heatmap({ cells }) {
  const max = Math.max(1, ...cells.flat());
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const first = Math.max(0, Math.min(...hours.filter((h) => cells.some((row) => row[h] > 0)), 10) - 0);
  const last = Math.min(23, Math.max(...hours.filter((h) => cells.some((row) => row[h] > 0)), 22));
  const shown = hours.filter((h) => h >= first && h <= last);
  const order = [1, 2, 3, 4, 5, 6, 0]; // Monday first
  return (
    <div className="viz" style={{ overflowX: "auto" }} role="table" aria-label="Busiest times: orders by weekday and hour">
      <div style={{ display: "grid", gridTemplateColumns: `78px repeat(${shown.length}, minmax(22px, 1fr))`, gap: 3, minWidth: 80 + shown.length * 25 }}>
        <span />
        {shown.map((h) => <span key={h} style={{ fontSize: 10.5, textAlign: "center", color: "var(--viz-ink-muted, #6b6b6b)" }}>{h % 3 === 0 ? hour12(h).replace(" ", "") : ""}</span>)}
        {order.map((d) => (
          <FragmentRow key={d} label={WEEKDAYS[d].slice(0, 3)} row={cells[d]} shown={shown} max={max} day={WEEKDAYS[d]} />
        ))}
      </div>
    </div>
  );
}

function FragmentRow({ label, row, shown, max, day }) {
  return (
    <>
      <span style={{ fontSize: 12, alignSelf: "center", color: "var(--viz-ink-2, #444)" }}>{label}</span>
      {shown.map((h) => (
        <span
          key={h}
          role="cell"
          title={`${day} ${hour12(h)}: ${row[h]} order${row[h] === 1 ? "" : "s"} in this period`}
          style={{ height: 24, borderRadius: 4, background: row[h] ? `color-mix(in srgb, var(--viz-accent, #2a78d6) ${Math.max(14, Math.round((row[h] / max) * 100))}%, transparent)` : "var(--viz-grid, #eee)", opacity: row[h] ? 1 : 0.5 }}
        />
      ))}
    </>
  );
}

/** a small "what this means" sentence under a chart */
export const Insight = ({ children }) => (
  <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.55, color: "var(--color-text)", padding: "9px 12px", borderRadius: 10, background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
    <Lightbulb size={14} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--viz-accent, #2a78d6)" }} aria-hidden />
    {children}
  </p>
);

export const money = (paise) => rupees(paise);
export const compactMoney = (paise) => rupees(paise, { compact: true });
export { count };
