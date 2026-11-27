/**
 * Small, dependency-free SVG chart primitives for the dashboard — no charting library, since these cover every chart widget in the catalogue and
 * stay fully theme-token-driven (a charting lib brings its own styling system to fight with `var(--color-*)`).
 *
 * Drawn in real pixels (the width is measured), so circles stay round and text stays the size it is meant to be. Every chart reads in both themes:
 * colours come from tokens, never a literal, and a chart with nothing to show says so instead of drawing an empty frame.
 */
import { useEffect, useId, useRef, useState } from "react";

export const CHART_PALETTE = ["#B23B3B", "#3B7BB2", "#3BA35C", "#B2953B", "#7B3BB2", "#3BAFB2", "#B23B8F", "#6B7280"];

/** `color` at `pct` percent over the card surface — a soft tint of a token that still works on a dark theme. */
export const tint = (color, pct = 14) => `color-mix(in srgb, ${color} ${pct}%, var(--color-surface))`;

/** The width of the element `ref` points at, kept up to date as it is resized (0 until measured). */
function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => setWidth(Math.round(el.getBoundingClientRect().width));
    read();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** The next "round" number at or above `n` (1, 2, 2.5, 5 × a power of ten) — so the top grid line is a number a person would pick. */
function niceCeil(n) {
  if (n <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(n));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (n <= m * pow) return m * pow;
  return 10 * pow;
}

/** 1,250 → "1.3k", 1,200,000 → "12L" (lakh) — short enough for an axis. */
export function compact(n) {
  const v = Math.abs(n);
  if (v >= 10_000_000) return `${(n / 10_000_000).toFixed(v >= 100_000_000 ? 0 : 1).replace(/\.0$/, "")}Cr`;
  if (v >= 100_000) return `${(n / 100_000).toFixed(v >= 1_000_000 ? 0 : 1).replace(/\.0$/, "")}L`;
  if (v >= 1_000) return `${(n / 1_000).toFixed(v >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k`;
  return String(Math.round(n));
}

/* ------------------------------------------------------------- line chart */

