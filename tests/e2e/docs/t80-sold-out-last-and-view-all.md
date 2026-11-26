# T80 — Menu: sold-out dishes go to the end of their category, and 'View all' disappears when a filter leaves only a few dishes

**Area:** storefront · **Last result:** ✅ PASSED (28 passed, 0 failed · 2026-11-26 12:41 · headless · 23.1 s)

**Run it alone:** `node run.mjs --only t80` (add `--visible` to watch it)

## What this test does

Runs suites/storefront-sold-out-last.mjs in Chrome against the bench store (desktop 1280px and a phone 390px). A custom menu layout with eight categories is built through the API. Sold-out first: a category of 15 with two sold-out dishes shows the 13 orderable ones in their own order and the two sold-out ones last (closed, the first 6 shown are all orderable; open, …15, 02, 07 and exactly two 'Sold out' labels, also on screen); a category with nothing sold out keeps its order; a section capped at 5 dishes is filled with orderable dishes first; a price-sorted section keeps its order and its dearest (sold-out) dish drops to the end; when a dish is orderable again it returns to its place. View all: with no filter the four long categories have the button; with Veg a 15-dish category cut to 3 shows all 3 and NO button, one cut to exactly 6 has none, one cut to 7 shows 6 and 'View all (1 more)' and still opens, the button beside a title goes too, the all-veg category keeps its button; Non-veg brings 'View all (6 more)' for the 12 left; All brings every button back. The phone checks the same. Everything is removed afterwards.

## Steps

1. Sold-out dishes go to the end of their category (desktop 1280px)
2. A dish that comes back is put back where it belongs
3. 'View all' follows the filter (desktop 1280px)
4. The same on a phone (390px wide)

## What to expect (these must happen)

- Sold-out dishes are the last cards of their category, in their own order; the dishes before them keep theirs.
- A capped or price-sorted section is built from orderable dishes first.
- After a filter, View all only shows while more dishes remain than the first-few limit (and its '(n more)' count matches).

## What must NOT happen

- A sold-out dish must NOT take one of the first visible places while orderable dishes wait behind 'View all'.
- 'View all' must NOT show for a category the filter has cut to the first-few limit or less.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (28)

**Step 1 — Sold-out dishes go to the end of their category (desktop 1280px)**

- a category of 15 with 2 sold-out dishes, closed: the first 6 shown are all orderable (01 03 04 05 06 08 — not 02 or 07) — _01 03 04 05 06 08_
- …and none of the first 6 says 'Sold out'
- the button counts the rest: View all (9 more) — _View all (9 more)_
- opened: the 13 orderable dishes in their own order, then the two sold-out ones last (…15, 02, 07) — _01 03 04 05 06 08 09 10 11 12 13 14 15 02 07_
- exactly two dishes say 'Sold out'
- on screen too: the sold-out dishes sit after dish 15, dish 02 before dish 07
- a category with nothing sold out keeps its normal order (01 … 08) — _01 02 03 04 05 06 07 08_
- a section capped at 5 dishes is filled with orderable ones first (03 … 07), not with the two sold-out dishes at the top — _03 04 05 06 07_
- sorted by price (high to low): that order holds, and the dearest dish — sold out — drops to the end — _05 04 03 02 01 06_
- …with its 'Sold out' label

**Step 2 — A dish that comes back is put back where it belongs**

- dish 02 orderable again → it is back among the first six (01 … 06) after a reload — _01 02 03 04 05 06_

**Step 3 — 'View all' follows the filter (desktop 1280px)**

- no filter: the four long categories each have a View all button
- Veg: category A (15 dishes) is down to 3 → all 3 are shown and there is NO View all button — _3 dishes, buttons: none_
- Veg: category B is down to exactly 6 (the first-few limit) → no button — _6 dishes, buttons: none_
- Veg: category C is down to 7 → 6 shown and View all (1 more) — _6 dishes, buttons: View all (1 more)_
- Veg: category D (button beside the title) is down to 2 → that button is gone too — _buttons: none_
- Veg: the all-veg category (15 left) keeps its View all (9 more) — _View all (9 more)_
- …and it still opens (7 dishes, 'Show less')
- Non-veg: category A has 12 left → View all (6 more), first 6 shown — _View all (6 more)_
- …and the all-veg category is gone from a Non-veg menu (nothing left in it)
- All: every View all button is back

**Step 4 — The same on a phone (390px wide)**

- no filter: category A has View all (under the cards)
- Veg: category A shows its 3 dishes and no View all button
- Veg: category D has no button either
- Veg: category C (7 left) still has one
- the first six of the 15-dish category are the orderable ones on a phone too — _01 03 04 05 06 08_
- the test categories are removed and the menu layout is put back — _200_
- the browser logged no errors or warnings

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-26 12:41 | pass | 28 | 0 | headless | 23.1 s |
| 2026-11-26 11:52 | pass | 28 | 0 | headless | 24.3 s |
| 2026-11-26 10:41 | pass | 28 | 0 | headless | 20.1 s |
| 2026-11-25 12:02 | pass | 28 | 0 | headless | 18.6 s |
| 2026-11-25 11:18 | error | 0 | 0 | headless | 0.8 s |
| 2026-11-25 10:51 | pass | 28 | 0 | headless | 20.5 s |
| 2026-11-25 10:35 | error | 0 | 0 | headless | 0.9 s |
| 2026-11-25 09:56 | pass | 28 | 0 | headless | 20.1 s |
| 2026-11-25 09:51 | fail | 16 | 12 | headless | 20.2 s |
| 2026-11-25 09:49 | error | 19 | 0 | headless | 1 min 1 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t80-sold-out-last-and-view-all.mjs`), not this page._
