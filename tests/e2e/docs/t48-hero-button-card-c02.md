# T48 — Storefront — no 'Order takeaway' button at the top; card C02 (Thumbnail left) shows the price right after the veg / non-veg mark with full-width title and description; every item card cuts its description at one line with an ellipsis

**Area:** storefront · **Last result:** ✅ PASSED (69 passed, 0 failed · 2026-11-26 11:49 · headless · 51.2 s)

**Run it alone:** `node run.mjs --only t48` (add `--visible` to watch it)

## What this test does

Runs suites/storefront-hero-card-c02.mjs against the bench store in Chrome. Menu page of an outlet on a desktop, on a phone and the other outlet: the area under the store name has no button or link, the words 'Order takeaway' appear nowhere, and the Takeaway / Delivery order bar is still there. Then two test dishes (one with a long name, a long description and the 'spicy' tag; one non-veg) are put in a category and the outlet's item card style is set to C02 'Thumbnail left' through the API: on a desktop and a phone each card shows the veg / non-veg mark, then the PRICE on the same line right after it, then the 'spicy' tag; the price is no longer alone at the right edge of the card; the title and the description run to the card's right padding (the full width left after the 72×72 picture); the long description wraps over several lines in that wide column; no sideways scroll. Then, with the same long description (about 570 characters) and a short one ('Crispy wings.'), EVERY item card style is tried on a desktop — C01 to C11: the long description is held to ONE line (CSS line clamp of 1, the rest cut off so the … shows), the short one is left on one line, and the two styles that show no description (C08 portrait, C09 circle) stay without; the dish pop-up that opens when a dish is chosen still shows the whole description. The test dishes are deleted and the card style put back.

## Steps

1. top of the menu page: desktop
2. top of the menu page: phone
3. top of the menu page: the other outlet
4. card C02: desktop
5. card C02: phone
6. every item card style: the description stops at ONE line

## What to expect (these must happen)

- No button or link under the store name at the top of the menu page, and no 'Order takeaway' text anywhere; the order bar is still there.
- Card C02: the price is on the first line right after the veg / non-veg mark (tags after it), the title and description take the card's full width, the thumbnail is unchanged.
- On every card style that shows a description it is ONE line, ending with an ellipsis when longer; the dish pop-up still shows all of it.

## What must NOT happen

- The price must NOT sit alone at the right edge of a C02 card.
- The title / description must NOT be narrowed by a price column.
- A description must NOT run to a second line on any item card.
- A short description must NOT be altered.
- The browser must NOT log errors or warnings.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (69)

**Step 1 — top of the menu page: desktop**

- desktop: the area under the store name has no button or link — _Acme Momos Steamed, fried and made to order_
- desktop: "Order takeaway" appears nowhere on the page
- desktop: the Takeaway / Delivery order bar is still there (only the extra button went)

**Step 2 — top of the menu page: phone**

- phone: the area under the store name has no button or link — _Acme Momos Steamed, fried and made to order_
- phone: "Order takeaway" appears nowhere on the page
- phone: the Takeaway / Delivery order bar is still there (only the extra button went)

**Step 3 — top of the menu page: the other outlet**

- the other outlet: the area under the store name has no button or link — _Acme Momos Steamed, fried and made to order_
- the other outlet: "Order takeaway" appears nowhere on the page
- the other outlet: the Takeaway / Delivery order bar is still there (only the extra button went)

**Step 4 — card C02: desktop**

- desktop: both test dishes are shown in the Thumbnail-left card — _2_
- desktop: "C02 Chicken Wings" — the price (₹220) comes right after the veg / non-veg mark, on the same line
- desktop: "C02 Chicken Wings" — the price is above the title, not beside it at the edge
- desktop: "C02 Chicken Wings" — the title runs to the card's right padding (13px from the edge, padding 12px)
- desktop: "C02 Chicken Wings" — the description takes the full width too (13px from the edge)
- desktop: "C02 Chicken Wings" — the thumbnail is still 72×72 at the left — _72×72_
- desktop: "C02 Paneer Tikka Platter With " — the price (₹180) comes right after the veg / non-veg mark, on the same line
- desktop: "C02 Paneer Tikka Platter With " — the price is above the title, not beside it at the edge
- desktop: "C02 Paneer Tikka Platter With " — the title runs to the card's right padding (13px from the edge, padding 12px)
- desktop: "C02 Paneer Tikka Platter With " — the description takes the full width too (13px from the edge)
- desktop: "C02 Paneer Tikka Platter With " — the thumbnail is still 72×72 at the left — _72×72_
- desktop: the "spicy" tag follows the price — _true_
- desktop: the very long description is cut at ONE line, inside the wide column — _1 lines_
- desktop: no sideways scroll — _0_

**Step 5 — card C02: phone**

