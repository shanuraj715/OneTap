import { cache } from "react";
import { notFound } from "next/navigation";
import { AccountView } from "@/components/AccountView";
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
  if (!outlet) return { title: "Your account" };
  return { title: `Your account — ${storeName(outlet)}`, robots: { index: false } };
}

/**
 * The customer's Account page at `/<outlet>/account` — their orders (status, payment, items, total) and their coins.
 * It is a private page (not indexed); what it shows comes from the signed-in customer's own session, in the browser.
 * "account" is one of the addresses a store's own pages can't use, so this can never be shadowed.
 */
export default async function AccountPage({ params }) {
  const { outletSlug } = await params;
  const { outlet, blocked, pages } = await load(outletSlug);
  if (!outlet) notFound();
  if (blocked) return <OutletUnavailable outlet={outlet} />;

  const { theme, typography } = outlet.config;
  return (
    <>
      <ThemeStyle theme={theme} typography={typography} effect={outlet.config.effect} branding={outlet.config.branding} />
      <StoreTop outlet={outlet} outletSlug={outletSlug} pages={pages} />
      <main>
        <AccountView outletId={outlet.id} menuHref={`/${outletSlug}`} />
      </main>
      <StoreBottom outlet={outlet} outletSlug={outletSlug} pages={pages} />
    </>
  );
}
