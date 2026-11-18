import { apiServerUrl } from "@/lib/api-config";
import { OrderPage } from "@/components/OrderPage";
import { OutletUnavailable } from "@/components/OutletUnavailable";
import { ThemeStyle } from "@/components/ThemeStyle";
import { getMenu } from "@/lib/menu";
import { visitorHeaders } from "@/lib/visitor";
import { getOutletById } from "@/lib/outlet";

export const dynamic = "force-dynamic";

const API_BASE = apiServerUrl();

/** Validates the signed QR before revealing anything about the restaurant — same check the table page itself makes. */
async function resolveScan(tableId, token) {
  try {
    const res = await fetch(`${API_BASE}/api/tables/scan/${tableId}?k=${encodeURIComponent(token)}`, {
      cache: "no-store",
      headers: await visitorHeaders(), // who is looking — a diner already seated here must not be told another party is
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: body.error ?? "That table code isn't valid" };
    return body;
  } catch {
    return { error: "Couldn't reach the restaurant. Check your connection." };
  }
}

/**
 * The dedicated order page reached from a table QR. Re-validates the scan
 * token itself rather than trusting that the menu page already did — a
 * customer can land here directly (a saved link, a refresh, browser back),
 * and the token is what's actually proving they're at this table, not
 * whichever page happened to check it last.
 */
export default async function TableOrderPage({ params, searchParams }) {
  const { tableId } = await params;
  const { k = "" } = await searchParams;

  const scan = await resolveScan(tableId, k);
  if ("error" in scan) {
    return (
      <main style={{ maxWidth: 460, margin: "120px auto", padding: 24, textAlign: "center" }}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>This code didn&apos;t work</h1>
        <p style={{ color: "var(--color-text-muted)" }}>{scan.error}</p>
      </main>
    );
  }

  const outlet = await getOutletById(scan.outletId);
  if (!outlet) {
    return (
      <main style={{ maxWidth: 460, margin: "120px auto", padding: 24, textAlign: "center" }}>
        <h1>Restaurant unavailable</h1>
      </main>
    );
  }
  if (outlet.blocked) return <OutletUnavailable outlet={outlet} />;

  const menu = await getMenu(outlet.id);
  const { identity, theme, typography, features } = outlet.config;
  const name = identity.name || outlet.name;

  if (!features.ordering.dineInQr) {
    return (
      <>
        <ThemeStyle theme={theme} typography={typography} effect={outlet.config.effect} branding={outlet.config.branding} />
        <main style={{ maxWidth: 460, margin: "120px auto", padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Table ordering is off right now</h1>
          <p style={{ color: "var(--color-text-muted)" }}>Please order at the counter.</p>
        </main>
      </>
    );
  }

  if (scan.occupiedByOther) {
    return (
      <>
        <ThemeStyle theme={theme} typography={typography} effect={outlet.config.effect} branding={outlet.config.branding} />
        <main style={{ maxWidth: 460, margin: "120px auto", padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Another party is seated here</h1>
          <p style={{ color: "var(--color-text-muted)" }}>Please ask a member of staff.</p>
        </main>
      </>
    );
  }

  return (
    <>
      <ThemeStyle theme={theme} typography={typography} effect={outlet.config.effect} branding={outlet.config.branding} />
      <OrderPage
        outletId={outlet.id}
        outletName={name}
        menu={menu}
        gateways={outlet.config.payments.enabled}
        dineIn={{ tableId: scan.table.id, tableNumber: scan.table.number, token: k }}
        menuHref={`/t/${tableId}?k=${encodeURIComponent(k)}`}
      />
    </>
  );
}
