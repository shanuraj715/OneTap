import { z } from "zod";
import { activeCategoryIds, categorySubtreeIds, flattenCategories } from "./menu.js";

/**
 * How the storefront menu is arranged.
 *
 * `auto` mirrors the old behaviour: every active category, in its sort order,
 * every available item, one card style throughout.
 *
 * `custom` hands the whole thing to the owner — which sections appear, their
 * order, their titles, which items each one shows, a card style per section,
 * how the items are sorted, and how many show before a "View all" button, so a
 * "Chef's picks" strip of big photo cards can sit above a plain list of the
 * full menu without that list running for three screens.
 */
export const MENU_LAYOUT_MODES = ["auto", "custom"];
export const menuLayoutModeSchema = z.enum(MENU_LAYOUT_MODES);
/** @typedef {(typeof MENU_LAYOUT_MODES)[number]} MenuLayoutMode */

export const MENU_SECTION_SOURCES = ["category", "picks", "all"];
export const menuSectionSourceSchema = z.enum(MENU_SECTION_SOURCES);
/** @typedef {(typeof MENU_SECTION_SOURCES)[number]} MenuSectionSource */

export const MENU_SECTION_SOURCE_LABELS = {
  category: "One category",
  picks: "Hand-picked items",
  all: "Everything else",
};

/**
 * How a section fills itself with items:
 *  - `auto`   — every item its source offers (a category's items, or the
 *               menu's leftovers), kept in sync as the menu changes
 *  - `manual` — only the items the owner ticked, in the order they ticked them
 *
 * `manual` works on top of any source: a "category" section in manual mode is
 * "these three items from Steamed Momos", not the whole category. The old
 * `source: "picks"` is just `source: "all"` + `manual` and is still accepted.
 */
export const MENU_ITEM_SELECTIONS = ["auto", "manual"];
export const menuItemSelectionSchema = z.enum(MENU_ITEM_SELECTIONS);
/** @typedef {(typeof MENU_ITEM_SELECTIONS)[number]} MenuItemSelection */

export const MENU_SECTION_SORTS = ["default", "price-asc", "price-desc", "name-asc"];
export const menuSectionSortSchema = z.enum(MENU_SECTION_SORTS);
/** @typedef {(typeof MENU_SECTION_SORTS)[number]} MenuSectionSort */

export const MENU_SECTION_SORT_LABELS = {
  default: "Menu order",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  "name-asc": "Name: A–Z",
};

export const MENU_TITLE_ALIGNS = ["left", "center"];
export const menuTitleAlignSchema = z.enum(MENU_TITLE_ALIGNS);
/** @typedef {(typeof MENU_TITLE_ALIGNS)[number]} MenuTitleAlign */

export const MENU_VIEW_ALL_PLACEMENTS = ["left", "center", "right", "title-right"];
export const menuViewAllPlacementSchema = z.enum(MENU_VIEW_ALL_PLACEMENTS);
/** @typedef {(typeof MENU_VIEW_ALL_PLACEMENTS)[number]} MenuViewAllPlacement */

export const MENU_VIEW_ALL_PLACEMENT_LABELS = {
  left: "Bottom — Left",
  center: "Bottom — Centered",
  right: "Bottom — Right",
  "title-right": "Right side of category title",
};

