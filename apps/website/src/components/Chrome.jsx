import Link from "next/link";
import { ChevronDown, Menu } from "lucide-react";
import { pathFor } from "@/lib/site";
import { Icon } from "./Icon";

/**
 * The header and footer every page shares. Server-rendered; the mobile menu
 * is a native <details>, so it works with no JavaScript at all.
 */

function Brand({ settings }) {
  return (
    <Link href="/" className="brand" aria-label={`${settings.brandName} home`}>
      {settings.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={settings.logoUrl} alt="" width="120" height="30" />
      ) : (
        <span className="brand-mark" aria-hidden="true" />
      )}
      <span>{settings.brandName}</span>
    </Link>
  );
}

const navPages = (pages) =>
  pages.filter((p) => p.nav?.show && p.slug !== "home").sort((a, b) => (a.nav.order ?? 50) - (b.nav.order ?? 50));

/**
 * The Product dropdown (desktop header): opens on hover, and on keyboard
 * focus or a tap on the button — CSS only, no JavaScript. Phones get the same
 * links inside the Menu instead.
 */
function ProductMenu({ items }) {
  if (!items.length) return null;
  return (
    <div className="dd">
      <button type="button" className="dd-btn" aria-haspopup="true">
        Product <ChevronDown size={14} aria-hidden="true" />
      </button>
      <div className="dd-panel">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className="dd-item">
            <span className="dd-icon">
              <Icon name={it.icon} size={17} />
            </span>
            <span>
              <b>{it.label}</b>
              {it.text ? <small>{it.text}</small> : null}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function SiteHeader({ settings, pages, product = [] }) {
  const nav = navPages(pages);
  const contact = pages.some((p) => p.slug === "contact");
  const ctaHref = contact ? "/contact" : settings.contact.phone ? `tel:${settings.contact.phone.replace(/\s/g, "")}` : "/";
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      {settings.announcement.show && settings.announcement.text ? (
        <div className="announce">
          {settings.announcement.href ? <a href={settings.announcement.href}>{settings.announcement.text}</a> : settings.announcement.text}
        </div>
      ) : null}
      <header className="site-header">
        <div className="wrap">
          <Brand settings={settings} />
          <nav className="nav" aria-label="Main">
            <ProductMenu items={product} />
            {nav.map((p) => (
              <Link key={p.slug} href={pathFor(p.slug)}>
                {p.nav.label || p.title}
              </Link>
            ))}
          </nav>
          <Link className="btn btn-brand btn-sm header-cta" href={ctaHref}>
            Talk to us
          </Link>
          <details className="menu">
            <summary aria-label="Menu">
              <Menu size={18} aria-hidden="true" /> Menu
            </summary>
            <div className="menu-panel">
              {product.length ? <span className="menu-label">Product</span> : null}
              {product.map((it) => (
                <Link key={it.href} href={it.href} className="menu-sub">
                  <Icon name={it.icon} size={16} /> {it.label}
                </Link>
              ))}
              {product.length ? <span className="menu-label">More</span> : null}
              {nav.map((p) => (
                <Link key={p.slug} href={pathFor(p.slug)}>
                  {p.nav.label || p.title}
                </Link>
              ))}
              <Link className="btn btn-brand" href={ctaHref}>
                Talk to us
              </Link>
            </div>
          </details>
        </div>
      </header>
    </>
  );
}

const GROUPS = [
  ["product", "Product"],
  ["company", "Company"],
  ["legal", "Legal"],
];

const SOCIAL_LABELS = { instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", x: "X (Twitter)", youtube: "YouTube" };

export function SiteFooter({ settings, pages }) {
  const social = Object.entries(settings.social).filter(([, url]) => url);
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <Brand settings={settings} />
            <p>{settings.tagline}</p>
            {settings.contact.email ? (
              <a href={`mailto:${settings.contact.email}`} style={{ color: "#ece7df", fontSize: 15 }}>
                {settings.contact.email}
              </a>
            ) : null}
            {settings.contact.phone ? (
              <a href={`tel:${settings.contact.phone.replace(/\s/g, "")}`} style={{ color: "#ece7df", fontSize: 15 }}>
                {settings.contact.phone}
              </a>
            ) : null}
          </div>
          {GROUPS.map(([key, label]) => {
            const list = pages.filter((p) => p.footerGroup === key);
            if (!list.length) return null;
            return (
              <div key={key} className="foot-col">
                <h2>{label}</h2>
                <ul>
                  {list.map((p) => (
                    <li key={p.slug}>
                      <Link href={pathFor(p.slug)}>{p.nav?.label || p.title}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {social.length ? (
            <div className="foot-col">
              <h2>Follow us</h2>
              <ul>
                {social.map(([key, url]) => (
                  <li key={key}>
                    <a href={url} rel="noopener me" target="_blank">
                      {SOCIAL_LABELS[key]}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <div className="foot-bottom">
          <span>
            © {year} {settings.brandName}. All rights reserved.
          </span>
          {settings.footerNote ? <span>{settings.footerNote}</span> : null}
        </div>
      </div>
    </footer>
  );
}
