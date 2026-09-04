                                           
                                             

const clamp = (v        ) => Math.max(0, Math.min(100, v));
const track                = { background: "var(--color-border)", overflow: "hidden" };
const label                = { fontSize: "0.78rem", color: "var(--color-text-muted)", display: "flex", justifyContent: "space-between", marginBottom: 6 };

/** 01 plain bar */
export function ProgressBar({ value, label: text }               ) {
  const v = clamp(value);
  return (
    <div>
      {text ? <div style={label}><span>{text}</span><span>{v}%</span></div> : null}
      <div style={{ ...track, height: 8, borderRadius: 999 }} role="progressbar" aria-valuenow={v}>
        <div className="ot-bar" style={{ width: `${v}%`, height: "100%", background: "var(--color-primary)", borderRadius: 999 }} />
      </div>
    </div>
  );
}

/** 02 thick bar with the value inside */
export function ProgressThick({ value, label: text }               ) {
  const v = clamp(value);
  return (
    <div style={{ ...track, height: 24, borderRadius: 999, position: "relative" }} role="progressbar" aria-valuenow={v}>
      <div className="ot-bar" style={{ width: `${v}%`, height: "100%", background: "var(--color-primary)", borderRadius: 999 }} />
      <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: "0.72rem", fontWeight: 700, color: "var(--color-text)" }}>
        {text ?? `${v}%`}
      </span>
    </div>
  );
}

/** 03 square edges, hairline */
export function ProgressLine({ value, label: text }               ) {
  const v = clamp(value);
  return (
    <div>
      {text ? <div style={label}><span>{text}</span><span>{v}%</span></div> : null}
      <div style={{ ...track, height: 3, borderRadius: 0 }} role="progressbar" aria-valuenow={v}>
        <div className="ot-bar" style={{ width: `${v}%`, height: "100%", background: "var(--color-primary)" }} />
      </div>
    </div>
  );
}

/** 04 striped */
export function ProgressStriped({ value, label: text }               ) {
  const v = clamp(value);
  return (
    <div>
      {text ? <div style={label}><span>{text}</span><span>{v}%</span></div> : null}
      <div style={{ ...track, height: 12, borderRadius: 6 }} role="progressbar" aria-valuenow={v}>
        <div
          className="ot-bar"
          style={{
            width: `${v}%`,
            height: "100%",
            borderRadius: 6,
            backgroundImage:
              "repeating-linear-gradient(45deg, var(--color-primary), var(--color-primary) 6px, color-mix(in srgb, var(--color-primary) 70%, transparent) 6px, color-mix(in srgb, var(--color-primary) 70%, transparent) 12px)",
          }}
        />
      </div>
    </div>
  );
}

/** 05 segmented into ten blocks */
export function ProgressSegments({ value, label: text }               ) {
  const v = clamp(value);
  const filled = Math.round(v / 10);
  return (
    <div>
      {text ? <div style={label}><span>{text}</span><span>{v}%</span></div> : null}
      <div style={{ display: "flex", gap: 4 }} role="progressbar" aria-valuenow={v}>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} style={{ flex: 1, height: 10, borderRadius: 2, background: i < filled ? "var(--color-primary)" : "var(--color-border)" }} />
        ))}
      </div>
    </div>
  );
}

/** 06 circular dial */
export function ProgressRing({ value, label: text }               ) {
  const v = clamp(value);
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <svg width="64" height="64" viewBox="0 0 64 64" role="progressbar" aria-valuenow={v}>
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-border)" strokeWidth="7" />
        <circle
          cx="32" cy="32" r={r} fill="none"
          stroke="var(--color-primary)" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${(c * v) / 100} ${c}`}
          transform="rotate(-90 32 32)"
        />
        <text x="32" y="37" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--color-text)">{v}</text>
      </svg>
      {text ? <span style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>{text}</span> : null}
    </div>
  );
}

/** 07 numbered step track */
export function ProgressSteps({ value, label: text }               ) {
  const v = clamp(value);
  const steps = ["Placed", "Preparing", "Ready", "Done"];
  const active = Math.min(steps.length - 1, Math.floor((v / 100) * steps.length));
  return (
    <div>
      {text ? <div style={{ ...label, justifyContent: "flex-start" }}>{text}</div> : null}
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        {steps.map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: i === steps.length - 1 ? "0 0 auto" : 1 }}>
            <span style={{ display: "grid", placeItems: "center", width: 24, height: 24, borderRadius: "50%", flexShrink: 0, fontSize: "0.7rem", fontWeight: 700, background: i <= active ? "var(--color-primary)" : "var(--color-border)", color: i <= active ? "var(--color-on-primary)" : "var(--color-text-muted)" }}>
              {i + 1}
            </span>
            {i < steps.length - 1 ? <span style={{ flex: 1, height: 2, background: i < active ? "var(--color-primary)" : "var(--color-border)" }} /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 08 gradient fill with the label above */
export function ProgressGradient({ value, label: text }               ) {
  const v = clamp(value);
  return (
    <div>
      {text ? <div style={label}><span>{text}</span><span>{v}%</span></div> : null}
      <div style={{ ...track, height: 14, borderRadius: 999 }} role="progressbar" aria-valuenow={v}>
        <div className="ot-bar" style={{ width: `${v}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, color-mix(in srgb, var(--color-primary) 55%, transparent), var(--color-primary))" }} />
      </div>
    </div>
  );
}
