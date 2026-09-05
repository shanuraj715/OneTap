import { notFound } from "next/navigation";
import { getFooterVariant, getHeaderVariant, Hero, MenuSections } from "@onetap/ui";
import { Ordering } from "@/components/Ordering";
import { ThemeStyle } from "@/components/ThemeStyle";
import { getMenu } from "@/lib/menu";
import { getOutletBySlug } from "@/lib/outlet";

export const dynamic = "force-dynamic";

export default async function OutletHomePage({ params }) {
  const { outletSlug } = await params;
  const outlet = await getOutletBySlug(outletSlug);

  // A real outlet resolves at "/" already for a single-outlet brand — this
  // slug just doesn't exist for the current host's brand.
  if (!outlet) notFound();

  const menu = await getMenu(outlet.id);
  const { identity, theme, typography, features, layout, menuLayout } = outlet.config;
  // Fall back to the single card style if the menu layout hasn't been touched.
  const resolvedMenuLayout =
    menuLayout.mode === "auto" && menuLayout.sections.length === 0
      ? { ...menuLayout, defaultCardVariant: menuLayout.defaultCardVariant || layout.itemCardVariant }
      : menuLayout;
  // Anyone can order online if any online channel is on.
  const onlineOrdering =
    features.ordering.takeaway || features.ordering.delivery || features.ordering.dineInQr;
  const name = identity.name || outlet.name;

  // Variants come from config — swapping one in admin changes the look, no code change.
  const Header = getHeaderVariant(layout.headerVariant).Component;
  const Footer = getFooterVariant(layout.footerVariant).Component;

  return (
    <>
      <ThemeStyle theme={theme} typography={typography} />
      <Header
        name={name}
        tagline={identity.tagline || undefined}
        phone={identity.phone || undefined}
        links={[
          { label: "Menu", href: "#menu" },
          ...(features.ordering.dineInQr ? [{ label: "Order at table", href: "#" }] : []),
          ...(features.reservations.enabled ? [{ label: "Book a table", href: "#" }] : []),
          // Admin-added, from Appearance → Header navigation links.
          ...layout.navLinks,
        ]}
      />

      <Hero
        title={name}
        subtitle={identity.tagline || undefined}
        ctaLabel={features.ordering.takeaway ? "Order takeaway" : undefined}
        ctaHref={features.ordering.takeaway ? "#menu" : undefined}
      />

      <div id="menu" style={{ scrollMarginTop: 24 }}>
        {menu.items.length > 0 ? (
          onlineOrdering ? (
            <Ordering
              outletId={outlet.id}
              menu={menu}
              menuLayout={resolvedMenuLayout}
              popupCarouselVariant={layout?.popupCarouselVariant || layout?.carouselVariant || "carousel.slider"}
              toastVariant={layout?.toastVariant || "toast.solid"}
              orderHref={`/${outletSlug}/order`}
            />
          ) : (
            <MenuSections menu={menu} layout={resolvedMenuLayout} />
          )
        ) : (
          <p style={{ textAlign: "center", color: "var(--color-text-muted)" }}>Menu coming soon.</p>
        )}
      </div>

      <Footer
        name={name}
        address={identity.address || undefined}
        phone={identity.phone || undefined}
        fssaiLicense={identity.fssaiLicense || undefined}
        gstin={identity.gstin || undefined}
      />
    </>
  );
}
