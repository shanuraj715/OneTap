import { z } from "zod";
import { prepStationSchema } from "./printing.js";
import { menuImageSchema } from "./storage.js";

/** Money is always integer paise. ₹110.00 => 11000. */
export function formatINR(paise        )         {
  const rupees = paise / 100;
  return "₹" + rupees.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export const foodTypeSchema = z.enum(["veg", "non-veg", "egg"]);
                                                      

/** A size / preparation choice, e.g. "Half plate (5 pcs)" — absolute price. */
export const variantSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  price: z.number().int().nonnegative(),
});
                                                    

export const modifierOptionSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  priceDelta: z.number().int().default(0),
});
                                                                  

export const modifierGroupSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  required: z.boolean().default(false),
  minSelect: z.number().int().nonnegative().default(0),
  maxSelect: z.number().int().positive().default(1),
  options: z.array(modifierOptionSchema).default([]),
});
                                                                

export const menuItemSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  name: z.string().min(1),
  description: z.string().default(""),
  foodType: foodTypeSchema.default("veg"),
  tags: z.array(z.string()).default([]),
  /** item photos, in display order — the first is the primary/card image */
  images: z.array(menuImageSchema).default([]),
  /** used when there are no variants */
  basePrice: z.number().int().nonnegative().default(0),
  variants: z.array(variantSchema).default([]),
  modifierGroupIds: z.array(z.string()).default([]),
  /** where this dish is made (which kitchen-ticket printer gets it); null = same as its category, else the kitchen */
  prepStation: prepStationSchema.nullable().default(null),
  gstRatePct: z.number().nonnegative().default(5),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});
/** @typedef {z.infer<typeof menuItemSchema>} MenuItem */
/** @typedef {z.infer<typeof menuSchema>} Menu */

export const menuCategorySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  /** the category this one is inside — null for a top-level category */
  parentId: z.string().nullable().default(null),
  /** an optional picture for the category */
  image: menuImageSchema.nullable().default(null),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  /** where everything inside this category is made, unless a dish says otherwise; null = same as the category it is inside, else the kitchen */
  prepStation: prepStationSchema.nullable().default(null),
});
                                                              

/** The full menu payload sent to the storefront and the admin editor. */
export const menuSchema = z.object({
  categories: z.array(menuCategorySchema),
  items: z.array(menuItemSchema),
  modifierGroups: z.array(modifierGroupSchema),
});
                                              

/** How many categories can be added in one go (the "Add another" boxes in the Add category window). */
export const MAX_CATEGORIES_AT_ONCE = 50;

/** "  Idli &   Vada " → "Idli & Vada": trimmed, runs of spaces made single. One function for the form and the server. */
export function cleanCategoryName(text) {
  return String(text ?? "").trim().replace(/\s+/g, " ");
}

/** The first name that appears twice in a list (ignoring capitals and extra spaces), or null — "Dosa" and "dosa " clash. */
export function duplicateCategoryName(names) {
  const seen = new Map();
  for (const raw of names) {
    const name = cleanCategoryName(raw);
    if (!name) continue;
    if (seen.has(name.toLowerCase())) return seen.get(name.toLowerCase());
    seen.set(name.toLowerCase(), name);
  }
  return null;
}

/* ------------------------------------------------------- categories inside categories */

/** How many levels deep categories may go (South Indian → Dosa → Rava Dosa… is three). */
export const MAX_CATEGORY_DEPTH = 6;

const bySort = (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.name).localeCompare(String(b.name));

/** Index a flat category list: id → category, and parentId → its children in order. */
function indexCategories(categories) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const kids = new Map();
  for (const c of categories) {
    // a parent that no longer exists (deleted elsewhere) makes the category top-level rather than invisible
    const parent = c.parentId && byId.has(c.parentId) && c.parentId !== c.id ? c.parentId : null;
    if (!kids.has(parent)) kids.set(parent, []);
    kids.get(parent).push(c);
  }
  for (const list of kids.values()) list.sort(bySort);
  return { byId, kids };
}

/**
 * The whole category list as one depth-first list, parents before their children, each with how deep it is and the
 * names above it — what a picker, the editor's tree or the storefront needs. Cycles (which the API refuses to
 * create) can't loop forever: each category is visited once.
 * @returns {{ category: any, depth: number, trail: string[], parentId: string|null, hasChildren: boolean }[]}
 */
export function flattenCategories(categories) {
  const { kids } = indexCategories(categories);
  const out = [];
  const seen = new Set();
  const walk = (parentId, depth, trail) => {
    for (const c of kids.get(parentId) ?? []) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push({ category: c, depth, trail, parentId, hasChildren: (kids.get(c.id) ?? []).length > 0 });
      walk(c.id, depth + 1, [...trail, c.name]);
    }
  };
  walk(null, 0, []);
  return out;
}

/** The category and everything inside it, as ids. */
export function categorySubtreeIds(categories, id) {
  const { kids } = indexCategories(categories);
  const out = [];
  const seen = new Set();
  const walk = (cid) => {
    if (seen.has(cid)) return;
    seen.add(cid);
    out.push(cid);
    for (const c of kids.get(cid) ?? []) walk(c.id);
  };
  walk(id);
  return out;
}

