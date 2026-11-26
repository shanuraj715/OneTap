# T49 — Storefront item pop-up — the picture is set in from the edges with rounded corners and has a close button; the name has the veg mark and the price; sizes and extras are tiles that light up; the Add row stays at the bottom while the choices scroll

**Area:** storefront · **Last result:** ✅ PASSED (42 passed, 0 failed · 2026-11-26 12:38 · headless · 20.6 s)

**Run it alone:** `node run.mjs --only t49` (add `--visible` to watch it)

## What this test does

Runs suites/storefront-item-popup.mjs against the bench store in Chrome. Three add-on groups (dips, sides, drinks, with a free option) are attached to a dish with two sizes, then its pop-up is opened on a desktop and a phone: the picture does not touch the pop-up's edges (at least 12px of space left, right and top) and has rounded corners; the name has the veg / non-veg mark in front and the price beside it ('from ₹60'); 'Choose a size' says Required and each extras group says Optional; extras read '+₹30' and a free one says 'Free'; a round close button sits on the picture's top right and closes the pop-up, and so do Escape, pressing outside and Cancel. The size and extra choices are tiles: the chosen one is highlighted and choosing another moves the highlight; the Add button shows the price of the size, adds an extra's price when ticked and doubles with 'One more'; Add puts it in the cart and closes the pop-up. On a short 390×560 phone the choices scroll inside the pop-up while the Add row does not move and stays fully on screen, and the last choice can be scrolled fully into view. The dish's own add-on groups are put back and the test groups deleted.

## Steps

1. the item pop-up: desktop
2. the item pop-up: phone
3. a short screen: the choices scroll, the Add button stays in view

## What to expect (these must happen)

- The picture has space around it and rounded corners; there is a round close button on it.
- The name has the veg / non-veg mark and the price next to it; sections say Required / Optional; free extras say Free.
- Chosen sizes and extras are highlighted; the Add button's total follows the choices and quantity.
- Escape, outside press, Cancel and the close button all close it; on a short screen the Add row stays in view while the choices scroll.

## What must NOT happen

- The picture must NOT start exactly at the pop-up's edge.
- The pop-up must NOT be taller than the screen, nor hide the Add button when there are many choices.
- Choosing must NOT change the pop-up's size or position in a way that moves the Add button.
- The browser must NOT log errors or warnings.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (42)

**Step 1 — the item pop-up: desktop**

- desktop: the picture does not touch the pop-up's edges (19px left, 19px right, 17px top) — _{"left":19,"right":19,"top":17,"radius":16,"vh":900,"mTop":45,"mBottom":855}_
- desktop: the picture has rounded corners — _16px_
- desktop: the pop-up fits inside the screen — _45–855 of 900_
- desktop: the name has the veg / non-veg mark in front — _Veg Steamed Momos_
- desktop: the price shows beside the name ("from ₹60" for a dish with sizes)
- desktop: each choice section says whether it is required or optional
- desktop: extras show "+₹30"; a free one says "Free"
- desktop: a round close button sits at the top right of the picture — _{"x":877,"y":72,"width":34,"height":34}_
- desktop: it closes the pop-up
- desktop: Escape closes it
- desktop: pressing outside closes it
- desktop: Cancel closes it
- desktop: the chosen size's tile is highlighted, the other is not
- desktop: choosing the other size moves the highlight
- desktop: the Add button shows the price of the chosen size — _Add · ₹90_
- desktop: a ticked extra lights up the same way
- desktop: …and its price is added to the Add button (₹90 + ₹30) — _Add · ₹120_
- desktop: a second portion doubles it — _Add · ₹240_
- desktop: Add puts it in the cart and closes the pop-up

**Step 2 — the item pop-up: phone**

- phone: the picture does not touch the pop-up's edges (19px left, 19px right, 17px top)
- phone: the picture has rounded corners — _16px_
- phone: the pop-up fits inside the screen — _42–802 of 844_
- phone: the name has the veg / non-veg mark in front — _Veg Steamed Momos_
- phone: the price shows beside the name ("from ₹60" for a dish with sizes)
- phone: each choice section says whether it is required or optional
- phone: extras show "+₹30"; a free one says "Free"
- phone: a round close button sits at the top right of the picture — _{"x":311,"y":69.203125,"width":34,"height":34}_
- phone: it closes the pop-up
- phone: Escape closes it
- phone: pressing outside closes it
- phone: Cancel closes it
- phone: the chosen size's tile is highlighted, the other is not
- phone: choosing the other size moves the highlight
- phone: the Add button shows the price of the chosen size — _Add · ₹90_
- phone: a ticked extra lights up the same way
- phone: …and its price is added to the Add button (₹90 + ₹30) — _Add · ₹120_
- phone: a second portion doubles it — _Add · ₹240_
- phone: Add puts it in the cart and closes the pop-up

**Step 3 — a short screen: the choices scroll, the Add button stays in view**

- the choices are taller than the pop-up, so they scroll inside it
- the Add button does not move while scrolling and is fully on the screen
- scrolled to the end, the last choice is fully visible above the Add row
- the browser logged no errors or warnings

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-26 12:38 | pass | 42 | 0 | headless | 20.6 s |
| 2026-11-26 11:49 | pass | 42 | 0 | headless | 22.1 s |
| 2026-11-26 10:39 | pass | 42 | 0 | headless | 19.6 s |
| 2026-11-25 12:00 | pass | 42 | 0 | headless | 18.3 s |
| 2026-11-25 10:49 | pass | 42 | 0 | headless | 20.5 s |
| 2026-11-25 10:35 | pass | 42 | 0 | headless | 20.3 s |
| 2026-11-25 09:55 | pass | 42 | 0 | headless | 19.6 s |
| 2026-11-21 15:12 | pass | 42 | 0 | headless | 19.3 s |
| 2026-11-21 05:00 | pass | 42 | 0 | headless | 19.2 s |
| 2026-11-21 01:12 | pass | 42 | 0 | headless | 17.6 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t49-storefront-item-popup.mjs`), not this page._
