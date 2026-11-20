# T32 — Menu categories inside categories — depth, moving, pictures, ordering, bulk delete of categories and items, import, and how the storefront builds its sections

**Area:** menu · **Last result:** ✅ PASSED (93 passed, 0 failed · 2026-11-20 06:00 · headless · 3.2 s)

**Run it alone:** `node run.mjs --only t32` (add `--visible` to watch it)

## What this test does

Runs suites/menu-tree.mjs: its own in-memory API with two outlets. Categories can sit inside categories to six levels (South Indian → Dosa → Rava Dosa); a missing parent, a move inside its own branch or inside itself, and anything deeper than the limit are refused; moving a category moves its dishes with it; a category can have a picture (set on create or edit, removed again). The shared section builder the storefront uses puts sections in tree order, gives a parent with no dishes of its own a heading, hides everything inside a switched-off category, leaves out empty branches, prunes headings after a food filter, and lets a hand-made section include what is inside a category. A level can be put in a new order (not across levels). Several categories can be deleted at once together with everything inside them: refused with the counts if dishes are inside unless told to delete them; kitchen can't; unknown ids change nothing. Several items can be deleted at once; one from another outlet can't be reached. Importing a menu from another outlet keeps the tree and pictures and never merges two categories of the same name under different parents.

## Steps

1. categories inside categories
2. dishes in parents and in children
3. moving a category
4. a picture for a category
5. the storefront's sections (the shared builder)
6. reordering
7. 6b. drag and drop: moving a category to a place in the tree
8. 6c. several categories at once, each with its own name and picture
9. deleting several categories at once
10. deleting several items at once
11. importing a menu from another outlet keeps the tree and the pictures

## What to expect (these must happen)

- Categories nest up to the depth limit; a parent that doesn't exist, moving into one's own branch, into itself, or beyond the limit are 400s.
- Moving a category carries its dishes; pictures can be set, replaced and removed.
- The storefront's sections come out in tree order with parents' headings, pictures and trails; a switched-off parent hides what is inside it; empty branches are dropped.
- Reordering works within one level only.
- Bulk category delete removes the whole branches; with dishes inside it is refused (409 with counts) unless 'delete the items too' is sent; roles without menu rights can't.
- Bulk item delete removes exactly those items, all or nothing, only in this outlet.
- Import keeps parents and pictures and matches categories by their place in the tree.

## What must NOT happen

- A category must NOT be movable inside itself or its own sub-categories, or deeper than the limit.
- Dishes must NOT be deleted by a category delete unless the caller says so.
- A bulk delete must NOT remove anything when one of the ids is unknown.
- Another outlet's dishes must NOT be deletable through this outlet.
- Import must NOT merge two same-named categories that sit under different parents.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (93)

**Step 1 — categories inside categories**

- a category can be put inside another, as deep as it likes (South Indian → Dosa → Rava Dosa)
- …and its full name reads South Indian › Dosa › Rava Dosa
- every category carries a picture field (empty until one is added)
- a parent that doesn't exist is refused — _400 That parent category doesn't exist_
- new categories go to the end of their own level (Dosa 0, Idli & Vada 1) — _0,1_
- 6 levels deep works — _201_
- one level deeper than 6 is refused — _400 Categories can go 6 levels deep at most._

**Step 2 — dishes in parents and in children**

- a parent category can hold dishes of its own
- (a category can still be edited as before)

**Step 3 — moving a category**

- a category can't be moved inside one of its own sub-categories — _400 A category can't be moved inside itself or inside one of its own sub-categories._
- …nor inside itself — _400_
- …nor inside a category that doesn't exist
- a move that would make the branch too deep is refused — _400 Categories can go 6 levels deep at most — that move would go deeper._
- moving a category moves it WITH its dishes — _200_
- …and back to the top level
- (put back inside South Indian)
- a deep category can be lifted one level — _200_

**Step 4 — a picture for a category**

- a category can have a picture
- the public menu carries it
- renaming keeps the picture
- a picture can be set when the category is created
- …and removed again
- (nothing left behind in the database)
- an empty picture address is not a picture

**Step 5 — the storefront's sections (the shared builder)**

- in tree order: South Indian (with its own dishes), then Dosa → Rava Dosa, then Idli & Vada, then Starters — _South Indian \|   Dosa \|     Rava Dosa \|   Idli & Vada \| Starters_
- a parent that has dishes shows them under its own heading
- a section knows its picture and the names above it
- …and which top-level category it belongs to (for the chips)
- a parent with no dishes of its own still gets a heading, because dishes sit inside it
- switching a category off hides it AND everything inside it — _Starters_
- a category with no dishes anywhere inside it is left out
- a filter that empties a section drops it, but keeps the headings above sections that remain
- a hand-made section for a parent includes the dishes of the categories inside it — _Masala Dosa,Paneer Dosa,Rava Masala,Plain Idli_
- …unless that is switched off for the section
- existing sections default to including what's inside (nothing changes for menus with no nesting)

**Step 6 — reordering**

