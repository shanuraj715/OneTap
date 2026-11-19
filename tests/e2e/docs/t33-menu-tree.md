# T33 — Menu — categories inside categories, category pictures, and multi-select delete for categories and items

**Area:** menu · **Last result:** ✅ PASSED (71 passed, 0 failed · 2026-11-19 22:42 · headless · 47.9 s)

**Run it alone:** `node run.mjs --only t33` (add `--visible` to watch it) · starts from fresh fake data

## What this test does

In Chrome as the owner of Acme Momos, on Menu: 'South Indian' is added as a category; from its ⋯ menu 'Add sub-category' makes Dosa and Idli & Vada inside it, and from Dosa's menu Rava Dosa inside that — the tree is indented, folds and unfolds, and Move up puts Idli & Vada above Dosa. Edit… on Dosa adds a picture (it appears on the row) and its 'Inside' list won't offer Dosa or Rava Dosa itself. Dishes are added at every level — South Indian Thali directly in South Indian, Masala Dosa and Paneer Dosa in Dosa, Plain Idli in Idli & Vada, Rava Masala in Rava Dosa (the item form has a Category picker showing the tree). Selecting South Indian lists its own dish and, with 'Also show dishes from the categories inside', the others marked 'in South Indian › Dosa'. On the storefront the menu has a 'South Indian' heading with 'Dosa' and 'Idli & Vada' under it ('Rava Dosa' under Dosa), the Dosa picture beside its heading, 'South Indian' as the chip with a second row of chips for what is inside; switching South Indian off hides all of it. Then two categories are ticked: the bulk bar says '2 selected', 'Delete selected' warns they hold dishes and stays off until 'Also delete the items' is ticked, and afterwards the categories, everything inside them and their dishes are gone from the dashboard and the storefront. Finally two dishes are ticked and deleted together. Last, 'Add several categories…' opens a window with ONE name box that grows with 'Add another category' (or Enter): each box has its own picture button — Soups and Fresh Juices get a picture, Salads none; a repeated name or a picture with no name is flagged; removing a box or Cancel throws away an unused upload; 'Add 3 categories' makes them in order at the top level, and the sub-category window does the same inside South Indian (Pongal with a picture). The category panel is wider, and the quick box adds exactly what is typed (no comma splitting).

## Steps

1. The owner makes South Indian, and categories inside it
2. The tree folds and unfolds
3. Move up puts Idli & Vada above Dosa
4. A picture for Dosa
5. Dishes at every level
6. The Add-on groups part of the page still works (it shares the page with the tree)
7. The customer's storefront shows the tree
8. Switching South Indian off hides everything inside it
9. Ticking two categories and deleting them together
10. Ticking two dishes and deleting them together
11. Dragging and dropping categories
12. Adding several categories at once — a box for each, with its own picture button
13. Several sub-categories inside one, and cancelling throws away an unsaved picture

## What to expect (these must happen)

- 'Add sub-category' puts a category inside another, as many levels as wanted; the tree is indented (levels 1, 2, 3), folds and unfolds, and Move up/Move down changes the order.
- The tree is drawn with connecting lines and a node per category (an elbow into each sub-category, a line down from each parent, a fold node on parents).
- Dragging a category: onto the middle of a row = inside it; onto a row's top/bottom edge = before/after it; onto the strip under the tree = top level; a line or outline shows where it would land; dropping into its own branch does nothing; it is saved.
- Edit… offers a picture; it shows on the category's row. The 'Inside' list disables the category itself and everything inside it.
- Dishes can be added to any level; the item form's Category picker shows the tree; a parent's list shows its own dishes and (optionally) those of the categories inside, each marked with where it is.
- Storefront: headings and sub-headings in tree order, the picture beside its heading, top-level chips with a second row for what is inside; a switched-off parent hides everything inside it.
- Ticking several categories shows 'N selected' and 'Delete selected'; categories holding dishes need 'Also delete the items' ticked; then the categories, all inside them and the dishes are gone everywhere.
- Ticking several dishes shows 'N selected' and 'Delete selected'; confirming deletes exactly those.
- The category panel is wider than before.
- Add category has one box at first; 'Add another category' (or Enter) adds more; each box has its own name and its own picture button; the button counts them ('Add 3 categories'); they are made in order, each with its own picture, at the top level or inside the chosen category; empty boxes are ignored.
- A name used twice, or a picture on a box with no name, is flagged and can't be added; removing a box (or Cancel) deletes pictures that were uploaded but not kept.

