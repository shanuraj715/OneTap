# T44 — Website header — the Product dropdown is wide, fits the window, and its hovered item is a soft rounded tile with a brand-filled icon (not a grey pill), in light and dark

**Area:** website · **Last result:** ✅ PASSED (53 passed, 0 failed · 2026-11-20 00:32 · headless · 9.6 s)

**Run it alone:** `node run.mjs --only t44` (add `--visible` to watch it)

## What this test does

Runs suites/website-product-menu.mjs: it renders the REAL website header component and loads the REAL stylesheet into Chrome (no servers needed). Hovering Product opens the six-item panel; the hovered item is filled with the soft paper colour with 12px corners and the dropdown's own padding and type — it used to wear the header links' pill shape and grey wash because `.nav a` out-ranked `.dd-item` — and its icon tile fills with the brand colour; moving the pointer moves the highlight; Tab onto an item gives the same highlight plus a focus ring; all of it again in dark mode; the header links (Pricing, FAQ…) keep their pill, and the phone Menu's Product rows are unchanged. The panel was also widened (420px → 580px, so descriptions wrap onto fewer lines) and is placed against the header row (its right edge lines up with the 'Talk to us' button) so it stays fully inside the window at 1440, 1280, 1100, 1024 and 900px; the pointer can travel from Product down to the first and last item without the panel closing, and moving away closes it. Screenshots are kept for light and dark.

## Steps

- _(set-up)_
1. light theme
2. dark theme
3. the panel is wide enough, and fits every desktop window
4. the pointer can travel from Product down into the panel without it closing
5. the header links themselves are unchanged
6. a phone: the Product list inside the Menu is unaffected

## What to expect (these must happen)

- The hovered Product item is a softly rounded tile (about 12px) filled with the paper colour, inside the panel, one column wide.
- Its icon tile turns brand-coloured; items at rest have no background; only one item is highlighted at a time.
- Keyboard focus gives the same highlight and a visible ring; dark mode works too.
- The panel is wide (580px) with every description in at most 2 lines, and sits fully inside the window from 900px up.
- The panel stays open while the pointer moves from Product onto its items, and closes when the pointer leaves.
- Header links keep their pill shape; the phone menu is unchanged.

## What must NOT happen

- The hovered item must NOT be a full pill (999px corners) with a grey wash.
- The dropdown items must NOT pick up the header links' 15px / 500 type or padding.
- The browser must NOT log errors or warnings.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (53)

**Set-up — Setup**

- the real header rendered (Product dropdown + header links)

**Step 1 — light theme**

- the dropdown is closed until the pointer is over Product
- hovering Product opens the panel with all 6 items — _6 items_
- an item at rest has no background — _rgba(0, 0, 0, 0)_
- the hovered item is filled with the soft paper colour — _rgb(245, 244, 240) vs paper rgb(245, 244, 240)_
- …which differs from the white panel behind it, so it shows
- …as a softly rounded tile (12px corners), not a pill — _12px_
- …with the dropdown's own padding — _10px 12px_
- …and not the header links' 15px/500 type — _16.5px/400_
- the title keeps its bold weight — _600_
- the icon tile fills with the brand colour (white icon) so the highlight reads clearly — _rgb(200, 55, 45) / rgb(255, 255, 255)_
- the other items' icon tiles stay in the soft tint — _color(srgb 0.980588 0.929412 0.925882)_
- the highlight stays inside the panel (nothing spills over its edge)
- …and is one column wide
- moving the pointer moves the highlight (only one item highlighted)
- Tab onto an item gives the same highlight plus a visible focus ring — _dd-item · rgb(245, 244, 240) · outline solid 2px_

**Step 2 — dark theme**

- the dropdown is closed until the pointer is over Product
- hovering Product opens the panel with all 6 items — _6 items_
- an item at rest has no background — _rgba(0, 0, 0, 0)_
- the hovered item is filled with the soft paper colour — _rgb(18, 17, 15) vs paper rgb(18, 17, 15)_
- …which differs from the white panel behind it, so it shows
- …as a softly rounded tile (12px corners), not a pill — _12px_
- …with the dropdown's own padding — _10px 12px_
- …and not the header links' 15px/500 type — _16.5px/400_
- the title keeps its bold weight — _600_
- the icon tile fills with the brand colour (white icon) so the highlight reads clearly — _rgb(200, 55, 45) / rgb(255, 255, 255)_
- the other items' icon tiles stay in the soft tint — _color(srgb 0.214431 0.116863 0.104)_
- the highlight stays inside the panel (nothing spills over its edge)
- …and is one column wide
- moving the pointer moves the highlight (only one item highlighted)
- Tab onto an item gives the same highlight plus a visible focus ring — _dd-item · rgb(18, 17, 15) · outline solid 2px_

**Step 3 — the panel is wide enough, and fits every desktop window**

- 1440px window: the panel sits fully inside the window — _x 688 → 1268 of 1440_
- 1440px window: the panel is wide (580px, it was 420px)
- 1440px window: every description fits in at most 2 lines — _lines per description: 1,1,2,1,1,1_
- 1280px window: the panel sits fully inside the window — _x 608 → 1188 of 1280_
- 1280px window: the panel is wide (580px, it was 420px)
- 1280px window: every description fits in at most 2 lines — _lines per description: 1,1,2,1,1,1_
- 1100px window: the panel sits fully inside the window — _x 488 → 1068 of 1100_
- 1100px window: the panel is wide (580px, it was 420px)
- 1100px window: every description fits in at most 2 lines — _lines per description: 1,1,2,1,1,1_
- 1024px window: the panel sits fully inside the window — _x 412 → 992 of 1024_
- 1024px window: every description fits in at most 2 lines — _lines per description: 1,1,2,1,1,1_
- 900px window: the panel sits fully inside the window — _x 288 → 868 of 900_
- 900px window: every description fits in at most 2 lines — _lines per description: 1,1,2,1,1,1_

**Step 4 — the pointer can travel from Product down into the panel without it closing**

- moving straight from Product onto the first item keeps the panel open
- …and that item is highlighted
- moving across the panel to the last item keeps it open
- moving away closes it

**Step 5 — the header links themselves are unchanged**

- Pricing / FAQ / About / Contact keep their pill shape and type — _{"borderTopLeftRadius":"999px","fontSize":"15px","fontWeight":"500","paddingLeft":"12px"}_
- a hovered header link still gets its own light grey pill — _color(srgb 0.101961 0.0941176 0.0823529 / 0.06)_

**Step 6 — a phone: the Product list inside the Menu is unaffected**

- the phone menu's Product rows still look as before — _{"display":"flex","borderTopLeftRadius":"10px"}_
- …and highlight with the paper colour
- the browser logged no errors or warnings

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-20 00:32 | pass | 53 | 0 | headless | 9.6 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t44-website-product-menu.mjs`), not this page._
