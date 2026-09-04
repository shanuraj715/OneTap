import { parseOutletConfig, menuLayoutSchema } from "@onetap/config-schema";
import { ThemeStyle } from "@/components/ThemeStyle";
import { getMenu } from "@/lib/menu";
import { LivePreview } from "./LivePreview";

export const dynamic = "force-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3072";

/**
 * The live menu-layout preview.
 *
 * Opened from the admin's Menu layout editor. It renders the real storefront
 * menu components against the outlet's live menu, and re-renders on every edit
 * the editor streams over the /preview WebSocket — so a second screen (or a
 * phone) shows exactly what a diner will see, before anything is saved.
 */
export default async function PreviewPage({ params }) {
  const { sessionId } = await params;

  let snapshot = null;
  try {
    const res = await fetch(`${API_BASE}/api/preview/${encodeURIComponent(sessionId)}`, { cache: "no-store" });
    if (res.ok) snapshot = await res.json();
  } catch {
    /* falls through to the expired screen */
  }

  if (!snapshot) return <Expired />;

  const [outletJson, menu] = await Promise.all([
    fetch(`${API_BASE}/api/outlets/resolve?id=${encodeURIComponent(snapshot.outletId)}&host=&slug=`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    getMenu(snapshot.outletId),
  ]);

  if (!outletJson?.outlet) return <Expired />;

  const config = parseOutletConfig(outletJson.outlet.config);
  const outletName = config.identity.name || outletJson.outlet.name;

  return (
    <>
      <ThemeStyle theme={config.theme} typography={config.typography} />
      <LivePreview
        sessionId={sessionId}
        apiBase={API_BASE}
        outletName={outletName}
        menu={menu}
        fallbackCardVariant={config.layout.itemCardVariant}
        initialLayout={menuLayoutSchema.parse(snapshot.layout ?? {})}
      />
    </>
  );
}

function Expired() {
  return (
    <main style={{ maxWidth: 460, margin: "120px auto", padding: 24, textAlign: "center", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Preview link expired</h1>
      <p style={{ color: "#666", lineHeight: 1.6 }}>
        This live-preview session has ended. Open the Menu layout editor in the admin panel again and use the fresh
        preview link.
      </p>
    </main>
  );
}
