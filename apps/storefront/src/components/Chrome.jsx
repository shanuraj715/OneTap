import { getAnnouncementVariant, getFooterVariant, getHeaderVariant } from "@onetap/ui";

/**
 * What every storefront page shares above and below its own content, built from the outlet's settings:
 *
 *   StoreTop     the message bar (when switched on), then the header
 *   StoreBottom  the footer, with the store's page links inside it
 *
 * One place, so the menu page, the table-QR page and the store's own pages can never drift apart.
 */

/** The header's menu: the built-in links, the store's own pages that are set to show there, and the owner's extra links. */
export function headerLinks({ outletSlug, config, pages, onHome }) {
  const { features, layout } = config;
  return [
    // on the menu page this is an in-page anchor; from another page it goes back to the menu
    { label: "Menu", href: onHome ? "#menu" : `/${outletSlug}#menu` },
    ...(features.ordering.dineInQr ? [{ label: "Order at table", href: "#" }] : []),
    ...(features.reservations.enabled ? [{ label: "Book a table", href: "#" }] : []),
    ...(pages ?? []).filter((p) => p.showInHeader).map((p) => ({ label: p.title, href: `/${outletSlug}/${p.slug}` })),
    // Admin-added, from Appearance → Header navigation links.
    ...layout.navLinks,
  ];
}

export function StoreTop({ outlet, outletSlug, pages = [], onHome = false, links }) {
  const { identity, layout, announcement } = outlet.config;
  const name = identity.name || outlet.name;
  const Bar = getAnnouncementVariant(layout.announcementVariant).Component;
  const Header = getHeaderVariant(layout.headerVariant).Component;
  const messages = announcement.messages.filter((m) => m.text.trim());
  return (
    <>
      {announcement.enabled && messages.length > 0 ? (
        <Bar messages={messages} phone={announcement.showPhone ? identity.phone || undefined : undefined} dismissible={announcement.dismissible} rotateSeconds={announcement.rotateSeconds} />
      ) : null}
      <Header
        name={name}
        logoUrl={identity.logoUrl || undefined}
        tagline={identity.tagline || undefined}
        phone={identity.phone || undefined}
        orderHref={onHome ? "#menu" : `/${outletSlug}#menu`}
        links={links ?? headerLinks({ outletSlug, config: outlet.config, pages, onHome })}
      />
    </>
  );
}

export function StoreBottom({ outlet, outletSlug, pages = [] }) {
  const { identity, layout } = outlet.config;
  const Footer = getFooterVariant(layout.footerVariant).Component;
  return (
    <Footer
      name={identity.name || outlet.name}
      address={identity.address || undefined}
      phone={identity.phone || undefined}
      fssaiLicense={identity.fssaiLicense || undefined}
      gstin={identity.gstin || undefined}
      // the store's own pages (About us, Contact…) that it chose to show in the footer
      links={pages.filter((p) => p.showInFooter).map((p) => ({ label: p.title, href: `/${outletSlug}/${p.slug}` }))}
    />
  );
}
