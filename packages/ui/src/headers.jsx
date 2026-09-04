"use client";

import { useEffect, useState } from "react";

const shell                = {
  borderBottom: "1px solid var(--color-border)",
  background: "var(--color-bg)",
};
const inner                = { maxWidth: 1080, margin: "0 auto", padding: "0 24px" };
const brand                = {
  fontFamily: "var(--font-heading)",
  fontWeight: 700,
  letterSpacing: "-0.01em",
  color: "var(--color-text)",
};
const linkStyle                = {
  fontSize: 14,
  color: "var(--color-text-muted)",
  textDecoration: "none",
  whiteSpace: "nowrap",
};
const cta                = {
  fontSize: 13,
  fontWeight: 600,
  padding: "8px 16px",
  borderRadius: "var(--radius-card)",
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
  textDecoration: "none",
  whiteSpace: "nowrap",
};
const navToggleBtn                = {
  alignItems: "center",
  justifyContent: "center",
  width: 36,
  height: 36,
  padding: 0,
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-card)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
  flexShrink: 0,
};
const navBackdrop                = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  zIndex: 60,
};
const navDrawer                = {
  position: "fixed",
  top: 0,
  right: 0,
  bottom: 0,
  width: "min(78vw, 300px)",
  background: "var(--color-bg)",
  borderLeft: "1px solid var(--color-border)",
  boxShadow: "-8px 0 26px rgba(0,0,0,0.18)",
  zIndex: 61,
  display: "flex",
  flexDirection: "column",
  gap: 2,
  padding: "22px 8px",
  overflowY: "auto",
};
const navDrawerLink                = {
  fontSize: 15.5,
  fontWeight: 600,
  color: "var(--color-text)",
  textDecoration: "none",
  padding: "12px 16px",
  borderRadius: "var(--radius-card)",
};

/**
 * The nav every header variant shares. Two renderings of the same links,
 * with CSS (not JS) deciding which one is visible at a given width — a wide
 * screen gets the inline row, a narrow one gets a hamburger that opens a
 * slide-in panel. Only the panel's open/closed state is React; which one
 * *shows* is `.ot-nav-inline` / `.ot-nav-toggle` in tokens.css, so there's no
 * server/client width mismatch to flash on load.
 */
function Nav({ links, mobileLinks, showToggle = true, style }                                                        ) {
  const [open, setOpen] = useState(false);
  // HeaderSplitNav renders two Nav halves for the desktop row — only one of
  // them should own the mobile hamburger, and it opens with the FULL list,
  // not just its own half.
  const drawerLinks = mobileLinks ?? links;

  // The drawer covers the page — stop it scrolling behind, and let Escape
  // close it the way any other overlay in this app does.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!links?.length && !(showToggle && drawerLinks?.length)) return null;

  return (
    <>
      {links?.length ? (
        <nav className="ot-nav-inline" style={{ gap: 20, flexWrap: "wrap", ...style }}>
          {links.map((l) => (
            <a key={l.label} href={l.href} style={linkStyle}>
              {l.label}
            </a>
          ))}
        </nav>
      ) : null}

      {showToggle && drawerLinks?.length ? (
        <button
          type="button"
          className="ot-nav-toggle"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          style={navToggleBtn}
        >
          {open ? <CloseGlyph /> : <BurgerGlyph />}
        </button>
      ) : null}

      {open ? (
        <>
          <div className="ot-anim-fade" style={navBackdrop} onClick={() => setOpen(false)} aria-hidden="true" />
          <nav className="ot-anim-slide-in" style={navDrawer} aria-label="Site menu">
            {drawerLinks.map((l) => (
              <a key={l.label} href={l.href} style={navDrawerLink} onClick={() => setOpen(false)}>
                {l.label}
              </a>
            ))}
          </nav>
        </>
      ) : null}
    </>
  );
}

/** Three bars — drawn inline rather than pulling an icon library into this package. */
function BurgerGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function CloseGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4.5 4.5l11 11M15.5 4.5l-11 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/* 1 ─ name centred, nav underneath */
export function HeaderCentered({ name, links }             ) {
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
export function HeaderLeftLogo({ name, links }             ) {
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
export function HeaderSplitNav({ name, links }             ) {
  const half = Math.ceil((links?.length ?? 0) / 2);
  return (
    <header style={shell}>
      <div style={{ ...inner, padding: "16px 24px", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 16 }}>
        <Nav links={links?.slice(0, half)} mobileLinks={links} />
        <span style={{ ...brand, fontSize: 20, textAlign: "center" }}>{name}</span>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 16 }}>
          <Nav links={links?.slice(half)} showToggle={false} />
          <a href="#menu" style={cta}>
            Order
          </a>
        </div>
      </div>
    </header>
  );
}

/* 4 ─ minimal: name only */
export function HeaderMinimal({ name }             ) {
  return (
    <header style={shell}>
      <div style={{ ...inner, padding: "14px 24px" }}>
        <span style={{ ...brand, fontSize: 16, letterSpacing: "0.02em", textTransform: "uppercase" }}>{name}</span>
      </div>
    </header>
  );
}

/* 5 ─ thin info bar above the main row */
export function HeaderTopBar({ name, links, tagline, phone }             ) {
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
export function HeaderBanner({ name, tagline, links }             ) {
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
export function HeaderTwoRow({ name, links, phone }             ) {
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
export function HeaderBoxed({ name, links }             ) {
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
