import Link from "next/link";
import { getPlatformLinks, lookupHost } from "@/lib/outlet";

/**
 * What a visitor sees when there is no store page to show. Which one depends on
 * what the address is:
 *
 *   an address no store uses  → "We couldn't find a restaurant here", with a way
 *                                to the main site and to contact us
 *   a real store, bad path    → "We couldn't find that page", back to its menu
 *   the API can't be reached  → "Can't reach the restaurant right now"
 *
 * Used by app/not-found.jsx (every unknown path, and every notFound() call) and
 * by the root page.
 */
export async function AddressNotFound() {
  const found = await lookupHost();
  if (found.state === "unknown") return <NoRestaurantHere host={found.host} />;
  if (found.state === "down") return <CantReach />;
  return <PageNotFound />;
}

const Icon = ({ children }) => (
  <span className="addr-icon" aria-hidden>
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  </span>
);

/** An address under the platform's domain (or a client's domain) that no store is using. */
export async function NoRestaurantHere({ host }) {
  const links = await getPlatformLinks();
  return (
    <main className="addr">
      <title>No restaurant at this address — Rasoi Pulse</title>
      <div className="addr-card">
        <Icon>
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <path d="M9.5 8.5 14.5 13.5M14.5 8.5l-5 5" />
        </Icon>
        <p className="addr-brand">Rasoi Pulse</p>
        <h1 className="addr-title">We couldn’t find a restaurant here</h1>
        {host ? (
          <p className="addr-host" translate="no">
            {host}
          </p>
        ) : null}
        <p className="addr-text">
          This address isn’t linked to any restaurant on Rasoi Pulse. The link may have a typing mistake, or the restaurant may have moved to a new address.
        </p>
        <p className="addr-text">Check the spelling, or ask the restaurant for their current link — or scan the QR code on their table.</p>
        {links ? (
          <div className="addr-actions">
            <a className="addr-btn addr-btn-primary" href={links.websiteUrl}>
              Go to Rasoi Pulse
            </a>
            <a className="addr-btn addr-btn-outline" href={links.contactUrl}>
              Contact us
            </a>
          </div>
        ) : null}
        {links ? <p className="addr-help">Think this address should be working? Contact us and we’ll look into it.</p> : null}
        {process.env.NODE_ENV !== "production" ? (
          <p className="addr-dev">
            Developer note: no store uses this host. Start the API and run <code>pnpm seed</code>, or give a store this address in the platform console.
          </p>
        ) : null}
      </div>
    </main>
  );
}

/** A real store, but not a page it has. */
export function PageNotFound() {
  return (
    <main className="addr">
      <title>Page not found</title>
      <div className="addr-card">
        <Icon>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5M8.5 11h5" />
        </Icon>
        <h1 className="addr-title">We couldn’t find that page</h1>
        <p className="addr-text">The link may be old or have a typing mistake.</p>
        <div className="addr-actions">
          <Link className="addr-btn addr-btn-primary" href="/">
            Go to the menu
          </Link>
        </div>
      </div>
    </main>
  );
}

/** The API didn't answer — we can't tell whether the address is right. */
export function CantReach() {
  return (
    <main className="addr">
      <title>Can’t reach the restaurant right now</title>
      <div className="addr-card">
        <Icon>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5V12l3 2" />
        </Icon>
        <h1 className="addr-title">We can’t reach the restaurant right now</h1>
        <p className="addr-text">This is usually brief. Please try again in a moment.</p>
        <div className="addr-actions">
          <a className="addr-btn addr-btn-primary" href="/">
            Try again
          </a>
        </div>
      </div>
    </main>
  );
}