- phone: both test dishes are shown in the Thumbnail-left card — _2_
- phone: "C02 Chicken Wings" — the price (₹220) comes right after the veg / non-veg mark, on the same line
- phone: "C02 Chicken Wings" — the price is above the title, not beside it at the edge
- phone: "C02 Chicken Wings" — the title runs to the card's right padding (13px from the edge, padding 12px)
- phone: "C02 Chicken Wings" — the description takes the full width too (13px from the edge)
- phone: "C02 Chicken Wings" — the thumbnail is still 72×72 at the left — _72×72_
- phone: "C02 Paneer Tikka Platter With " — the price (₹180) comes right after the veg / non-veg mark, on the same line
- phone: "C02 Paneer Tikka Platter With " — the price is above the title, not beside it at the edge
- phone: "C02 Paneer Tikka Platter With " — the title runs to the card's right padding (13px from the edge, padding 12px)
- phone: "C02 Paneer Tikka Platter With " — the description takes the full width too (13px from the edge)
- phone: "C02 Paneer Tikka Platter With " — the thumbnail is still 72×72 at the left — _72×72_
- phone: the "spicy" tag follows the price — _true_
- phone: the very long description is cut at ONE line, inside the wide column — _1 lines_
- phone: no sideways scroll — _0_

**Step 6 — every item card style: the description stops at ONE line**

- C01 row-compact: a very long description is held to ONE line — _{"lines":1,"clamp":"1","cut":true}_
- C01 row-compact: the rest is cut off (that is where the … shows) — _{"lines":1,"clamp":"1","cut":true}_
- C01 row-compact: a short description is left alone, on one line — _{"lines":1,"clamp":"1","cut":false}_
- C02 row-thumb-left: a very long description is held to ONE line — _{"lines":1,"clamp":"1","cut":true}_
- C02 row-thumb-left: the rest is cut off (that is where the … shows) — _{"lines":1,"clamp":"1","cut":true}_
- C02 row-thumb-left: a short description is left alone, on one line — _{"lines":1,"clamp":"1","cut":false}_
- C03 row-thumb-right: a very long description is held to ONE line — _{"lines":1,"clamp":"1","cut":true}_
- C03 row-thumb-right: the rest is cut off (that is where the … shows) — _{"lines":1,"clamp":"1","cut":true}_
- C03 row-thumb-right: a short description is left alone, on one line — _{"lines":1,"clamp":"1","cut":false}_
- C04 image-top: a very long description is held to ONE line — _{"lines":1,"clamp":"1","cut":true}_
- C04 image-top: the rest is cut off (that is where the … shows) — _{"lines":1,"clamp":"1","cut":true}_
- C04 image-top: a short description is left alone, on one line — _{"lines":1,"clamp":"1","cut":false}_
- C05 image-top-badge: a very long description is held to ONE line — _{"lines":1,"clamp":"1","cut":true}_
- C05 image-top-badge: the rest is cut off (that is where the … shows) — _{"lines":1,"clamp":"1","cut":true}_
- C05 image-top-badge: a short description is left alone, on one line — _{"lines":1,"clamp":"1","cut":false}_
- C06 text-above-image: a very long description is held to ONE line — _{"lines":1,"clamp":"1","cut":true}_
- C06 text-above-image: the rest is cut off (that is where the … shows) — _{"lines":1,"clamp":"1","cut":true}_
- C06 text-above-image: a short description is left alone, on one line — _{"lines":1,"clamp":"1","cut":false}_
- C07 image-overlay: a very long description is held to ONE line — _{"lines":1,"clamp":"1","cut":true}_
- C07 image-overlay: the rest is cut off (that is where the … shows) — _{"lines":1,"clamp":"1","cut":true}_
- C07 image-overlay: a short description is left alone, on one line — _{"lines":1,"clamp":"1","cut":false}_
- C08 portrait: this card style shows no description (nothing to cut)
- C09 circle: this card style shows no description (nothing to cut)
- C10 menu-line: a very long description is held to ONE line — _{"lines":1,"clamp":"1","cut":true}_
- C10 menu-line: the rest is cut off (that is where the … shows) — _{"lines":1,"clamp":"1","cut":true}_
- C10 menu-line: a short description is left alone, on one line — _{"lines":1,"clamp":"1","cut":false}_
- C11 featured-wide: a very long description is held to ONE line — _{"lines":1,"clamp":"1","cut":true}_
- C11 featured-wide: the rest is cut off (that is where the … shows) — _{"lines":1,"clamp":"1","cut":true}_
- C11 featured-wide: a short description is left alone, on one line — _{"lines":1,"clamp":"1","cut":false}_
- the dish pop-up still shows the full description, not the shortened one
- the test dishes are removed and the card style is put back — _200_
- the browser logged no errors or warnings

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-26 11:49 | pass | 69 | 0 | headless | 51.2 s |
| 2026-11-26 10:39 | pass | 69 | 0 | headless | 31.9 s |
| 2026-11-25 12:00 | pass | 69 | 0 | headless | 26.3 s |
| 2026-11-25 10:52 | fail | 10 | 3 | headless | 8.5 s |
| 2026-11-25 10:49 | fail | 10 | 3 | headless | 8.9 s |
| 2026-11-25 10:35 | pass | 69 | 0 | headless | 39.0 s |
| 2026-11-25 09:55 | pass | 69 | 0 | headless | 31.4 s |
| 2026-11-21 15:11 | pass | 69 | 0 | headless | 30.7 s |
| 2026-11-21 05:00 | pass | 69 | 0 | headless | 28.0 s |
| 2026-11-21 01:12 | pass | 69 | 0 | headless | 26.6 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t48-hero-button-card-c02.mjs`), not this page._
