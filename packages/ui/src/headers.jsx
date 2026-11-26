"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { fx } from "./fx";
import { AppLink } from "./link";

/**
 * The storefront header — sixteen styles that all take the same props:
 *
 *   name       the restaurant's name
 *   logoUrl    the logo picture, when the owner has uploaded one (shown beside / above the name)
 *   links      [{ label, href }] — the nav
 *   tagline    a short line, for styles that have room for it
 *   phone      the phone number, for styles that have room for it
 *   orderHref  where an "Order" button goes (defaults to the menu on the same page)
 *
 * A header holds the brand and the navigation, nothing more. The message bar that used to be part of one of them
 * ("Top bar") is now a component of its own — see announcements.jsx — so any header can sit under any bar.
 */

const shell = {
  borderBottom: "1px solid var(--color-border)",
  background: "var(--color-bg)",
};
// Horizontal padding comes from the .ot-header-px class (tokens.css), not
// from here — that's what lets it shrink on a narrow screen. Every div that
// spreads `inner` must also carry that class and supply only vertical
// padding (paddingTop/paddingBottom) of its own.
const inner = { maxWidth: 1080, margin: "0 auto" };
const brand = {
  fontFamily: "var(--font-heading)",
  fontWeight: 700,
  letterSpacing: "-0.01em",
  color: "var(--color-text)",
};
const linkStyle = {
  fontSize: 14,
  color: "var(--color-text-muted)",
  textDecoration: "none",
  whiteSpace: "nowrap",
};
const cta = {
  fontSize: 13,
  fontWeight: 600,
  padding: "8px 16px",
  borderRadius: "var(--radius-card)",
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
  textDecoration: "none",
  whiteSpace: "nowrap",
};
const navToggleBtn = {
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
const navBackdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  zIndex: 60,
};
const navDrawer = {
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
const navDrawerLink = {
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
 *
 * `collapsed` is for the styles that keep the burger at every width: no inline row, the button always shows.
 * `linkStyle` / `linkClass` restyle the links of one variant (pills, underlines, small caps…).
 *
 * A link with `current: true` is the page the visitor is on: it gets `aria-current="page"` and `currentStyle` (a variant can pass its own,
 * for a dark bar or a pill; the default is stronger text with an underline in the brand colour). The storefront decides which link is current
 * and whether to mark any at all (the owner can switch it off), so a header with no `current` flag looks exactly as it always did.
 */
const currentLinkStyle = {
  color: "var(--color-text)",
  fontWeight: 700,
  textDecoration: "underline",
  textDecorationThickness: "2px",
  textUnderlineOffset: "6px",
  textDecorationColor: "var(--color-primary-text, var(--color-primary))",
};
/** in the slide-in panel (a link per row): a tinted row in the brand colour */
const currentDrawerStyle = {
  background: "color-mix(in srgb, var(--color-primary) 12%, transparent)",
  color: "var(--color-primary-text, var(--color-primary))",
  fontWeight: 700,
};
function Nav({ links, mobileLinks, showToggle = true, collapsed = false, style, linkStyle: linkOverride, linkClass, currentStyle = currentLinkStyle }) {
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
      {!collapsed && links?.length ? (
        <nav className="ot-nav-inline" style={{ gap: 20, flexWrap: "wrap", ...style }}>
          {links.map((l) => (
            <AppLink
              key={l.label}
              href={l.href}
              className={linkClass}
              aria-current={l.current ? "page" : undefined}
              style={{ ...linkStyle, ...linkOverride, ...(l.current ? currentStyle : null) }}
            >
              {l.label}
            </AppLink>
          ))}
        </nav>
      ) : null}

      {showToggle && drawerLinks?.length ? (
        <button
          type="button"
          className={collapsed ? "ot-fx-chip" : "ot-nav-toggle ot-fx-chip"}
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          style={fx("chip", collapsed ? { ...navToggleBtn, display: "inline-flex" } : navToggleBtn)}
        >
          {open ? <CloseGlyph /> : <BurgerGlyph />}
        </button>
      ) : null}

      {/*
        The drawer is drawn on <body>, not inside the header: the header is pinned to the top of the page (its own stacking
        layer), and a drawer left inside it would slide in under the cart bar and the item pop-ups instead of over them.
      */}
      {open
        ? createPortal(
            <>
              <div className="ot-anim-fade" style={navBackdrop} onClick={() => setOpen(false)} aria-hidden="true" />
              <nav className="ot-anim-slide-in ot-fx-modal" style={fx("modal", navDrawer)} aria-label="Site menu">
                {drawerLinks.map((l) => (
                  <AppLink key={l.label} href={l.href} aria-current={l.current ? "page" : undefined} style={{ ...navDrawerLink, ...(l.current ? currentDrawerStyle : null) }} onClick={() => setOpen(false)}>
                    {l.label}
                  </AppLink>
                ))}
              </nav>
            </>,
            document.body,
          )
        : null}
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
function PhoneGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z" />
    </svg>
  );
}

/** The brand: the logo (when there is one) beside the name. */
function BrandMark({ name, logoUrl, size = 20, color, style }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      {logoUrl ? <img src={logoUrl} alt="" style={{ height: Math.round(size * 1.7), width: "auto", maxWidth: 160, objectFit: "contain", flexShrink: 0, borderRadius: 6 }} /> : null}
      <span style={{ ...brand, fontSize: size, ...(color ? { color } : null), ...style }}>{name}</span>
    </span>
  );
}

