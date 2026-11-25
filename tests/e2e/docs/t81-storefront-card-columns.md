# T81 — Menu cards: '3 a row' shows 3 only where 3 fit — 2 on a portrait tablet, 1 on a phone — and no card is ever cut off, pushed past the screen or on top of another

**Area:** storefront · **Last result:** ✅ PASSED (163 passed, 0 failed · 2026-11-25 12:01 · headless · 15.9 s)

**Run it alone:** `node run.mjs --only t81` (add `--visible` to watch it)

## What this test does

Runs suites/storefront-card-columns.mjs in Chrome against the bench store. A custom menu layout has one section per card style (ten styles) set to '3 per row', plus sections set to 2, 4 and 1. Each is measured at 390 (phone), 744 and 820 (tablet portrait), 1024 (tablet landscape) and 1280px: the number of columns must equal what fits (the row's width divided by the card style's own minimum width, never more than the chosen number; one column on a phone), every card must stay inside its row without touching another, the cards share the whole row, and the page must not scroll sideways. The reported case (image overlay, 3 a row, which ran past the right edge on a tablet) is checked by name: 2 a row at 744 / 820px, 3 at 1024 and 1280px, 1 on a phone.

## Steps

1. 390px wide (a phone)
2. 744px wide (a tablet in portrait)
3. 820px wide (a tablet in portrait)
4. 1024px wide (a tablet in landscape)
5. 1280px wide (a laptop)
6. The case from the report: image overlay, 3 per row, on a tablet

## What to expect (these must happen)

- A row holds the chosen number of cards only while each card keeps its own minimum width; otherwise fewer (3 → 2 → 1).
- Cards fill the row; no card is cut off or overlaps another; the page never scrolls sideways.
- 1 a row stays 1 at every width.

## What must NOT happen

- A card must NOT be pushed past the right edge of the screen.
- '3 a row' must NOT squeeze 3 cards onto a screen too narrow for them.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (163)

**Step 1 — 390px wide (a phone)**

- card.row-compact, 3 per row: 1 column here (minimum card 320px, row 362px) — _1 columns_
- card.row-compact: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-thumb-left, 3 per row: 1 column here (minimum card 340px, row 362px) — _1 columns_
- card.row-thumb-left: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-thumb-right, 3 per row: 1 column here (minimum card 340px, row 362px) — _1 columns_
- card.row-thumb-right: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-top, 3 per row: 1 column here (minimum card 240px, row 362px) — _1 columns_
- card.image-top: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-top-badge, 3 per row: 1 column here (minimum card 240px, row 362px) — _1 columns_
- card.image-top-badge: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.text-above-image, 3 per row: 1 column here (minimum card 260px, row 362px) — _1 columns_
- card.text-above-image: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-overlay, 3 per row: 1 column here (minimum card 260px, row 362px) — _1 columns_
- card.image-overlay: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.portrait, 3 per row: 1 column here (minimum card 210px, row 362px) — _1 columns_
- card.portrait: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.circle, 3 per row: 1 column here (minimum card 190px, row 362px) — _1 columns_
- card.circle: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.menu-line, 3 per row: 1 column here (minimum card 280px, row 362px) — _1 columns_
- card.menu-line: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- the page does not scroll sideways

**Step 2 — 744px wide (a tablet in portrait)**

- card.row-compact, 3 per row: 2 columns here (minimum card 320px, row 716px) — _2 columns_
- card.row-compact: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-compact: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.row-thumb-left, 3 per row: 2 columns here (minimum card 340px, row 716px) — _2 columns_
- card.row-thumb-left: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-thumb-left: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.row-thumb-right, 3 per row: 2 columns here (minimum card 340px, row 716px) — _2 columns_
- card.row-thumb-right: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-thumb-right: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-top, 3 per row: 2 columns here (minimum card 240px, row 716px) — _2 columns_
- card.image-top: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-top: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-top-badge, 3 per row: 2 columns here (minimum card 240px, row 716px) — _2 columns_
- card.image-top-badge: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-top-badge: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.text-above-image, 3 per row: 2 columns here (minimum card 260px, row 716px) — _2 columns_
- card.text-above-image: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.text-above-image: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-overlay, 3 per row: 2 columns here (minimum card 260px, row 716px) — _2 columns_
- card.image-overlay: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-overlay: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.portrait, 3 per row: 2 columns here (minimum card 210px, row 716px) — _2 columns_
- card.portrait: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.portrait: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.circle, 3 per row: 2 columns here (minimum card 190px, row 716px) — _2 columns_
- card.circle: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.circle: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.menu-line, 3 per row: 2 columns here (minimum card 280px, row 716px) — _2 columns_
- card.menu-line: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.menu-line: the cards share the whole row (no unused strip at the right) — _0px left over_
- the page does not scroll sideways
- 2 per row (image on top): 2 here — _row 716px_
- 4 per row (image on top): only as many as fit — 2 here, nothing cut off — _row 716px_
- 1 per row stays 1 at every width

**Step 3 — 820px wide (a tablet in portrait)**

