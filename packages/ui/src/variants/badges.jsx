                                           
import { toneVars,                 } from "./types";

const base                = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontSize: "0.72rem",
  fontWeight: 700,
  lineHeight: 1.4,
  padding: "3px 9px",
  whiteSpace: "nowrap",
};

/** 01 solid tone */
export function BadgeSolid({ children, tone }            ) {
  const t = toneVars(tone);
  return <span style={{ ...base, background: t.fg, color: "var(--color-bg)", borderRadius: 5 }}>{children}</span>;
}

/** 02 soft wash */
export function BadgeSoft({ children, tone }            ) {
  const t = toneVars(tone);
  return <span style={{ ...base, background: t.wash, color: t.fg, borderRadius: 5 }}>{children}</span>;
}

/** 03 outline */
export function BadgeOutline({ children, tone }            ) {
  const t = toneVars(tone);
  return (
    <span style={{ ...base, border: `1px solid ${t.fg}`, color: t.fg, borderRadius: 5, background: "transparent" }}>
      {children}
    </span>
  );
}

/** 04 pill */
export function BadgePill({ children, tone }            ) {
  const t = toneVars(tone);
  return <span style={{ ...base, background: t.fg, color: "var(--color-bg)", borderRadius: 999, padding: "3px 12px" }}>{children}</span>;
}

/** 05 leading status dot */
export function BadgeDot({ children, tone }            ) {
  const t = toneVars(tone);
  return (
    <span style={{ ...base, background: t.wash, color: t.fg, borderRadius: 999, padding: "4px 11px" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: t.fg }} />
      {children}
    </span>
  );
}

/** 06 left accent bar */
export function BadgeAccent({ children, tone }            ) {
  const t = toneVars(tone);
  return (
    <span style={{ ...base, background: t.wash, color: t.fg, borderLeft: `3px solid ${t.fg}`, borderRadius: "0 5px 5px 0", padding: "3px 9px 3px 8px" }}>
      {children}
    </span>
  );
}

/** 07 uppercase micro-label */
export function BadgeMicro({ children, tone }            ) {
  const t = toneVars(tone);
  return (
    <span style={{ ...base, color: t.fg, background: "transparent", padding: 0, fontSize: "0.64rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
      {children}
    </span>
  );
}

/** 08 brand-coloured, square */
export function BadgeBrand({ children }            ) {
  return (
    <span style={{ ...base, background: "var(--color-primary)", color: "var(--color-on-primary)", borderRadius: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>
      {children}
    </span>
  );
}
