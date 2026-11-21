# T20 — Missed-order alerts — with the feature off nothing warns anyone; with it on: banner, red row, sound, repeat, per-status messages, roles, dashboard, customer

**Area:** orders · **Last result:** ✅ PASSED (75 passed, 0 failed · 2026-11-21 04:47 · headless · 2 min 59 s)

**Run it alone:** `node run.mjs --only t20` (add `--visible` to watch it) · starts from fresh fake data

## What this test does

In Chrome. The owner of Acme Momos opens Settings → Missed-order alerts (on by default: accept within 2 minutes and finish cooking within 20 minutes; sound and reminders on), checks the limits (0 becomes 1, 241 is refused) and sets both limits to 1 minute, then switches the alerts OFF. A customer places order A and nobody touches it. After more than a minute the Orders screen shows the wait ('1m') but no banner, no red row, no 'Running late' count and no sound; the dashboard says 'In the queue 1' and 'Missed orders 0'; the order is still 'Placed' (nothing accepts or cancels it for them). The customer's screen is the same. The alerts are switched ON: the Orders screen shows a banner ('Order #A needs attention — hasn't been accepted for N minutes — the limit is 1'), a red row ('Placed Nm — over 1m limit'), 'Running late (1)', and the dashboard shows 'Missed orders 1'. The alert sound waits for a click, then chimes once; a second order B then arrives and, when it also goes late, the sound chimes again, and keeps reminding every minute while orders are still late. Dismissing the banner leaves the rows red and the count. As staff move A on, only two moments warn: an order nobody has accepted, and an order that has been Preparing longer than its limit (the timer starts when it reaches Preparing). Once A is Accepted, and again when it is Ready or Completed, nothing warns however long it sits. 'Play a sound' off and 'Keep reminding me' off are respected. The manager, cashier and kitchen see the same alerts. The customer sees nothing different and can still order.

## Steps

1. Settings → Missed-order alerts: the defaults and the limits
2. Switch the alerts OFF
3. A customer places order A and nobody accepts it (alerts OFF)
4. The alerts are switched ON (order A is still waiting)
5. ALERTS ON: banner, red row, count, dashboard
6. The sound: waits for a click, chimes, chimes for a second late order, keeps reminding
7. Dismiss all warnings: the banner and the sound stop, the rows stay red
8. Staff move A along: only 'not accepted' and 'cooking too long' warn — Accepted, Ready and Completed never do
9. 'Keep reminding me' off, and 'Play a sound' off
10. The manager, the cashier and the kitchen see the same alerts
11. The customer's side

## What to expect (these must happen)

- Settings → Missed-order alerts starts ticked with 2 / 20 minutes (accept / finish cooking), 'Play a sound' and 'Keep reminding me' ticked; there are no 'start cooking' or 'hand over' limits; typing 0 gives 1; 241 is refused with 'Validation failed' and not saved; 1 / 1 saves.
- Switched off, the limits, the sound and the reminder boxes disappear and stay off after a reload.
- ALERTS OFF, order unattended for over a minute: the Orders row shows 'Placed' with the wait '1m' in the normal colour; no banner, no red row, 'Running late' has no count and shows no order; dashboard 'In the queue 1', 'Missed orders 0'; no sound; the order is still Placed.
- ALERTS ON: banner 'Order #A needs attention' with '#A hasn't been accepted for N minutes — the limit is 1.'; the row is red with 'Placed Nm — over 1m limit'; 'Running late (1)'; 'Show late orders' lists only the late order; the dashboard says 'Missed orders 1'.
- The sound is waiting for a click ('Click anywhere once to allow the alert sound.'); after one click it says 'Sound on' and chimes once; when a second order goes late it chimes again; with 'Keep reminding me' it chimes again a minute later while they are still late.
- 'Dismiss all warnings' removes the banner and the sound but the rows stay red and 'Running late (2)' stays; nothing chimes again.
- After A is Accepted the warning for it goes and does NOT come back, however long it sits Accepted; Preparing starts a fresh timer and after the limit 'has been cooking longer than expected'; Ready → no warning; Completed → no warning, no timer.
- 'Play a sound' off: the banner shows but nothing chimes and it says the sound is off. 'Keep reminding me' off: one chime only, however long the order stays late.
- The manager, the cashier and the kitchen each see the banner and the red row for a late order.
- The customer's confirmation is identical with the alerts on or off; a late order is not cancelled or changed for them and they can keep ordering.

