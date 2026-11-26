import type { FoodType, Menu, MenuCategory, MenuItem, ModifierGroup, Unavailable } from "@/api/schemas";
import { formatMoney } from "@/lib/money";

/** One category of the menu with the dishes to show in it. The name is the whole path: "South Indian › Dosa". */
export interface MenuSection { id: string; name: string; items: MenuItem[] }
export interface MenuFilter { query?: string; foodType?: FoodType | null }

const byOrder = <T extends { sortOrder: number; name: string }>(a: T, b: T) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);

/** "South Indian › Dosa" (the categories above it, then its own name). A loop in the data cannot hang the app. */
export function categoryPath(categories: MenuCategory[], id: string): string {
  const names: string[] = [];
  let cursor: MenuCategory | undefined = categories.find((c) => c.id === id);
  for (let guard = 0; cursor && guard < 8; guard += 1) {
    names.unshift(cursor.name);
    const parent: string | null = cursor.parentId;
    cursor = parent ? categories.find((c) => c.id === parent) : undefined;
  }
  return names.join(" › ");
}

/** A category counts only while it and everything above it is switched on. */
function activeCategoryIds(categories: MenuCategory[]): Set<string> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const ok = new Set<string>();
  for (const c of categories) {
    let cursor: MenuCategory | undefined = c;
    let on = true;
    for (let guard = 0; cursor && guard < 8; guard += 1) {
      if (!cursor.isActive) { on = false; break; }
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    if (on) ok.add(c.id);
  }
  return ok;
}

/** Tree order: a category, then the ones inside it. */
function treeOrder(categories: MenuCategory[]): MenuCategory[] {
  const out: MenuCategory[] = [];
  const visit = (parent: string | null, depth: number) => {
    for (const c of categories.filter((x) => x.parentId === parent).sort(byOrder)) {
      out.push(c);
      if (depth < 6) visit(c.id, depth + 1);
    }
  };
  visit(null, 0);
  return out;
}

export function buildSections(menu: Menu, filter: MenuFilter = {}): MenuSection[] {
  const active = activeCategoryIds(menu.categories);
  const q = (filter.query ?? "").trim().toLowerCase();
  const matches = (i: MenuItem) =>
    (!filter.foodType || i.foodType === filter.foodType) &&
    (!q || i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q) || i.tags.some((t) => t.toLowerCase().includes(q)));
  return treeOrder(menu.categories)
    .filter((c) => active.has(c.id))
    .map((c) => {
      const items = menu.items.filter((i) => i.categoryId === c.id && matches(i)).sort(byOrder);
      // dishes that can't be ordered go to the end of their category (the same rule as the storefront)
      const sorted = [...items.filter((i) => i.isAvailable), ...items.filter((i) => !i.isAvailable)];
      return { id: c.id, name: categoryPath(menu.categories, c.id), items: sorted };
    })
    .filter((s) => s.items.length > 0);
}

/** The add-on groups that belong to a dish, in the dish's own order. */
export function groupsFor(menu: Menu, item: MenuItem): ModifierGroup[] {
  return item.modifierGroupIds.map((id) => menu.modifierGroups.find((g) => g.id === id)).filter((g): g is ModifierGroup => !!g);
}

/** A dish with sizes or add-ons needs a choice before it can be added; a plain one is added with one tap. */
export const needsChoices = (item: MenuItem, groups: ModifierGroup[]): boolean => item.variants.length > 0 || groups.length > 0;

/** "₹90", or "from ₹60" when the price depends on the size. */
export function priceLabel(item: MenuItem): string {
  if (item.variants.length === 0) return formatMoney(item.basePrice);
  const prices = item.variants.map((v) => v.price);
  const lowest = Math.min(...prices);
  return prices.every((p) => p === lowest) ? formatMoney(lowest) : `from ${formatMoney(lowest)}`;
}

/**
 * The menu with what the server says about THIS moment laid over it. The whole menu is loaded once; each time an order is started the
 * app asks only "what can't be ordered now?" and this marks those dishes (with the words to show: "Sold out", "Available 8 AM – 11 AM").
 * A dish that is NOT in the answer can be ordered — including one the first copy of the menu said was sold out (it came back in stock).
 * Before the first answer arrives the menu is shown as it is.
 */
export function withAvailability(menu: Menu, answer: Unavailable | undefined): Menu {
  if (!answer) return menu;
  const off = new Map(answer.unavailable.map((u) => [u.id, u.label]));
  const low = new Map(answer.low.map((l) => [l.id, l.left]));
  return { ...menu, items: menu.items.map((i): MenuItem => ({ ...i, isAvailable: !off.has(i.id), unavailableLabel: off.get(i.id) ?? null, lowLeft: low.get(i.id) ?? null })) };
}

/** True when at least one dish has a picture (then every row keeps a picture slot, so the rows line up). */
export const menuHasPictures = (menu: Menu): boolean => menu.items.some((i) => (i.images ?? []).length > 0);

/** What the menu list draws, top to bottom: a heading per category (it opens and closes), and under an OPEN one its dishes in rows of `columns`. */
export type MenuRow =
  | { kind: "header"; id: string; sectionId: string; name: string; count: number; expanded: boolean }
  | { kind: "dishes"; id: string; items: MenuItem[] };

/** `open`: the categories that are open ("all" = every one, "none" = every one closed). Dishes of a closed category are not rows at all. */
export function buildRows(sections: MenuSection[], columns: number, open: ReadonlySet<string> | "all" = "all"): MenuRow[] {
  const per = Math.max(1, Math.floor(columns));
  const rows: MenuRow[] = [];
  for (const s of sections) {
    const expanded = open === "all" || open.has(s.id);
    rows.push({ kind: "header", id: `h-${s.id}`, sectionId: s.id, name: s.name, count: s.items.length, expanded });
    if (!expanded) continue;
    for (let i = 0; i < s.items.length; i += per) rows.push({ kind: "dishes", id: `r-${s.id}-${i}`, items: s.items.slice(i, i + per) });
  }
  return rows;
}