export const menuSectionSchema = z.object({
  id: z.string(),
  title: z.string().max(60).default(""),
  subtitle: z.string().max(120).default(""),
  source: menuSectionSourceSchema.default("category"),
  /** for source "category" */
  categoryId: z.string().default(""),
  /** for source "category": also show the dishes of the categories inside it (South Indian → Dosa, Idli & Vada) */
  includeSubcategories: z.boolean().default(true),
  /** how the section is filled — see {@link MENU_ITEM_SELECTIONS} */
  itemSelection: menuItemSelectionSchema.default("auto"),
  /** the hand-picked item ids, in display order — used when itemSelection is "manual" (or source is "picks") */
  itemIds: z.array(z.string()).default([]),
  /** item card variant id from the registry, e.g. "card.image-top" */
  cardVariant: z.string().default("card.row-compact"),
  /** the picture shape this section's cards ask each dish for ("" = the card style's own, or the default's override) */
  imageRatio: z.enum(["", "1:1", "4:3", "16:9", "3:4"]).default(""),
  /**
   * How many cards sit side by side on a wide screen. 0 = automatic — the
   * card variant picks its own natural width and the row fills with however
   * many fit (see each variant's `defaultColumns`/`minWidth` in the
   * registry). A screen too narrow for the chosen count always collapses
   * toward 1 column, whatever this is set to — this only sets the desktop
   * target, never a fixed layout that could clip on a phone.
   */
  columns: z.number().int().min(0).max(6).default(0),
  /** order items within the section */
  sortBy: menuSectionSortSchema.default("default"),
  /** hard cap on how many items the section ever contains (0 = no cap) */
  maxItems: z.number().int().min(0).max(200).default(0),
  /** show only the first few items, and a "View all" button that reveals the rest inline */
  collapsible: z.boolean().default(false),
  /** how many items are visible before the "View all" button (only when collapsible) */
  initialItems: z.number().int().min(1).max(200).default(6),
  /** the "View all" button text — customisable per section */
  viewAllLabel: z.string().max(40).default("View all"),
  /** the button text once expanded */
  showLessLabel: z.string().max(40).default("Show less"),
  /** placement of the "View all" button: bottom left, centered, right, or beside category title */
  viewAllPlacement: menuViewAllPlacementSchema.default("left"),
  /** hide sold-out items in this section instead of showing them greyed */
  hideUnavailable: z.boolean().default(false),
  /** drop the section heading entirely — for a bare strip that needs no label */
  hideTitle: z.boolean().default(false),
  /** heading alignment */
  titleAlign: menuTitleAlignSchema.default("left"),
  /** show the item count next to the heading, e.g. "Steamed Momos (8)" */
  showItemCount: z.boolean().default(false),
  visible: z.boolean().default(true),
});
/** @typedef {z.infer<typeof menuSectionSchema>} MenuSection */

export const menuLayoutSchema = z.object({
  mode: menuLayoutModeSchema.default("auto"),
  /** the card style used in "auto" mode and as the default for new sections */
  defaultCardVariant: z.string().default("card.row-compact"),
  /** the picture shape the default card style is overridden to ("" = the card's own) */
  defaultImageRatio: z.enum(["", "1:1", "4:3", "16:9", "3:4"]).default(""),
  sections: z.array(menuSectionSchema).default([]),
  /** show the little veg/non-veg filter above the menu */
  showFoodTypeFilter: z.boolean().default(true),
  /** show a category quick-jump bar */
  showCategoryNav: z.boolean().default(true),
});
/** @typedef {z.infer<typeof menuLayoutSchema>} MenuLayout */

/* --------------------------------------------------------------- resolution */

/**
 * @typedef {Object} ResolvedSection
 * @property {string} id
 * @property {string} title
 * @property {string} subtitle
 * @property {string} cardVariant
 * @property {string} imageRatio "" = the card's own picture shape, else the shape the store chose for it
 * @property {number} columns 0 = automatic, else the desktop column count
 * @property {import("./menu.js").MenuItem[]} items every item in the section, in display order
 * @property {boolean} hideTitle
 * @property {MenuTitleAlign} titleAlign
 * @property {boolean} showItemCount
 * @property {boolean} collapsible whether the storefront should show `initialItems` and a "View all" button
 * @property {number} initialItems
 * @property {string} viewAllLabel
 * @property {string} showLessLabel
 * @property {MenuViewAllPlacement} viewAllPlacement
 */

const bySortOrder = (a, b) => a.sortOrder - b.sortOrder;

/**
 * Dishes that can't be ordered right now (sold out, out of stock, outside their hours) go to the END of their section, so a
 * category of 15 with one sold-out dish shows the 14 orderable ones first and that one 15th. Everything else keeps its
 * order (a stable split, not a re-sort), so menu order, hand-picked order and price/name sorting all still hold among
 * the dishes on each side.
 */
export function soldOutLast(items) {
  if (!items.some((i) => i.isAvailable === false)) return items;
  return [...items.filter((i) => i.isAvailable !== false), ...items.filter((i) => i.isAvailable === false)];
}

