import { Link } from "react-router-dom";

/**
 * A "404" drawn inside the dashboard's content area, so the sidebar and the rest of the shell stay in place.
 * Used for pages a person has the address of but that aren't available to them (a feature their plan doesn't include,
 * or an area their role can't open) — the page simply doesn't exist for them.
 */
export function NotFoundSection() {
  return (
    <section aria-label="Page not found" data-not-found="true" style={wrap}>
      <div>
        <div style={big}>404</div>
        <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 22, margin: "10px 0 6px" }}>Page not found</h1>
        <p style={{ margin: "0 0 16px", fontSize: 14.5, lineHeight: 1.5, color: "var(--color-text-muted)", maxWidth: 380 }}>
          The page you're looking for doesn't exist, or it isn't available to you.
        </p>
        <Link to="/" style={link}>Back to the dashboard</Link>
      </div>
    </section>
  );
}

const wrap = { minHeight: "62vh", display: "grid", placeItems: "center", textAlign: "center", padding: 24 };
const big = { fontFamily: "var(--font-heading)", fontSize: 92, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.03em", color: "var(--color-text-muted)", opacity: 0.55 };
const link = { display: "inline-block", padding: "8px 16px", borderRadius: 8, background: "var(--color-primary)", color: "var(--color-on-primary)", fontWeight: 600, fontSize: 13.5, textDecoration: "none" };
