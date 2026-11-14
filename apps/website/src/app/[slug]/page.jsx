import { notFound, permanentRedirect } from "next/navigation";
import { PageView } from "@/components/PageView";
import { pageMetadata } from "@/lib/seo";
import { getPage, getPages, getSettings } from "@/lib/site";

// Rendered on the server the first time it's asked for, then served from
// cache — refreshed every 5 minutes, or the moment the console saves.
export const revalidate = 300;
// pages published after the build render on their first visit, then cache
export const dynamicParams = true;

/** Pre-render every published page at build time. */
export async function generateStaticParams() {
  const pages = await getPages();
  return pages.filter((p) => p.slug !== "home").map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const [page, settings] = await Promise.all([getPage(slug), getSettings()]);
  return page ? pageMetadata(page, settings) : {};
}

export default async function SitePage({ params }) {
  const { slug } = await params;
  // the home page lives at "/" — one address per page, for search engines
  if (slug === "home") permanentRedirect("/");
  const [page, settings] = await Promise.all([getPage(slug), getSettings()]);
  if (!page) notFound();
  return <PageView page={page} settings={settings} />;
}
