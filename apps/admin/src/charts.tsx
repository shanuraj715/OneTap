import type { CSSProperties } from "react";

/**
 * Small, dependency-free SVG chart primitives for the dashboard — no
 * charting library, since these four cover every chart widget in the
 * catalogue and stay fully theme-token-driven (a charting lib brings its own
 * styling system to fight with `var(--color-*)`).
 */

export const CHART_PALETTE = ["#B23B3B", "#3B7BB2", "#3BA35C", "#B2953B", "#7B3BB2", "#3BAFB2", "#B23B8F", "#6B7280"];

/* ------------------------------------------------------------- line chart */

export function LineChart({
  points,
  height = 150,
  color = "var(--color-primary)",
  formatValue = (v: number) => String(v),
}: {
  points: { label: string; value: number }[];
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
}) {
  if (points.length === 0) return <Empty height={height} />;

  const values = points.map((p) => p.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = points.length > 1 ? 100 / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({ x: i * stepX, y: 100 - ((p.value - min) / range) * 100 }));
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const area = `${line} L100,100 L0,100 Z`;

  return (
    <div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height, display: "block", overflow: "visible" }}>
        <path d={area} fill={color} opacity={0.12} stroke="none" />
        <path d={line} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={1.6} fill={color} vectorEffect="non-scaling-stroke">
            <title>
              {points[i]!.label}: {formatValue(points[i]!.value)}
            </title>
          </circle>
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--color-text-muted)", marginTop: 5 }}>
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- bar chart */

export function BarChart({
  bars,
  height = 110,
  color = "var(--color-primary)",
  formatValue = (v: number) => String(v),
  labelEvery = 1,
}: {
  bars: { label: string; value: number }[];
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
  /** show an x-axis label under every Nth bar, so 24 hourly bars don't crowd */
  labelEvery?: number;
}) {
  if (bars.length === 0) return <Empty height={height} />;
  const max = Math.max(...bars.map((b) => b.value), 1);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height }}>
        {bars.map((b, i) => (
          <div key={i} style={barCol} title={`${b.label}: ${formatValue(b.value)}`}>
            <div
              style={{
                width: "100%",
                maxWidth: 18,
                borderRadius: "3px 3px 0 0",
                background: b.value > 0 ? color : "var(--color-border)",
                height: `${Math.max(b.value > 0 ? 4 : 2, (b.value / max) * 100)}%`,
                opacity: b.value > 0 ? 0.85 : 0.4,
              }}
            />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 3, marginTop: 5 }}>
        {bars.map((b, i) => (
          <span key={i} style={{ flex: 1, textAlign: "center", fontSize: 9.5, color: "var(--color-text-muted)" }}>
            {i % labelEvery === 0 ? b.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
const barCol: CSSProperties = { flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "center", height: "100%" };

/* ------------------------------------------------------------ donut chart */

export function DonutChart({
  segments,
  size = 116,
  thickness = 16,
}: {
  segments: { label: string; value: number; color?: string }[];
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  let cursor = 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={thickness} />
        {total > 0
          ? segments.map((s, i) => {
              if (s.value <= 0) return null;
              const dash = (s.value / total) * circumference;
              const el = (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color ?? CHART_PALETTE[i % CHART_PALETTE.length]}
                  strokeWidth={thickness}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-cursor}
                >
                  <title>
                    {s.label}: {s.value}
                  </title>
                </circle>
              );
              cursor += dash;
              return el;
            })
          : null}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, minWidth: 120 }}>
        {segments.map((s, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: s.color ?? CHART_PALETTE[i % CHART_PALETTE.length], flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{s.label}</span>
            <strong style={{ fontVariantNumeric: "tabular-nums" }}>{s.value}</strong>
            {total > 0 ? <span style={{ color: "var(--color-text-muted)", fontSize: 11 }}>{Math.round((s.value / total) * 100)}%</span> : null}
          </span>
        ))}
        {total === 0 ? <span style={{ color: "var(--color-text-muted)" }}>No data yet</span> : null}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- ranked h-bars */

export function HBarList({
  items,
  formatValue = (v: number) => String(v),
}: {
  items: { label: string; value: number; sub?: string }[];
  formatValue?: (v: number) => string;
}) {
  if (items.length === 0) return <p style={{ color: "var(--color-text-muted)", fontSize: 13, margin: 0 }}>No data yet.</p>;
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((it, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, marginBottom: 4 }}>
            <span style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
            <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--color-text-muted)", flexShrink: 0 }}>
              {formatValue(it.value)}
              {it.sub ? <span style={{ marginLeft: 5 }}>{it.sub}</span> : null}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "var(--color-border)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(it.value / max) * 100}%`, background: "var(--color-primary)", borderRadius: 3 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Empty({ height }: { height: number }) {
  return (
    <div style={{ height, display: "grid", placeItems: "center", color: "var(--color-text-muted)", fontSize: 13 }}>No data yet</div>
  );
}
