import { createStore } from "zustand/vanilla";
import type { CartInput } from "@/api/endpoints";
import type { FoodType, MenuItem, ModifierGroup, Order } from "@/api/schemas";

/**
 * The order being put together at a table (a "draft"), kept per table so a waiter can go from one table to another and back without losing
 * either. It lives in memory only. The app never works out the real price: it shows an estimate while building the order, and the server's
 * quote (priced with taxes, coupons and rounding) is what the waiter confirms.
 */
export interface DraftLine {
  /** one line per dish + size + add-ons + note: the same choice added twice raises the quantity instead of making a second line */
  key: string;
  itemId: string;
  name: string;
  foodType: FoodType;
  variantId?: string;
  variantLabel?: string;
  modifierOptionIds: string[];
  modifierLabels: string[];
  /** estimate: the size's price (or the dish's) plus the add-ons */
  unitPrice: number;
  quantity: number;
  note?: string;
}
export interface Draft { lines: DraftLine[]; name: string; phone: string; note: string }
export const MAX_QUANTITY = 99;
export const emptyDraft = (): Draft => ({ lines: [], name: "", phone: "", note: "" });

export interface Selection { variantId?: string; optionIds: string[] }

export function lineKey(itemId: string, variantId: string | undefined, optionIds: string[], note: string | undefined): string {
  return [itemId, variantId ?? "", [...optionIds].sort().join(","), (note ?? "").trim().toLowerCase()].join("|");
}

/** Everything the waiter still has to choose before this dish can be added (an empty list = ready). */
export function selectionProblems(item: MenuItem, groups: ModifierGroup[], sel: Selection): string[] {
  const out: string[] = [];
  if (!item.isAvailable) out.push(`${item.name} is sold out`);
  if (item.variants.length > 0) {
    if (!sel.variantId) out.push("Choose a size");
    else if (!item.variants.some((v) => v.id === sel.variantId)) out.push("That size is not on the menu any more");
  }
  for (const g of groups) {
    const chosen = g.options.filter((o) => sel.optionIds.includes(o.id)).length;
    const min = g.required ? Math.max(1, g.minSelect) : g.minSelect;
    if (chosen < min) out.push(min === 1 ? `Choose one for ${g.name}` : `Choose at least ${min} for ${g.name}`);
    if (g.maxSelect > 0 && chosen > g.maxSelect) out.push(`Choose at most ${g.maxSelect} for ${g.name}`);
  }
  // an option the dish does not offer must never be sent
  const offered = new Set(groups.flatMap((g) => g.options.map((o) => o.id)));
  if (sel.optionIds.some((id) => !offered.has(id))) out.push("An add-on that is not offered was selected");
  return out;
}

export function unitPriceOf(item: MenuItem, groups: ModifierGroup[], sel: Selection): number {
  const base = item.variants.length > 0 ? (item.variants.find((v) => v.id === sel.variantId)?.price ?? 0) : item.basePrice;
  const extras = groups.flatMap((g) => g.options).filter((o) => sel.optionIds.includes(o.id)).reduce((sum, o) => sum + o.priceDelta, 0);
  return base + extras;
}

export function buildLine(item: MenuItem, groups: ModifierGroup[], sel: Selection, quantity: number, note?: string): DraftLine {
  const cleanNote = note?.trim() || undefined;
  const options = groups.flatMap((g) => g.options).filter((o) => sel.optionIds.includes(o.id));
  return {
    key: lineKey(item.id, sel.variantId, sel.optionIds, cleanNote),
    itemId: item.id,
    name: item.name,
    foodType: item.foodType,
    variantId: sel.variantId,
    variantLabel: item.variants.find((v) => v.id === sel.variantId)?.label,
    modifierOptionIds: options.map((o) => o.id),
    modifierLabels: options.map((o) => o.label),
    unitPrice: unitPriceOf(item, groups, sel),
    quantity: Math.min(MAX_QUANTITY, Math.max(1, Math.floor(quantity))),
    note: cleanNote,
  };
}

export function addLine(draft: Draft, line: DraftLine): Draft {
  const at = draft.lines.findIndex((l) => l.key === line.key);
  if (at === -1) return { ...draft, lines: [...draft.lines, line] };
  const lines = draft.lines.slice();
  lines[at] = { ...lines[at]!, quantity: Math.min(MAX_QUANTITY, lines[at]!.quantity + line.quantity) };
  return { ...draft, lines };
}

export function setQuantity(draft: Draft, key: string, quantity: number): Draft {
  if (quantity <= 0) return { ...draft, lines: draft.lines.filter((l) => l.key !== key) };
  return { ...draft, lines: draft.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(MAX_QUANTITY, Math.floor(quantity)) } : l)) };
}

/** How many portions of this dish (any size, any add-ons) are in the order. */
export const quantityOfItem = (draft: Draft, itemId: string): number => draft.lines.filter((l) => l.itemId === itemId).reduce((n, l) => n + l.quantity, 0);
export const countOf = (draft: Draft): number => draft.lines.reduce((n, l) => n + l.quantity, 0);
export const estimateOf = (draft: Draft): number => draft.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

