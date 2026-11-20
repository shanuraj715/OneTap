# T58 — Dish pictures in four shapes — square (default), landscape 4:3, wide 16:9, portrait 3:4 — stored, limited and chosen per card; existing square pictures untouched

**Area:** menu · **Last result:** ✅ PASSED (31 passed, 0 failed · 2026-11-21 01:13 · headless · 4.1 s)

**Run it alone:** `node run.mjs --only t58` (add `--visible` to watch it)

## What this test does

Runs suites/item-image-shapes-api.mjs on an in-memory API. A dish saved BEFORE shapes existed (pictures with no shape, written straight into the database) comes back with each picture as a square 1:1 one, with its address and file key exactly as it was; a card of any shape shows its first square picture so the dish looks the same as before; the pop-up still cycles through both squares; changing the price leaves the pictures alone and saving the form (which sends the pictures back) keeps them. Landscape, wide and portrait pictures are added next to the squares and kept in their own shape with their sizes; each card shape gets its own picture, and falls back to the first square one when the dish has none (a dish with only a wide picture still shows it on a square card; a dish with none shows nothing); a picture sent without a shape is stored as square. Limits: six squares, one each of landscape / wide / portrait (extras are dropped), nine in all, ten in one save is refused, a shape that doesn't exist (2:1) is refused. Importing a menu from another outlet brings every picture with its shape. The card variants ask for the right shape (photo-on-top and overlay 4:3, text-above and featured-wide 16:9, portrait 3:4, thumbnails and round cards square).

## Steps

1. a dish that already has square pictures keeps every one of them
2. adding a landscape, a wide and a portrait picture next to the squares
3. only the shapes that were uploaded are used; the rest fall back to square
4. how many of each shape a dish can hold
5. importing a menu from another outlet brings the shapes along
6. the card variants ask for the right shape

## What to expect (these must happen)

- A picture saved before shapes reads back as square with its file and address unchanged; nothing is removed or re-saved by reading or by saving other fields.
- Each shape is stored on the picture and returned by the menu; the selection falls back to the first square picture.
- Six square pictures and one of each other shape fit; more are dropped or refused; an unknown shape is refused.
- An imported menu keeps each picture's shape.

## What must NOT happen

- An existing square picture must NOT be lost, re-ordered or changed to another shape.
- A dish must NOT end up with no picture on a card just because it lacks that shape, when it has any picture.
- A shape that doesn't exist must NOT be accepted.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (31)

**Step 1 — a dish that already has square pictures keeps every one of them**

- both old pictures come back, each as a square (1:1) one — _["1:1","1:1"]_
- …with their address and file key exactly as they were
- a card of ANY shape shows the first square picture — the dish looks exactly as before
- …and the dish pop-up still cycles through both
- changing the price (not the pictures) leaves the pictures alone — _200_
- saving the dish form (which sends the pictures back) keeps both

**Step 2 — adding a landscape, a wide and a portrait picture next to the squares**

- the dish now has five pictures: two squares and one of each other shape — _200 5_
- each is kept in its own shape, the old squares first and unchanged
- a landscape card gets the landscape picture, a wide card the wide one, a portrait card the portrait one, a small card the square one
- the pop-up shows the wide picture when there is one
- the square gallery is still the two squares
- their sizes are kept
- the database holds the shape on every picture (the old ones now say 1:1) — _1:1,1:1,4:3,16:9,3:4_

**Step 3 — only the shapes that were uploaded are used; the rest fall back to square**

- a dish with a square and a landscape picture: landscape cards use the landscape one, wide and portrait cards fall back to the square one
- a dish with no pictures has none for any shape (the card shows its placeholder)
- a dish that has only a wide picture still shows it on a square card rather than nothing
- a picture sent without a shape (an older dashboard tab, say) is stored as square

**Step 4 — how many of each shape a dish can hold**

- a second picture of the same landscape / wide / portrait shape is not kept (one each) — _4:3:l1.webp 16:9:w1.webp 3:4:t1.webp_
- squares: the first six are kept (the gallery limit it always had) — _6_
- six squares plus one of each other shape — nine in all — fit
- ten pictures in one save is refused — _400_
- a shape that doesn't exist (2:1) is refused — _400_
- taking every picture off works

**Step 5 — importing a menu from another outlet brings the shapes along**

- an item with all four shapes is imported into the second outlet — _201 {"importedCategoriesCount":1,"importedItemsCount":1,"importedModifierGroupsCount":0}_
- …with every picture still in its own shape — _1:1,1:1,4:3,16:9,3:4_

**Step 6 — the card variants ask for the right shape**

- photo-on-top cards (C04, C05) use landscape 4:3
- the overlay card (C07) uses wide 16:9; a card without a photo has no shape
- the wide cards use 16:9
- the tall card uses portrait 3:4
- thumbnail and round cards use the square picture
- every card asks for a shape that exists

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-21 01:13 | pass | 31 | 0 | headless | 4.1 s |
| 2026-11-21 01:10 | fail | 29 | 1 | headless | 3.7 s |
| 2026-11-21 00:20 | pass | 30 | 0 | headless | 3.6 s |
| 2026-11-21 00:11 | pass | 30 | 0 | headless | 4.1 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t58-item-image-shapes-api.mjs`), not this page._
