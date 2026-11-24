import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CantReach } from "@/components/AddressNotice";
import { OutletPicker } from "@/components/OutletPicker";
import { OutletUnavailable } from "@/components/OutletUnavailable";
import { getOutletsForHost, getPageLinks, lookupHost } from "@/lib/outlet";

export const dynamic = "force-dynamic";

// Remembers a diner's outlet choice so a later "/" visit skips straight past
// the picker instead of asking every time.
const CHOICE_COOKIE = "onetap_outlet_slug";

/**
 * No outlet in the URL yet. A single-outlet brand (still the common case)
 * redirects straight through with nothing shown — this must never regress
 * for a brand that has only ever had one outlet. More than one outlet shows
 * a picker before any site content renders, per the "ask before showing"
 * requirement.
 */
/** The picker's tab title is the store's name too (a single-outlet store never shows this page — it redirects). */
export async function generateMetadata() {
  const resolved = await getOutletsForHost();
  const name = resolved?.brand?.name;
  return name ? { title: name, description: `Choose an outlet and order online from ${name}.` } : {};
}

export default async function RootPage() {
  const resolved = await getOutletsForHost();

  // The store exists but every outlet is blocked by the platform.
  if (resolved && resolved.outlets.length === 0) return <OutletUnavailable outlet={null} />;

  // No store at this address (or the API couldn't say): show a proper page, not a developer message.
  // The page renders as a real 404 so search engines don't index addresses that lead nowhere.
  if (!resolved) {
    const found = await lookupHost();
    if (found.state === "unknown") notFound();
    return <CantReach />;
  }

  if (resolved.outlets.length === 1) {
    redirect(`/${resolved.outlets[0].slug}`);
  }

  const cookieStore = await cookies();
  const chosen = cookieStore.get(CHOICE_COOKIE)?.value;
  if (chosen && resolved.outlets.some((o) => o.slug === chosen)) {
    redirect(`/${chosen}`);
  }

  // The store's pages (About, Contact, Pricing, Privacy, Terms, Refunds…) are per outlet; this landing page links to
  // the first outlet's, so a visitor — or a payment gateway's reviewer — finds them without picking an outlet first.
  const first = resolved.outlets[0];
  const pages = first ? (await getPageLinks(first.id)).filter((p) => p.showInFooter) : [];
  const pageLinks = pages.map((p) => ({ label: p.title, href: `/${first.slug}/${p.slug}` }));

  return <OutletPicker brand={resolved.brand} outlets={resolved.outlets} cookieName={CHOICE_COOKIE} pageLinks={pageLinks} />;
}
