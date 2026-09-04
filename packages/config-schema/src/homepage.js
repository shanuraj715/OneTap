import { z } from "zod";

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
  /** how the section is filled — see {@link MENU_ITEM_SELECTIONS} */
  itemSelection: menuItemSelectionSchema.default("auto"),
  /** the hand-picked item ids, in display order — used when itemSelection is "manual" (or source is "picks") */
  itemIds: z.array(z.string()).default([]),
  /** item card variant id from the registry, e.g. "card.image-top" */
  cardVariant: z.string().default("card.row-compact"),
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

/** Every active category as its own section — the "automatic" arrangement. */
function autoSections(menu, layout) {
  return [...menu.categories]
    .filter((c) => c.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((cat) => ({
      id: cat.id,
      title: cat.name,
      subtitle: "",
      cardVariant: layout.defaultCardVariant,
      columns: 0,
      items: menu.items.filter((i) => i.categoryId === cat.id).sort(bySortOrder),
      hideTitle: false,
      titleAlign: "left",
      showItemCount: false,
      collapsible: false,
      initialItems: 6,
      viewAllLabel: "View all",
      showLessLabel: "Show less",
      viewAllPlacement: "left",
    }))
    .filter((s) => s.items.length > 0);
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
  const activeCategories = [...menu.categories]
    .filter((c) => c.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);

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
      items = menu.items.filter((i) => i.categoryId === cat.id).sort(bySortOrder);
    } else {
      // "all": whatever hasn't been shown by an earlier section yet
      items = activeCategories.flatMap((cat) =>
        menu.items.filter((i) => i.categoryId === cat.id && !claimed.has(i.id)).sort(bySortOrder),
      );
    }

    if (section.hideUnavailable) items = items.filter((i) => i.isAvailable);
    // "default" keeps the pool order (menu order, or the hand-picked order).
    if (section.sortBy && section.sortBy !== "default") items = applySort(items, section.sortBy);
    if (section.maxItems > 0) items = items.slice(0, section.maxItems);
    if (items.length === 0) continue;

    for (const it of items) claimed.add(it.id);

    resolved.push({
      id: section.id,
      title: section.title || sectionFallbackTitle(section, menu),
      subtitle: section.subtitle,
      cardVariant: section.cardVariant || layout.defaultCardVariant,
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

/** A blank section for the admin's "add section" button. */
export function emptySection(defaultCardVariant) {
  return menuSectionSchema.parse({
    id: `sec_${Math.random().toString(36).slice(2, 10)}`,
    source: "category",
    cardVariant: defaultCardVariant,
  });
}
