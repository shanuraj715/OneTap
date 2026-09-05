import { getFooterVariant, getHeaderVariant } from "@onetap/ui";
import { Ordering } from "@/components/Ordering";
import { ThemeStyle } from "@/components/ThemeStyle";
import { getMenu } from "@/lib/menu";
import { getOutletById } from "@/lib/outlet";

export const dynamic = "force-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3072";

                      
                   
                                                                     
                           
 

/** Validates the signed QR before revealing anything about the restaurant. */
async function resolveScan(tableId        , token        )                                          {
  try {
    const res = await fetch(`${API_BASE}/api/tables/scan/${tableId}?k=${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: (body                      ).error ?? "That table code isn't valid" };
    return body              ;
  } catch {
    return { error: "Couldn't reach the restaurant. Check your connection." };
  }
}

export default async function TablePage({
  params,
  searchParams,
}   
                                       
                                        
 ) {
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

  const locationFromOutletName = outlet.name.includes("—")
    ? outlet.name.split("—")[1]?.trim()
    : outlet.name.includes("-")
      ? outlet.name.split("-")[1]?.trim()
      : "";
  const outletLocation = identity.address || identity.location?.formattedAddress || locationFromOutletName;
  const outletDisplayName = identity.name || (locationFromOutletName ? outlet.name.split(/—|-/)[0]?.trim() : outlet.name);

  return (
    <>
      <ThemeStyle theme={theme} typography={typography} />
      <Header name={name} tagline={identity.tagline || undefined} phone={identity.phone || undefined} links={[]} />

      <section style={tableHeaderWrap}>
        <h1 style={tableHeading}>Table {scan.table.number}</h1>
        <div style={tableMeta}>
          <span style={outletNameStyle}>{outletDisplayName}</span>
          {outletLocation ? (
            <>
              <span style={metaDot} aria-hidden>·</span>
              <span style={locationStyle}>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0 }}
                  aria-hidden
                >
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {outletLocation}
              </span>
            </>
          ) : null}
        </div>
      </section>

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
          popupCarouselVariant={layout?.popupCarouselVariant || layout?.carouselVariant || "carousel.slider"}
          toastVariant={layout?.toastVariant || "toast.solid"}
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

const tableHeaderWrap = {
  maxWidth: 1080,
  margin: "0 auto",
  padding: "20px 16px 14px",
  textAlign: "center",
  boxSizing: "border-box",
};

const tableHeading = {
  fontFamily: "var(--font-heading)",
  fontSize: "clamp(1.5rem, 4vw, 2.15rem)",
  fontWeight: 700,
  letterSpacing: "-0.02em",
  margin: 0,
  lineHeight: 1.2,
  color: "var(--color-text)",
};

const tableMeta = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  flexWrap: "wrap",
  margin: "6px auto 0",
  fontSize: "clamp(13px, 2.5vw, 15px)",
  lineHeight: 1.4,
  color: "var(--color-text-muted)",
};

const outletNameStyle = {
  fontWeight: 600,
  color: "var(--color-text)",
};

const metaDot = {
  color: "var(--color-text-muted)",
  opacity: 0.6,
};

const locationStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  color: "var(--color-text-muted)",
};
