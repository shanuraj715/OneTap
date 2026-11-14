import { PageView } from "@/components/PageView";
import { pageMetadata } from "@/lib/seo";
import { getPreview, getSettings } from "@/lib/site";

/**
 * A page as it is right now in the console — draft or not — through the
 * signed, short-lived link the console's Preview button opens. Never cached,
 * never indexed.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }) {
  const [{ id }, { t }] = await Promise.all([params, searchParams]);
  const [page, settings] = await Promise.all([getPreview(id, t), getSettings()]);
  return page ? pageMetadata(page, settings, { preview: true }) : { robots: { index: false, follow: false } };
}

export default async function PreviewPage({ params, searchParams }) {
  const [{ id }, { t }] = await Promise.all([params, searchParams]);
  const [page, settings] = await Promise.all([getPreview(id, t), getSettings()]);
  if (!page) {
    return (
      <main id="main" className="wrap not-found">
        <h1>This preview link has expired</h1>
        <p style={{ color: "var(--muted)" }}>Open Preview again from the console to get a fresh link.</p>
      </main>
    );
  }
  return (
    <>
      <div className="preview-bar">
        Preview{page.status === "draft" ? " of a draft" : ""} — this is how “{page.title}” will look. Only people with this link can see it.
      </div>
      <PageView page={page} settings={settings} />
    </>
  );
}
