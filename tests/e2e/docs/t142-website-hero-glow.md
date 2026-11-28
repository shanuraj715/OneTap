# T142 — Website → an app's page: the purple (app-coloured) glow at the bottom of the top section is kept and fades out smoothly instead of ending in a straight line; the heartbeat line's corners are softly rounded

**Area:** website · **Last result:** ✅ PASSED (29 passed, 0 failed · 2026-11-28 15:40 · headless · 6.9 s)

**Run it alone:** `node run.mjs --only t142` (add `--visible` to watch it)

## What this test does

Chrome against the bench website, motion off, pixel-based. On an app's page (light and dark): the colour inside the top section near its bottom is clearly still tinted (the glow was not removed); the pixel rows 2 px above and 2 px below the section's bottom edge are the same colour (no step); the glow carries on below the edge and has melted into the page colour 255 px further down. On the /apps list page (light and dark) the colour is still there, the cards section has no rule above or below it and no background of its own, there is no step in colour where the top section ends and the cards begin, and the heartbeat sits low in the top section. The heartbeat line is one path drawn twice (line + glow) whose corners are curves, with round joins and ends, and still bends towards the same peak and dip points. Nothing sticks out sideways on desktop or at 390 px wide.

## Steps

1. an app's page, light
2. an app's page, dark
3. the apps page, light
4. the apps page, dark
5. The heartbeat line has softly rounded corners
6. A phone

## What to expect (these must happen)

- The coloured glow is still visible in the lower part of the top section.
- There is no visible step in colour where the top section ends; the glow fades out below it.
- Every corner of the heartbeat line is a small curve.
- The top section and the cards section of /apps read as one page.

## What must NOT happen

- The glow must NOT end in a straight line.
- The glow must NOT be removed or faded away inside the top section.
- The heartbeat line must NOT have sharp pointed corners.
- There must NOT be a line or a change of background colour between the top section and the cards of /apps.
- The page must NOT scroll sideways.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (29)

**Step 1 — an app's page, light**

- the colour is still there inside the hero, near its bottom (not faded away) — _33 away from the page colour_
- the heartbeat sits at the very bottom of an app's top section — _20px from the edge_
- no straight edge: the rows just above and just below the hero's bottom are the same colour — _step 0.8_
- the glow has melted into the page colour well below the hero — _1 away at 255 px below_
- nothing sticks out sideways — _0px over_

**Step 2 — an app's page, dark**

- the colour is still there inside the hero, near its bottom (not faded away) — _38 away from the page colour_
- the heartbeat sits at the very bottom of an app's top section — _20px from the edge_
- no straight edge: the rows just above and just below the hero's bottom are the same colour — _step 0.8_
- the glow has melted into the page colour well below the hero — _1 away at 255 px below_
- nothing sticks out sideways — _0px over_

**Step 3 — the apps page, light**

- the colour is still there inside the hero, near its bottom (not faded away) — _33 away from the page colour_
- no rule above or below the cards section — _0px / 0px_
- the cards section has no background of its own (the hero's colour carries straight on into it) — _rgba(0, 0, 0, 0) none_
- no step in colour where the hero ends and the cards begin — _step 0.5_
- the heartbeat sits low in the hero, just above its bottom edge (not up among the buttons) — _10px from the edge_
- nothing sticks out sideways — _0px over_

**Step 4 — the apps page, dark**

- the colour is still there inside the hero, near its bottom (not faded away) — _49 away from the page colour_
- no rule above or below the cards section — _0px / 0px_
- the cards section has no background of its own (the hero's colour carries straight on into it) — _rgba(0, 0, 0, 0) none_
- no step in colour where the hero ends and the cards begin — _step 0.8_
- the heartbeat sits low in the hero, just above its bottom edge (not up among the buttons) — _10px from the edge_
- nothing sticks out sideways — _0px over_

**Step 5 — The heartbeat line has softly rounded corners**

- the heartbeat is drawn twice (line and soft glow) along the same path
- every corner of it is a small curve, not a sharp point — _6 curves_
- the joins and ends of the stroke are round too — _round/round round/round_
- the curves still bend towards the original peak and dip points (the shape is the same, only softer) — _92,42,140,12,132,92_

**Step 6 — A phone**

- /apps/oma fits a 390 px screen — _0px over_
- /apps fits a 390 px screen — _0px over_
- no errors in the browser

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-28 15:40 | pass | 29 | 0 | headless | 6.9 s |
| 2026-11-28 14:16 | pass | 29 | 0 | headless | 7.3 s |
| 2026-11-28 14:13 | pass | 29 | 0 | headless | 7.8 s |
| 2026-11-28 14:12 | pass | 29 | 0 | headless | 7.6 s |
| 2026-11-28 14:12 | error | 0 | 0 | headless | 7.3 s |
| 2026-11-28 14:11 | fail | 27 | 2 | headless | 8.0 s |
| 2026-11-28 14:07 | pass | 19 | 0 | headless | 20.8 s |
| 2026-11-28 14:04 | pass | 15 | 0 | headless | 8.3 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t142-website-hero-glow.mjs`), not this page._
