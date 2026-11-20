# T42 — Storefront — the Takeaway / Delivery choice (menu page and checkout) always shows both; one the outlet doesn't offer is shown greyed out and can't be chosen

**Area:** storefront · **Last result:** ✅ PASSED (39 passed, 0 failed · 2026-11-20 16:05 · headless · 29.9 s)

**Run it alone:** `node run.mjs --only t42` (add `--visible` to watch it)

## What this test does

Runs suites/storefront-order-type.mjs against the bench stores in Chrome. A takeaway-only outlet (Acme's second outlet) shows BOTH 'Takeaway' (selected, available) and 'Delivery' (disabled, faded, 'not allowed' pointer, a tooltip, and a line under the switch saying 'Delivery isn't available from this outlet.'); pressing Delivery does nothing, the Tab key skips it, and a remembered 'delivery' from another outlet doesn't select it here. An outlet with both lets either be chosen and shows no 'isn't available' line. Beta Bites — ONE outlet, takeaway only — now shows the switch too (the bar used to be hidden when there was nothing to choose between). A delivery-only outlet shows Takeaway disabled and Delivery selected, with the line saying Takeaway isn't available. An outlet with neither takeaway nor delivery shows no switch. On a 390px phone the switch and its line fit and Delivery is still disabled. The outlet's settings are put back at the end. The same is checked on the CHECKOUT page ("Step 4 of 4 · Review & pay" → "How would you like it?"): with one dish in the cart and a signed-in customer, a takeaway-only outlet shows Takeaway (selected) and a greyed-out Delivery with a tooltip and the line 'Delivery isn't available from this outlet.' (pressing it does nothing — no delivery address or 'paid online' note — and the order can still be placed); an outlet with both lets the customer switch to Delivery and back; delivery switched on without online payment stays greyed out (delivery is prepaid); a delivery-only outlet greys out Takeaway and starts on Delivery; Delivery chosen on the menu page is already selected in checkout; it fits a 390px phone.

## Steps

1. takeaway-only outlet
2. an outlet with both
3. Beta Bites: one outlet, no delivery
4. delivery-only outlet
5. no takeaway and no delivery
6. phone
7. checkout page

## What to expect (these must happen)

- Takeaway and Delivery are both always shown on the menu page's order bar (when the outlet takes online orders at all).
- An order type the outlet doesn't offer is disabled and visibly off, explained by a tooltip and a line under the switch; it can't be chosen by mouse, touch or keyboard, and a remembered choice for it is ignored.
- A store with one outlet and one choice shows the switch too.
- The checkout page ('How would you like it?') shows both too, for every takeaway or delivery order: the unavailable one greyed out with the reason underneath; the one chosen on the menu page is carried over.
- No switch at all when the outlet offers neither takeaway nor delivery.

## What must NOT happen

- A disabled order type must NOT be selectable, nor be selected because it was remembered.
- The switch must NOT be hidden just because only one order type is on — on the menu page or in checkout.
- A disabled Delivery in checkout must NOT open the delivery address box or change the price.
- The browser must NOT log errors or warnings.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (39)

**Step 1 — takeaway-only outlet**

- both choices are shown, Takeaway and Delivery — _Takeaway Delivery_
- Takeaway is available and selected
- Delivery is shown but disabled, and not selected
- …and looks switched off (faded, 'not allowed' pointer) — _{"opacity":0.45,"cursor":"not-allowed"}_
- hovering it explains why
- a line under the switch says so (a phone has no hover)
- pressing Delivery does nothing
- the keyboard Tab key skips the disabled Delivery
- a remembered 'delivery' from another outlet does not select it here — _onetap.orderType_

**Step 2 — an outlet with both**

- both are available
- …and there is no 'isn't available' line
- Delivery can be chosen
- …and Takeaway again

**Step 3 — Beta Bites: one outlet, no delivery**

- the switch is there too (it used to be hidden for a one-outlet, one-choice store): Takeaway on, Delivery off

**Step 4 — delivery-only outlet**

- Takeaway is the greyed-out one, Delivery is available and selected
- and the line says Takeaway isn't available

**Step 5 — no takeaway and no delivery**

- no switch at all when the outlet takes no takeaway or delivery orders (nothing to choose)

**Step 6 — phone**

- the switch and its line fit the screen — _239px of 390_
- Delivery is disabled on a phone too, and nothing scrolls sideways

**Step 7 — checkout page**

- the checkout shows both choices, Takeaway and Delivery (it used to show none) — _🥡 Takeaway 🛵 Delivery_
- Takeaway is available and selected
- Delivery is shown but disabled, and not selected
- …and looks switched off (faded, 'not allowed' pointer) — _{"opacity":0.45,"cursor":"not-allowed"}_
- hovering it explains why
- a line under the buttons says so
- pressing Delivery does nothing — no delivery address or 'paid online' note appears
- the order can still be placed as takeaway
- both are available and there is no 'isn't available' line
- choosing Delivery works as before (selected, 'paid online' note and the address box appear)
- …and back to Takeaway
- Delivery stays greyed out while the outlet takes no online payment
- …with the same explanation
- Takeaway is the greyed-out one, Delivery is available and already selected
- and the line says Takeaway isn't available
- the delivery address part is showing
- Delivery chosen on the menu page is already selected in checkout
- the checkout buttons and their line fit the screen — _357px of 390_
- Delivery is disabled on a phone too, and nothing scrolls sideways
- the browser logged no errors or warnings

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-20 16:05 | pass | 39 | 0 | headless | 29.9 s |
| 2026-11-20 06:04 | pass | 39 | 0 | headless | 34.3 s |
| 2026-11-20 05:01 | pass | 39 | 0 | headless | 28.9 s |
| 2026-11-20 03:51 | pass | 39 | 0 | headless | 41.8 s |
| 2026-11-20 03:45 | pass | 39 | 0 | headless | 55.9 s |
| 2026-11-20 00:28 | pass | 39 | 0 | headless | 29.3 s |
| 2026-11-19 23:46 | pass | 39 | 0 | headless | 29.6 s |
| 2026-11-19 23:41 | pass | 39 | 0 | headless | 30.4 s |
| 2026-11-19 23:40 | fail | 20 | 1 | headless | 10.2 s |
| 2026-11-19 23:32 | pass | 20 | 0 | headless | 23.0 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t42-storefront-order-type.mjs`), not this page._