## What must NOT happen

- With the alerts off, an unattended order must NOT show a banner, a red row, a count, or play a sound.
- An order must NOT be accepted, cancelled or changed automatically because it was missed.
- Dismissing a warning must NOT make the late order look normal again.
- 'Keep reminding me' must NOT go silent while the order is still late.
- A new late order must NOT be missed because an earlier one was dismissed.
- 'Play a sound' off must NOT chime.
- The customer must NOT see anything different, or a warning, because staff missed the order.
- The browser must NOT log JavaScript errors.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (75)

**Step 1 — Settings → Missed-order alerts: the defaults and the limits**

- the switch 'Warn me about slow orders' is ticked from the start
- the limits are 2 (accept) / 20 (finish cooking) minutes — _2/20_
- did not happen: there is still a 'Start cooking within' or 'Hand over within' limit
- 'Play a sound' and 'Keep reminding me' are ticked
- typing 0 minutes gives 1 (never 0) — _1_
- 241 minutes is refused ('Validation failed')
- did not happen: the refused value 241 was saved
- 1 / 1 saves ('Settings saved.')
- after a reload both limits are 1

**Step 2 — Switch the alerts OFF**

- did not happen: the switch is still ticked after saving it off
- with it off, the limits, the sound and the reminder boxes are hidden

**Step 3 — A customer places order A and nobody accepts it (alerts OFF)**

- the customer sees 'Order #… placed' and the kitchen has it
- the counter's Orders screen has order A as 'Placed' with its wait running ('0m') — _#0001 04:44 AM Meera Late 9877700077 TA 1 ₹70 Placed 0m Accepted_
- did not happen: a banner shows for a brand-new order
- over a minute later the status still says 'Placed' and the wait shows 1m or more — _#0001 04:44 AM Meera Late 9877700077 TA 1 ₹70 Placed 1m Accepted_
- did not happen: a banner ('needs attention') is shown although the alerts are off
- did not happen: the late order's row is red although the alerts are off
- did not happen: the status says 'over 1m limit'
- 'Running late' has no count and no order in it
- did not happen: 'Running late' lists the unattended order
- no chime has played — _0_
- the dashboard says 'In the queue 1' and 'Missed orders 0' — _{"queue":1,"missed":0}_
- after all that time the order is still just 'Placed' (not accepted, not cancelled by itself) — _Placed_
- did not happen: the customer's store page mentions the delay

**Step 4 — The alerts are switched ON (order A is still waiting)**

- ticking it brings the limits back with the values saved earlier (1 / 1), sound and reminder ticked
- it saves

**Step 5 — ALERTS ON: banner, red row, count, dashboard**

- a banner names order A: 'Order #0001 needs attention'
- …with the reason and the limit: 'hasn't been accepted for N minute(s) — the limit is 1.' (N is however long it has really waited, at least 1)
- order A's row is red and its status says 'Placed Nm — over 1m limit' with the same N as the banner — _Placed 1m — over 1m limit (banner said 1)_
- 'Running late (1)' counts it — _Running late (1)_
- the wait is shown in red and bold
- 'Show late orders' lists the late order
- clicking the filter again goes back to every order
- the dashboard says 'In the queue 1' and 'Missed orders 1' — _{"queue":1,"missed":1}_

**Step 6 — The sound: waits for a click, chimes, chimes for a second late order, keeps reminding**

- before anyone clicks: 'Click anywhere once to allow the alert sound.' and no chime
- after one click on the page: 'Sound on' and one chime — _1 chimes_
- order B appears on the Orders screen by itself, and is not late yet (not red, banner still only about A)
- its arrival doesn't chime (it isn't late) — _1 chimes_
- a minute on, order B is late too: '2 orders need attention … And 1 more.'
- …and the new late order chimes (2 chimes) — _2 chimes_
- 'Keep reminding me': a minute later it chimes again while both are still late (3 chimes) — _3 chimes_
- …and another minute later again (4 chimes) — _4 chimes_
- both rows are red and 'Running late (2)' — _Running late (2)_

