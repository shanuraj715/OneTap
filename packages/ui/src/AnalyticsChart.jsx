/**
 * Stacked Area Analytics Chart Card matching reference design (Image 3)
 */
export function AnalyticsChart({
  title = "Sessions",
  value = "13,277",
  change = "+35%",
  subtitle = "Sessions per day for the last 30 days",
  style = {},
  className = "",
}) {
  const yTicks = [
    { label: "25,000", val: 25000 },
    { label: "20,000", val: 20000 },
    { label: "15,000", val: 15000 },
    { label: "10,000", val: 10000 },
    { label: "5,000", val: 5000 },
    { label: "0", val: 0 },
  ];

  const xTicks = ["Apr 5", "Apr 10", "Apr 15", "Apr 20", "Apr 25", "Apr 30"];

  // 3 stacked series (layer 1: base, layer 2: middle, layer 3: top)
  const l1 = [1200, 1600, 1400, 2200, 1800, 2400, 2200, 2700, 2900, 2600, 3400, 3800, 3600, 3200, 3900, 4200, 3600, 4400, 4600, 4100, 4800, 5200, 5000, 5400, 5800, 6100, 6400];
  const l2 = [600, 900, 700, 1400, 1100, 2600, 2100, 2800, 3000, 2300, 3100, 3900, 3800, 5200, 4300, 3000, 5500, 5400, 5900, 6100, 6300, 6900, 5700, 7000, 7200, 7800, 8300];
  const l3 = [400, 800, 600, 1000, 900, 2100, 1800, 2400, 3000, 1900, 3300, 3900, 4200, 4700, 3100, 4600, 4500, 5600, 4800, 6200, 6700, 5900, 7400, 7200, 7100, 8200, 8700];

  const width = 600;
  const height = 200;
  const maxVal = 26000;

  // Compute accumulated points
  const points1 = l1.map((v, i) => [(i / (l1.length - 1)) * width, height - (v / maxVal) * height]);
  const points2 = l1.map((v, i) => {
    const total = v + l2[i];
    return [(i / (l1.length - 1)) * width, height - (total / maxVal) * height];
  });
  const points3 = l1.map((v, i) => {
    const total = v + l2[i] + l3[i];
    return [(i / (l1.length - 1)) * width, height - (total / maxVal) * height];
  });

  const buildCurve = (pts) => {
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const mx = (x0 + x1) / 2;
      d += ` C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}`;
    }
    return d;
  };

  const curve1 = buildCurve(points1);
  const curve2 = buildCurve(points2);
  const curve3 = buildCurve(points3);

  // Stacked areas
  const area1 = `${curve1} L ${width} ${height} L 0 ${height} Z`;
  const area2 = `${curve2} L ${width} ${height} L 0 ${height} Z`;
  const area3 = `${curve3} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div
      className={`onetap-analytics-chart ${className}`}
      style={{
        background: "var(--color-surface, #ffffff)",
        border: "1px solid var(--color-border, #e2e8f0)",
        borderRadius: 14,
        padding: "20px 22px 18px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        ...style,
      }}
    >
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-text, #334155)", marginBottom: 6 }}>
        {title}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <div style={{ fontSize: 27, fontWeight: 700, color: "var(--color-text, #0f172a)", letterSpacing: "-0.02em" }}>
          {value}
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 999,
            backgroundColor: "#ecfdf5",
            color: "#15803d",
          }}
        >
          {change}
        </span>
      </div>

      <div style={{ fontSize: 12, color: "var(--color-text-muted, #64748b)", marginTop: 2, marginBottom: 20 }}>
        {subtitle}
      </div>

      {/* Chart Canvas with Y-Axis */}
      <div style={{ display: "flex", gap: 12, alignItems: "stretch", height: 210 }}>
        {/* Y-Axis Labels */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "flex-end",
            paddingBottom: 22,
            fontSize: 11,
            color: "var(--color-text-muted, #94a3b8)",
            fontVariantNumeric: "tabular-nums",
            minWidth: 42,
          }}
        >
          {yTicks.map((t) => (
            <span key={t.val}>{t.label}</span>
          ))}
        </div>

        {/* Chart SVG + Grid + X-Axis */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ position: "relative", height: height, flex: 1 }}>
            {/* Horizontal Dashed Grid Lines */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                pointerEvents: "none",
              }}
            >
              {yTicks.map((t) => (
                <div
                  key={t.val}
                  style={{
                    width: "100%",
                    borderBottom: "1px dashed var(--color-border, #e2e8f0)",
                  }}
                />
              ))}
            </div>

            {/* SVG stacked area chart */}
            <svg
              viewBox={`0 0 ${width} ${height}`}
              style={{ width: "100%", height: "100%", display: "block", position: "relative", zIndex: 2 }}
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="layerTop" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#bae6fd" stopOpacity="0.55" />
                </linearGradient>
                <linearGradient id="layerMid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0284c7" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="layerBottom" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0369a1" stopOpacity="1" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.95" />
                </linearGradient>
              </defs>

              {/* Layer 3 (Top / Cyan) */}
              <path d={area3} fill="url(#layerTop)" />
              <path d={curve3} fill="none" stroke="#38bdf8" strokeWidth="1.5" />

              {/* Layer 2 (Mid / Sky Blue) */}
              <path d={area2} fill="url(#layerMid)" />
              <path d={curve2} fill="none" stroke="#0284c7" strokeWidth="1.5" />

              {/* Layer 1 (Bottom / Navy Deep Blue) */}
              <path d={area1} fill="url(#layerBottom)" />
              <path d={curve1} fill="none" stroke="#0369a1" strokeWidth="1.5" />
            </svg>
          </div>

          {/* X-Axis Labels */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              paddingTop: 8,
              fontSize: 11,
              color: "var(--color-text-muted, #94a3b8)",
            }}
          >
            {xTicks.map((x) => (
              <span key={x}>{x}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