const telHref = (phone) => `tel:${String(phone).replace(/[^+\d]/g, "")}`;

/** The "Order" button several styles carry. */
function OrderButton({ href = "#menu", style, className }) {
  return (
    <AppLink href={href} className={className ? `ot-fx-btn ${className}` : "ot-fx-btn"} style={fx("btn", { ...cta, ...style })}>
      Order
    </AppLink>
  );
}

/* 1 ─ name centred, nav underneath */
export function HeaderCentered({ name, logoUrl, links }) {
  return (
    <header className="ot-fx-bar" style={fx("bar", shell)}>
      <div className="ot-header-px" style={{ ...inner, paddingTop: 18, paddingBottom: 18, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <BrandMark name={name} logoUrl={logoUrl} size={22} />
        <Nav links={links} />
      </div>
    </header>
  );
}

/* 2 ─ name left, nav right, single row */
export function HeaderLeftLogo({ name, logoUrl, links }) {
  return (
    <header className="ot-fx-bar" style={fx("bar", shell)}>
      <div className="ot-header-px" style={{ ...inner, paddingTop: 16, paddingBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
        <BrandMark name={name} logoUrl={logoUrl} size={20} />
        <Nav links={links} />
      </div>
    </header>
  );
}

/* 3 ─ nav left, name centred, CTA right */
export function HeaderSplitNav({ name, logoUrl, links, orderHref }) {
  const half = Math.ceil((links?.length ?? 0) / 2);
  return (
    <header className="ot-fx-bar" style={fx("bar", shell)}>
      <div className="ot-header-px" style={{ ...inner, paddingTop: 16, paddingBottom: 16, display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 16 }}>
        <Nav links={links?.slice(0, half)} mobileLinks={links} />
        <span style={{ textAlign: "center" }}>
          <BrandMark name={name} logoUrl={logoUrl} size={20} />
        </span>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 16 }}>
          <Nav links={links?.slice(half)} showToggle={false} />
          <OrderButton href={orderHref} />
        </div>
      </div>
    </header>
  );
}

/* 4 ─ minimal: name only */
export function HeaderMinimal({ name, logoUrl }) {
  return (
    <header className="ot-fx-bar" style={fx("bar", shell)}>
      <div className="ot-header-px" style={{ ...inner, paddingTop: 14, paddingBottom: 14 }}>
        <BrandMark name={name} logoUrl={logoUrl} size={16} style={{ letterSpacing: "0.02em", textTransform: "uppercase" }} />
      </div>
    </header>
  );
}

/* (5 was "Top bar" — its message bar is now announcements.jsx, and a store that chose it gets the bar plus a plain header) */

/* 6 ─ accent band behind a centred name */
export function HeaderBanner({ name, logoUrl, tagline, links }) {
  return (
    <header className="ot-fx-bar" style={fx("bar", shell)}>
      <div className="ot-header-px" style={{ background: "var(--color-primary)", color: "var(--color-on-primary)", textAlign: "center", paddingTop: 26, paddingBottom: 22 }}>
        {logoUrl ? <img src={logoUrl} alt="" style={{ height: 46, width: "auto", maxWidth: 180, objectFit: "contain", marginBottom: 8 }} /> : null}
        <div style={{ ...brand, color: "var(--color-on-primary)", fontSize: 26 }}>{name}</div>
        {tagline ? <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>{tagline}</div> : null}
      </div>
      <div className="ot-header-px" style={{ ...inner, paddingTop: 12, paddingBottom: 12, display: "flex", justifyContent: "center" }}>
        <Nav links={links} />
      </div>
    </header>
  );
}

/* 7 ─ two rows: brand row, then a nav bar on the surface colour */
export function HeaderTwoRow({ name, logoUrl, links, phone }) {
  return (
    <header className="ot-fx-bar" style={fx("bar", shell)}>
      <div className="ot-header-px" style={{ ...inner, paddingTop: 16, paddingBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <BrandMark name={name} logoUrl={logoUrl} size={21} />
        {phone ? <span style={{ fontSize: 13, color: "var(--color-text-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>{phone}</span> : null}
      </div>
      <div style={{ background: "var(--color-surface)", borderTop: "1px solid var(--color-border)" }}>
        <div className="ot-header-px" style={{ ...inner, paddingTop: 11, paddingBottom: 11 }}>
          <Nav links={links} />
        </div>
      </div>
    </header>
  );
}

/* 8 ─ boxed brand block on the left */
export function HeaderBoxed({ name, logoUrl, links }) {
  return (
    <header className="ot-fx-bar" style={fx("bar", shell)}>
      <div className="ot-header-px" style={{ ...inner, display: "flex", alignItems: "stretch", justifyContent: "space-between", gap: 24 }}>
        <span className="ot-header-px" style={{ ...brand, fontSize: 19, background: "var(--color-primary)", color: "var(--color-on-primary)", paddingTop: 20, paddingBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          {logoUrl ? <img src={logoUrl} alt="" style={{ height: 32, width: "auto", maxWidth: 120, objectFit: "contain" }} /> : null}
          {name}
        </span>
        <span style={{ display: "flex", alignItems: "center" }}>
          <Nav links={links} />
        </span>
      </div>
    </header>
  );
}

/* 9 ─ stacked: the logo (or name) centred over a ruled, spaced-out nav */
export function HeaderStacked({ name, logoUrl, links }) {
  return (
    <header className="ot-fx-bar" style={fx("bar", shell)}>
      <div className="ot-header-px" style={{ ...inner, paddingTop: 22, paddingBottom: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        {logoUrl ? <img src={logoUrl} alt="" style={{ height: 58, width: "auto", maxWidth: 220, objectFit: "contain" }} /> : null}
        <span style={{ ...brand, fontSize: logoUrl ? 18 : 28, letterSpacing: logoUrl ? "0.16em" : "-0.01em", textTransform: logoUrl ? "uppercase" : "none", textAlign: "center" }}>{name}</span>
      </div>
      {links?.length ? (
        <div style={{ borderTop: "1px solid var(--color-border)" }}>
          <div className="ot-header-px" style={{ ...inner, paddingTop: 11, paddingBottom: 11, display: "flex", justifyContent: "center" }}>
            <Nav links={links} style={{ gap: 30 }} linkStyle={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600, color: "var(--color-text)" }} />
          </div>
        </div>
      ) : null}
    </header>
  );
}

/* 10 ─ pill nav: the links sit in a rounded capsule */
export function HeaderPillNav({ name, logoUrl, links }) {
  return (
    <header className="ot-fx-bar" style={fx("bar", shell)}>
      <div className="ot-header-px" style={{ ...inner, paddingTop: 12, paddingBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
        <BrandMark name={name} logoUrl={logoUrl} size={20} />
        <Nav
          links={links}
          style={{ gap: 4, padding: 4, borderRadius: 999, background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          linkClass="ot-hd-pill"
          linkStyle={{ padding: "7px 16px", borderRadius: 999, color: "var(--color-text)", fontWeight: 600, fontSize: 13.5 }}
          currentStyle={{ background: "var(--color-primary)", color: "var(--color-on-primary)" }}
        />
      </div>
    </header>
  );
}

/* 11 ─ floating: the header is a rounded card with a shadow, hovering over the page */
export function HeaderFloating({ name, logoUrl, links }) {
  return (
    <header style={{ padding: "12px 12px 0" }}>
      <div
        className="ot-fx-card ot-header-px"
        style={fx("card", {
          ...inner,
          paddingTop: 12,
          paddingBottom: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          background: "var(--color-bg)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-card)",
          boxShadow: "0 8px 28px rgba(0,0,0,0.09)",
        })}
      >
        <BrandMark name={name} logoUrl={logoUrl} size={19} />
        <Nav links={links} />
      </div>
    </header>
  );
}

/* 12 ─ dark bar: reversed out, with the Order button in the brand colour */
export function HeaderDark({ name, logoUrl, links, orderHref }) {
  // No effect styling on purpose: a translucent "glass" bar would leave this light-on-dark text unreadable.
  return (
    <header style={{ background: "var(--color-text)", color: "var(--color-bg)" }}>
      <div className="ot-header-px" style={{ ...inner, paddingTop: 15, paddingBottom: 15, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
        <BrandMark name={name} logoUrl={logoUrl} size={20} color="var(--color-bg)" />
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Nav links={links} linkStyle={{ color: "color-mix(in srgb, var(--color-bg) 80%, transparent)" }} currentStyle={{ ...currentLinkStyle, color: "var(--color-bg)", textDecorationColor: "var(--color-bg)" }} />
          <OrderButton href={orderHref} />
        </div>
      </div>
    </header>
  );
}

/* 13 ─ underline links, with the phone number at the end */
export function HeaderUnderline({ name, logoUrl, links, phone }) {
  return (
    <header className="ot-fx-bar" style={fx("bar", shell)}>
      <div className="ot-header-px" style={{ ...inner, paddingTop: 16, paddingBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
        <BrandMark name={name} logoUrl={logoUrl} size={20} />
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <Nav links={links} style={{ gap: 26 }} linkClass="ot-hd-underline" linkStyle={{ color: "var(--color-text)", fontWeight: 600, paddingBottom: 3 }} currentStyle={{ backgroundSize: "100% 2px", fontWeight: 700 }} />
          {phone ? (
            <a href={telHref(phone)} className="ot-hide-sm" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--color-text-muted)", textDecoration: "none", whiteSpace: "nowrap" }}>
              <PhoneGlyph /> {phone}
            </a>
          ) : null}
        </div>
      </div>
    </header>
  );
}

/* 14 ─ burger only: the menu button at every width, plus the Order button */
export function HeaderBurger({ name, logoUrl, links, orderHref }) {
  return (
    <header className="ot-fx-bar" style={fx("bar", shell)}>
      <div className="ot-header-px" style={{ ...inner, paddingTop: 13, paddingBottom: 13, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <BrandMark name={name} logoUrl={logoUrl} size={20} />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <OrderButton href={orderHref} />
          <Nav links={links} collapsed />
        </div>
      </div>
    </header>
  );
}

/* 15 ─ brand with its tagline underneath, nav and Order button to the right */
export function HeaderTagline({ name, logoUrl, tagline, links, orderHref }) {
  return (
    <header className="ot-fx-bar" style={fx("bar", shell)}>
      <div className="ot-header-px" style={{ ...inner, paddingTop: 14, paddingBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
        <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <BrandMark name={name} logoUrl={logoUrl} size={21} />
          {tagline ? <span style={{ fontSize: 12.5, color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tagline}</span> : null}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Nav links={links} />
          <OrderButton href={orderHref} className="ot-hide-sm" />
        </div>
      </div>
    </header>
  );
}

/* 16 ─ call & order: brand left, nav in the middle, phone and Order button right */
export function HeaderCallOrder({ name, logoUrl, links, phone, orderHref }) {
  return (
    <header className="ot-fx-bar" style={fx("bar", shell)}>
      <div className="ot-header-px" style={{ ...inner, paddingTop: 14, paddingBottom: 14, display: "flex", alignItems: "center", gap: 20 }}>
        <span style={{ flex: "1 1 0", minWidth: 0 }}>
          <BrandMark name={name} logoUrl={logoUrl} size={20} />
        </span>
        <Nav links={links} style={{ gap: 22, justifyContent: "center" }} />
        <div style={{ flex: "1 1 0", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 14 }}>
          {phone ? (
            <a href={telHref(phone)} aria-label={`Call ${phone}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--color-text)", textDecoration: "none", whiteSpace: "nowrap" }}>
              <PhoneGlyph /> <span className="ot-hide-sm">{phone}</span>
            </a>
          ) : null}
          <OrderButton href={orderHref} />
        </div>
      </div>
    </header>
  );
}
