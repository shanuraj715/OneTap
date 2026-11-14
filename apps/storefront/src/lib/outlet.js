import { apiServerUrl } from "@/lib/api-config";
import { headers } from "next/headers";
import { parseOutletConfig,                   } from "@onetap/config-schema";

const API_BASE = apiServerUrl();
const DEV_FALLBACK_SLUG = process.env.NEXT_PUBLIC_OUTLET_SLUG ?? "gazab-momos/laxmi-nagar";

                                 
             
               
               
                       
 

/**
 * Resolve which restaurant this request is for. In production: by Host header.
 * In local dev: Host is `localhost:3070`, which the seed also registers, with a
 * brand/outlet slug fallback.
 */
export async function getOutlet()                                 {
  const host = (await headers()).get("host") ?? "";
  const url = `${API_BASE}/api/outlets/resolve?host=${encodeURIComponent(host)}&slug=${encodeURIComponent(DEV_FALLBACK_SLUG)}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const { outlet } = (await res.json())                                                                            ;
    return {
      id: outlet._id,
      name: outlet.name,
      slug: outlet.slug,
      blocked: Boolean(outlet.blocked),
      config: parseOutletConfig(outlet.config),
    };
  } catch {
    return null;
  }
}

/**
 * Resolve one specific outlet within the current host's brand — every
 * outlet-scoped storefront page (`/[outletSlug]`, `/[outletSlug]/t/...`)
 * uses this instead of the bare host-only getOutlet().
 */
export async function getOutletBySlug(outletSlug        )                                 {
  const host = (await headers()).get("host") ?? "";
  const url = `${API_BASE}/api/outlets/resolve?host=${encodeURIComponent(host)}&slug=${encodeURIComponent(outletSlug)}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const { outlet } = (await res.json())                                                                            ;
    return {
      id: outlet._id,
      name: outlet.name,
      slug: outlet.slug,
      blocked: Boolean(outlet.blocked),
      config: parseOutletConfig(outlet.config),
    };
  } catch {
    return null;
  }
}

/**
 * Which brand the current host belongs to, and every outlet under it —
 * powers the root page's "no outlet in the URL yet" resolution.
 */
export async function getOutletsForHost() {
  const host = (await headers()).get("host") ?? "";
  try {
    const res = await fetch(`${API_BASE}/api/outlets/for-host?host=${encodeURIComponent(host)}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Is there a store at the address this request came to?
 *   known    — a store uses it
 *   unknown  — the API answered and no store uses it (mistyped, or removed)
 *   down     — we couldn't find out (API unreachable or failing) — a different message
 */
export async function lookupHost() {
  const host = (await headers()).get("host") ?? "";
  try {
    const res = await fetch(`${API_BASE}/api/outlets/for-host?host=${encodeURIComponent(host)}`, { cache: "no-store" });
    if (res.ok) return { state: "known", host };
    if (res.status === 404) return { state: "unknown", host };
  } catch {
    /* fall through */
  }
  return { state: "down", host };
}

/** Where "the main site" and "contact us" lead — null when the API can't say (those buttons are then left out). */
export async function getPlatformLinks() {
  try {
    const res = await fetch(`${API_BASE}/api/site/links`, { next: { revalidate: 300 } });
    if (res.ok) return await res.json();
  } catch {
    /* fall through */
  }
  return null;
}

/** Load an outlet directly by id — used by the table-QR landing page. */
export async function getOutletById(outletId        )                                 {
  try {
    const res = await fetch(`${API_BASE}/api/outlets/resolve?slug=&host=&id=${encodeURIComponent(outletId)}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const { outlet } = (await res.json())                                                                            ;
      return {
        id: outlet._id,
        name: outlet.name,
        slug: outlet.slug,
        blocked: Boolean(outlet.blocked),
        config: parseOutletConfig(outlet.config),
      };
    }
  } catch {
    /* fall through */
  }
  return null;
}