- a level can be put in a new order — _204_
- …and the tree (and the storefront) follow it — _South Indian › Idli & Vada › Dosa › Rava Dosa › Starters_
- categories from different levels can't be ordered together — _400_
- an unknown category is a 404 — _404_

**Step 7 — 6b. drag and drop: moving a category to a place in the tree**

- (three top-level categories, in order)
- dropping a category on the top edge of another puts it just before it — _200 DnD C,DnD A,DnD B_
- …and dropping it on the strip below the tree puts it last
- dropping B between A1 and A2 puts it inside A, between them — _DnD A1,DnD B,DnD A2 \| DnD A,DnD C_
- the level it joined is renumbered 0, 1, 2
- dropping a category into its own branch is refused — _400 A category can't be moved inside itself or inside one of its own sub-categories._
- 'before' something that isn't on that level is refused — _400 It can't be placed there._
- an unknown category is a 404
- an unknown parent is a 400
- dropping a category where it already is leaves the order exactly as it was — _200 DnD A,DnD C → DnD A,DnD C_
- a sub-category dragged out becomes top-level and the level it left closes up — _DnD A,DnD C,DnD A1 \| DnD B,DnD A2_
- the kitchen can't move categories — _403_
- a category of ANOTHER outlet can't be moved through this one
- a drop that would make the branch too deep is refused — _400 Categories can go 6 levels deep at most — that move would go deeper._
- the public menu shows the new place straight away

**Step 8 — 6c. several categories at once, each with its own name and picture**

- three categories are made in one request (201)
- they are in the order given, with the spaces tidied — _Bulk Dosa\|Bulk Idli & Vada\|Bulk Uttapam_
- all sit inside the parent, numbered 0, 1, 2
- each keeps ITS OWN picture — the first and third have one, the second has none — _[true,false,true]_
- more can be added later: they go to the end of the level and can be created switched off — _0,1,2,3_
- without a parent they are top-level
- the same name twice (any capitals) is refused and NOTHING is created — _400 “Bulk Same” is in the list twice._
- a box with no name is refused and NOTHING is created (the good one isn't left behind) — _400 Every category needs a name._
- an empty list is a 400
- more than 50 at a time is refused — _400 Add 50 categories or fewer at a time._
- an unknown parent is a 400 — _400 That parent category doesn't exist_
- inside a category that is already at the deepest level is refused — _400 Categories can go 6 levels deep at most._
- the kitchen can't add categories
- someone not signed in can't either
- a parent of ANOTHER outlet is not found through this one — _400 That parent category doesn't exist_
- the shared name helpers agree (spaces tidied; a repeat is found and reported with its first spelling)
- (the comma splitter is gone — names come from separate boxes)

**Step 9 — deleting several categories at once**

- the kitchen can't delete categories — _403_
- nobody signed in can't either — _401_
- an empty list is a 400
- an unknown category is a 404 and nothing is deleted
- categories that hold dishes are refused — with how many dishes and categories it would take — _409 {"code":"category_has_items","itemCount":5,"categoryCount":5}_
- …and nothing was removed
- an empty category goes together with the empty categories inside it — _{"deletedCategories":2,"deletedItems":0}_
- two categories chosen: both go, with every category inside them and all their dishes — _{"deletedCategories":5,"deletedItems":5}_
- …none of them is left
- …and unrelated categories are untouched
- deleting one category that holds dishes is still refused — _409_
- …and an empty one still deletes with 204

**Step 10 — deleting several items at once**

- the kitchen can't delete items — _403_
- if one of them isn't an item, nothing is deleted — _404_
- an item of ANOTHER outlet can't be deleted through this one — _404_
- three of four are deleted in one go; the fourth stays — _{"deletedItems":3}_
- an empty list is a 400

**Step 11 — importing a menu from another outlet keeps the tree and the pictures**

- imported categories keep their parents (North Indian › Curries, South Indian › Dosa)
- two categories both called 'Dosa' under different parents stay two categories (not merged by name)
- a category's picture comes across too
- each dish lands in the right one — _North Indian › Curries_
- importing again doesn't duplicate categories (matched by place in the tree) — _39 vs 39_

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-20 06:00 | pass | 93 | 0 | headless | 3.2 s |
| 2026-11-20 04:57 | pass | 93 | 0 | headless | 3.4 s |
| 2026-11-20 00:24 | pass | 91 | 0 | headless | 3.2 s |
| 2026-11-19 19:29 | pass | 93 | 0 | headless | 3.9 s |
| 2026-11-19 17:50 | pass | 93 | 0 | headless | 3.4 s |
| 2026-11-19 17:44 | pass | 93 | 0 | headless | 3.3 s |
| 2026-11-19 15:51 | pass | 91 | 0 | headless | 3.1 s |
| 2026-11-19 13:35 | pass | 91 | 0 | headless | 4.0 s |
| 2026-11-19 13:27 | pass | 76 | 0 | headless | 3.8 s |
| 2026-11-19 13:07 | pass | 61 | 0 | headless | 3.6 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t32-menu-tree-api.mjs`), not this page._
