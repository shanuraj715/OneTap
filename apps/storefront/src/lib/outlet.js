import { headers } from "next/headers";
import { parseOutletConfig,                   } from "@onetap/config-schema";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3072";
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
      config: parseOutletConfig(outlet.config),
    };
  } catch {
    return null;
  }
}

/** Load an outlet directly by id — used by the table-QR landing page. */
export async function getOutletById(outletId        )                                 {
  try {
    const res = await fetch(`${API_BASE}/api/outlets/resolve?slug=&host=&id=${encodeURIComponent(outletId)}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const { outlet } = (await res.json())                                                                            ;
      return { id: outlet._id, name: outlet.name, slug: outlet.slug, config: parseOutletConfig(outlet.config) };
    }
  } catch {
    /* fall through */
  }
  return null;
}
