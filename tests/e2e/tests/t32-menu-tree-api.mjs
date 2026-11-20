// T32 — Categories inside categories, category pictures, and deleting several at once: the API rules (no browser).
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t32-menu-tree-api",
  title: "Menu categories inside categories — depth, moving, pictures, ordering, bulk delete of categories and items, import, and how the storefront builds its sections",
  area: "menu",
  browser: false,
  fresh: false,
  summary: "Runs suites/menu-tree.mjs: its own in-memory API with two outlets. Categories can sit inside categories to six levels (South Indian → Dosa → Rava Dosa); a missing parent, a move inside its own branch or inside itself, and anything deeper than the limit are refused; moving a category moves its dishes with it; a category can have a picture (set on create or edit, removed again). The shared section builder the storefront uses puts sections in tree order, gives a parent with no dishes of its own a heading, hides everything inside a switched-off category, leaves out empty branches, prunes headings after a food filter, and lets a hand-made section include what is inside a category. A level can be put in a new order (not across levels). Several categories can be deleted at once together with everything inside them: refused with the counts if dishes are inside unless told to delete them; kitchen can't; unknown ids change nothing. Several items can be deleted at once; one from another outlet can't be reached. Importing a menu from another outlet keeps the tree and pictures and never merges two categories of the same name under different parents.",
  expect: [
    "Categories nest up to the depth limit; a parent that doesn't exist, moving into one's own branch, into itself, or beyond the limit are 400s.",
    "Moving a category carries its dishes; pictures can be set, replaced and removed.",
    "The storefront's sections come out in tree order with parents' headings, pictures and trails; a switched-off parent hides what is inside it; empty branches are dropped.",
    "Reordering works within one level only.",
    "Bulk category delete removes the whole branches; with dishes inside it is refused (409 with counts) unless 'delete the items too' is sent; roles without menu rights can't.",
    "Bulk item delete removes exactly those items, all or nothing, only in this outlet.",
    "Import keeps parents and pictures and matches categories by their place in the tree.",
  ],
  expectNot: [
    "A category must NOT be movable inside itself or its own sub-categories, or deeper than the limit.",
    "Dishes must NOT be deleted by a category delete unless the caller says so.",
    "A bulk delete must NOT remove anything when one of the ids is unknown.",
    "Another outlet's dishes must NOT be deletable through this outlet.",
    "Import must NOT merge two same-named categories that sit under different parents.",
  ],
};

export const run = (d) => runSuite(d, "menu-tree.mjs");
