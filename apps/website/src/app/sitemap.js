import { getPages, getSettings, pathFor, siteUrl } from "@/lib/site";

export const revalidate = 300;

/** Every published page Google may index, with when it last changed. */
export default async function sitemap() {
  const [settings, pages] = await Promise.all([getSettings(), getPages()]);
  const base = siteUrl(settings);
  return pages
    .filter((p) => !p.noindex)
    .map((p) => ({
      url: `${base}${pathFor(p.slug)}`,
      lastModified: p.updatedAt ? new Date(p.updatedAt) : undefined,
      changeFrequency: p.slug === "home" ? "weekly" : "monthly",
      priority: p.slug === "home" ? 1 : p.slug === "pricing" ? 0.9 : 0.7,
    }));
}
