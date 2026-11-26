import { cache } from "react";
import { notFound } from "next/navigation";
import { BookingView } from "@/components/BookingView";
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
  if (!outlet) return { title: "Book a table" };
  return { title: `Book a table — ${storeName(outlet)}` };
}

/**
 * `/<outlet>/book` — book a table at this outlet: party size, day, a time that still has room, an optional note.
 * Booking needs the customer to sign in (the same name + mobile + code card as ordering), so the restaurant can reach
 * them. "book" is one of the addresses a store's own pages can't use.
 */
export default async function BookPage({ params }) {
  const { outletSlug } = await params;
  const { outlet, blocked, pages } = await load(outletSlug);
  if (!outlet) notFound();
  if (blocked) return <OutletUnavailable outlet={outlet} />;

  const { theme, typography, identity } = outlet.config;
  return (
    <>
      <ThemeStyle theme={theme} typography={typography} effect={outlet.config.effect} branding={outlet.config.branding} />
      <StoreTop outlet={outlet} outletSlug={outletSlug} pages={pages} current="book" />
      <main>
        <BookingView outletId={outlet.id} outletName={identity.name || outlet.name} outletSlug={outletSlug} phone={identity.phone || ""} />
      </main>
      <StoreBottom outlet={outlet} outletSlug={outletSlug} pages={pages} />
    </>
  );
}
