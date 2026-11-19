# T27 — WhatsApp → Numbers has a 'Send sign-in codes from my WhatsApp numbers' switch; with several numbers each code leaves from a random one

**Area:** notifications · **Last result:** ✅ PASSED (21 passed, 0 failed · 2026-11-19 11:21 · headless · 29.6 s)

**Run it alone:** `node run.mjs --only t27` (add `--visible` to watch it) · starts from fresh fake data

## What this test does

In Chrome as the owner of Acme Momos with two WhatsApp numbers connected but nothing chosen yet: a new customer is still shown the code on screen. On WhatsApp → Numbers a 'Sign-in codes' card says so and offers a switch right under the list of numbers. Ticking it saves at once ('On. Each code is sent from one of your 2 connected numbers, picked at random.'), survives a reload and shows as chosen under Settings → Message sending; the next customer gets the code on WhatsApp instead of on screen. Fourteen customers asking at once get their codes from both numbers. Unticking asks first (anyone could then sign in as anyone) — 'Keep sending' changes nothing, 'Stop sending' brings the on-screen code back. With no number connected the switch can't be turned on and says why; with it on and every number offline the card warns that customers can't get a code.

## Steps

- _(set-up)_
1. Nothing connected: the switch is there, but can't be turned on yet
2. Two numbers come online; the switch becomes available but the customer still sees the code on screen
3. The owner ticks the switch
4. The next customer gets the code on WhatsApp
5. Fourteen customers ask at the same moment
6. Unticking asks first
7. Every number goes offline while the switch is on

## What to expect (these must happen)

- WhatsApp → Numbers shows a 'Sign-in codes' card with the switch, off, saying customers are shown the code on screen.
- Before the switch is turned on a new customer is shown the code on screen.
- Ticking the switch saves immediately and says it is on, with the number of connected numbers and 'picked at random'; after a reload it is still on and Settings → Message sending has 'Your linked WhatsApp number' chosen.
- After that a new customer is told the code was sent on WhatsApp, sees no code on screen, and the code arrives from one of the store's numbers.
- Fourteen customers asking at the same moment are all sent a code and BOTH connected numbers are used.
- Unticking asks for confirmation; 'Keep sending' leaves it on; 'Stop sending' turns it off and the on-screen code returns.
- With no number connected the switch is disabled and says what to do; switched on with every number offline, the card warns that customers can't get a code.

## What must NOT happen

- Turning the switch on must NOT need a visit to another page.
- With it on, the code must NOT be shown on screen.
- Unticking must NOT happen without the confirmation.
- The switch must NOT be usable when no number is connected.
- The browser must NOT log JavaScript errors.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (21)

**Set-up — Setup**

- the store has two numbers to connect (the counter phone and number 3) — _Counter phone, Number 2, New phone, Number 3_

**Step 1 — Nothing connected: the switch is there, but can't be turned on yet**

- WhatsApp → Numbers has a 'Sign-in codes' card with the switch, off
- with no number connected the switch is disabled, and the card says why — _Off. Customers are shown the code on the sign-in screen — fine while you test, b_

**Step 2 — Two numbers come online; the switch becomes available but the customer still sees the code on screen**

- the switch can now be used
- it says customers are shown the code on screen
- a new customer is shown the code on screen (a 'dev code')

**Step 3 — The owner ticks the switch**

- it saves at once and says it is on, with how many numbers and 'at random' — _On. Each code is sent from one of your 2 connected numbers, picked at random._
- the box is ticked
- after a reload it is still on
- Settings → Message sending shows 'Your linked WhatsApp number' chosen — the same setting

**Step 4 — The next customer gets the code on WhatsApp**

- the screen says the code was sent on WhatsApp, and shows no code — _We sent a 6-digit code to 9811500002 on WhatsApp._
- it arrived from one of the store's two numbers — _["919000000001"]_

**Step 5 — Fourteen customers ask at the same moment**

- every one of them is sent a code, and none is shown on screen — _200,200,200,200,200,200,200,200,200,200,200,200,200,200_
- both connected numbers were used (picked at random) — _{"919000000003":7,"919000000001":7}_

**Step 6 — Unticking asks first**

- a confirmation explains that anyone could sign in as anyone — _Stop sending sign-in codes? Customers will be shown the code on the sign-in scre_
- nothing has changed yet
- 'Keep sending' leaves it on
- 'Stop sending' turns it off
- customers are shown the code on screen again

**Step 7 — Every number goes offline while the switch is on**

- the card warns that customers can't get a code
- a customer is asked to try again later — and is not shown a code — _We can't send the code right now._

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-19 11:21 | pass | 21 | 0 | headless | 29.6 s |
| 2026-11-19 11:01 | pass | 21 | 0 | headless | 30.7 s |
| 2026-11-19 10:59 | fail | 19 | 2 | headless | 31.6 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t27-signin-codes-switch.mjs`), not this page._