/** The cart as the server wants it (only what the server needs: it prices everything itself). */
export function toCartInput(draft: Draft): CartInput {
  return {
    lines: draft.lines.map((l) => ({
      itemId: l.itemId,
      ...(l.variantId ? { variantId: l.variantId } : {}),
      modifierOptionIds: l.modifierOptionIds,
      quantity: l.quantity,
      ...(l.note ? { note: l.note } : {}),
    })),
  };
}

/**
 * An order that was already placed, as a draft to change (editing an order): its lines, with the prices the server charged, and who it is for.
 * (The server prices the whole cart again when the edit is saved; these prices are only what is shown meanwhile.)
 */
export function draftFromOrder(order: Pick<Order, "lines" | "customer" | "note">): Draft {
  const lines = order.lines.map((l): DraftLine => {
    const optionIds = l.modifiers.map((m) => m.id);
    const note = l.note?.trim() || undefined;
    return { key: lineKey(l.itemId, l.variantId ?? undefined, optionIds, note), itemId: l.itemId, name: l.name, foodType: l.foodType, variantId: l.variantId ?? undefined, variantLabel: l.variantLabel ?? undefined, modifierOptionIds: optionIds, modifierLabels: l.modifiers.map((m) => m.label), unitPrice: l.unitPrice, quantity: l.quantity, note };
  });
  // the same dish chosen the same way twice is one line (the draft merges them)
  const merged = lines.reduce<Draft>((d, line) => addLine(d, line), emptyDraft());
  return { ...merged, name: order.customer?.name ?? "", phone: order.customer?.phone ?? "", note: order.note ?? "" };
}

/** What an edit would change, in the three parts the server takes: the items (as a cart), the note, the customer. Only what differs is returned. */
export function editChanges(original: Draft, now: Draft): { cart?: CartInput; note?: string; customerName?: string; customerPhone?: string } {
  const out: { cart?: CartInput; note?: string; customerName?: string; customerPhone?: string } = {};
  const sig = (d: Draft) => JSON.stringify(toCartInput(d).lines.map((l) => [l.itemId, l.variantId ?? "", [...l.modifierOptionIds].sort(), l.quantity, l.note ?? ""]).sort());
  if (sig(original) !== sig(now)) out.cart = toCartInput(now);
  if (now.note.trim() !== original.note.trim()) out.note = now.note.trim();
  if (now.name.trim() !== original.name.trim()) out.customerName = now.name.trim();
  if (cleanPhone(now.phone) !== cleanPhone(original.phone)) out.customerPhone = cleanPhone(now.phone);
  return out;
}

/** A mobile number as the server wants it: digits (a leading + is kept), 8 to 20 of them. */
export function cleanPhone(raw: string): string {
  const trimmed = raw.trim();
  return (trimmed.startsWith("+") ? "+" : "") + trimmed.replace(/\D/g, "");
}
export function phoneProblem(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "Enter the customer's mobile number.";
  if (digits.length < 8 || digits.length > 20) return "That mobile number doesn't look right.";
  return null;
}

/* ------------------------------------------------------------------ the store */

export interface DraftState {
  drafts: Record<string, Draft>;
  draftFor(tableId: string): Draft;
  add(tableId: string, line: DraftLine): void;
  setQty(tableId: string, key: string, quantity: number): void;
  setCustomer(tableId: string, patch: Partial<Pick<Draft, "name" | "phone" | "note">>): void;
  /** put a whole draft in place (editing an order starts from the order as it is) */
  set(tableId: string, draft: Draft): void;
  clear(tableId: string): void;
  clearAll(): void;
}

export function createDraftStore() {
  return createStore<DraftState>()((set, get) => ({
    drafts: {},
    draftFor: (tableId) => get().drafts[tableId] ?? emptyDraft(),
    add: (tableId, line) => set((s) => ({ drafts: { ...s.drafts, [tableId]: addLine(s.drafts[tableId] ?? emptyDraft(), line) } })),
    setQty: (tableId, key, quantity) => set((s) => ({ drafts: { ...s.drafts, [tableId]: setQuantity(s.drafts[tableId] ?? emptyDraft(), key, quantity) } })),
    setCustomer: (tableId, patch) => set((s) => ({ drafts: { ...s.drafts, [tableId]: { ...(s.drafts[tableId] ?? emptyDraft()), ...patch } } })),
    set: (tableId, draft) => set((s) => ({ drafts: { ...s.drafts, [tableId]: draft } })),
    clear: (tableId) => set((s) => { const { [tableId]: _gone, ...rest } = s.drafts; return { drafts: rest }; }),
    clearAll: () => set({ drafts: {} }),
  }));
}
export type DraftStore = ReturnType<typeof createDraftStore>;
