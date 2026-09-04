import { getFooterVariant, getHeaderVariant, Hero } from "@onetap/ui";
import { Ordering } from "@/components/Ordering";
import { ThemeStyle } from "@/components/ThemeStyle";
import { getMenu } from "@/lib/menu";
import { getOutletById } from "@/lib/outlet";

export const dynamic = "force-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3072";

interface ScanResult {
  outletId: string;
  table: { id: string; number: string; zone: string; seats: number };
  occupiedByOther: boolean;
}

/** Validates the signed QR before revealing anything about the restaurant. */
async function resolveScan(tableId: string, token: string): Promise<ScanResult | { error: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/tables/scan/${tableId}?k=${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: (body as { error?: string }).error ?? "That table code isn't valid" };
    return body as ScanResult;
  } catch {
    return { error: "Couldn't reach the restaurant. Check your connection." };
  }
}

export default async function TablePage({
  params,
  searchParams,
}: {
  params: Promise<{ tableId: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
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

  const menu = await getMenu(outlet.id);
  const { identity, theme, typography, features, layout } = outlet.config;
  const name = identity.name || outlet.name;
  const Header = getHeaderVariant(layout.headerVariant).Component;
  const Footer = getFooterVariant(layout.footerVariant).Component;

  if (!features.ordering.dineInQr) {
    return (
      <>
        <ThemeStyle theme={theme} typography={typography} />
        <main style={{ maxWidth: 460, margin: "120px auto", padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Table ordering is off right now</h1>
          <p style={{ color: "var(--color-text-muted)" }}>Please order at the counter.</p>
        </main>
      </>
    );
  }

  return (
    <>
      <ThemeStyle theme={theme} typography={typography} />
      <Header name={name} tagline={identity.tagline || undefined} phone={identity.phone || undefined} links={[]} />

      <Hero title={`Table ${scan.table.number}`} subtitle={`${name} · order straight from your seat`} />

      {scan.occupiedByOther ? (
        <p style={{ maxWidth: 560, margin: "0 auto 20px", padding: "12px 16px", textAlign: "center", color: "var(--tone-warning)", background: "var(--tone-warning-wash)", borderRadius: 10 }}>
          Another party is currently seated at this table. Please ask a member of staff.
        </p>
      ) : (
        <Ordering
          outletId={outlet.id}
          menu={menu}
          menuLayout={
            outlet.config.menuLayout.mode === "auto" && outlet.config.menuLayout.sections.length === 0
              ? { ...outlet.config.menuLayout, defaultCardVariant: outlet.config.menuLayout.defaultCardVariant || layout.itemCardVariant }
              : outlet.config.menuLayout
          }
          gateways={outlet.config.payments.enabled}
          dineIn={{ tableId: scan.table.id, tableNumber: scan.table.number, token: k }}
        />
      )}

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
