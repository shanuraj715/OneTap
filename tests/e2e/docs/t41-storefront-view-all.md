# T41 — Storefront View all — as configured on a wide screen; under the cards and centred on phones and tablets (portrait and landscape); the extra cards slide open and shut

**Area:** storefront · **Last result:** ✅ PASSED (70 passed, 0 failed · 2026-11-19 23:05 · headless · 42.8 s)

**Run it alone:** `node run.mjs --only t41` (add `--visible` to watch it)

## What this test does

Runs suites/storefront-view-all.mjs: through the bench API it makes five collapsible sections (View all configured bottom-left, bottom-centre, bottom-right, beside the title, and a 3-column grid of picture cards) and checks them in Chrome. On a 1280px mouse screen each button is where it was configured. On a phone (390), a tablet in portrait (820), a tablet in LANDSCAPE (1180 and 1366, touch) and a narrow desktop window (900) every section has exactly ONE View all button, under the cards, in the middle — the one configured beside the title is not there. Opening and closing animate on a desktop and a phone: the clipping box's height passes through several in-between values (only growing when opening, only shrinking when closing), the leaving cards are inert while they close, the closed section is back to 3 dishes at its original height, and pressing twice quickly mid-slide ends cleanly closed. In a 3-column grid the opened cards flow on from the kept ones as one grid. With 'reduce motion' on, it opens at once. Closing a long section while scrolled far below its heading brings the heading back into view.

## Steps

1. desktop 1280px (mouse): as configured
2. phone 390px
3. tablet, portrait 820px
4. tablet, landscape 1180px
5. large tablet, landscape 1366px
6. a narrow desktop window (mouse) 900px
7. animation, desktop
8. animation, phone
9. the grid layout, reduced motion and the scroll position

## What to expect (these must happen)

- Wide screen (mouse): the View all button is exactly where the store configured it (left, centre, right, beside the title).
- Phone, tablet portrait, tablet landscape (touch) and any window up to 1023px: one View all button per section, under the cards, centred — never beside the title.
- Opening and closing slide (several in-between heights); the button label and aria-expanded follow; the closed section returns to its first few cards.
- The opened cards continue the same grid or list; reduced-motion users get an instant change; closing scrolls a far-away heading back into view.

## What must NOT happen

- A phone or tablet must NOT show the View all button beside the title or at the left/right.
- The extra cards must NOT appear or vanish instantly (unless reduced motion is on).
- The cards leaving during a close must NOT be keyboard-focusable.
- The browser must NOT log errors or warnings.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (70)

**Step 1 — desktop 1280px (mouse): as configured**

- 'Bottom — left': under the cards, at the left edge
- 'Bottom — centred': under the cards, in the middle — _0.0px off_
- 'Bottom — right': under the cards, at the right edge
- 'Right side of the title': beside the title, and no second button under the cards

**Step 2 — phone 390px**

- phone: configured left → ONE button, under the cards, in the middle — _0.0px off centre, below=true, beside title=false_
- phone: configured centre → ONE button, under the cards, in the middle — _0.0px off centre, below=true, beside title=false_
- phone: configured right → ONE button, under the cards, in the middle — _0.0px off centre, below=true, beside title=false_
- phone: configured beside the title → ONE button, under the cards, in the middle — _0.0px off centre, below=true, beside title=false_
- phone: a grid of cards, configured left → ONE button, under the cards, in the middle — _0.0px off centre, below=true, beside title=false_

**Step 3 — tablet, portrait 820px**

- tablet, portrait: configured left → ONE button, under the cards, in the middle — _0.0px off centre, below=true, beside title=false_
- tablet, portrait: configured centre → ONE button, under the cards, in the middle — _0.0px off centre, below=true, beside title=false_
- tablet, portrait: configured right → ONE button, under the cards, in the middle — _0.0px off centre, below=true, beside title=false_
- tablet, portrait: configured beside the title → ONE button, under the cards, in the middle — _0.0px off centre, below=true, beside title=false_
- tablet, portrait: a grid of cards, configured left → ONE button, under the cards, in the middle — _0.0px off centre, below=true, beside title=false_

**Step 4 — tablet, landscape 1180px**

- tablet, landscape: configured left → ONE button, under the cards, in the middle — _0.0px off centre, below=true, beside title=false_
- tablet, landscape: configured centre → ONE button, under the cards, in the middle — _0.0px off centre, below=true, beside title=false_
- tablet, landscape: configured right → ONE button, under the cards, in the middle — _0.0px off centre, below=true, beside title=false_
- tablet, landscape: configured beside the title → ONE button, under the cards, in the middle — _0.0px off centre, below=true, beside title=false_
- tablet, landscape: a grid of cards, configured left → ONE button, under the cards, in the middle — _0.0px off centre, below=true, beside title=false_

**Step 5 — large tablet, landscape 1366px**