/** The section a category becomes. `extra` carries where it sits in the tree. */
function sectionFor(cat, items, layout, extra = {}) {
  return {
    id: cat.id,
    title: cat.name,
    subtitle: "",
    cardVariant: layout.defaultCardVariant,
    imageRatio: layout.defaultImageRatio ?? "",
    columns: 0,
    items,
    hideTitle: false,
    titleAlign: "left",
    showItemCount: false,
    collapsible: false,
    initialItems: 6,
    viewAllLabel: "View all",
    showLessLabel: "Show less",
    viewAllPlacement: "left",
    // where it sits: 0 = top level; the names above it; the top-level category it belongs to; its picture
    depth: 0,
    trail: [],
    rootId: cat.id,
    imageUrl: cat.image?.url ?? "",
    headingOnly: false,
    ...extra,
  };
}

/**
 * Every active category as its own section, in tree order — the "automatic" arrangement. A category inside another
 * becomes a section under its parent's heading ("South Indian" → "Dosa" → "Rava Dosa"). A parent with no dishes of
 * its own still gets a heading (`headingOnly`) when something inside it has dishes; one with nothing at all below it
 * is left out. A category that is switched off hides everything inside it.
 */
function autoSections(menu, layout) {
  const active = activeCategoryIds(menu.categories);
  const itemsOf = (id) => soldOutLast(menu.items.filter((i) => i.categoryId === id).sort(bySortOrder));
  const hasDishes = (id) => categorySubtreeIds(menu.categories, id).some((cid) => active.has(cid) && menu.items.some((i) => i.categoryId === cid));
  const rootOf = new Map();

  const out = [];
  for (const entry of flattenCategories(menu.categories)) {
    const cat = entry.category;
    if (!active.has(cat.id)) continue;
    const rootId = entry.parentId ? rootOf.get(entry.parentId) ?? cat.id : cat.id;
    rootOf.set(cat.id, rootId);
    const items = itemsOf(cat.id);
    if (items.length === 0 && !hasDishes(cat.id)) continue;
    out.push(sectionFor(cat, items, layout, { depth: entry.depth, trail: entry.trail, rootId, headingOnly: items.length === 0 }));
  }
  return out;
}

/**
 * After a filter (veg only…) has emptied some sections: keep a parent's heading only while something below it is
 * still shown, and drop sections with nothing left.
 */
export function pruneEmptySections(sections) {
  return sections.filter((s, i) => {
    if (!s.headingOnly) return s.items.length > 0;
    for (let j = i + 1; j < sections.length && (sections[j].depth ?? 0) > (s.depth ?? 0); j += 1) {
      if (!sections[j].headingOnly && sections[j].items.length > 0) return true;
    }
    return false;
  });
}

/** Lowest price for an item, for the price-sort options. */
function itemSortPrice(item) {
  if (item.variants && item.variants.length > 0) return Math.min(...item.variants.map((v) => v.price));
  return item.basePrice;
}

