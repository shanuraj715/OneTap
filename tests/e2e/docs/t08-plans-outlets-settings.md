# T08 — Plans & outlets — Basic → Pro upgrade, outlets 1-3 with menus, all outlet settings, delivery distance, load management

**Area:** plans · **Last result:** ✅ PASSED (44 passed, 0 failed · 2026-11-20 16:09 · headless · 3 min 12 s)

**Run it alone:** `node run.mjs --only t08` (add `--visible` to watch it) · starts from fresh fake data

## What this test does

In Chrome: the platform creates a Basic, a Pro and a Custom plan and a store on each. The Basic store's owner finds 'Add outlet' greyed out; after the platform upgrades the store to Pro the owner creates outlets 2 and 3 (a 4th is refused). Every outlet gets a menu and a full set of settings through the Settings screen (identity + location, opening hours, alerts, order handling, prep time, order limits, delivery, receipts, features, wallet, load management) which are read back after a reload and checked for isolation between outlets. Delivery distance is checked on the storefront with the browser's location (inside / outside each outlet's radius), and load management with real customer orders. Start of the t08–t12 chain: the later tests continue with this store.

## Steps

1. Platform console → Plans: create Basic, Pro and Custom
2. Platform console → Stores: create a store on each plan
3. As the Basic store's owner: try to add a second outlet, a coupon, and switch delivery on
4. The platform upgrades the store from Basic to Pro
5. The owner adds outlets 2 and 3 — and a 4th is refused
6. Add a category and menu items to every outlet
7. Configure each outlet in Settings: identity, location, hours, alerts, order handling, delivery, receipts, features, wallet, load management
8. Reload Settings for each outlet: every value must be exactly as saved, and independent of the others
9. Give each outlet the name customers see — Settings → Outlets → ✎ (the Store name in Settings is the whole store's and can't be edited there)
10. Delivery distance on the storefront: inside and outside each outlet's radius (using the browser's location)
11. Load management on Second (busy at 2 orders, stop at 4): the customer's checkout and the dashboard
12. The Pro store and the Custom store get what their plans give them

## What to expect (these must happen)

- A Basic store's owner can't add a second outlet: the 'Add outlet' button is greyed out and says why.
- Coupons are refused on Basic with the plan message; after the upgrade to Pro they can be created.
- After the upgrade the owner creates outlets 2 and 3; the platform page shows 3 of 3 outlets; a 4th is refused ('Your plan allows 3 outlets.').
- Each outlet has its own menu on its own storefront page, and its own settings; saving one outlet changes nothing on the others.
- Every saved setting shows exactly the same after reloading Settings.
- Delivery: the storefront tells a customer inside the radius 'We deliver here' with that outlet's fee and distance, and one outside the radius that delivery isn't possible.
- Load management: at the busy threshold checkout shows the outlet's own 'busy' message; at the stop threshold the stop message appears and Delivery is still listed but greyed out, so it can no longer be chosen; after the orders are cancelled it returns to normal.
- A Pro store gets 3 outlets and every feature; a Custom store starts with nothing and gets exactly what the platform sets by hand.

## What must NOT happen

- A Basic store must NOT get a 2nd outlet or coupons.
- A 4th outlet must NOT be created on a Pro plan limited to 3.
- One outlet's settings or menu must NOT leak into another outlet.
- A customer must NOT be offered delivery to an address outside the delivery radius.
- A customer must NOT be able to choose delivery while load management has it stopped.
- A Custom store must NOT get a 3rd outlet when limited to 2.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (44)

**Step 1 — Platform console → Plans: create Basic, Pro and Custom**

- all three plans are listed
- Basic shows 3 people · 1 outlet
- Pro shows 10 people · 3 outlets
- Custom is marked as a custom plan

**Step 2 — Platform console → Stores: create a store on each plan**

- all three stores are listed
- each store shows its own plan

**Step 3 — As the Basic store's owner: try to add a second outlet, a coupon, and switch delivery on**

- did not happen: a Basic store's owner can add a second outlet
- the 'Add outlet' button is greyed out and says why — _Multiple outlets aren't included in your plan._
- did not happen: a Basic store creates a coupon
- …and is told coupons aren't in the plan
- Settings → Features shows Delivery as 'Not in your plan' (there is no switch to turn on)

