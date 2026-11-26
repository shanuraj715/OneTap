import type { ItemState, KitchenItem } from "@/api/schemas";
import type { IconName } from "@/ui/Icon";
import type { Tone } from "./tone";

/* The dishes screen: the three states, what a count means, and how a long list is narrowed down and grouped. */

export const ITEM_STATES: ItemState[] = ["available", "sold-out", "unavailable"];
export const STATE_LABEL: Record<ItemState, string> = { available: "Available", "sold-out": "Sold out", unavailable: "Unavailable" };
export const STATE_TONE: Record<ItemState, Tone> = { available: "ok", "sold-out": "danger", unavailable: "warn" };
export const STATE_ICON: Record<ItemState, IconName> = { available: "check-circle", "sold-out": "x-circle", unavailable: "eye-off" };
/** What each choice means, in the words of the sheet. */
export const STATE_HELP: Record<ItemState, string> = {
  available: "Customers and waiters can order it.",
  "sold-out": "Finished for now. It shows as Sold out everywhere until you put it back.",
  unavailable: "Can't be made (an ingredient is missing, a machine is down). It shows as Sold out everywhere until you put it back.",
};

export type DishFilter = "all" | "sold-out" | "unavailable" | "low";

export interface DishCounts { all: number; soldOut: number; unavailable: number; low: number }
export const countsOf = (items: KitchenItem[]): DishCounts => ({
  all: items.length,
  soldOut: items.filter((i) => i.state === "sold-out").length,
  unavailable: items.filter((i) => i.state === "unavailable").length,
  low: items.filter((i) => i.low).length,
});

/** The dishes that pass the chosen filter and contain the typed words (in the name or the category). */
export function filterItems(items: KitchenItem[], filter: DishFilter, query: string): KitchenItem[] {
  const q = query.trim().toLowerCase();
  return items.filter((i) => {
    if (filter === "sold-out" && i.state !== "sold-out") return false;
    if (filter === "unavailable" && i.state !== "unavailable") return false;
    if (filter === "low" && !i.low) return false;
    return !q || i.name.toLowerCase().includes(q) || i.categoryName.toLowerCase().includes(q);
  });
}

/** Rows for a list: a heading per category (in the menu's own order), then its dishes. A dish with no category goes under "Other". */
export type DishRow = { kind: "heading"; key: string; title: string; count: number } | { kind: "dish"; key: string; item: KitchenItem };
export function dishRows(items: KitchenItem[], categories: { id: string; name: string }[]): DishRow[] {
  const order = new Map(categories.map((c, i) => [c.id, i]));
  const groups = new Map<string, KitchenItem[]>();
  for (const i of items) {
    const g = groups.get(i.categoryId ?? "") ?? [];
    g.push(i);
    groups.set(i.categoryId ?? "", g);
  }
  const ids = [...groups.keys()].sort((a, b) => (order.get(a) ?? 1e6) - (order.get(b) ?? 1e6));
  const rows: DishRow[] = [];
  for (const id of ids) {
    const list = groups.get(id)!;
    rows.push({ kind: "heading", key: `h-${id}`, title: list[0]!.categoryName || "Other", count: list.length });
    for (const item of list) rows.push({ kind: "dish", key: item.id, item });
  }
  return rows;
}

/** "5 left" / "3 left of 20 a day" / "None left"; empty for a dish that isn't counted. */
export const countText = (item: Pick<KitchenItem, "stock">): string => {
  if (!item.stock) return "";
  if (item.stock.left <= 0) return "None left";
  return item.stock.daily ? `${item.stock.left} left of ${item.stock.daily} a day` : `${item.stock.left} left`;
};

/** What the dish's state becomes in the list the moment a person taps (before the server answers). A counted dish with none left stays sold out. */
export const stateAfter = (item: Pick<KitchenItem, "stock">, wanted: ItemState, left?: number): ItemState => {
  if (wanted !== "available") return wanted;
  const stock = left !== undefined ? left : item.stock?.left;
  return item.stock && (stock ?? 0) <= 0 ? "sold-out" : "available";
};

/** The menu stores the food type as plain text. Showing "veg" for an unknown type would be a claim nobody made, so an unknown type shows no mark. */
export const foodTypeOf = (value: string): "veg" | "egg" | "non-veg" | null => (value === "veg" || value === "egg" || value === "non-veg" ? value : null);

/** The number typed in the "left today" box, as a whole number ≥ 0, or null when it is empty or not a number. */
export function parseLeft(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,5}$/.test(t)) return null;
  return Number(t);
}
