import { ImageResponse } from "next/og";

/**
 * The share image (1200×630) for a page that has none uploaded — the page's
 * title on the site's colours, with the kitchen-ticket edge as the motif.
 * Used by Open Graph / Twitter cards: what shows up when a link is pasted in
 * WhatsApp, LinkedIn or X.
 */
export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const title = (q.get("title") || "Restaurant ordering, from table to kitchen.").slice(0, 110);
  const brand = (q.get("brand") || "TablePe").slice(0, 40);
  const color = /^#[0-9a-fA-F]{6}$/.test(q.get("color") ?? "") ? q.get("color") : "#C8372D";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f5f4f0", padding: "64px 72px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: color, display: "flex" }} />
          <div style={{ fontSize: 40, fontWeight: 800, color: "#1a1815", letterSpacing: -1 }}>{brand}</div>
        </div>
        <div style={{ display: "flex", fontSize: title.length > 60 ? 62 : 74, fontWeight: 800, color: "#1a1815", lineHeight: 1.08, letterSpacing: -2, maxWidth: 1000 }}>
          {title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, color: "#6b655e" }}>
          <div style={{ display: "flex", width: 120, height: 8, borderRadius: 8, background: color }} />
          QR ordering · staff ordering · your own ordering site
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