**Step 4 — The platform upgrades the store from Basic to Pro**

- the store page now shows the Pro plan and 1 of 3 outlets

**Step 5 — The owner adds outlets 2 and 3 — and a 4th is refused**

- outlet 2 created
- outlet 3 created
- did not happen: a 4th outlet is created on a plan limited to 3
- the 'Add outlet' button is greyed out: 'Your plan allows 3 outlets.' — _Your plan allows 3 outlets._
- the Outlets page lists Central, Second and Third
- on Pro the coupon that Basic refused now works

**Step 6 — Add a category and menu items to every outlet**

- Central: the menu lists Veg Burger and Chicken Burger
- Second: the menu lists Margherita Pizza and Farmhouse Pizza
- Third: the menu lists Paneer Roll and Egg Roll

**Step 8 — Reload Settings for each outlet: every value must be exactly as saved, and independent of the others**

- Central: all 55 settings across 10 tabs read back exactly as saved
- Second: all 55 settings across 10 tabs read back exactly as saved
- Third: all 55 settings across 10 tabs read back exactly as saved

**Step 9 — Give each outlet the name customers see — Settings → Outlets → ✎ (the Store name in Settings is the whole store's and can't be edited there)**

- each outlet is listed under the name customers see

**Step 10 — Delivery distance on the storefront: inside and outside each outlet's radius (using the browser's location)**

- Central, 1.2 km away (radius 3 km): 'We deliver here' with the ₹20 fee — _We deliver here 1.2 km away · ₹20 delivery · about 20 min Coupon Apply Tota_
- did not happen: Central offers delivery 5 km away (radius 3 km)
- …and the customer is told it is too far
- Third, 5 km away (radius 8 km): 'We deliver here' with Third's own ₹40 fee — every outlet uses its own radius and fee — _We deliver here 5 km away · ₹40 delivery · about 62 min Coupon Apply Total _

**Step 11 — Load management on Second (busy at 2 orders, stop at 4): the customer's checkout and the dashboard**

- 2 orders in the queue: checkout shows Second's own 'busy' message
- 4 orders: checkout shows Second's own 'not taking orders' message
- Delivery is still listed in checkout but greyed out while load management has it stopped
- did not happen: a customer can still choose Delivery while load management has it stopped
- Central (busy only at 5 orders) shows no load message
- the dashboard's Orders screen lists the four orders — _0001, 0002, 0003, 0004_
- all four orders are cancelled in the dashboard
- after the orders are cancelled the load messages are gone again

**Step 12 — The Pro store and the Custom store get what their plans give them**

- Pro store: Pro plan, up to 3 outlets and 10 people — _Within plan People 1 / 10 Outlets 1 / 3 Store name Shown in the storefr_
- Custom store starts with nothing: 1 outlet, 1 person — _Within plan People 1 / 1 Outlets 1 / 1 Store name Shown in the storefro_
- the platform sets the Custom store to 2 outlets by hand — _Within plan People 1 / 1 Outlets 1 / 2 Store name Shown in the storefro_
- Custom store: a 2nd outlet can be added
- did not happen: a Custom store limited to 2 outlets gets a 3rd
- …the button says why — _Your plan allows 2 outlets._
- did not happen: the browser logged JavaScript errors

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-20 16:09 | pass | 44 | 0 | headless | 3 min 12 s |
| 2026-11-20 12:39 | pass | 44 | 0 | headless | 3 min 12 s |
| 2026-11-20 10:58 | pass | 44 | 0 | headless | 3 min 13 s |
| 2026-11-20 05:42 | pass | 44 | 0 | headless | 3 min 13 s |
| 2026-11-20 05:34 | pass | 44 | 0 | headless | 3 min 14 s |
| 2026-11-20 05:26 | pass | 44 | 0 | headless | 3 min 16 s |
| 2026-11-20 05:18 | fail | 43 | 1 | headless | 3 min 14 s |
| 2026-11-20 05:08 | error | 33 | 1 | headless | 3 min 4 s |
| 2026-11-20 04:38 | error | 11 | 0 | headless | 1 min 2 s |
| 2026-11-20 04:14 | pass | 43 | 0 | headless | 3 min 6 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t08-plans-outlets-settings.mjs`), not this page._
