# T22 — Onboarding price estimate — price list, plan + extras, Custom starts above the dearest plan, discount / GST / yearly, the Custom plan, plan dialog

**Area:** onboarding · **Last result:** ✅ PASSED (55 passed, 0 failed · 2026-11-19 12:41 · headless · 36.1 s)

**Run it alone:** `node run.mjs --only t22` (add `--visible` to watch it) · starts from fresh fake data

## What this test does

In Chrome. With no priced plans yet the Custom estimate says what to do first. Two plans are created: Basic (one outlet, 5 people, four features, ₹999 a month) and Business (three outlets, 20 people, every feature, ₹2,499). The Price list page shows the starting prices (each extra outlet ₹250, person ₹15, GST 18%, a price per feature) and that they add up: Basic → Business adds nine features (₹775), two outlets (₹500) and fifteen people (₹225) = ₹1,500 — exactly the plans' difference. On the onboarding form, Basic alone is ₹999 (+GST ₹180 = ₹1,179 a month; ₹12,731 for a year paid up front); ticking Marketing and Delivery, a second outlet and a team of seven adds ₹100 + ₹100 + ₹250 + 3 × ₹15, a 10% discount and GST are applied, and the form says only Business fits as it is. The Custom plan (listed even though nobody created it) starts from the dearest plan, ₹2,499, and adds ₹250 per outlet and ₹15 per person beyond Business's limits, so it is always dearer than every standard plan, and warns when a standard plan would do. Editing the price list changes the estimate. Prices never appear on the PDF. Publishing a Custom form creates the real Custom plan and puts the store on it with the limits asked for. The 'New plan' dialog has its limits stacked and aligned, its Save button always in view, and dropdown arrows with room to spare.

## Steps

1. Before any plan has a price, there is nothing to estimate
2. Two plans with prices: Basic ₹999 and Business ₹2,499
3. The Price list: starting prices, and do they add up?
4. A standard plan: its own price, then GST and the year
5. Asking for more than Basic: each extra is priced, then a discount
6. The discount is saved with the form; the PDF has no prices
7. The Custom plan: starts from the dearest plan and goes up in steps
8. Change the price list: the estimate follows; Back to the starting prices asks first
9. Publishing a Custom form creates the real Custom plan and puts the store on it
10. The New plan dialog: tidy limits, Save always in reach, room for the dropdown arrow

## What to expect (these must happen)

- Before any plan has a price, Custom's estimate says to give Basic and Pro a monthly price.
- The Price list shows the starting prices and, with Basic ₹999 and Business ₹2,499, 'They agree' for Basic → Business (₹1,500 = ₹1,500).
- Basic alone: ₹999, GST ₹180, ₹1,179 a month; yearly (10% off) ₹12,731 with GST.
- Basic + Marketing + Delivery + 1 extra outlet + 3 extra people = ₹1,494; 10% discount −₹149; GST ₹242; ₹1,587 a month; only Business fits as it is.
- Custom: Business's ₹2,499 + 2 more outlets (₹500) + 5 more people (₹75) = ₹3,074 — dearer than Business; each extra outlet adds exactly ₹250 and each extra person ₹15.
- A Custom need that a standard plan would cover shows a note saying so.
- Changing the price list (extra outlet ₹400, Marketing ₹130) changes the estimate; 'Back to the starting prices' asks first.
- A plan with no monthly price says so in the estimate.
- The PDF has no prices.
- Publishing on Custom creates the real Custom plan; the store is on it with 2 outlets / 3 people and Marketing unlocked.
- The New plan dialog: limits stacked and left-aligned, Save always visible, dropdown arrow with space on its right.

## What must NOT happen

- Custom must NOT cost less than, or the same as, the dearest standard plan.
- An unpriced plan or missing price list must NOT show a made-up number.
- Prices must NOT appear on the PDF.
- The browser must NOT log JavaScript errors.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (55)

**Step 1 — Before any plan has a price, there is nothing to estimate**

- the Custom plan is offered although nobody has created it
- its estimate says to give Basic and Pro a monthly price first — no number
- a standard plan with no monthly price says so: 'has no monthly price yet', ₹0

**Step 2 — Two plans with prices: Basic ₹999 and Business ₹2,499**

- both plans are listed

**Step 3 — The Price list: starting prices, and do they add up?**

- the starting prices: Delivery ₹100, Dine-in ₹200, Marketing ₹100, Online payments ₹50, WhatsApp chat ₹150
- each extra outlet ₹250, each extra person ₹15, GST 18%
- 'Your plans' lists Basic ₹999 and Business ₹2,499 (Custom: priced by this list)
- 'Do the prices add up?': Basic → Business adds 9 features, 2 outlets, 15 people — this list charges ₹1,500, the plans differ by ₹1,500: 'They agree.'

**Step 4 — A standard plan: its own price, then GST and the year**

- Basic alone is one line: 'Basic plan ₹999' — _Basic plan ₹999_
- a month ₹999, GST (18%) ₹180, pays ₹1,179 a month
- paying for the year (10% off): ₹12,731 with GST, about ₹899 a month, saving ₹1,199
- both Basic and Business are said to fit as they are — _Standard plans that fit as they are: Basic (₹999), Business (₹2,499)._

**Step 5 — Asking for more than Basic: each extra is priced, then a discount**

