import { cache } from "react";
import { notFound } from "next/navigation";
import { OrderTracker } from "@/components/OrderTracker";
import { StoreBottom, StoreTop } from "@/components/Chrome";
import { OutletUnavailable } from "@/components/OutletUnavailable";
import { ThemeStyle } from "@/components/ThemeStyle";
import { getOutletBySlug, getPageLinks, storeName } from "@/lib/outlet";

export const dynamic = "force-dynamic";

const load = cache(async (outletSlug) => {
  const outlet = await getOutletBySlug(outletSlug);
  if (!outlet) return { outlet: null };
  if (outlet.blocked) return { outlet, blocked: true };
  return { outlet, pages: await getPageLinks(outlet.id) };
});

export async function generateMetadata({ params }) {
  const { outletSlug } = await params;
  const { outlet } = await load(outletSlug);
  if (!outlet) return { title: "Follow your order" };
  return { title: `Follow your order — ${storeName(outlet)}`, robots: { index: false } };
}

/**
 * Follow one order at `/<outlet>/order/<id>` — where it is right now, refreshed by itself. A private page: nothing is
 * indexed and the order itself is fetched in the browser with the customer's own sign-in.
 */
export default async function TrackOrderPage({ params }) {
  const { outletSlug, orderId } = await params;
  const { outlet, blocked, pages } = await load(outletSlug);
  if (!outlet) notFound();
  if (blocked) return <OutletUnavailable outlet={outlet} />;

  const { theme, typography } = outlet.config;
  return (
    <>
      <ThemeStyle theme={theme} typography={typography} effect={outlet.config.effect} branding={outlet.config.branding} />
      <StoreTop outlet={outlet} outletSlug={outletSlug} pages={pages} current="orders" />
      <main>
        <OrderTracker outletId={outlet.id} outletSlug={outletSlug} orderId={orderId} />
      </main>
      <StoreBottom outlet={outlet} outletSlug={outletSlug} pages={pages} />
    </>
  );
}