/** Apply a section's `sortBy`. `default` keeps whatever order the pool arrived in. */
function applySort(items, sortBy) {
  const out = [...items];
  if (sortBy === "price-asc") out.sort((a, b) => itemSortPrice(a) - itemSortPrice(b));
  else if (sortBy === "price-desc") out.sort((a, b) => itemSortPrice(b) - itemSortPrice(a));
  else if (sortBy === "name-asc") out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/**
 * Turn a layout + the live menu into the ordered list of sections the
 * storefront renders. One function, used by the storefront and by the admin
 * preview, so what the owner arranges is exactly what a diner sees.
 *
 * `maxItems` is a hard cap (items past it are dropped). `collapsible` is not a
 * cap — every item stays in the section; the renderer just hides the tail
 * behind a "View all" button until the diner asks for it.
 *
 * @param {import("./menu.js").Menu} menu
 * @param {MenuLayout} layout
 * @returns {ResolvedSection[]}
 */
export function resolveMenuSections(menu, layout) {
  const activeIds = activeCategoryIds(menu.categories);
  // active categories in tree order (a parent before the categories inside it)
  const activeCategories = flattenCategories(menu.categories).map((e) => e.category).filter((c) => activeIds.has(c.id));

  if (layout.mode === "auto" || layout.sections.length === 0) {
    return autoSections(menu, layout);
  }

  // Track which items a custom "all" section still needs to sweep up.
  const claimed = new Set();
  const itemsById = new Map(menu.items.map((i) => [i.id, i]));

  const resolved = [];

  for (const section of layout.sections) {
    if (!section.visible) continue;

    // A "picks" section is manual by definition; otherwise honour itemSelection.
    const manual = section.source === "picks" || section.itemSelection === "manual";

    let items = [];
    if (manual) {
      items = section.itemIds.map((id) => itemsById.get(id)).filter((i) => Boolean(i));
    } else if (section.source === "category") {
      const cat = menu.categories.find((c) => c.id === section.categoryId);
      if (!cat) continue;
      // the category itself, then (unless switched off for this section) the categories inside it, in tree order
      const inside = section.includeSubcategories === false ? [cat.id] : categorySubtreeIds(menu.categories, cat.id).filter((id) => activeIds.has(id) || id === cat.id);
      const order = new Map(flattenCategories(menu.categories).map((e, n) => [e.category.id, n]));
      items = inside
        .slice()
        .sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
        .flatMap((id) => menu.items.filter((i) => i.categoryId === id).sort(bySortOrder));
    } else {
      // "all": whatever hasn't been shown by an earlier section yet
      items = activeCategories.flatMap((cat) =>
        menu.items.filter((i) => i.categoryId === cat.id && !claimed.has(i.id)).sort(bySortOrder),
      );
    }

    if (section.hideUnavailable) items = items.filter((i) => i.isAvailable);
    // "default" keeps the pool order (menu order, or the hand-picked order).
    if (section.sortBy && section.sortBy !== "default") items = applySort(items, section.sortBy);
    items = soldOutLast(items);
    if (section.maxItems > 0) items = items.slice(0, section.maxItems);
    if (items.length === 0) continue;

    for (const it of items) claimed.add(it.id);

    resolved.push({
      id: section.id,
      title: section.title || sectionFallbackTitle(section, menu),
      subtitle: section.subtitle,
      cardVariant: section.cardVariant || layout.defaultCardVariant,
      // the store's picture-shape override belongs to the store's chosen card style only
      imageRatio: section.imageRatio || ((section.cardVariant || layout.defaultCardVariant) === layout.defaultCardVariant ? (layout.defaultImageRatio ?? "") : ""),
      columns: section.columns,
      items,
      hideTitle: section.hideTitle,
      titleAlign: section.titleAlign,
      showItemCount: section.showItemCount,
      collapsible: section.collapsible && items.length > section.initialItems,
      initialItems: section.initialItems,
      viewAllLabel: section.viewAllLabel || "View all",
      showLessLabel: section.showLessLabel || "Show less",
      viewAllPlacement: section.viewAllPlacement || "left",
      // a hand-arranged section is one flat block; only its category's picture carries over
      depth: 0,
      trail: [],
      rootId: section.id,
      imageUrl: section.source === "category" ? menu.categories.find((c) => c.id === section.categoryId)?.image?.url ?? "" : "",
      headingOnly: false,
    });
  }

  // A custom layout whose sections all resolve to nothing (e.g. the only
  // section points at a category that was deleted, or was never chosen) must
  // not blank the whole menu — fall back to showing every category.
  if (resolved.length === 0) return autoSections(menu, layout);

  return resolved;
}

function sectionFallbackTitle(section, menu) {
  if (section.source === "category") {
    return menu.categories.find((c) => c.id === section.categoryId)?.name ?? "Menu";
  }
  if (section.source === "picks") return "Featured";
  return "More on the menu";
}

/**
 * The menu layout the storefront draws: while the menu layout hasn't been touched (auto, no sections) the card style chosen in
 * Appearance is used, and the picture shape chosen there for it travels along (only for that style).
 */
export function storefrontMenuLayout(menuLayout, layout) {
  const untouched = menuLayout.mode === "auto" && (menuLayout.sections ?? []).length === 0;
  const base = untouched ? { ...menuLayout, defaultCardVariant: menuLayout.defaultCardVariant || layout.itemCardVariant } : menuLayout;
  // the Menu layout page's own default shape wins; else the one chosen in Appearance, for the card style it was chosen for
  const ratio = base.defaultImageRatio || (base.defaultCardVariant === layout.itemCardVariant ? (layout.itemImageRatio ?? "") : "");
  return ratio === (base.defaultImageRatio ?? "") ? base : { ...base, defaultImageRatio: ratio };
}

/** A blank section for the admin's "add section" button. */
export function emptySection(defaultCardVariant) {
  return menuSectionSchema.parse({
    id: `sec_${Math.random().toString(36).slice(2, 10)}`,
    source: "category",
    cardVariant: defaultCardVariant,
  });
}
