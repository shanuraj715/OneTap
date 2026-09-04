"use client";

import { useRouter } from "next/navigation";

/**
 * Shown only when a brand has more than one outlet and no outlet is in the
 * URL yet (a single-outlet brand skips this entirely — see app/page.jsx).
 * Picking one remembers the choice for next time and lands on that outlet's
 * own URL, which from then on is what's shared, bookmarked and printed on
 * table QR codes.
 */
export function OutletPicker({ brand, outlets, cookieName }) {
  const router = useRouter();

  const choose = (slug) => {
    document.cookie = `${cookieName}=${encodeURIComponent(slug)}; path=/; max-age=${60 * 60 * 24 * 180}`;
    router.push(`/${slug}`);
  };

  return (
    <main style={page}>
      <div style={card}>
        <h1 style={heading}>{brand.name}</h1>
        <p style={subheading}>Which location?</p>
        <div style={list}>
          {outlets.map((o) => (
            <button key={o.id} type="button" onClick={() => choose(o.slug)} style={row} className="ot-press">
              <span style={name}>{o.name}</span>
              {o.address ? <span style={address}>{o.address}</span> : null}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

const page = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 24,
  background: "var(--color-bg)",
};
const card = { width: "100%", maxWidth: 440 };
const heading = {
  fontFamily: "var(--font-heading)",
  fontSize: 26,
  fontWeight: 700,
  margin: "0 0 4px",
  textAlign: "center",
  color: "var(--color-text)",
};
const subheading = {
  margin: "0 0 24px",
  textAlign: "center",
  fontSize: 14,
  color: "var(--color-text-muted)",
};
const list = { display: "flex", flexDirection: "column", gap: 10 };
const row = {
  font: "inherit",
  textAlign: "left",
  display: "flex",
  flexDirection: "column",
  gap: 3,
  padding: "14px 16px",
  borderRadius: "var(--radius-card)",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  cursor: "pointer",
};
const name = { fontWeight: 600, fontSize: 15 };
const address = { fontSize: 13, color: "var(--color-text-muted)" };
