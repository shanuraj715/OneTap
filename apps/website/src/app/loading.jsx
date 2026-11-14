/**
 * Shown while a page that isn't cached yet is being put together on the
 * server — a ticket "printing", in keeping with the site.
 */
export default function Loading() {
  return (
    <main id="main" className="page-loading" aria-busy="true" aria-live="polite">
      <div className="mini-ticket" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p>Loading…</p>
    </main>
  );
}
