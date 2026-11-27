import type { CacheEntry } from "@/api/endpoints";

/**
 * The words for each way of expiring the cache, the same as the web console's: what it DROPS and what STAYS. The sheet shows them next to the real
 * list of items (the list is built by the server's own rule, so the sheet and the result agree).
 */
export const EXPIRE_WORDS = {
  admin: {
    title: "Expire the admin panel's cache",
    drops: "What the console and the marketing website remember on their own: the dashboard's numbers, the website's pages and prices, and “no store has this address” answers.",
    stays: "Every store's items. No store, outlet or menu is touched.",
  },
  outlet: {
    title: "Expire this outlet's cache",
    drops: "Only this outlet's own items: its menu, settings, pages, offers, kitchen-load count and access check.",
    stays: "The store's look, plan and web addresses, the store's other outlets, and every other store.",
  },
  store: {
    title: "Expire this store's cache",
    drops: "Everything remembered for this store: its look and outlets, its plan, its addresses, and every outlet's menu, settings, pages and offers.",
    stays: "Every other store, and the admin panel's own items.",
  },
  all: {
    title: "Expire everything",
    drops: "Everything remembered: every store's items and the admin panel's own. The marketing website is told to refresh too.",
    stays: "Nothing in the database. People stay signed in (their sign-in is just looked up again).",
  },
} as const;
export type ExpireKind = keyof typeof EXPIRE_WORDS;
export const NEXT_WORDS = "The next visit loads fresh data from the database (a little slower, once). Nothing in the database changes.";

/** What a list of remembered items is made of, biggest group first: [{ label: "Menu", n: 2 }, …]. */
export function summarize(entries: { label?: string; kind: string }[]): { label: string; n: number }[] {
  const by = new Map<string, number>();
  for (const e of entries) by.set(e.label ?? e.kind, (by.get(e.label ?? e.kind) ?? 0) + 1);
  return [...by].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
}

export interface OutletGroup { id: string; name: string; rows: CacheEntry[]; bytes: number }
export interface StoreGroup { id: string; name: string; rows: CacheEntry[]; bytes: number; outlets: OutletGroup[]; whole: CacheEntry[] }
const sum = (rows: { bytes: number }[]) => rows.reduce((n, r) => n + r.bytes, 0);

/**
 * The cache the way a person thinks of it: what belongs to no store (the admin panel), and then store by store, each store outlet by outlet, with
 * what is not one outlet's (the store's look, plan, addresses) kept apart as "the whole store".
 */
export function groupCache(entries: CacheEntry[], stores: { id: string; name: string }[]): { admin: CacheEntry[]; stores: StoreGroup[] } {
  const admin = entries.filter((e) => !e.store);
  const groups = stores.map((s) => {
    const rows = entries.filter((e) => e.store?.id === s.id);
    const byOutlet = new Map<string, OutletGroup>();
    for (const e of rows) if (e.outlet && !byOutlet.has(e.outlet.id)) byOutlet.set(e.outlet.id, { id: e.outlet.id, name: e.outlet.name, rows: [], bytes: 0 });
    for (const e of rows) if (e.outlet) { const g = byOutlet.get(e.outlet.id)!; g.rows.push(e); g.bytes += e.bytes; }
    return { id: s.id, name: s.name, rows, bytes: sum(rows), outlets: [...byOutlet.values()].sort((a, b) => a.name.localeCompare(b.name)), whole: rows.filter((e) => !e.outlet) };
  });
  return { admin, stores: groups };
}
