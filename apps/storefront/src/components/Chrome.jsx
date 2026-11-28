import { getAnnouncementVariant, getFooterVariant, getHeaderVariant, StickyBar } from "@rasoipulse/ui";
import { storeName } from "@/lib/outlet";
import { AppVersion } from "./AppVersion";

/**
 * What every storefront page shares above and below its own content, built from the outlet's settings:
 *
 *   StoreTop     the message bar (when switched on), then the header — the header stays pinned to the top of the screen
 *                while the page scrolls (the message bar scrolls away)
 *   StoreBottom  the footer, with the store's page links inside it, and the Rasoi Pulse version under it
 *
 * One place, so the menu page, the table-QR page and the store's own pages can never drift apart.
 */

/**
 * The header's menu: the built-in links, the store's own pages that are set to show there, and the owner's extra links.
 *
 * `current` says which page this is — "menu", "orders" (the account page and a single order), "book", or "page:<slug>" for one of the
 * store's own pages. That link is marked `current` so the header can show the visitor where they are; the owner can switch that off
 * (Appearance → Header → "Highlight the page you're on").
 */
export function headerLinks({ outletSlug, config, pages, onHome, current }) {
  const { features, layout } = config;
  const here = onHome ? "menu" : current;
  const highlight = layout.highlightCurrentPage !== false;
  const hereHref = { menu: `/${outletSlug}`, orders: `/${outletSlug}/account`, book: `/${outletSlug}/book` }[here] ?? (here?.startsWith("page:") ? `/${outletSlug}/${here.slice(5)}` : null);
  const mark = (key, link) => (highlight && here === key ? { ...link, current: true } : link);
  const samePage = (href) => typeof href === "string" && href.startsWith("/") && hereHref !== null && href.split(/[#?]/)[0].replace(/\/$/, "") === hereHref;
  return [
    // on the menu page this is an in-page anchor; from another page it goes back to the menu
    mark("menu", { label: "Menu", href: onHome ? "#menu" : `/${outletSlug}#menu` }),
    // the customer's Account page: their orders, how each is going and paid for, and their coins
    mark("orders", { label: "My orders", href: `/${outletSlug}/account` }),
    ...(features.ordering.dineInQr ? [{ label: "Order at table", href: "#" }] : []),
    // table bookings, when the outlet takes them
    ...(features.reservations.enabled ? [mark("book", { label: "Book a table", href: `/${outletSlug}/book` })] : []),
    ...(pages ?? []).filter((p) => p.showInHeader).map((p) => mark(`page:${p.slug}`, { label: p.title, href: `/${outletSlug}/${p.slug}` })),
    // Admin-added, from Appearance → Header navigation links (current when the link goes to the page the visitor is on).
    ...layout.navLinks.map((l) => (highlight && samePage(l.href) ? { ...l, current: true } : l)),
  ];
}

export function StoreTop({ outlet, outletSlug, pages = [], onHome = false, current, links }) {
  const { identity, layout, announcement } = outlet.config;
  const name = storeName(outlet); // the store, not this outlet
  const Bar = getAnnouncementVariant(layout.announcementVariant).Component;
  const Header = getHeaderVariant(layout.headerVariant).Component;
  const messages = announcement.messages.filter((m) => m.text.trim());
  return (
    <>
      {announcement.enabled && messages.length > 0 ? (
        <Bar messages={messages} phone={announcement.showPhone ? identity.phone || undefined : undefined} dismissible={announcement.dismissible} rotateSeconds={announcement.rotateSeconds} />
      ) : null}
      <StickyBar name="header" z={32}>
        <Header
          name={name}
          logoUrl={identity.logoUrl || undefined}
          tagline={identity.tagline || undefined}
          phone={identity.phone || undefined}
          orderHref={onHome ? "#menu" : `/${outletSlug}#menu`}
          links={links ?? headerLinks({ outletSlug, config: outlet.config, pages, onHome, current })}
        />
      </StickyBar>
    </>
  );
}

export function StoreBottom({ outlet, outletSlug, pages = [] }) {
  const { identity, layout } = outlet.config;
  const Footer = getFooterVariant(layout.footerVariant).Component;
  return (
    <>
      <Footer
        name={storeName(outlet)}
        address={identity.address || undefined}
        phone={identity.phone || undefined}
        fssaiLicense={identity.fssaiLicense || undefined}
        gstin={identity.gstin || undefined}
        // the store's own pages (About us, Contact…) that it chose to show in the footer
        links={pages.filter((p) => p.showInFooter).map((p) => ({ label: p.title, href: `/${outletSlug}/${p.slug}` }))}
      />
      <AppVersion />
    </>
  );
}