## What must NOT happen

- A category must NOT be offered as its own parent, or inside its own sub-categories, and must NOT be droppable into its own branch.
- Delete must NOT be possible for categories that hold dishes until the 'also delete the items' box is ticked.
- A sub-category must NOT appear as a top-level chip on the storefront.
- A category must NOT get another box's picture, and several names typed with commas in the quick box must NOT be split into several categories.
- The browser must NOT log JavaScript errors.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (71)

**Step 1 — The owner makes South Indian, and categories inside it**

- 'South Indian' is a top-level category (level 1)
- Dosa and Idli & Vada are level 2; Rava Dosa (inside Dosa) is level 3 — _2/2/3_
- the tree is in order: South Indian, Dosa, Rava Dosa, Idli & Vada (after the existing categories)
- the tree is drawn with lines: a sub-category hangs off its parent by an elbow; the last one's line stops there
- a parent has a line running down to its children; a leaf doesn't
- South Indian's line carries on past Dosa's branch (through Rava Dosa's row) to reach Idli & Vada
- every category has a node; parents' nodes are fold buttons, leaves' are dots

**Step 2 — The tree folds and unfolds**

- folded: its sub-categories are hidden
- unfolded: they are back

**Step 3 — Move up puts Idli & Vada above Dosa**

- Idli & Vada is now first inside South Indian — _South Indian, Idli & Vada, Dosa, Rava Dosa_
- Move down puts it back

**Step 4 — A picture for Dosa**

- the 'Inside' list can't offer Dosa itself or Rava Dosa (inside it) — _South Indian \| ↳ Dosa ✗ \| ↳ Rava Dosa ✗ \| ↳ Idli & Vada_
- the picture shows in the dialog once uploaded
- Dosa's row now shows its picture

**Step 5 — Dishes at every level**

- the dish placed with the item form's Category picker is inside Rava Dosa
- South Indian lists its own dish AND those inside it — _South Indian Thali, Masala Dosa, Paneer Dosa, Rava Masala, Plain Idli_
- dishes from further down say where they are
- unticking that shows only its own dish — _South Indian Thali_

**Step 6 — The Add-on groups part of the page still works (it shares the page with the tree)**

- an add-on group can be added and is listed with its options (the page didn't crash)
- …and deleted again

**Step 7 — The customer's storefront shows the tree**

- 'South Indian' is a heading; 'Dosa' and 'Idli & Vada' sit under it; 'Rava Dosa' under Dosa
- in tree order — _Gravy Momos › Beverages › South Indian › Dosa › Rava Dosa › Idli & Vada_
- a sub-heading says what it is inside
- Dosa's picture is beside its heading
- the parent shows its own dish (South Indian Thali) under its heading
- the top row of chips has 'South Indian' and not its sub-categories — _Steamed Momos, Kurkure Momos, Tandoori Momos, Gravy Momos, Beverages, South Indian_
- a second row of chips lists what is inside South Indian — _Dosa, Rava Dosa, Idli & Vada_

**Step 8 — Switching South Indian off hides everything inside it**

- the storefront shows none of South Indian, Dosa, Rava Dosa, Idli & Vada or their dishes

**Step 9 — Ticking two categories and deleting them together**

- a bar says '2 selected' and offers 'Delete selected'
- the dialog lists both and says they hold dishes (2 items)
- 'Delete' is switched off until 'Also delete the items' is ticked
- …then it can be pressed
- both categories are gone from the tree (Dosa and South Indian stay)
- and their dishes are gone with them (Plain Idli, Rava Masala) — _South Indian Thali, Masala Dosa, Paneer Dosa_
- the bulk bar went away
- the storefront no longer shows them, but still shows Dosa

**Step 10 — Ticking two dishes and deleting them together**

- the items' bar says '2 selected'
- the dialog lists the two dishes
- both dishes are gone; the category is empty
- a dish that wasn't ticked is still there (South Indian Thali) — _South Indian Thali_

**Step 11 — Dragging and dropping categories**

- dropping Desserts on the middle of North Indian puts it INSIDE it (level 2, right under) — _2 · South Indian, Dosa, North Indian, Desserts_
- North Indian became a parent (a fold node with a line down)
- dropping it on the TOP edge of South Indian puts it before South Indian, at the top level — _Beverages, Desserts, South Indian, Dosa, North Indian_
- Dosa dragged out of South Indian into North Indian: now level 2 under North Indian
- South Indian lost its children: its node is a plain dot again
- dropping a category into its own sub-category does nothing
- while dragging, a strip appears for making it top-level
- over a row's top edge a line shows where it would land
- over a row's middle that row is outlined — 'inside'
- letting go there puts Dosa inside Desserts
- the strip and the indicators are gone
- dropping on the strip makes Dosa a top-level category, last — _Desserts, South Indian, North Indian, Dosa_
- after a reload it is all where it was dropped (saved)

**Step 12 — Adding several categories at once — a box for each, with its own picture button**

- the category panel is wider than the old 300px column — _378px_
- it opens with ONE box (and a picture button on it); nothing can be added until it has a name
- 'Add another category' adds a second box, with the cursor in it
- Enter in the last box (with a name) makes the next box and moves into it
- the button counts them: 'Add 3 categories'
- each box has its own picture: Soups and Fresh Juices show one, Salads doesn't
- the picture button of a box with a picture now says 'Change'
- the same name twice (any capitals) is flagged and can't be added
- fixing it clears the message
- a picture on a box with no name is refused ('give each picture's category a name') and can't be added
- removing that box clears the message, deletes the unused upload, and leaves three boxes — _3 boxes, 1 delete request(s)_
- three top-level categories were made, in the order of the boxes — _Soups, Salads, Fresh Juices_
- Soups and Fresh Juices show their own picture on the tree; Salads has none

**Step 13 — Several sub-categories inside one, and cancelling throws away an unsaved picture**

- the window says where they will go, and 'Inside' is already South Indian
- Cancel adds nothing and deletes the picture that was uploaded for it — _1 delete request(s)_
- this time both are made inside South Indian (level 2); Pongal has its picture, Uttapam none
- after a reload all five are still there with their pictures (saved)
- the old comma-separated box is gone: the quick 'New category' box adds exactly what is typed

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-19 22:42 | pass | 71 | 0 | headless | 47.9 s |
| 2026-11-19 19:30 | pass | 71 | 0 | headless | 45.4 s |
| 2026-11-19 18:14 | pass | 71 | 0 | headless | 45.1 s |
| 2026-11-19 17:51 | pass | 71 | 0 | headless | 47.7 s |
| 2026-11-19 17:45 | pass | 71 | 0 | headless | 46.6 s |
| 2026-11-19 16:31 | pass | 71 | 0 | headless | 47.8 s |
| 2026-11-19 15:52 | pass | 71 | 0 | headless | 45.2 s |
| 2026-11-19 13:40 | pass | 71 | 0 | headless | 45.1 s |
| 2026-11-19 13:39 | pass | 71 | 0 | headless | 45.7 s |
| 2026-11-19 13:38 | error | 65 | 1 | headless | 50.3 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t33-menu-tree.mjs`), not this page._
