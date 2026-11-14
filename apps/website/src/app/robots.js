import { getSettings, siteUrl } from "@/lib/site";

export const revalidate = 300;

export default async function robots() {
  const base = siteUrl(await getSettings());
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/preview/", "/api/"] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
