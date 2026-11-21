# T59 — Dish photos in four shapes — the dish form's four sections (upload, replace, trim warning, paste into the chosen one, remove) and the picture each card style shows

**Area:** menu · **Last result:** ✅ PASSED (45 passed, 0 failed · 2026-11-21 15:12 · headless · 5.2 s)

**Run it alone:** `node run.mjs --only t59` (add `--visible` to watch it)

## What this test does

Runs suites/item-image-shapes-ui.mjs in Chrome on the bench store (Acme Momos, Main). Dashboard: Menu → a dish → Edit shows four sections — Square 1:1 (marked Default, holding the dish's own pictures), Landscape 4:3, Wide 16:9 and Portrait 3:4 — the last three start empty. A real PNG is uploaded into each (its 'Add' tile then goes: one picture per shape); choosing another landscape picture replaces the first; a square picture put in the landscape section says 'not 4:3 — its edges are trimmed', and putting a real 4:3 one back clears the note. Ctrl/⌘+V is aimed at the square section until another section is clicked, and a pasted picture goes into the clicked (portrait) section. Saving stores 1 landscape + 1 wide + 1 portrait next to the dish's own squares, which are exactly the files it had (same order), and the wide and tall files really are wide and tall; reopening shows each in its own section; removing the wide one brings its 'Add' tile back and saves. Storefront: a dish with all four pictures and one with only a square picture are shown with each card style — C02 C03 C09 the square, C04 C05 C07 the landscape, C06 C11 the wide, C08 the portrait — and the square-only dish shows its square picture on every one; the dish pop-up shows the wide picture (the square-only dish still shows its square). Everything is put back — the dish's own pictures exactly as they were.

## Steps

1. The dish form has four photo sections
2. Upload into each shape
3. Paste goes into the section you chose
4. Save keeps the squares and stores the shapes
5. Reopen, remove one
6. Storefront: each card style shows its own shape
7. Storefront: the dish pop-up uses the wide picture

## What to expect (these must happen)

- Four photo sections; one picture per non-square shape; replace works; the trim warning appears only for a wrong shape.
- Paste goes to the section last clicked; the square set is untouched by it.
- Saved shapes are right and the dish's square pictures are unchanged.
- Each card style shows the picture of its shape, and the square one when its shape is missing.

## What must NOT happen

- The dish's own square pictures must NOT change, move or disappear.
- No errors in the browser console.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (45)

**Step 1 — The dish form has four photo sections**

- a 1:1 section is there
- a 4:3 section is there
- a 16:9 section is there
- a 3:4 section is there
- the square section is marked Default
- Ctrl+V is aimed at the square section until another is chosen
- the dish's own 2 square picture(s) are all in the square section — _2_
- the other three sections start empty
- the square section still has 'Add photo' and 'Paste photo'

**Step 2 — Upload into each shape**

- once a shape has its picture, its 'Add' tile goes (one picture per shape)
- a picture that really is 4:3 gets no 'trimmed' warning
- choosing another landscape picture REPLACES the first (still one)
- a square picture put in the landscape section says its edges will be trimmed

**Step 3 — Paste goes into the section you chose**

- clicking the portrait section aims Ctrl+V at it
- the pasted picture replaced the portrait one — the squares are untouched

**Step 4 — Save keeps the squares and stores the shapes**

- saved: 2 square + one landscape + one wide + one portrait — _1:1,1:1,16:9,4:3,3:4_
- …and the dish's own square pictures are exactly the ones it had (same files, same order)
- …each other shape holds one picture
- …and the files really are wide and tall (the pictures weren't squashed to squares) — _[["1:1",800,800],["1:1",800,800],["16:9",640,360],["4:3",400,300],["3:4",300,400]]_

**Step 5 — Reopen, remove one**

- reopening the dish shows each picture in its own section
- removing the wide picture brings its 'Add' tile back
- after saving, the wide picture is gone and the rest is as it was
- the two square pictures are still exactly the same files, in the same order

**Step 6 — Storefront: each card style shows its own shape**

- C02 (row-thumb-left) shows the sq picture of a dish that has all four — _https://img.test/full-sq.png_
- C02: a dish with only a square picture shows the square one — _https://img.test/only-sq.png_
- C03 (row-thumb-right) shows the sq picture of a dish that has all four — _https://img.test/full-sq.png_
- C03: a dish with only a square picture shows the square one — _https://img.test/only-sq.png_
- C04 (image-top) shows the land picture of a dish that has all four — _https://img.test/full-land.png_
- C04: a dish with only a square picture shows the square one — _https://img.test/only-sq.png_
- C05 (image-top-badge) shows the land picture of a dish that has all four — _https://img.test/full-land.png_
- C05: a dish with only a square picture shows the square one — _https://img.test/only-sq.png_
- C06 (text-above-image) shows the wide picture of a dish that has all four — _https://img.test/full-wide.png_
- C06: a dish with only a square picture shows the square one — _https://img.test/only-sq.png_
- C07 (image-overlay) shows the wide picture of a dish that has all four — _https://img.test/full-wide.png_
- C07: a dish with only a square picture shows the square one — _https://img.test/only-sq.png_
- C08 (portrait) shows the tall picture of a dish that has all four — _https://img.test/full-tall.png_
- C08: a dish with only a square picture shows the square one — _https://img.test/only-sq.png_
- C09 (circle) shows the sq picture of a dish that has all four — _https://img.test/full-sq.png_
- C09: a dish with only a square picture shows the square one — _https://img.test/only-sq.png_
- C11 (featured-wide) shows the wide picture of a dish that has all four — _https://img.test/full-wide.png_
- C11: a dish with only a square picture shows the square one — _https://img.test/only-sq.png_

**Step 7 — Storefront: the dish pop-up uses the wide picture**

- a dish with a wide picture shows it in the pop-up (not the square) — _https://img.test/full-wide.png_
- a dish with only a square picture still shows it in the pop-up, as before — _https://img.test/only-sq.png_
- the dish's own pictures are back exactly as they were at the start
- no errors in the browser console

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-21 15:12 | pass | 45 | 0 | headless | 5.2 s |
| 2026-11-21 05:02 | pass | 45 | 0 | headless | 5.5 s |
| 2026-11-21 01:33 | pass | 45 | 0 | headless | 5.1 s |
| 2026-11-21 01:10 | pass | 45 | 0 | headless | 5.2 s |
| 2026-11-21 00:44 | pass | 45 | 0 | headless | 5.2 s |
| 2026-11-21 00:21 | pass | 45 | 0 | headless | 4.6 s |
| 2026-11-21 00:20 | pass | 45 | 0 | headless | 4.5 s |
| 2026-11-21 00:11 | pass | 45 | 0 | headless | 5.1 s |
| 2026-11-21 00:11 | fail | 42 | 2 | headless | 4.9 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t59-item-image-shapes-ui.mjs`), not this page._