/** Values over time, as a filled line with a faint grid, a marked last point and a readout that follows the pointer. */
export function LineChart({ points, height = 176, color = "var(--color-primary)", formatValue = (v) => String(v), formatTick = compact }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const gradientId = useId().replace(/:/g, "");
  if (points.length === 0) return <Empty height={height} />;

  const W = width || 320;
  const left = 38;
  const right = 10;
  const top = 12;
  const bottom = 22;
  const innerW = Math.max(40, W - left - right);
  const innerH = height - top - bottom;
  const max = niceCeil(Math.max(...points.map((p) => p.value), 1));
  const xAt = (i) => left + (points.length > 1 ? (i / (points.length - 1)) * innerW : innerW / 2);
  const yAt = (v) => top + innerH - (v / max) * innerH;
  const coords = points.map((p, i) => ({ x: xAt(i), y: yAt(p.value) }));
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1].x.toFixed(1)},${top + innerH} L${coords[0].x.toFixed(1)},${top + innerH} Z`;
  const ticks = [0, 0.5, 1].map((f) => ({ y: yAt(max * f), label: formatTick(max * f) }));
  const last = coords[coords.length - 1];
  const labelAt = new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]);

  const pick = (clientX) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const rel = clientX - box.left - left;
    const i = Math.round((rel / innerW) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };
  const hv = hover === null ? null : coords[hover];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg
        width={W}
        height={height}
        role="img"
        aria-label={`${points.length} points, from ${points[0].label} to ${points[points.length - 1].label}; latest ${formatValue(points[points.length - 1].value)}`}
        style={{ display: "block", overflow: "visible", touchAction: "pan-y" }}
        onMouseMove={(e) => pick(e.clientX)}
        onMouseLeave={() => setHover(null)}
        onTouchMove={(e) => pick(e.touches[0].clientX)}
        onTouchEnd={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t.y}>
            <line x1={left} x2={left + innerW} y1={t.y} y2={t.y} stroke="var(--color-border)" strokeWidth="1" strokeDasharray={t.label === "0" ? undefined : "3 4"} />
            <text x={left - 8} y={t.y + 3.5} textAnchor="end" fontSize="10" fill="var(--color-text-muted)">
              {t.label}
            </text>
          </g>
        ))}
        <path d={area} fill={`url(#${gradientId})`} stroke="none" />
        <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) =>
          labelAt.has(i) ? (
            <text key={`l${i}`} x={xAt(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fontSize="10" fill="var(--color-text-muted)">
              {p.label}
            </text>
          ) : null,
        )}
        {hv ? <line x1={hv.x} x2={hv.x} y1={top} y2={top + innerH} stroke="var(--color-text-muted)" strokeWidth="1" strokeDasharray="2 3" opacity="0.6" /> : null}
        {/* the latest point is the one that matters: a halo and a ring in the card's own colour */}
        <circle cx={last.x} cy={last.y} r="7" fill={color} opacity="0.16" />
        <circle cx={last.x} cy={last.y} r="3.6" fill="var(--color-surface)" stroke={color} strokeWidth="2.2" />
        {hv ? <circle cx={hv.x} cy={hv.y} r="4.4" fill={color} stroke="var(--color-surface)" strokeWidth="2" /> : null}
      </svg>
      {hv ? (
        <div
          role="status"
          style={{
            position: "absolute",
            top: Math.max(0, hv.y - 46),
            left: Math.min(Math.max(hv.x - 52, 0), Math.max(0, W - 104)),
            width: 104,
            padding: "5px 8px",
            borderRadius: 8,
            background: "var(--color-text)",
            color: "var(--color-bg)",
            fontSize: 11.5,
            textAlign: "center",
            pointerEvents: "none",
            lineHeight: 1.3,
            boxShadow: "0 4px 14px rgba(0,0,0,0.22)",
          }}
        >
          <div style={{ opacity: 0.75, fontSize: 10.5 }}>{points[hover].label}</div>
          <strong style={{ fontVariantNumeric: "tabular-nums" }}>{formatValue(points[hover].value)}</strong>
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- sparkline */

/** A tiny trend line for inside a number card: no axes, an end dot, a soft fill. */
export function Sparkline({ values, color = "var(--color-primary)", width = 92, height = 36 }) {
  const gradientId = useId().replace(/:/g, "");
  if (values.length < 2 || values.every((v) => v === 0)) return null;
  const max = Math.max(...values, 1);
  const pad = 4;
  const xs = (i) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const ys = (v) => height - pad - (v / max) * (height - pad * 2);
  const pts = values.map((v, i) => [xs(i), ys(v)]);
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg width={width} height={height} aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${lx.toFixed(1)},${height} L${pts[0][0].toFixed(1)},${height} Z`} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="2.8" fill={color} />
    </svg>
  );
}

/* -------------------------------------------------------------- bar chart */

/** Bars, the busiest one in full colour (and named), the rest softer; `highlight` marks one more (the current hour). */
export function BarChart({ bars, height = 130, color = "var(--color-primary)", formatValue = (v) => String(v), labelEvery = 1, highlight = -1, unit = "" }) {
  if (bars.length === 0) return <Empty height={height} />;
  const max = Math.max(...bars.map((b) => b.value), 1);
  const peak = bars.every((b) => b.value === 0) ? -1 : bars.reduce((best, b, i) => (b.value > bars[best].value ? i : best), 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height, paddingTop: 18, position: "relative" }}>
        {[0.5, 1].map((f) => (
          <div key={f} aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, bottom: `${f * (100 - (18 / height) * 100)}%`, borderTop: "1px dashed var(--color-border)" }} />
        ))}
        {bars.map((b, i) => {
          const on = i === peak || i === highlight;
          return (
            <div key={i} style={barCol} title={`${b.label}${unit}: ${formatValue(b.value)}`}>
              {i === peak ? <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--color-text)", marginBottom: 3, fontVariantNumeric: "tabular-nums" }}>{formatValue(b.value)}</span> : null}
              <div
                style={{
                  width: "100%",
                  maxWidth: 22,
                  borderRadius: "5px 5px 2px 2px",
                  background: b.value > 0 ? color : "var(--color-border)",
                  height: `${Math.max(b.value > 0 ? 5 : 2, (b.value / max) * 100)}%`,
                  opacity: b.value === 0 ? 0.5 : on ? 1 : 0.5,
                  outline: i === highlight ? `2px solid ${color}` : "none",
                  outlineOffset: 2,
                  position: "relative",
                  zIndex: 1,
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 3, marginTop: 6 }}>
        {bars.map((b, i) => (
          <span key={i} style={{ flex: 1, textAlign: "center", fontSize: 10, color: i === highlight ? "var(--color-text)" : "var(--color-text-muted)", fontWeight: i === highlight ? 700 : 400 }}>
            {i % labelEvery === 0 || i === highlight ? b.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
const barCol = { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", minWidth: 0 };

/* ------------------------------------------------------------ donut chart */

/** Shares of a whole, with the total in the middle and a legend that says each share in numbers. */
export function DonutChart({ segments, size = 128, thickness = 16, centerLabel = "total" }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  let cursor = 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)", display: "block" }} role="img" aria-label={`${total} ${centerLabel}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={thickness} />
          {total > 0
            ? segments.map((s, i) => {
                if (s.value <= 0) return null;
                const dash = (s.value / total) * circumference;
                const gap = segments.filter((x) => x.value > 0).length > 1 ? 2.5 : 0; // a hairline of surface between neighbours
                const el = (
                  <circle
                    key={i}
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={s.color ?? CHART_PALETTE[i % CHART_PALETTE.length]}
                    strokeWidth={thickness}
                    strokeDasharray={`${Math.max(0, dash - gap)} ${circumference - Math.max(0, dash - gap)}`}
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
        <div style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center", textAlign: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-heading)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{total}</div>
          <div style={{ fontSize: 10.5, color: "var(--color-text-muted)", marginTop: 3 }}>{centerLabel}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 12.5, minWidth: 130, flex: "1 1 130px" }}>
        {segments.map((s, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color ?? CHART_PALETTE[i % CHART_PALETTE.length], flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{s.label}</span>
            <strong style={{ fontVariantNumeric: "tabular-nums" }}>{s.value}</strong>
            {total > 0 ? <span style={{ color: "var(--color-text-muted)", fontSize: 11, width: 30, textAlign: "right" }}>{Math.round((s.value / total) * 100)}%</span> : null}
          </span>
        ))}
        {total === 0 ? <span style={{ color: "var(--color-text-muted)" }}>No data yet</span> : null}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- ranked h-bars */

/** A ranked list with a bar behind each name: first place numbered and in full colour. */
export function HBarList({ items, formatValue = (v) => String(v) }) {
  if (items.length === 0) return <p style={{ color: "var(--color-text-muted)", fontSize: 13, margin: 0 }}>No data yet.</p>;
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <ol style={{ display: "flex", flexDirection: "column", gap: 11, margin: 0, padding: 0, listStyle: "none" }}>
      {items.map((it, i) => (
        <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span
            aria-hidden="true"
            style={{
              flexShrink: 0,
              width: 22,
              height: 22,
              borderRadius: 7,
              display: "grid",
              placeItems: "center",
              fontSize: 11.5,
              fontWeight: 700,
              background: i === 0 ? "var(--color-primary)" : tint("var(--color-text-muted)", 14),
              color: i === 0 ? "var(--color-on-primary)" : "var(--color-text-muted)",
            }}
          >
            {i + 1}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, marginBottom: 5 }}>
              <span style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
              <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--color-text-muted)", flexShrink: 0 }}>
                <strong style={{ color: "var(--color-text)" }}>{formatValue(it.value)}</strong>
                {it.sub ? <span style={{ marginLeft: 4 }}>{it.sub}</span> : null}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "var(--color-border)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(it.value / max) * 100}%`, background: "var(--color-primary)", opacity: i === 0 ? 1 : 0.55, borderRadius: 3 }} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Empty({ height }) {
  return <div style={{ height, display: "grid", placeItems: "center", color: "var(--color-text-muted)", fontSize: 13 }}>No data yet</div>;
}
