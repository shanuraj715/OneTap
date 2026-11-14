import Link from "next/link";

export const metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <main id="main" className="wrap not-found">
      <div className="eyebrow">404</div>
      <h1>This table's empty.</h1>
      <p style={{ color: "var(--muted)", maxWidth: 440 }}>We couldn't find that page. It may have moved — try the home page.</p>
      <Link className="btn btn-brand" href="/">
        Go to the home page
      </Link>
    </main>
  );
}
