"use client";

import { useId, useMemo, useRef, useState } from "react";

/**
 * CHT01 — the stacked area chart card (smooth layers, dashed grid, axis labels, a touch-and-hover reading).
 *
 * With no data it draws the sample "Sessions" chart (that is what the components catalogue shows). Give it `layers` and it draws real numbers:
 *
 *   <AnalyticsChart palette="brand" title="Sales by order type" value="₹4.2 L" change="+12%" subtitle="Last 12 months"
 *     labels={["Jan", "Feb", …]} layers={[{ label: "Dine-in", values: [..] }, { label: "Takeaway", values: [..] }]} formatValue={(n) => "₹" + n} />
 *
 * `layers` are stacked from the bottom up. `palette` picks the colour: "sky" (the original blue), "violet", "emerald", "rose", "amber", or
 * "brand" — the page's own accent colour (`--color-primary`), so each dashboard gets its own look. `formatValue` words a number in the reading
 * bubble, `axisFormat` on the left axis. `bare` draws only the chart (no card or heading) for use inside something that already has a title.
 */

const PALETTES = {
  // [bottom, middle, top, line colours are the same as the fill's strongest stop]
  sky: ["#0369a1", "#0284c7", "#7dd3fc"],
  violet: ["#5b21b6", "#7c3aed", "#c4b5fd"],
  emerald: ["#047857", "#10b981", "#a7f3d0"],
  rose: ["#9f1239", "#e11d48", "#fda4af"],
  amber: ["#b45309", "#f59e0b", "#fde68a"],
};

/** The shades for `n` layers, bottom to top. "brand" mixes the page's accent colour with black and white. */
export function layerColors(palette, n) {
  const base = palette === "brand" ? ["color-mix(in srgb, var(--color-primary, #4f46e5) 72%, black)", "var(--color-primary, #4f46e5)", "color-mix(in srgb, var(--color-primary, #4f46e5) 38%, white)"] : (PALETTES[palette] ?? PALETTES.sky);
  if (n <= 1) return [base[1]];
  if (n === 2) return [base[0], base[2]];
  if (n === 3) return base;
  // four or more: spread across the three stops, repeating the middle
  return Array.from({ length: n }, (_, i) => (i === 0 ? base[0] : i === n - 1 ? base[2] : i % 2 ? base[1] : `color-mix(in srgb, ${base[1]} 70%, ${base[2]})`));
}

