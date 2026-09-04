import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OutletPicker } from "@/components/OutletPicker";
import { getOutletsForHost } from "@/lib/outlet";

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
export default async function RootPage() {
  const resolved = await getOutletsForHost();

  if (!resolved || resolved.outlets.length === 0) {
    return (
      <main style={{ maxWidth: 560, margin: "120px auto", padding: 24, textAlign: "center" }}>
        <h1>Storefront not configured</h1>
        <p style={{ color: "var(--color-text-muted)" }}>
          No outlet resolved for this host. Start the API and run <code>pnpm seed</code>.
        </p>
      </main>
    );
  }

  if (resolved.outlets.length === 1) {
    redirect(`/${resolved.outlets[0].slug}`);
  }

  const cookieStore = await cookies();
  const chosen = cookieStore.get(CHOICE_COOKIE)?.value;
  if (chosen && resolved.outlets.some((o) => o.slug === chosen)) {
    redirect(`/${chosen}`);
  }

  return <OutletPicker brand={resolved.brand} outlets={resolved.outlets} cookieName={CHOICE_COOKIE} />;
}