- Marketing (added for this client) adds ₹100 → ₹1,099 — _Basic plan ₹999 \| Marketing ₹100_
- a second outlet adds ₹250 ('1 extra outlet × ₹250') → ₹1,349 — _Basic plan ₹999 \| Marketing ₹100 \| 1 extra outlet × ₹250 ₹250_
- Delivery adds ₹100 → ₹1,449 — _Basic plan ₹999 \| Marketing ₹100 \| Delivery ₹100 \| 1 extra outlet × ₹250 ₹250_
- a team of 7 + the owner is 8 people, 3 over Basic's 5: '3 extra people × ₹15' ₹45 → ₹1,494
- the lines in order: Basic ₹999, Marketing ₹100, Delivery ₹100, outlet ₹250, people ₹45
- 10% discount: −₹149 → ₹1,345, GST ₹242, pays ₹1,587 a month
- the yearly price follows: ₹17,141 with GST (saving ₹1,614)
- only Business fits these needs as they are (₹2,499) — Basic plus extras is cheaper than upgrading

**Step 6 — The discount is saved with the form; the PDF has no prices**

- saved
- after reloading, the 10% discount and the ₹1,587 are still there
- did not happen: the PDF shows the estimate (estimated price, 'Pays a month', ₹1,587, or the discount)
- it is still the full form (the store name and the outlets are in it)

**Step 7 — The Custom plan: starts from the dearest plan and goes up in steps**

- a small need on Custom is just the dearest plan: 'Business plan — every feature, up to 3 outlets and 20 people ₹2,499' — _Business plan — every feature, up to 3 outlets and 20 people ₹2,499_
- and says a standard plan would do: 'These needs fit the Basic plan (₹999)… Custom is for clients who need more'
- no limits to set beyond Business: the form shows the Custom limits boxes (outlets, people)
- 5 outlets and 25 people: Business ₹2,499 + 2 more outlets × ₹250 (₹500) + 5 more people × ₹15 (₹75)
- total ₹3,074 a month — dearer than Business's ₹2,499 and Basic's ₹999
- did not happen: the Custom estimate is not above the dearest standard plan
- no standard plan fits: 'No standard plan fits this on its own.'
- each extra outlet adds exactly ₹250 (3,074 → 3,324) and each extra person exactly ₹15 (→ 3,339) — _3324 then 3339_
- setting the outlets the client was promised (8) prices them even before the cards exist: 5 more outlets × ₹250

**Step 8 — Change the price list: the estimate follows; Back to the starting prices asks first**

- the page says 'Unsaved changes'
- saved: the page says 'Saved'
- 'Do the prices add up?' now says the plans are ₹330 cheaper than this list (2 outlets × ₹150 more, plus Marketing ₹30 more)
- after a reload the new prices are still there
- on the form: Marketing is now ₹130 and an extra outlet ₹400 (Basic ₹999 + 130 + 400 = ₹1,529) — _Basic plan ₹999 \| Marketing ₹130 \| 1 extra outlet × ₹400 ₹400_
- 'Back to the starting prices' asks first
- 'Keep my prices' changes nothing (extra outlet still ₹400)
- 'Use the starting prices' puts ₹250 and ₹100 back (unsaved until Save)
- saved again: the plans and the list agree once more ('They agree.')

**Step 9 — Publishing a Custom form creates the real Custom plan and puts the store on it**

- no Custom plan has been created yet (it is only created the first time it is needed)
- on Custom nothing is disabled or flagged 'Not in the plan'
- the estimate: Business ₹2,499 (3 outlets and 20 people cover it) — it says a standard plan would do
- the store was created
- the Custom plan now exists, as a real plan, with this store on it
- in Stores: Custom Cafe is on the Custom plan with 2 of 2 outlets and 1 of 3 people — _Custom Cafe pricing@custom-cafe.test Plan Custom People 1 / 3 Outlets 2 / 2 Within plan_
- Marketing, which was ticked, is unlocked for the store — _Unlocked for this store_

**Step 10 — The New plan dialog: tidy limits, Save always in reach, room for the dropdown arrow**

- the 'Multi-outlet' box sits directly under the people limit, on the same left edge — _people x=381 y=323 · multi x=385 y=376_
- 'Unlimited' is on the same line as the people number — _333 vs 323_
- ticking Multi-outlet shows the 'Outlets' limit below it, aligned with the others — _383 vs 381_
- 'Save plan' is in view without scrolling the dialog (it stays at the bottom) — _button at y=811–840 of 900_
- a dropdown (the Plan box) has room for its arrow: more padding on the right than the left, its own arrow drawn — _{"pr":32,"pl":10,"bg":"url(\"data:im","app":"none"}_
- did not happen: the browser logged JavaScript errors

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-19 12:41 | pass | 55 | 0 | headless | 36.1 s |
| 2026-11-19 11:29 | pass | 55 | 0 | headless | 35.7 s |
| 2026-11-19 11:18 | error | 3 | 1 | headless | 28.2 s |
| 2026-11-19 01:19 | pass | 55 | 0 | headless | 35.8 s |
| 2026-11-18 17:56 | pass | 55 | 0 | visible | 3 min 17 s |
| 2026-11-18 17:49 | pass | 55 | 0 | headless | 35.4 s |
| 2026-11-18 17:26 | pass | 55 | 0 | headless | 34.9 s |
| 2026-11-18 17:19 | pass | 55 | 0 | headless | 35.6 s |
| 2026-11-18 17:18 | fail | 54 | 1 | headless | 35.7 s |
| 2026-11-18 17:17 | error | 51 | 0 | headless | 1 min 6 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t22-onboarding-price.mjs`), not this page._
