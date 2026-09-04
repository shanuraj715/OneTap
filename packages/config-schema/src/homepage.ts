import { z } from "zod";
import type { Menu, MenuItem } from "./menu";

/**
 * How the storefront menu is arranged.
 *
 * `auto` mirrors the old behaviour: every active category, in its sort order,
 * every available item, one card style throughout.
 *
 * `custom` hands the whole thing to the owner — which sections appear, their
 * order, their titles, which items each one shows, and a card style per
 * section, so a "Chef's picks" strip of big photo cards can sit above a plain
 * list of the full menu.
 */
export const MENU_LAYOUT_MODES = ["auto", "custom"] as const;
export const menuLayoutModeSchema = z.enum(MENU_LAYOUT_MODES);
export type MenuLayoutMode = (typeof MENU_LAYOUT_MODES)[number];

export const MENU_SECTION_SOURCES = ["category", "picks", "all"] as const;
export const menuSectionSourceSchema = z.enum(MENU_SECTION_SOURCES);
export type MenuSectionSource = (typeof MENU_SECTION_SOURCES)[number];

export const MENU_SECTION_SOURCE_LABELS: Record<MenuSectionSource, string> = {
  category: "One category",
  picks: "Hand-picked items",
  all: "Everything else",
};

export const menuSectionSchema = z.object({
  id: z.string(),
  title: z.string().max(60).default(""),
  subtitle: z.string().max(120).default(""),
  source: menuSectionSourceSchema.default("category"),
  /** for source "category" */
  categoryId: z.string().default(""),
  /** for source "picks" — explicit item ids, in the order they're listed */
  itemIds: z.array(z.string()).default([]),
  /** item card variant id from the registry, e.g. "card.image-top" */
  cardVariant: z.string().default("card.row-compact"),
  /** cap the number of items shown (0 = no cap) */
  maxItems: z.number().int().min(0).max(200).default(0),
  /** hide sold-out items in this section instead of showing them greyed */
  hideUnavailable: z.boolean().default(false),
  visible: z.boolean().default(true),
});
export type MenuSection = z.infer<typeof menuSectionSchema>;

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
export type MenuLayout = z.infer<typeof menuLayoutSchema>;

/* --------------------------------------------------------------- resolution */

export interface ResolvedSection {
  id: string;
  title: string;
  subtitle: string;
  cardVariant: string;
  items: MenuItem[];
}

const bySortOrder = (a: MenuItem, b: MenuItem): number => a.sortOrder - b.sortOrder;

/**
 * Turn a layout + the live menu into the ordered list of sections the
 * storefront renders. One function, used by the storefront and by the admin
 * preview, so what the owner arranges is exactly what a diner sees.
 */
export function resolveMenuSections(menu: Menu, layout: MenuLayout): ResolvedSection[] {
  const activeCategories = [...menu.categories]
    .filter((c) => c.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (layout.mode === "auto" || layout.sections.length === 0) {
    return activeCategories
      .map((cat) => ({
        id: cat.id,
        title: cat.name,
        subtitle: "",
        cardVariant: layout.defaultCardVariant,
        items: menu.items.filter((i) => i.categoryId === cat.id).sort(bySortOrder),
      }))
      .filter((s) => s.items.length > 0);
  }

  // Track which items a custom "all" section still needs to sweep up.
  const claimed = new Set<string>();
  const itemsById = new Map(menu.items.map((i) => [i.id, i]));

  const resolved: ResolvedSection[] = [];

  for (const section of layout.sections) {
    if (!section.visible) continue;

    let items: MenuItem[] = [];

    if (section.source === "category") {
      const cat = menu.categories.find((c) => c.id === section.categoryId);
      if (!cat) continue;
      items = menu.items.filter((i) => i.categoryId === cat.id).sort(bySortOrder);
    } else if (section.source === "picks") {
      items = section.itemIds
        .map((id) => itemsById.get(id))
        .filter((i): i is MenuItem => Boolean(i));
    } else {
      // "all": whatever hasn't been shown by an earlier section yet
      items = activeCategories.flatMap((cat) =>
        menu.items.filter((i) => i.categoryId === cat.id && !claimed.has(i.id)).sort(bySortOrder),
      );
    }

    if (section.hideUnavailable) items = items.filter((i) => i.isAvailable);
    if (section.maxItems > 0) items = items.slice(0, section.maxItems);
    if (items.length === 0) continue;

    for (const it of items) claimed.add(it.id);

    resolved.push({
      id: section.id,
      title: section.title || sectionFallbackTitle(section, menu),
      subtitle: section.subtitle,
      cardVariant: section.cardVariant || layout.defaultCardVariant,
      items,
    });
  }

  return resolved;
}

function sectionFallbackTitle(section: MenuSection, menu: Menu): string {
  if (section.source === "category") {
    return menu.categories.find((c) => c.id === section.categoryId)?.name ?? "Menu";
  }
  if (section.source === "picks") return "Featured";
  return "More on the menu";
}

/** A blank section for the admin's "add section" button. */
export function emptySection(defaultCardVariant: string): MenuSection {
  return menuSectionSchema.parse({
    id: `sec_${Math.random().toString(36).slice(2, 10)}`,
    source: "category",
    cardVariant: defaultCardVariant,
  });
}
