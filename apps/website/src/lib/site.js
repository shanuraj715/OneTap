import { siteSettingsSchema } from "@rasoipulse/config-schema";
import { apiServerUrl } from "./api-config";

/**
 * Reading the website's content from the API. Every read is cached and tagged
 * "site": pages are served from cache, refreshed at least every REFRESH
 * seconds, and immediately when the console saves something (it calls
 * /api/revalidate, which drops the "site" tag).
 */
export const REFRESH = 300;

async function get(path, { cache = true } = {}) {
  const res = await fetch(`${apiServerUrl()}${path}`, cache ? { next: { revalidate: REFRESH, tags: ["site"] } } : { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`The website API answered ${res.status} for ${path}`);
  return res.json();
}

/** Settings, with defaults — the site still renders (as Rasoi Pulse) if the API is briefly unreachable. */
export async function getSettings() {
  try {
    const data = await get("/api/site/settings");
    return siteSettingsSchema.parse(data?.settings ?? {});
  } catch {
    return siteSettingsSchema.parse({});
  }
}

export async function getPages() {
  try {
    return (await get("/api/site/pages"))?.pages ?? [];
  } catch {
    return [];
  }
}

export async function getPage(slug) {
  return (await get(`/api/site/pages/${encodeURIComponent(slug)}`))?.page ?? null;
}

export async function getPricing() {
  try {
    return (await get("/api/site/pricing"))?.plans ?? [];
  } catch {
    return [];
  }
}

/** One app's published versions (newest first) for its page /apps/<slug> — `{ latest, releases }`, or null if the API can't be reached. */
export async function getAppReleases(app = "oma") {
  try {
    return await get(`/api/app-updates/releases?app=${encodeURIComponent(app)}`);
  } catch {
    return null;
  }
}

/** Every app with its newest published version, for the /apps page — `{ apps }`, or null if the API can't be reached. */
export async function getApps() {
  try {
    return await get("/api/app-updates/apps");
  } catch {
    return null;
  }
}

export async function getPreview(id, token) {
  const res = await fetch(`${apiServerUrl()}/api/site/preview/${encodeURIComponent(id)}?t=${encodeURIComponent(token ?? "")}`, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()).page;
}

/** The site's own public address — for canonical links, the sitemap and share images. */
export function siteUrl(settings) {
  return (settings.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3073").replace(/\/+$/, "");
}

export const pathFor = (slug) => (slug === "home" ? "/" : `/${slug}`);