- card.row-compact, 3 per row: 2 columns here (minimum card 320px, row 792px) — _2 columns_
- card.row-compact: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-compact: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.row-thumb-left, 3 per row: 2 columns here (minimum card 340px, row 792px) — _2 columns_
- card.row-thumb-left: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-thumb-left: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.row-thumb-right, 3 per row: 2 columns here (minimum card 340px, row 792px) — _2 columns_
- card.row-thumb-right: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-thumb-right: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-top, 3 per row: 2 columns here (minimum card 240px, row 792px) — _2 columns_
- card.image-top: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-top: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-top-badge, 3 per row: 2 columns here (minimum card 240px, row 792px) — _2 columns_
- card.image-top-badge: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-top-badge: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.text-above-image, 3 per row: 2 columns here (minimum card 260px, row 792px) — _2 columns_
- card.text-above-image: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.text-above-image: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-overlay, 3 per row: 2 columns here (minimum card 260px, row 792px) — _2 columns_
- card.image-overlay: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-overlay: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.portrait, 3 per row: 2 columns here (minimum card 210px, row 792px) — _2 columns_
- card.portrait: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.portrait: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.circle, 3 per row: 2 columns here (minimum card 190px, row 792px) — _2 columns_
- card.circle: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.circle: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.menu-line, 3 per row: 2 columns here (minimum card 280px, row 792px) — _2 columns_
- card.menu-line: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.menu-line: the cards share the whole row (no unused strip at the right) — _0px left over_
- the page does not scroll sideways
- 2 per row (image on top): 2 here — _row 792px_
- 4 per row (image on top): only as many as fit — 2 here, nothing cut off — _row 792px_
- 1 per row stays 1 at every width

**Step 4 — 1024px wide (a tablet in landscape)**

- card.row-compact, 3 per row: 3 columns here (minimum card 320px, row 976px) — _3 columns_
- card.row-compact: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-compact: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.row-thumb-left, 3 per row: 2 columns here (minimum card 340px, row 976px) — _2 columns_
- card.row-thumb-left: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-thumb-left: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.row-thumb-right, 3 per row: 2 columns here (minimum card 340px, row 976px) — _2 columns_
- card.row-thumb-right: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-thumb-right: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-top, 3 per row: 3 columns here (minimum card 240px, row 976px) — _3 columns_
- card.image-top: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-top: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-top-badge, 3 per row: 3 columns here (minimum card 240px, row 976px) — _3 columns_
- card.image-top-badge: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-top-badge: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.text-above-image, 3 per row: 3 columns here (minimum card 260px, row 976px) — _3 columns_
- card.text-above-image: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.text-above-image: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-overlay, 3 per row: 3 columns here (minimum card 260px, row 976px) — _3 columns_
- card.image-overlay: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-overlay: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.portrait, 3 per row: 3 columns here (minimum card 210px, row 976px) — _3 columns_
- card.portrait: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.portrait: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.circle, 3 per row: 3 columns here (minimum card 190px, row 976px) — _3 columns_
- card.circle: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.circle: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.menu-line, 3 per row: 3 columns here (minimum card 280px, row 976px) — _3 columns_
- card.menu-line: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.menu-line: the cards share the whole row (no unused strip at the right) — _0px left over_
- the page does not scroll sideways
- 2 per row (image on top): 2 here — _row 976px_
- 4 per row (image on top): only as many as fit — 4 here, nothing cut off — _row 976px_
- 1 per row stays 1 at every width

**Step 5 — 1280px wide (a laptop)**

- card.row-compact, 3 per row: 3 columns here (minimum card 320px, row 1032px) — _3 columns_
- card.row-compact: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-compact: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.row-thumb-left, 3 per row: 3 columns here (minimum card 340px, row 1032px) — _3 columns_
- card.row-thumb-left: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-thumb-left: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.row-thumb-right, 3 per row: 3 columns here (minimum card 340px, row 1032px) — _3 columns_
- card.row-thumb-right: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.row-thumb-right: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-top, 3 per row: 3 columns here (minimum card 240px, row 1032px) — _3 columns_
- card.image-top: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-top: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-top-badge, 3 per row: 3 columns here (minimum card 240px, row 1032px) — _3 columns_
- card.image-top-badge: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-top-badge: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.text-above-image, 3 per row: 3 columns here (minimum card 260px, row 1032px) — _3 columns_
- card.text-above-image: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.text-above-image: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.image-overlay, 3 per row: 3 columns here (minimum card 260px, row 1032px) — _3 columns_
- card.image-overlay: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.image-overlay: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.portrait, 3 per row: 3 columns here (minimum card 210px, row 1032px) — _3 columns_
- card.portrait: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.portrait: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.circle, 3 per row: 3 columns here (minimum card 190px, row 1032px) — _3 columns_
- card.circle: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.circle: the cards share the whole row (no unused strip at the right) — _0px left over_
- card.menu-line, 3 per row: 3 columns here (minimum card 280px, row 1032px) — _3 columns_
- card.menu-line: every card inside the row, none on top of another — _0 outside, 0 overlapping_
- card.menu-line: the cards share the whole row (no unused strip at the right) — _0px left over_
- the page does not scroll sideways
- 2 per row (image on top): 2 here — _row 1032px_
- 4 per row (image on top): only as many as fit — 4 here, nothing cut off — _row 1032px_
- 1 per row stays 1 at every width

**Step 6 — The case from the report: image overlay, 3 per row, on a tablet**

- portrait tablet (744 / 820px): 2 cards a row, not 3 squeezed or cut off — _2 / 2_
- landscape tablet (1024px): 3 cards a row, all inside the row (they used to run past the right edge and overlap) — _3 columns_
- laptop (1280px): 3 a row
- phone: 1 a row
- the test category is removed and the menu layout is put back — _200_
- the browser logged no errors or warnings

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-25 12:01 | pass | 163 | 0 | headless | 15.9 s |
| 2026-11-25 10:50 | pass | 163 | 0 | headless | 18.2 s |
| 2026-11-25 10:43 | pass | 163 | 0 | headless | 21.7 s |
| 2026-11-25 10:40 | fail | 161 | 2 | headless | 19.4 s |
| 2026-11-25 10:35 | pass | 163 | 0 | headless | 17.6 s |
| 2026-11-25 10:29 | fail | 144 | 19 | headless | 17.1 s |
| 2026-11-25 10:23 | pass | 163 | 0 | headless | 19.0 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t81-storefront-card-columns.mjs`), not this page._