/** How many levels a category sits at (1 = top-level). */
export function categoryLevel(categories, id) {
  const { byId } = indexCategories(categories);
  let level = 0;
  for (let c = byId.get(id), guard = 0; c && guard < 50; c = c.parentId ? byId.get(c.parentId) : null, guard += 1) level += 1;
  return level;
}

/** How many levels the category and everything below it take up (a lone category = 1). */
export function categoryHeight(categories, id) {
  const { kids } = indexCategories(categories);
  const walk = (cid, seen) => (seen.has(cid) ? 0 : 1 + Math.max(0, ...(kids.get(cid) ?? []).map((c) => walk(c.id, new Set([...seen, cid])))));
  return walk(id, new Set());
}

/** "South Indian › Dosa" — the names from the top down. */
export function categoryPathLabel(categories, id) {
  const { byId } = indexCategories(categories);
  const names = [];
  for (let c = byId.get(id), guard = 0; c && guard < 50; c = c.parentId ? byId.get(c.parentId) : null, guard += 1) names.unshift(c.name);
  return names.join(" › ");
}

/**
 * A category is shown to diners only if it AND every category above it are switched on — turning "South Indian" off
 * hides Dosa and Idli & Vada with it.
 * @returns {Set<string>} the ids that are effectively active
 */
export function activeCategoryIds(categories) {
  const { byId } = indexCategories(categories);
  const ok = new Set();
  for (const c of categories) {
    let on = true;
    for (let cur = c, guard = 0; cur; cur = cur.parentId ? byId.get(cur.parentId) : null, guard += 1) {
      if (!cur.isActive || guard > 50) { on = false; break; }
    }
    if (on) ok.add(c.id);
  }
  return ok;
}

/**
 * Where a category ends up when it is dragged: inside `parentId` (null = the top level), just before `beforeId`
 * (null = at the end of that level). ONE function for the server (which applies it) and the editor (which shows it
 * the instant you let go), so the two can never disagree about the result. A move that is not allowed — into itself
 * or its own branch, somewhere that would go too deep, before something that isn't on that level — says why.
 * @returns {{ ok: true, changes: { id: string, parentId?: string | null, sortOrder: number }[] } | { ok: false, reason: string }}
 */
export function planCategoryMove(categories, id, parentId = null, beforeId = null) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const moving = byId.get(id);
  if (!moving) return { ok: false, reason: "Category not found" };
  const parent = parentId ?? null;
  if (parent) {
    if (!byId.has(parent)) return { ok: false, reason: "That parent category doesn't exist" };
    if (categorySubtreeIds(categories, id).includes(parent)) return { ok: false, reason: "A category can't be moved inside itself or inside one of its own sub-categories." };
    if (categoryLevel(categories, parent) + categoryHeight(categories, id) > MAX_CATEGORY_DEPTH) {
      return { ok: false, reason: `Categories can go ${MAX_CATEGORY_DEPTH} levels deep at most — that move would go deeper.` };
    }
  }
  const levelOf = (c) => (c.parentId && byId.has(c.parentId) ? c.parentId : null);
  const siblings = categories.filter((c) => levelOf(c) === parent && c.id !== id).sort(bySort);
  let at = siblings.length;
  if (beforeId) {
    const i = siblings.findIndex((c) => c.id === beforeId);
    if (i < 0) return { ok: false, reason: "It can't be placed there." };
    at = i;
  }
  const order = [...siblings.slice(0, at), moving, ...siblings.slice(at)];
  const changes = [];
  order.forEach((c, index) => {
    const reparented = c.id === id && levelOf(moving) !== parent;
    if ((c.sortOrder ?? 0) !== index || reparented) changes.push({ id: c.id, ...(c.id === id ? { parentId: parent } : {}), sortOrder: index });
  });
  return { ok: true, changes };
}

/**
 * What a modifier group asks of the diner, in words — "Required · choose 1",
 * "Choose up to 2". `null` when the group is a free-for-all.
 */
export function modifierRuleText(group) {
  const min = group.required ? Math.max(1, group.minSelect) : group.minSelect;
  const max = group.maxSelect;
  if (min > 0 && min === max) return `Required · choose ${min}`;
  if (min > 0) return `Choose ${min}–${max}`;
  if (max < group.options.length) return `Choose up to ${max}`;
  return null;
}

/**
 * Check a selection of modifier options against each group's rules. Returns
 * one message per group that isn't satisfied (empty when it's fine to add).
 * `groups` are the groups attached to the item; `selected` is option ids.
 */
export function modifierSelectionErrors(groups, selected) {
  const errors = [];
  for (const g of groups) {
    const count = g.options.filter((o) => selected.includes(o.id)).length;
    const min = g.required ? Math.max(1, g.minSelect) : g.minSelect;
    if (count < min) errors.push(`${g.name}: choose ${min === 1 ? "one" : `at least ${min}`}`);
    else if (count > g.maxSelect) errors.push(`${g.name}: choose at most ${g.maxSelect}`);
  }
  return errors;
}

/** Lowest applicable price for an item, in paise. */
export function itemFromPrice(item                                          )         {
  if (item.variants.length === 0) return item.basePrice;
  return Math.min(...item.variants.map((v) => v.price));
}

/** Display string: a single price or a range. */
export function itemPriceLabel(item                                          )         {
  if (item.variants.length === 0) return formatINR(item.basePrice);
  const prices = item.variants.map((v) => v.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatINR(min) : `${formatINR(min)} – ${formatINR(max)}`;
}
