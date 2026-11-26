import type { Outlet } from "@/api/schemas";

/** One store (a restaurant business) and its outlets, as the "choose a store" screen lists them. */
export interface StoreGroup { id: string; name: string; outlets: Outlet[] }

/**
 * The outlets a platform admin can reach, grouped by the store they belong to: stores A→Z, and each store's outlets A→Z. A store with
 * no name on record is shown as "Unnamed store" (so it can still be told apart and chosen).
 */
export function groupByStore(outlets: Outlet[]): StoreGroup[] {
  const byId = new Map<string, StoreGroup>();
  for (const o of outlets) {
    const group = byId.get(o.brandId) ?? { id: o.brandId, name: o.brandName || "Unnamed store", outlets: [] };
    group.outlets.push(o);
    byId.set(o.brandId, group);
  }
  const by = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });
  return [...byId.values()].map((g) => ({ ...g, outlets: [...g.outlets].sort((a, b) => by(a.name, b.name)) })).sort((a, b) => by(a.name, b.name));
}

/** "1 outlet" / "3 outlets" */
export const outletCount = (n: number) => `${n} ${n === 1 ? "outlet" : "outlets"}`;