/** 25 000 → "25K", 1 200 000 → "1.2M" — for an axis where the whole number would not fit. */
export const compactNumber = (n) => {
  const a = Math.abs(n);
  if (a >= 1e7) return `${+(n / 1e7).toFixed(1)}Cr`;
  if (a >= 1e5) return `${+(n / 1e5).toFixed(1)}L`;
  if (a >= 1e3) return `${+(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
};

/** A round number at or above `v`, so the top of the axis lands on a tick (1, 2, 2.5, 5 or 10 times a power of ten). */
export const niceMax = (v) => {
  if (!(v > 0)) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= v / 1.0001) ?? 10;
  return step * pow;
};

const SAMPLE = {
  labels: Array.from({ length: 27 }, (_, i) => `Apr ${i + 4}`),
  layers: [
    { label: "Direct", values: [1200, 1600, 1400, 2200, 1800, 2400, 2200, 2700, 2900, 2600, 3400, 3800, 3600, 3200, 3900, 4200, 3600, 4400, 4600, 4100, 4800, 5200, 5000, 5400, 5800, 6100, 6400] },
    { label: "Search", values: [600, 900, 700, 1400, 1100, 2600, 2100, 2800, 3000, 2300, 3100, 3900, 3800, 5200, 4300, 3000, 5500, 5400, 5900, 6100, 6300, 6900, 5700, 7000, 7200, 7800, 8300] },
    { label: "Social", values: [400, 800, 600, 1000, 900, 2100, 1800, 2400, 3000, 1900, 3300, 3900, 4200, 4700, 3100, 4600, 4500, 5600, 4800, 6200, 6700, 5900, 7400, 7200, 7100, 8200, 8700] },
  ],
};

const W = 600;
const H = 200;

/** A smooth path through the points (the same curve the sample always used). */
const curve = (pts) => {
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const mx = (x0 + x1) / 2;
    d += ` C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}`;
  }
  return d;
};

export function AnalyticsChart({
  title = "Sessions",
  value = "13,277",
  change = "+35%",
  changeTone = "good",
  subtitle = "Sessions per day for the last 30 days",
  labels,
  layers,
  palette = "sky",
  formatValue,
  axisFormat,
  bare = false,
  style = {},
  className = "",
}) {
  const sample = !layers;
  const rows = useMemo(() => (sample ? SAMPLE.layers : layers).filter((l) => l && Array.isArray(l.values)), [sample, layers]);
  const xs = sample ? SAMPLE.labels : labels ?? [];
  const n = Math.max(0, ...rows.map((l) => l.values.length), xs.length);
  const id = useId().replace(/:/g, "");
  const colors = useMemo(() => layerColors(palette, rows.length), [palette, rows.length]);
  const fmt = formatValue ?? ((v) => v.toLocaleString("en-IN"));
  const axis = axisFormat ?? compactNumber;
  const [at, setAt] = useState(null);
  const box = useRef(null);

  // cumulative totals, layer by layer: layer i sits on top of layers 0 … i-1
  const cum = useMemo(() => rows.map((_, li) => Array.from({ length: n }, (__, i) => rows.slice(0, li + 1).reduce((s, l) => s + (Number(l.values[i]) || 0), 0))), [rows, n]);
  const top = cum.length ? cum[cum.length - 1] : [];
  const max = sample ? 26000 : niceMax(Math.max(0, ...top));
  const yTicks = [5, 4, 3, 2, 1, 0].map((k) => ({ val: (max * k) / 5, label: sample ? (k === 0 ? "0" : `${(5 * k).toLocaleString("en-US")},000`) : axis((max * k) / 5) }));
  const x = (i) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v) => H - (v / max) * H;
  const paths = cum.map((c) => {
    const pts = c.map((v, i) => [x(i), y(v)]);
    return pts.length ? { line: curve(pts.length === 1 ? [[0, pts[0][1]], [W, pts[0][1]]] : pts), n: pts.length } : null;
  });
  const ticks = n <= 1 ? [0] : Array.from({ length: Math.min(6, n) }, (_, k) => Math.round((k * (n - 1)) / (Math.min(6, n) - 1)));

  const move = (e) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || n < 1) return;
    const cx = (e.touches?.[0]?.clientX ?? e.clientX) - r.left;
    setAt(Math.max(0, Math.min(n - 1, Math.round((cx / r.width) * (n - 1)))));
  };
  const flatSample = sample && !labels;

  const chart = (
    <div style={{ display: "flex", gap: 12, alignItems: "stretch", height: 210 }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end", paddingBottom: 22, fontSize: 11, color: "var(--color-text-muted, #94a3b8)", fontVariantNumeric: "tabular-nums", minWidth: 42 }} aria-hidden="true">
        {yTicks.map((t) => <span key={t.val}>{t.label}</span>)}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div ref={box} style={{ position: "relative", height: H, flex: 1, touchAction: "pan-y" }} onMouseMove={move} onMouseLeave={() => setAt(null)} onTouchMove={move} onTouchEnd={() => setAt(null)} data-chart-area>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", pointerEvents: "none" }} aria-hidden="true">
            {yTicks.map((t) => <div key={t.val} style={{ width: "100%", borderBottom: "1px dashed var(--color-border, #e2e8f0)" }} />)}
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%", display: "block", position: "relative", zIndex: 2 }} preserveAspectRatio="none" role="img"
            aria-label={`${title}: ${rows.map((l) => l.label).join(", ")}`}>
            <defs>
              {rows.map((_, li) => (
                <linearGradient key={li} id={`${id}-l${li}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style={{ stopColor: colors[li] }} stopOpacity={0.95} />
                  <stop offset="100%" style={{ stopColor: colors[li] }} stopOpacity={0.62} />
                </linearGradient>
              ))}
            </defs>
            {/* the top layer is drawn first so the ones under it cover it, exactly as stacked areas do */}
            {[...paths].map((p, li) => ({ p, li })).reverse().map(({ p, li }) => p && (
              <g key={li} data-layer={rows[li]?.label}>
                <path d={`${p.line} L ${W} ${H} L 0 ${H} Z`} fill={`url(#${id}-l${li})`} />
                <path d={p.line} fill="none" style={{ stroke: colors[li] }} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              </g>
            ))}
          </svg>
          {at !== null && n > 0 ? (
            <>
              <div style={{ position: "absolute", top: 0, bottom: 0, left: `${n <= 1 ? 50 : (at / (n - 1)) * 100}%`, borderLeft: "1.5px solid var(--color-text, #334155)", opacity: 0.45, zIndex: 3, pointerEvents: "none" }} />
              <div role="status" data-tooltip style={{ position: "absolute", top: 4, zIndex: 4, pointerEvents: "none", left: `${n <= 1 ? 50 : (at / (n - 1)) * 100}%`, transform: at > n * 0.6 ? "translateX(calc(-100% - 10px))" : "translateX(10px)", minWidth: 150, background: "var(--color-surface, #fff)", border: "1px solid var(--color-border, #e2e8f0)", borderRadius: 10, padding: "8px 10px", boxShadow: "0 6px 18px rgba(15,23,42,0.14)", fontSize: 12 }}>
                <div style={{ color: "var(--color-text-muted, #64748b)", marginBottom: 4 }}>{xs[at] ?? ""}</div>
                {[...rows].map((l, li) => ({ l, li })).reverse().map(({ l, li }) => (
                  <div key={li} style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "space-between" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--color-text, #334155)" }}><i style={{ width: 8, height: 8, borderRadius: 2, background: colors[li], display: "inline-block" }} />{l.label}</span>
                    <b style={{ fontVariantNumeric: "tabular-nums", color: "var(--color-text, #0f172a)" }}>{flatSample ? Number(l.values[at] ?? 0).toLocaleString("en-US") : fmt(Number(l.values[at]) || 0)}</b>
                  </div>
                ))}
                {rows.length > 1 ? (
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--color-border, #e2e8f0)", marginTop: 4, paddingTop: 4 }}>
                    <span style={{ color: "var(--color-text-muted, #64748b)" }}>Total</span>
                    <b style={{ fontVariantNumeric: "tabular-nums", color: "var(--color-text, #0f172a)" }}>{flatSample ? Number(top[at] ?? 0).toLocaleString("en-US") : fmt(top[at] ?? 0)}</b>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, fontSize: 11, color: "var(--color-text-muted, #94a3b8)" }} aria-hidden="true">
          {(flatSample ? ["Apr 5", "Apr 10", "Apr 15", "Apr 20", "Apr 25", "Apr 30"] : ticks.map((i) => xs[i] ?? "")).map((t, i) => <span key={`${t}-${i}`}>{t}</span>)}
        </div>
        {rows.length > 1 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, paddingTop: 10, fontSize: 12, color: "var(--color-text-muted, #64748b)" }} data-legend>
            {rows.map((l, li) => <span key={li} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: colors[li], display: "inline-block" }} />{l.label}</span>)}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (bare) return <div className={`rasoipulse-analytics-chart ${className}`} style={style}>{chart}</div>;

  return (
    <div className={`rasoipulse-analytics-chart ${className}`} style={{ background: "var(--color-surface, #ffffff)", border: "1px solid var(--color-border, #e2e8f0)", borderRadius: 14, padding: "20px 22px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", ...style }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-text, #334155)", marginBottom: 6 }}>{title}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 27, fontWeight: 700, color: "var(--color-text, #0f172a)", letterSpacing: "-0.02em" }}>{value}</div>
        {change ? (
          <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 999, backgroundColor: changeTone === "bad" ? "#fef2f2" : changeTone === "neutral" ? "#f1f5f9" : "#ecfdf5", color: changeTone === "bad" ? "#b91c1c" : changeTone === "neutral" ? "#475569" : "#15803d" }}>{change}</span>
        ) : null}
      </div>
      <div style={{ fontSize: 12, color: "var(--color-text-muted, #64748b)", marginTop: 2, marginBottom: 20 }}>{subtitle}</div>
      {chart}
    </div>
  );
}
