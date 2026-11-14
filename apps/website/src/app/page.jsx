import { notFound } from "next/navigation";
import { PageView } from "@/components/PageView";
import { pageMetadata } from "@/lib/seo";
import { getPage, getSettings } from "@/lib/site";

// Served from cache — refreshed every 5 minutes, or the moment the console saves.
export const revalidate = 300;

export async function generateMetadata() {
  const [page, settings] = await Promise.all([getPage("home"), getSettings()]);
  return page ? pageMetadata(page, settings) : {};
}

export default async function Home() {
  const [page, settings] = await Promise.all([getPage("home"), getSettings()]);
  if (!page) notFound();
  return <PageView page={page} settings={settings} />;
}
