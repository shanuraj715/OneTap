import { notFound } from "next/navigation";
import { menuForNow } from "@onetap/config-schema";
import { getVariant, Hero, MenuSections } from "@onetap/ui";
import { StoreBottom, StoreTop } from "@/components/Chrome";
import { Ordering } from "@/components/Ordering";
import { OrderBar } from "@/components/OrderBar";
import { OutletUnavailable } from "@/components/OutletUnavailable";
import { ThemeStyle } from "@/components/ThemeStyle";
import { getMenu } from "@/lib/menu";
import { getOutletBySlug, getOutletsForHost, getPageLinks, storeName } from "@/lib/outlet";

export const dynamic = "force-dynamic";

export default async function OutletHomePage({ params }) {
  const { outletSlug } = await params;
  const outlet = await getOutletBySlug(outletSlug);

  // A real outlet resolves at "/" already for a single-outlet brand — this
  // slug just doesn't exist for the current host's brand.
  if (!outlet) notFound();
  if (outlet.blocked) return <OutletUnavailable outlet={outlet} />;

  const [menu, pages, store] = await Promise.all([getMenu(outlet.id), getPageLinks(outlet.id), getOutletsForHost()]);
  const { identity, theme, typography, features, layout, menuLayout, carousel } = outlet.config;
  // Fall back to the single card style if the menu layout hasn't been touched.
  const resolvedMenuLayout =
    menuLayout.mode === "auto" && menuLayout.sections.length === 0
      ? { ...menuLayout, defaultCardVariant: menuLayout.defaultCardVariant || layout.itemCardVariant }
      : menuLayout;
  // Anyone can order online if any online channel is on.
  const onlineOrdering =
    features.ordering.takeaway || features.ordering.delivery || features.ordering.dineInQr;
  const name = storeName(outlet); // the big heading is the store's name; the outlet is chosen in the dropdown

  // The promo carousel — its style comes from Appearance, its slides from Banners; a slide needs a picture or a title to show.
  const slides = carousel.enabled ? carousel.slides.filter((s) => s.imageUrl || s.title) : [];
  const Carousel = getVariant("carouselVariant", layout.carouselVariant).Component;

  return (
    <>
      <ThemeStyle theme={theme} typography={typography} effect={outlet.config.effect} branding={outlet.config.branding} />
      <StoreTop outlet={outlet} outletSlug={outletSlug} pages={pages} onHome />

      {/* Takeaway or Delivery, and which outlet — only where there is something to choose */}
      {features.ordering.takeaway || features.ordering.delivery ? <OrderBar current={{ id: outlet.id, slug: outlet.slug }} outlets={store?.outlets ?? []} /> : null}

      <Hero title={name} subtitle={identity.tagline || undefined} />

      {slides.length > 0 ? (
        <section aria-label="Offers and news" className="ot-page-px" style={{ maxWidth: 1080, margin: "0 auto", padding: "0 18px 18px", boxSizing: "border-box" }}>
          <Carousel
            items={slides.map((s) => ({ id: s.id, imageUrl: s.imageUrl || undefined, title: s.title, subtitle: s.subtitle, ctaLabel: s.ctaLabel, href: s.ctaHref }))}
            autoplay={carousel.autoplay}
            interval={carousel.intervalSeconds * 1000}
            showArrows={carousel.showArrows}
            showDots={carousel.showDots}
            height={carousel.height}
          />
        </section>
      ) : null}

      <div id="menu" style={{ scrollMarginTop: "calc(var(--ot-header-h, 0px) + var(--ot-bar-h, 0px) + 24px)" }}>
        {menu.items.length > 0 ? (
          onlineOrdering ? (
            <Ordering
              outletId={outlet.id}
              menu={menu}
              menuLayout={resolvedMenuLayout}
              popupCarouselVariant={layout?.popupCarouselVariant || layout?.carouselVariant || "carousel.slider"}
              toastVariant={layout?.toastVariant || "toast.solid"}
              orderHref={`/${outletSlug}/order`}
              hideOutsideHours={outlet.config.menuTimes.hideOutsideHours}
              serverNow={Date.now()}
            />
          ) : (
            <MenuSections menu={menuForNow(menu, Date.now(), { hideOutsideHours: outlet.config.menuTimes.hideOutsideHours })} layout={resolvedMenuLayout} />
          )
        ) : (
          <p style={{ textAlign: "center", color: "var(--color-text-muted)" }}>Menu coming soon.</p>
        )}
      </div>

      <StoreBottom outlet={outlet} outletSlug={outletSlug} pages={pages} />
    </>
  );
}