- large tablet, landscape: configured left → ONE button, under the cards, in the middle — _0.0px off centre, below=true, beside title=false_
- large tablet, landscape: configured centre → ONE button, under the cards, in the middle — _0.0px off centre, below=true, beside title=false_
- large tablet, landscape: configured right → ONE button, under the cards, in the middle — _0.0px off centre, below=true, beside title=false_
- large tablet, landscape: configured beside the title → ONE button, under the cards, in the middle — _0.0px off centre, below=true, beside title=false_
- large tablet, landscape: a grid of cards, configured left → ONE button, under the cards, in the middle — _0.0px off centre, below=true, beside title=false_

**Step 6 — a narrow desktop window (mouse) 900px**

- a narrow desktop window (mouse): configured left → ONE button, under the cards, in the middle — _0.0px off centre, below=true, beside title=false_
- a narrow desktop window (mouse): configured centre → ONE button, under the cards, in the middle — _0.0px off centre, below=true, beside title=false_
- a narrow desktop window (mouse): configured right → ONE button, under the cards, in the middle — _0.0px off centre, below=true, beside title=false_
- a narrow desktop window (mouse): configured beside the title → ONE button, under the cards, in the middle — _0.0px off centre, below=true, beside title=false_
- a narrow desktop window (mouse): a grid of cards, configured left → ONE button, under the cards, in the middle — _0.0px off centre, below=true, beside title=false_

**Step 7 — animation, desktop**

- desktop: closed, the section shows its first 3 of 8 dishes — _3_
- desktop: the button says how many more — _View all (5 more)_
- desktop: it starts from the closed height — _56px vs 56px_
- desktop: opening SLIDES — several in-between heights, not an instant jump — _40 in-between heights: 56, 57, 58, 60, 61, 63, 66, 69…_
- desktop: and only ever grows while opening
- desktop: it ends fully open — _56px → 191px_
- desktop: opening takes long enough to WATCH (about 0.8 s), without dragging — _793 ms_
- desktop: the new dishes also FADE in (opacity 0 → 1, 11 in-between steps) — _0.2, 0.3, 0.35, 0.45, 0.55, 0.6_
- desktop: all 8 dishes are there, the button says Show less
- desktop: nothing is inert once open
- desktop: closing slides too — _33 in-between heights_
- desktop: closing is visible too (about 0.7 s) — _670 ms_
- desktop: and only ever shrinks while closing
- desktop: the leaving cards can't be tabbed into while they close — _1 inert group_
- desktop: closed again — 3 dishes in the page, the original height — _3 dishes, 56px vs 56px_
- desktop: the button says View all again
- desktop: pressing twice quickly (mid-slide) turns round cleanly and ends closed

**Step 8 — animation, phone**

- phone: closed, the section shows its first 3 of 8 dishes — _3_
- phone: the button says how many more — _View all (5 more)_
- phone: it starts from the closed height — _191px vs 191px_
- phone: opening SLIDES — several in-between heights, not an instant jump — _55 in-between heights: 191, 192, 194, 196, 198, 201, 204, 209…_
- phone: and only ever grows while opening
- phone: it ends fully open — _191px → 529px_
- phone: opening takes long enough to WATCH (about 1.0 s), without dragging — _1021 ms_
- phone: the new dishes also FADE in (opacity 0 → 1, 11 in-between steps) — _0.2, 0.3, 0.35, 0.45, 0.55, 0.6_
- phone: all 8 dishes are there, the button says Show less
- phone: nothing is inert once open
- phone: closing slides too — _47 in-between heights_
- phone: closing is visible too (about 0.9 s) — _854 ms_
- phone: and only ever shrinks while closing
- phone: the leaving cards can't be tabbed into while they close — _1 inert group_
- phone: closed again — 3 dishes in the page, the original height — _3 dishes, 191px vs 191px_
- phone: the button says View all again
- phone: pressing twice quickly (mid-slide) turns round cleanly and ends closed

**Step 9 — the grid layout, reduced motion and the scroll position**

- a 3-column grid shows its first 4 cards
- …and all 9 once open — _9_
- the 5th card carries on in the same row as the 4th — the opened cards flow on from the kept ones, exactly as one grid — _[[124,200],[472,200]]_
- with 'reduce motion' switched on in the system it opens at once (no slide) — _2 distinct heights_
- closing a section you have scrolled far down in brings its heading back into view — _-6px → 72px from the top_
- the test categories are removed and the menu layout is put back — _200_
- the browser logged no errors or warnings

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-19 23:05 | pass | 70 | 0 | headless | 42.8 s |
| 2026-11-19 23:04 | fail | 69 | 1 | headless | 41.8 s |
| 2026-11-19 22:55 | pass | 64 | 0 | headless | 26.9 s |
| 2026-11-19 22:54 | pass | 64 | 0 | headless | 26.0 s |
| 2026-11-19 22:50 | pass | 64 | 0 | headless | 26.7 s |
| 2026-11-19 22:49 | fail | 62 | 2 | headless | 26.3 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t41-storefront-view-all.mjs`), not this page._