**Step 7 — Dismiss all warnings: the banner and the sound stop, the rows stay red**

- the banner is gone
- did not happen: dismissing made a late order look normal again (rows no longer red)
- 'Running late (2)' is still counted — _Running late (2)_
- did not happen: a dismissed warning chimes again
- did not happen: a dismissed warning's banner comes back by itself

**Step 8 — Staff move A along: only 'not accepted' and 'cooking too long' warn — Accepted, Ready and Completed never do**

- cancelling the other late order (B) takes it out of the late list: 'Running late (1)' — _Cancelled · Running late (1)_
- did not happen: a cancelled order is still red
- accepted: order A is no longer red and its status says 'Accepted' (no 'over limit') — _Accepted_
- a minute later, still Accepted: NO warning (an accepted order is not the alert's business — only 'not accepted' and 'cooking too long' are) — _Accepted · banner 0_
- preparing: no warning for A yet (a fresh timer starts now) — _Preparing_
- '#A has been cooking longer than expected for N minute(s) — the limit is 1.'
- A had been dismissed as 'not accepted' — it speaks up again because this is a different delay
- order A is red: 'Preparing Nm — over 1m limit' — _Preparing 1m — over 1m limit_
- ready: NO warning, however long it waits — the warning from cooking is gone and none replaces it — _Ready · banner 0_
- completed: order A has no timer and no warning — _Completed · #0001 04:44 AM Meera Late 9877700077 TA 1 ₹70 Completed —_
- nothing is late any more: 'Running late' has no count — _Running late_

**Step 9 — 'Keep reminding me' off, and 'Play a sound' off**

- reminders off: the late order chimes once… — _1 chimes_
- did not happen: …and chimes again although 'Keep reminding me' is off
- the banner is still there (the warning stays, only the repeating stops)
- sound off: the banner still warns about the late order
- did not happen: a chime played although 'Play a sound' is off
- the banner says the sound is off (not 'Sound on')

**Step 10 — The manager, the cashier and the kitchen see the same alerts**

- the manager sees the banner for the late order (#0003)
- …and order #0003 is red there too
- the cashier sees the banner for the late order (#0003)
- …and order #0003 is red there too
- the kitchen sees the banner for the late order (#0003)
- …and order #0003 is red there too

**Step 11 — The customer's side**

- a customer can still order while orders are late; their confirmation reads exactly like before the alerts were on
- did not happen: the customer's confirmation mentions a delay or a late order
- their new order simply appears on the Orders screen like any other
- did not happen: the browser logged JavaScript errors

### 🔎 Findings (not a pass/fail, but you should know)

- Missed-order alerts: a limit over 240 minutes is refused with only 'Validation failed' — it doesn't say which box or what the maximum is.
- A missed order is never escalated: nobody is messaged and it is not cancelled — the only signs are the Orders screen alerts and the dashboard's 'Missed orders'.
- The customer has no way to see that their order is waiting or late — their confirmation never changes (see also T01: there is no order-tracking page).

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-21 04:47 | pass | 75 | 0 | headless | 2 min 59 s |
| 2026-11-21 04:24 | pass | 75 | 0 | headless | 2 min 55 s |
| 2026-11-21 03:41 | pass | 75 | 0 | headless | 2 min 55 s |
| 2026-11-20 16:03 | pass | 75 | 0 | headless | 2 min 56 s |
| 2026-11-20 12:43 | pass | 75 | 0 | headless | 2 min 60 s |
| 2026-11-20 11:11 | pass | 74 | 0 | headless | 2 min 56 s |
| 2026-11-20 05:54 | pass | 74 | 0 | headless | 2 min 58 s |
| 2026-11-20 04:51 | pass | 74 | 0 | headless | 2 min 57 s |
| 2026-11-20 04:26 | pass | 74 | 0 | headless | 2 min 55 s |
| 2026-11-20 00:19 | pass | 74 | 0 | headless | 2 min 59 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t20-missed-order-alerts.mjs`), not this page._
