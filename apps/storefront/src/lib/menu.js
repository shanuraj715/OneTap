import { apiServerUrl } from "@/lib/api-config";
import { menuSchema,           } from "@rasoipulse/config-schema";

const API_BASE = apiServerUrl();

const EMPTY       = { categories: [], items: [], modifierGroups: [] };

export async function getMenu(outletId        )                {
  try {
    const res = await fetch(`${API_BASE}/api/menu?outletId=${encodeURIComponent(outletId)}`, {
      cache: "no-store",
    });
    if (!res.ok) return EMPTY;
    return menuSchema.parse(await res.json());
  } catch {
    return EMPTY;
  }
}
