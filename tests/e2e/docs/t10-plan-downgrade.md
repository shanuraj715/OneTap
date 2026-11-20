# T10 — Plan downgrade Pro → Basic — what stops, what keeps working, grace period, after the grace period, a manually disabled outlet

**Area:** plans · **Last result:** ✅ PASSED (38 passed, 0 failed · 2026-11-21 03:37 · headless · 52.2 s)

**Run it alone:** `node run.mjs --only t10` (add `--visible` to watch it)

## What this test does

Continues from t09, in Chrome. The platform moves the store to Basic: it goes 'over limit' with a grace period; the three outlets keep serving customers and taking orders, but new outlets, delivery, the coin wallet and coupons are locked and the owner's dashboard shows a notice with the deadline. When the grace period has ended nothing is blocked automatically. Then the platform disables outlet 3 by hand: customers see 'temporarily unavailable' and can't order, the other outlets are unaffected, and it can be switched back on.

## Steps

1. Before: the store is on Pro and customers can choose Delivery
2. The platform moves the store from Pro down to Basic
3. During grace: what the owner sees and what is locked
4. During grace: the customer's side
5. After the grace period (set to 0 days): is anything blocked automatically?
6. The platform disables outlet 3 by hand — what a customer sees

## What to expect (these must happen)

- Right after the downgrade the platform page shows the store over its limits with a grace deadline; the owner's dashboard shows 'Everything keeps working until …'.
- During grace all 3 outlets still open for customers and accept orders; the owner can still sign in and change settings.
- Locked on Basic: 'Add outlet' is greyed out, creating a coupon is refused, customers can no longer choose Delivery (it is still listed, but greyed out) — while .
- After the grace period the owner's notice says the grace period ended; still nothing is blocked automatically.
- Disabling outlet 3: its page says 'This outlet is temporarily unavailable' with no menu; outlets 1 and 2 are unaffected; enabling it again brings the menu back.

## What must NOT happen

- The downgrade must NOT delete or switch off any outlet, menu or setting by itself.
- A Basic store must NOT be able to add an outlet, create coupons, switch delivery on or offer it to customers.
- The end of the grace period must NOT block outlets or the owner automatically.
- A disabled outlet must NOT show its menu; the other outlets must NOT be affected.
- The browser must NOT log JavaScript errors.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (38)

**Step 1 — Before: the store is on Pro and customers can choose Delivery**

- the platform shows Pro with 3 of 3 outlets and no grace period — _Within plan People 1 / 10 Outlets 3 / 3 Store name Shown in the storefr_
- customers are offered Delivery at Central (and can choose it) — _Takeaway Delivery_
- the grace period is set to 7 days

**Step 2 — The platform moves the store from Pro down to Basic**

- the platform page now shows Basic with 3 outlets against a limit of 1 — _Over its limits since Nov 21, 2026. Everything keeps working until Nov 28, 2026; aft_
- …and says the store is over its limits, with the 7-day grace deadline
- did not happen: the downgrade blocked an outlet by itself

**Step 3 — During grace: what the owner sees and what is locked**

- the owner's dashboard shows 'Your store has 3 outlets (plan allows 1)' and 'Everything keeps working until …'
- did not happen: an outlet can be added while over the limit
- 'Add outlet' is greyed out — _Multiple outlets aren't included in your plan._
- did not happen: a coupon is created on Basic
- …with the plan message
- Settings → Features shows Delivery as 'Not in your plan' (no switch to turn on)
- did not happen: the Features tab still offers a Delivery switch
- Settings → Coin wallet says it isn't in the plan
- the owner can still edit and save settings

**Step 4 — During grace: the customer's side**

- outlet "central" still opens
- outlet "second" still opens
- outlet "third" still opens
- Delivery is still listed, but greyed out and can't be chosen — _Takeaway Delivery_
- did not happen: customers can still choose Delivery
- a customer can still place a takeaway order at outlet 2 — _order #0005_

**Step 5 — After the grace period (set to 0 days): is anything blocked automatically?**

- the platform page says the grace period has ended
- the owner's dashboard says 'The grace period ended on …'
- did not happen: an outlet was blocked automatically when the grace period ended
- customers can still open outlet 2
- …and still order — _order #0006_
- did not happen: an outlet can be added after the grace period

**Step 6 — The platform disables outlet 3 by hand — what a customer sees**

- the Outlets tab shows Third as blocked
- customers see 'This outlet is temporarily unavailable' — _Lifecycle Third This outlet is temporarily unavailable. Please check back soon._
- did not happen: the disabled outlet still shows its menu
- did not happen: the disabled outlet still offers 'Add' buttons to order
- did not happen: outlet "central" is affected by outlet 3 being disabled
- did not happen: outlet "second" is affected by outlet 3 being disabled
- the store's address still opens
- the disabled outlet no longer counts toward the limit: 2 outlets in use — _Over limit People 1 / 3 Outlets 2 / 1 1 outlet, 0 people blocked Store name Shown in_
- enabling it again brings the menu back
- outlet 3 is left disabled for the next tests
- did not happen: the browser logged JavaScript errors

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-21 03:37 | pass | 38 | 0 | headless | 52.2 s |
| 2026-11-20 11:00 | pass | 38 | 0 | headless | 52.7 s |
| 2026-11-20 05:44 | pass | 38 | 0 | headless | 53.5 s |
| 2026-11-20 05:35 | pass | 38 | 0 | headless | 53.3 s |
| 2026-11-20 05:29 | error | 14 | 4 | headless | 2 min 20 s |
| 2026-11-20 05:20 | error | 10 | 1 | headless | 1 min 45 s |
| 2026-11-20 05:10 | error | 10 | 1 | headless | 1 min 45 s |
| 2026-11-20 04:40 | error | 1 | 2 | headless | 1 min 37 s |
| 2026-11-20 04:16 | pass | 38 | 0 | headless | 52.8 s |
| 2026-11-20 00:08 | pass | 38 | 0 | headless | 52.2 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t10-plan-downgrade.mjs`), not this page._
