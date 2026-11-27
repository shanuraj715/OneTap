# T77 — The Storage page — find the pictures bigger than the size limit in a grid, select them and optimize

**Area:** platform · **Last result:** ✅ PASSED (37 passed, 0 failed · 2026-11-21 16:15 · headless · 7.5 s)

**Run it alone:** `node run.mjs --only t77` (add `--visible` to watch it)

## What this test does

Runs suites/storage-optimize-ui.mjs in Chrome as the platform super admin on the bench, with a throwaway store ('Optimize Test Co': three ~1.5 MB pictures and fifty small ones made with sharp while the compression was loose; the platform's compression settings are put back and the store deleted at the end). The card sits below 'Image compression'; nothing is listed until 'Find big pictures'; the summary names the saved limit (150 KB); choosing the store shows exactly its 3 big pictures as same-size cards with size, store, outlet and kind, loaded thumbnails and no buttons (view-only); 'Select all' says how many, selects them, a single picture can be taken out, the Optimize button names the count and waits while nothing is selected; pressing it asks first (originals deleted, can't be undone), runs in the background with a progress readout, ends with '3 optimized, 3 originals deleted' and 'went from … to … smaller'; the list refreshes by itself; the dishes now use new WebP files under 150 KB which open, and the big originals no longer do. With a 5 KB limit the grid draws 48 at a time with 'Show more (n left)', and 'Select all' covers all of the store's pictures; on a phone it doesn't scroll sideways and shows two across; with no size limit it says where to put one.

## Steps

1. Before looking
2. Find the big pictures
3. Select
4. Optimize
5. A long list is shown a page at a time
6. A phone
7. No size limit set

## What to expect (these must happen)

- Big pictures are shown in a view-only grid and can be selected all at once or one by one.
- Optimize asks first, shows progress, and the dishes end up using smaller files.
- The grid pages (48 at a time) and works on a phone.

## What must NOT happen

- Looking must NOT change any picture.
- The grid must NOT offer edit/delete buttons on the pictures.
- The page must NOT scroll sideways on a phone.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (37)

**Step 1 — Before looking**

- the last scan is still there when the page is opened again (the button says 'Scan again')
- …and it can't show this run's pictures: they weren't there when it was made
- it sits below 'Image compression', whose size limit it uses

**Step 2 — Find the big pictures**

- the button now says 'Scan again'
- the summary names the limit that is saved (150 KB)
- choosing the store shows exactly its 3 big pictures — _3_
- 'Select all' says how many it would select (3) — _Select all of this store (3) Store All stores (3) Optimize Test Co (3) Nothing selected_
- nothing is selected to begin with, and the Optimize button waits
- each picture shows its size, store, outlet and what it is — _925 KB Optimize Test Co Counter Dish picture_
- the grid is view-only: no button on any picture
- the pictures are shown (loaded from where they are stored)
- the cards are all the same size — _137×175 137×175 137×175_
- the 'Scan again' button stays on one line — _113×29_
- the outlet and the kind each get their own line, not cut off — _925 KB \| Optimize Test Co \| Counter \| Dish picture_

**Step 3 — Select**

- 'Select all' selects the 3 — _3 selected · 2.7 MB_
- the button says what it will do and is ready
- a single picture can be taken out again (2 selected)
- 'Select all' puts it back (3 selected)
- unticking 'Select all' clears the selection

**Step 4 — Optimize**

- a new job starts
- it asks first and says plainly that the big originals are deleted and it can't be undone
- the job runs and finishes by itself — _done_
- the numbers say 3 optimized, 0 failed, 3 originals deleted
- it says how much was saved — _3 pictures went from 2.7 MB to 410 KB — 2.3 MB smaller._
- the list refreshes by itself: the optimized pictures are gone from it
- the dishes now use new files (new addresses) — _3 pictures_
- …which open, as WebP, each under 150 KB — _138 KB, 136 KB, 136 KB_
- together they are a fraction of what they were — _2773 KB → 410 KB_
- the big originals no longer open (they were deleted) — _404,404,404_

**Step 5 — A long list is shown a page at a time**

- only the first 48 are drawn at once — _48_
- 'Show more' says how many are left — _Show more (5 left)_
- pressing it draws the rest — _53_
- 'Select all' covers every picture of the store, not only the ones drawn — _53 selected · 708 KB_

**Step 6 — A phone**

- no sideways scrolling on a phone
- the grid shows two pictures side by side, inside the screen — _152 + 152 px_

**Step 7 — No size limit set**

- it says a size limit is needed (and where to put it) instead of listing everything
- no errors in the browser

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-27 16:46 | pass | 37 | 0 | headless | 8.8 s |
| 2026-11-21 16:15 | pass | 37 | 0 | headless | 7.5 s |
| 2026-11-21 16:14 | pass | 37 | 0 | headless | 7.8 s |
| 2026-11-21 16:12 | error | 3 | 0 | headless | 33.5 s |
| 2026-11-21 16:11 | fail | 2 | 1 | headless | 32.7 s |
| 2026-11-21 16:11 | fail | 34 | 2 | headless | 8.1 s |
| 2026-11-21 16:10 | fail | 35 | 1 | headless | 7.9 s |
| 2026-11-21 16:09 | pass | 34 | 0 | headless | 8.4 s |
| 2026-11-21 16:08 | error | 3 | 0 | headless | 35.4 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t77-storage-optimize-ui.mjs`), not this page._
