import { notFound } from "next/navigation";
import { OrderPage } from "@/components/OrderPage";
import { ThemeStyle } from "@/components/ThemeStyle";
import { getMenu } from "@/lib/menu";
import { getOutletBySlug } from "@/lib/outlet";

export const dynamic = "force-dynamic";

/**
 * The dedicated order page for a takeaway/delivery/walk-in-dine-in visitor —
 * mirrors `[outletSlug]/page.jsx`'s data-fetching exactly (same outlet
 * resolution, same menu load) because it's the same visit, just a different
 * screen: whatever validated the outlet for the menu has to validate it here
 * too, or a customer mid-checkout could hit a 404 the menu page never showed
 * them.
 */
export default async function OutletOrderPage({ params }) {
  const { outletSlug } = await params;
  const outlet = await getOutletBySlug(outletSlug);
  if (!outlet) notFound();

  const menu = await getMenu(outlet.id);
  const { identity, theme, typography, features, layout } = outlet.config;
  const name = identity.name || outlet.name;

  if (!features.ordering.takeaway && !features.ordering.delivery && !features.ordering.dineInQr) {
    return (
      <>
        <ThemeStyle theme={theme} typography={typography} />
        <main style={{ maxWidth: 460, margin: "120px auto", padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Ordering is off right now</h1>
          <p style={{ color: "var(--color-text-muted)" }}>Please order at the counter.</p>
        </main>
      </>
    );
  }

  return (
    <>
      <ThemeStyle theme={theme} typography={typography} />
      <OrderPage
        outletId={outlet.id}
        outletName={name}
        menu={menu}
        gateways={outlet.config.payments.enabled}
        dineInEnabled={features.ordering.dineInQr}
        deliveryEnabled={features.ordering.delivery}
        menuHref={`/${outletSlug}`}
      />
    </>
  );
}
