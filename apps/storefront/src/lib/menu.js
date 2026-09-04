import { menuSchema,           } from "@onetap/config-schema";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3072";

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
