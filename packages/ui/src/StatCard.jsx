"use client";

import { useId } from "react";

/**
 * Metric / Sparkline Card matching reference design (Image 2)
 */
export function StatCard({
  title = "Users",
  value = "14k",
  change = "+25%",
  subtitle = "Last 30 days",
  tone = "positive", // "positive" (green) | "negative" (red) | "neutral" (slate/blue)
  data = [10, 8, 12, 11, 14, 10, 13, 12, 15, 14, 16, 15, 17, 16, 22, 16, 18, 17, 18, 20, 26, 27],
  style = {},
  className = "",
}) {
  const gradientId = useId();

  // Tone color configurations
  const toneConfigs = {
    positive: {
      stroke: "#22c55e",
      badgeBg: "#ecfdf5",
      badgeColor: "#15803d",
      stopStart: "#22c55e",
      stopOpacityStart: 0.28,
      stopOpacityEnd: 0.02,
    },
    negative: {
      stroke: "#ef4444",
      badgeBg: "#fef2f2",
      badgeColor: "#b91c1c",
      stopStart: "#ef4444",
      stopOpacityStart: 0.25,
      stopOpacityEnd: 0.02,
    },
    neutral: {
      stroke: "#64748b",
      badgeBg: "#f1f5f9",
      badgeColor: "#334155",
      stopStart: "#64748b",
      stopOpacityStart: 0.2,
      stopOpacityEnd: 0.02,
    },
  };

  const config = toneConfigs[tone] || toneConfigs.positive;

  // Build SVG path for the sparkline data
  const width = 240;
  const height = 48;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d - min) / range) * (height - 10) - 4;
    return [x, y];
  });

  // Generate SVG path string with smooth curves
  let pathD = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const mx = (x0 + x1) / 2;
    pathD += ` C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}`;
  }

  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div
      className={`onetap-stat-card ${className}`}
      style={{
        background: "var(--color-surface, #ffffff)",
        border: "1px solid var(--color-border, #e2e8f0)",
        borderRadius: 12,
        padding: "16px 18px 12px",
        display: "flex",
        flexDirection: "column",
        minWidth: 220,
        boxSizing: "border-box",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        ...style,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text, #334155)", marginBottom: 6 }}>
        {title}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 25, fontWeight: 700, color: "var(--color-text, #0f172a)", letterSpacing: "-0.02em" }}>
          {value}
        </div>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            padding: "2px 7px",
            borderRadius: 999,
            backgroundColor: config.badgeBg,
            color: config.badgeColor,
            letterSpacing: "0.02em",
          }}
        >
          {change}
        </span>
      </div>

      <div style={{ fontSize: 11.5, color: "var(--color-text-muted, #64748b)", marginTop: 2, marginBottom: 12 }}>
        {subtitle}
      </div>

      {/* Sparkline */}
      <div style={{ marginTop: "auto", overflow: "hidden" }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: "100%", height: 42, display: "block", overflow: "visible" }}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={config.stopStart} stopOpacity={config.stopOpacityStart} />
              <stop offset="100%" stopColor={config.stopStart} stopOpacity={config.stopOpacityEnd} />
            </linearGradient>
          </defs>
          <path d={areaD} fill={`url(#${gradientId})`} />
          <path d={pathD} fill="none" stroke={config.stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
