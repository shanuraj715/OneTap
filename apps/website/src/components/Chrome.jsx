import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { pathFor } from "@/lib/site";
import { Icon } from "./Icon";
import { MobileMenu } from "./MobileMenu";

/**
 * The header and footer every page shares. Server-rendered; the mobile menu
 * is a native <details>, so it works with no JavaScript at all (MobileMenu only
 * adds closing it after a link is pressed).
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

/**
 * Pages that live in the FOOTER only: the header keeps to what a visitor is choosing between (Product, Pricing, Apps, FAQ). The About and Contact
 * pages are recognised however the console named them — "about", "about-us", "Contact Us" — by their address, title or menu label.
 */
const FOOTER_ONLY_NAME = /^(about|contact)([- ]?us)?$/i;
const isFooterOnly = (p) => [p.slug, p.title, p.nav?.label].some((v) => FOOTER_ONLY_NAME.test(String(v ?? "").trim()));

/**
 * The header's links: the pages the console flags for the menu (minus the footer-only ones), in the console's order, with the Apps page — which is
 * not a console page — right after Pricing (or first when there is no Pricing page).
 */
function headerLinks(pages) {
  const list = pages
    .filter((p) => p.nav?.show && p.slug !== "home" && !isFooterOnly(p))
    .sort((a, b) => (a.nav.order ?? 50) - (b.nav.order ?? 50))
    .map((p) => ({ key: p.slug, href: pathFor(p.slug), label: p.nav.label || p.title }));
  const apps = { key: "apps", href: "/apps", label: "Apps" };
  const at = list.findIndex((l) => l.key === "pricing");
  list.splice(at + 1, 0, apps);
  return list;
}

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
  const nav = headerLinks(pages);
  // the contact page, however the console named it ("contact", "contact-us", or a menu label "Contact Us")
  const contact = pages.find((p) => [p.slug, p.title, p.nav?.label].some((v) => /^contact([- ]?us)?$/i.test(String(v ?? "").trim())));
  const ctaHref = contact ? pathFor(contact.slug) : settings.contact.phone ? `tel:${settings.contact.phone.replace(/\s/g, "")}` : "/";
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
            {nav.map((l) => (
              <Link key={l.key} href={l.href}>
                {l.label}
              </Link>
            ))}
          </nav>
          <Link className="btn btn-brand btn-sm header-cta" href={ctaHref}>
            Talk to us
          </Link>
          <MobileMenu>
            {product.length ? <span className="menu-label">Product</span> : null}
            {product.map((it) => (
              <Link key={it.href} href={it.href} className="menu-sub">
                <Icon name={it.icon} size={16} /> {it.label}
              </Link>
            ))}
            {product.length ? <span className="menu-label">More</span> : null}
            {nav.map((l) => (
              <Link key={l.key} href={l.href}>
                {l.label}
              </Link>
            ))}
            <Link className="btn btn-brand" href={ctaHref}>
              Talk to us
            </Link>
          </MobileMenu>
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
            // About and Contact always sit in Company (unless the console put them in another column), whether or not they are in the menu
            const list = pages.filter((p) => p.footerGroup === key || (key === "company" && isFooterOnly(p) && !p.footerGroup));
            if (!list.length && key !== "product") return null;
            return (
              <div key={key} className="foot-col">
                <h2>{label}</h2>
                <ul>
                  {list.map((p) => (
                    <li key={p.slug}>
                      <Link href={pathFor(p.slug)}>{p.nav?.label || p.title}</Link>
                    </li>
                  ))}
                  {key === "product" ? (
                    <li>
                      <Link href="/apps">Apps</Link>
                    </li>
                  ) : null}
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
          <span className="foot-version" data-testid="app-version">{process.env.NEXT_PUBLIC_APP_VERSION || "dev"}</span>
        </div>
      </div>
    </footer>
  );
}
