import { MenuCategoryModel, MenuItemModel, PrinterModel, tenantFilter } from "@rasoipulse/db";

/**
 * The rules for kitchen tickets (KOTs):
 *
 *  1. WHICH printer gets WHICH dish — every dish is "prepared at" the kitchen or the bar (set on a dish, or on its
 *     category and inherited down through sub-categories; nothing set = the kitchen).
 *  2. WHAT changed on an order after its ticket went out — worked out by comparing the order before and after an edit.
 *
 * Everything here is plain functions (plus two small database look-ups); printing.service.js decides when to call them.
 */

/** Printers at these stations split an order by dish; any other station that prints a KOT gets the whole order. */
const SPLIT_STATIONS = new Set(["kitchen", "bar"]);
const DEFAULT_STATION = "kitchen";

/* ------------------------------------------------------------ prep stations */

/**
 * itemId → "kitchen" | "bar", for every dish in `itemIds`. The dish's own setting wins; otherwise the nearest category
 * above it that has one; otherwise the kitchen. A dish that no longer exists is made in the kitchen.
 */
export async function stationsForItems(ctx, itemIds) {
  const ids = [...new Set(itemIds.filter(Boolean).map(String))];
  const out = new Map(ids.map((id) => [id, DEFAULT_STATION]));
  if (!ids.length) return out;

  const [items, categories] = await Promise.all([
    MenuItemModel.find(tenantFilter(ctx, { _id: { $in: ids } })).select("categoryId prepStation").lean(),
    MenuCategoryModel.find(tenantFilter(ctx)).select("parentId prepStation").lean(),
  ]);
  const catById = new Map(categories.map((c) => [String(c._id), c]));

  for (const item of items) {
    let station = item.prepStation || null;
    // walk up through the categories (bounded, so a bad parent loop can never hang a print)
    let cat = catById.get(String(item.categoryId));
    for (let hops = 0; !station && cat && hops < 12; hops += 1) {
      station = cat.prepStation || null;
      cat = cat.parentId ? catById.get(String(cat.parentId)) : null;
    }
    out.set(String(item._id), station || DEFAULT_STATION);
  }
  return out;
}

/** The active kitchen-ticket printers an order of this channel may print on. */
export async function activeKotPrinters(ctx, channel) {
  const printers = await PrinterModel.find(tenantFilter(ctx, { isActive: true, docType: "kot" }));
  // an empty channel list means the printer takes every channel
  return printers.filter((p) => !p.channels?.length || !channel || p.channels.includes(channel));
}

/**
 * Which of `entries` (anything with a `.station`) one KOT printer should print.
 *
 *  - A kitchen or bar printer prints the dishes made at ITS station.
 *  - A dish whose station has no printer goes to the kitchen printer; if there is no kitchen printer either, every ticket
 *    gets it — so a dish is never left without a ticket just because a printer is missing or switched off.
 *  - Any other KOT printer (counter, packing, manager…) is a master copy and prints everything.
 */
export function entriesForPrinter(printer, entries, kotPrinters) {
  if (!SPLIT_STATIONS.has(printer.station)) return entries;
  const hasPrinterAt = (station) => kotPrinters.some((p) => p.station === station);
  return entries.filter((entry) => {
    const home = hasPrinterAt(entry.station) ? entry.station : hasPrinterAt(DEFAULT_STATION) ? DEFAULT_STATION : null;
    return home === null ? true : home === printer.station;
  });
}

/**
 * A combo is cooked as its parts: on a kitchen ticket every combo line becomes the dishes it is made of (each going to
 * the printer that makes it), labelled with the combo's name. The combo's own add-ons and note go with its first part.
 */
export function expandCombos(lines) {
  return (lines ?? []).flatMap((l) => {
    if (!l.includes?.length) return [l];
    return l.includes.map((p, i) => ({
      itemId: p.itemId,
      name: p.name,
      variantLabel: [p.variantLabel, `in ${l.name}`].filter(Boolean).join(" · "),
      modifiers: i === 0 ? (l.modifiers ?? []) : [],
      quantity: (p.quantity ?? 1) * l.quantity,
      unitPrice: 0,
      lineTotal: 0,
      note: i === 0 ? l.note : undefined,
    }));
  });
}

/* ------------------------------------------------------------ what changed */

/**
 * Two lines are "the same dish" for a kitchen when the item, size, add-ons and note are all the same. A different note
 * on the same dish therefore reads as one REMOVE and one ADD, which is exactly what a cook needs to see.
 */
export const lineKey = (l) =>
  [
    String(l.itemId ?? l.name ?? ""),
    String(l.variantId ?? l.variantLabel ?? ""),
    (l.modifiers ?? [])
      .map((m) => String(m.id ?? m.label ?? ""))
      .sort()
      .join(","),
    String(l.note ?? "").trim().toLowerCase(),
  ].join("|");

const snapshot = (l, quantity) => ({
  itemId: l.itemId ? String(l.itemId) : null,
  name: l.name,
  variantLabel: l.variantLabel ?? undefined,
  modifiers: (l.modifiers ?? []).map((m) => ({ id: m.id, label: m.label ?? m.name })),
  note: l.note ?? undefined,
  quantity,
});

function totals(lines) {
  const out = new Map();
  for (const l of lines ?? []) {
    const key = lineKey(l);
    const seen = out.get(key);
    if (seen) seen.quantity += l.quantity;
    else out.set(key, snapshot(l, l.quantity));
  }
  return out;
}

/**
 * What the kitchen has to do differently: dishes added (or more of them) and dishes taken off (or fewer of them).
 * `[{ op: "add" | "remove", quantity, name, variantLabel, modifiers, note, itemId }]` — `quantity` is the DIFFERENCE, so
 * going from 2 to 3 of a dish is "ADD 1", and 3 to 2 is "REMOVE 1".
 */
export function diffLines(before, after) {
  const was = totals(before);
  const now = totals(after);
  const changes = [];
  for (const [key, line] of now) {
    const prev = was.get(key)?.quantity ?? 0;
    if (line.quantity > prev) changes.push({ op: "add", ...line, quantity: line.quantity - prev });
  }
  for (const [key, line] of was) {
    const next = now.get(key)?.quantity ?? 0;
    if (line.quantity > next) changes.push({ op: "remove", ...line, quantity: line.quantity - next });
  }
  return changes;
}
