import type { CSSProperties } from "react";

export interface HeaderProps {
  name: string;
  links?: { label: string; href: string }[];
  tagline?: string;
  phone?: string;
}

const shell: CSSProperties = {
  borderBottom: "1px solid var(--color-border)",
  background: "var(--color-bg)",
};
const inner: CSSProperties = { maxWidth: 1080, margin: "0 auto", padding: "0 24px" };
const brand: CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontWeight: 700,
  letterSpacing: "-0.01em",
  color: "var(--color-text)",
};
const linkStyle: CSSProperties = {
  fontSize: 14,
  color: "var(--color-text-muted)",
  textDecoration: "none",
  whiteSpace: "nowrap",
};
const cta: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  padding: "8px 16px",
  borderRadius: "var(--radius-card)",
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
  textDecoration: "none",
  whiteSpace: "nowrap",
};

function Nav({ links, style }: { links: HeaderProps["links"]; style?: CSSProperties }) {
  if (!links?.length) return null;
  return (
    <nav style={{ display: "flex", gap: 20, flexWrap: "wrap", ...style }}>
      {links.map((l) => (
        <a key={l.label} href={l.href} style={linkStyle}>
          {l.label}
        </a>
      ))}
    </nav>
  );
}

/* 1 ─ name centred, nav underneath */
export function HeaderCentered({ name, links }: HeaderProps) {
  return (
    <header style={shell}>
      <div style={{ ...inner, padding: "18px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <span style={{ ...brand, fontSize: 22 }}>{name}</span>
        <Nav links={links} />
      </div>
    </header>
  );
}

/* 2 ─ name left, nav right, single row */
export function HeaderLeftLogo({ name, links }: HeaderProps) {
  return (
    <header style={shell}>
      <div style={{ ...inner, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
        <span style={{ ...brand, fontSize: 20 }}>{name}</span>
        <Nav links={links} />
      </div>
    </header>
  );
}

/* 3 ─ nav left, name centred, CTA right */
export function HeaderSplitNav({ name, links }: HeaderProps) {
  const half = Math.ceil((links?.length ?? 0) / 2);
  return (
    <header style={shell}>
      <div style={{ ...inner, padding: "16px 24px", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 16 }}>
        <Nav links={links?.slice(0, half)} />
        <span style={{ ...brand, fontSize: 20, textAlign: "center" }}>{name}</span>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 16 }}>
          <Nav links={links?.slice(half)} />
          <a href="#menu" style={cta}>
            Order
          </a>
        </div>
      </div>
    </header>
  );
}

/* 4 ─ minimal: name only */
export function HeaderMinimal({ name }: HeaderProps) {
  return (
    <header style={shell}>
      <div style={{ ...inner, padding: "14px 24px" }}>
        <span style={{ ...brand, fontSize: 16, letterSpacing: "0.02em", textTransform: "uppercase" }}>{name}</span>
      </div>
    </header>
  );
}

/* 5 ─ thin info bar above the main row */
export function HeaderTopBar({ name, links, tagline, phone }: HeaderProps) {
  return (
    <header style={shell}>
      <div style={{ background: "var(--color-primary)", color: "var(--color-on-primary)" }}>
        <div style={{ ...inner, padding: "7px 24px", display: "flex", justifyContent: "space-between", gap: 16, fontSize: 12.5 }}>
          <span>{tagline ?? "Fresh, hot and made to order"}</span>
          {phone ? <span>{phone}</span> : null}
        </div>
      </div>
      <div style={{ ...inner, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
        <span style={{ ...brand, fontSize: 22 }}>{name}</span>
        <Nav links={links} />
      </div>
    </header>
  );
}

/* 6 ─ accent band behind a centred name */
export function HeaderBanner({ name, tagline, links }: HeaderProps) {
  return (
    <header style={shell}>
      <div style={{ background: "var(--color-primary)", color: "var(--color-on-primary)", textAlign: "center", padding: "26px 24px 22px" }}>
        <div style={{ ...brand, color: "var(--color-on-primary)", fontSize: 26 }}>{name}</div>
        {tagline ? <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>{tagline}</div> : null}
      </div>
      <div style={{ ...inner, padding: "12px 24px", display: "flex", justifyContent: "center" }}>
        <Nav links={links} />
      </div>
    </header>
  );
}

/* 7 ─ two rows: brand row, then a nav bar on the surface colour */
export function HeaderTwoRow({ name, links, phone }: HeaderProps) {
  return (
    <header style={shell}>
      <div style={{ ...inner, padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ ...brand, fontSize: 21 }}>{name}</span>
        {phone ? <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{phone}</span> : null}
      </div>
      <div style={{ background: "var(--color-surface)", borderTop: "1px solid var(--color-border)" }}>
        <div style={{ ...inner, padding: "11px 24px" }}>
          <Nav links={links} />
        </div>
      </div>
    </header>
  );
}

/* 8 ─ boxed brand block on the left */
export function HeaderBoxed({ name, links }: HeaderProps) {
  return (
    <header style={shell}>
      <div style={{ ...inner, padding: "0 24px", display: "flex", alignItems: "stretch", justifyContent: "space-between", gap: 24 }}>
        <span style={{ ...brand, fontSize: 19, background: "var(--color-primary)", color: "var(--color-on-primary)", padding: "20px 22px", display: "flex", alignItems: "center" }}>
          {name}
        </span>
        <span style={{ display: "flex", alignItems: "center" }}>
          <Nav links={links} />
        </span>
      </div>
    </header>
  );
}
