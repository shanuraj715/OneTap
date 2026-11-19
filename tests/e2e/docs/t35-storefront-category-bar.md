# T35 — Storefront — with 30+ categories the sticky category bar stays ONE short row that scrolls sideways, and phones keep one short bar with a Categories sheet

**Area:** storefront · **Last result:** ✅ PASSED (34 passed, 0 failed · 2026-11-19 18:14 · headless · 20.2 s)

**Run it alone:** `node run.mjs --only t35` (add `--visible` to watch it)

## What this test does

Runs suites/storefront-category-bar.mjs: adds 30 categories (one dish each) to Acme Momos' fake menu through the bench API, then in Chrome at desktop, tablet and phone sizes checks the storefront. Desktop: every category is a chip but the sticky bar is one short row (under 80 px — it used to wrap into seven rows), all chips on one line, the row scrolls sideways with no scrollbar, ‹ › buttons appear (‹ off at the start) and move it, choosing a chip far along scrolls the menu to that category just below the bar, highlights that chip and brings it into view; scrolling the page by hand moves the highlight (and the row) to the category being read. Tablet and phone: one short bar with the Veg/Egg/Non-veg filter and the Categories button on the same row, fully on screen; the sheet fits the screen, lists every category and scrolls; picking one lands just under the bar; no sideways page scroll. The 30 categories are removed at the end.

## Steps

1. desktop 1280px
2. tablet 820px
3. phone 390px

## What to expect (these must happen)

- With 30+ categories the sticky bar is one row under 80 px tall on desktop, tablet and phone; all chips on one line.
- Too many chips for the width: the row scrolls sideways (no scrollbar), with ‹ › buttons for a mouse.
- Choosing a chip scrolls to that category just under the bar; the chip is highlighted and in view; scrolling the page keeps the highlight and the row in step.
- Phone/tablet: filter + Categories button on one row, sheet fits the screen and scrolls, picking a category lands just under the bar.

## What must NOT happen

- The category chips must NOT wrap into several rows or make the sticky bar tall.
- The page must NOT scroll sideways at any size.
- The highlighted chip must NOT be left hidden off to the side of the row.
- The browser must NOT log errors or warnings.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (34)

**Step 1 — desktop 1280px**

- all 30+ categories are in the bar — _36_
- the sticky bar is ONE short row (it used to be seven) — _53px_
- every chip sits on the same row — _1 row(s)_
- more chips than fit: the row scrolls sideways instead of wrapping — _5282px of chips in 768px_
- no scrollbar is drawn on it
- ‹ › buttons appear; ‹ is off at the start
- › moves the row along and turns ‹ on — _0 → 538_
- ‹ moves it back
- choosing it scrolls the menu to that category, just under the (short) bar — _{"top":66,"bar":53}_
- that chip is the highlighted one — _Bar Test 22 Specials_
- …and it is scrolled into view in the row, not hidden off to the side
- scrolling the page by hand moves the highlight to the category being read — _Bar Test 05 Specials_
- …and the row follows it
- the bar is still one short row while scrolled
- choosing the very last category highlights it, even though the page can't scroll it to the top — _Bar Test 30 Specials_
- no sideways scroll on the page

**Step 2 — tablet 820px**

- tablet: the bar is one short row — _59px_
- tablet: one Categories button
- tablet: the Veg/Egg/Non-veg filter and the Categories button share the row
- tablet: the Categories button is fully on screen
- tablet: the sheet fits the screen and lists every category — _792px of 1100px, 37 buttons_
- tablet: the list inside it scrolls (there are more categories than fit)
- tablet: a category picked in the sheet lands just under the bar — _{"top":71,"bar":59}_
- tablet: no sideways scroll

**Step 3 — phone 390px**

- phone: the bar is one short row — _59px_
- phone: one Categories button
- phone: the Veg/Egg/Non-veg filter and the Categories button share the row
- phone: the Categories button is fully on screen
- phone: the sheet fits the screen and lists every category — _608px of 844px, 37 buttons_
- phone: the list inside it scrolls (there are more categories than fit)
- phone: a category picked in the sheet lands just under the bar — _{"top":71,"bar":59}_
- phone: no sideways scroll
- the 30 extra categories and their dishes are removed again — _200_
- the browser logged no errors or warnings

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-19 18:14 | pass | 34 | 0 | headless | 20.2 s |
| 2026-11-19 18:09 | pass | 34 | 0 | headless | 20.2 s |
| 2026-11-19 17:51 | pass | 34 | 0 | headless | 26.4 s |
| 2026-11-19 17:46 | pass | 34 | 0 | headless | 27.7 s |
| 2026-11-19 17:41 | pass | 34 | 0 | headless | 20.5 s |
| 2026-11-19 17:41 | pass | 34 | 0 | headless | 18.9 s |
| 2026-11-19 17:39 | error | 22 | 0 | headless | 42.5 s |
| 2026-11-19 17:38 | fail | 19 | 2 | headless | 40.5 s |
| 2026-11-19 17:37 | fail | 18 | 3 | headless | 40.7 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t35-storefront-category-bar.mjs`), not this page._
