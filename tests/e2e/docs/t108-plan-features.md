# T108 — Plans → Business includes every feature (also future ones), Starter gains pre-orders and ratings, features that need another are flagged, and update-plans.js brings existing plans up to date safely

**Area:** platform · **Last result:** ✅ PASSED (51 passed, 0 failed · 2026-11-27 09:53 · headless · 7.1 s)

**Run it alone:** `node run.mjs --only t108` (add `--visible` to watch it)

## What this test does

Runs suites/plan-features.mjs against a private API on an in-memory database. The rules: a table says which features need another (delivery → online payments, pre-orders → takeaway, cart reminders and marketing → WhatsApp & SMS alerts) and featureProblems() lists the mistakes in plain words. A plan with the new 'includes every feature' switch gets every feature whatever its saved list says (so features added later reach it on their own, which a plain list never did), a store can still have one locked, and a Custom plan still includes nothing. The shared presets: Starter keeps its four features and gains pre-orders and ratings (cheap for the restaurant, they win customers) but not the ones that need a team or a sender account; Business has everything, switched on. Through the console API: creating, listing and editing such a plan, bad feature keys refused, a Custom plan ignores the switch, a store on the plan has the five newest features. update-plans.js against a database laid out like production's (Starter with 4 features, Business with 13, Custom): the default run is a dry run that changes nothing and names what would change; --apply updates Starter and Business only, keeps everything a plan had, leaves Custom, limits and prices alone, is safe to repeat, never invents a missing plan, and also finds plans still called Basic / Pro. seed-plans.js: creates Starter, Business and Custom from the presets on an empty database, creates nothing twice, and doesn't add a second plan beside one with an old name.

## Steps

1. The rules
2. The shared presets
3. 'Includes every feature' in the rules
4. Through the console's API
5. update-plans.js on a database laid out like production's
6. seed-plans.js

## What to expect (these must happen)

- Business gets every feature, including ones added later; Starter gets pre-orders and ratings.
- A feature that needs another is flagged (delivery without online payments).
- update-plans.js is a dry run unless --apply is given, and only ever adds.

## What must NOT happen

- A dry run must NOT change the database.
- Custom plans, limits and prices must NOT be touched by the update.
- A plan that doesn't exist must NOT be created by update-plans.js.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (51)

**Step 1 — The rules**

- the product has 18 plan features — _18_
- every feature named in the dependency table really exists
- delivery without online payments is flagged, in plain words — _Delivery needs Online payments (delivery orders are paid online)._
- …and not when it has them
- abandoned-cart reminders need the WhatsApp & SMS alerts
- marketing needs alerts; pre-orders need takeaway
- no features, or every feature, is never a problem

**Step 2 — The shared presets**

- two presets: Starter (once called Basic) and Business (once called Pro)
- neither preset offers a feature without what it needs
- Starter keeps what it always had (takeaway, dine-in QR, coupons, printing)
- …and gains pre-orders and ratings (they cost the restaurant nothing to run and win it customers)
- …but not the features that need a team or a sender account (kitchen display, bookings, reminders, delivery, marketing…)
- Business includes every feature, with the 'every feature' switch on
- limits unchanged: Starter 1 outlet and 5 people, Business 3 outlets and 20 people
- tables: Starter 5, Business 20 (tables are sold in fives)

**Step 3 — 'Includes every feature' in the rules**

- a plan WITHOUT the switch keeps only its own list (a feature added later never reaches it: the problem we had)
- a plan WITH the switch gets every feature, whatever its saved list says (so also features added in future)
- a store can still have one feature locked on such a plan
- a Custom plan still includes nothing by itself (the switch is ignored there)
- effectiveFeatures: all when the switch is on, else the list, else nothing

**Step 4 — Through the console's API**

- creating a plan with the switch on stores it and answers with every feature — _201 18_
- the list of plans shows it the same way (so the console and the website show every feature)
- switching it off goes back to the plan's own list
- a feature that doesn't exist is refused (400)
- a Custom plan saved with the switch on still stores nothing
- a store on that plan has the five newest features (kitchen display, bookings, pre-orders, ratings, cart reminders)
- the switch is what is stored in the database

**Step 5 — update-plans.js on a database laid out like production's**

- the default run is a dry run and says so
- it says Starter would gain pre-orders and ratings — _adds: scheduledOrders, feedback_
- …and Business would gain the five newest features and switch on 'includes every feature'
- Custom is not mentioned, and the dry run changed NOTHING in the database
- --apply updates the two plans — _\| 2 plan(s) updated. \|_
- Starter: everything it had is kept, plus pre-orders and ratings (6 features) — _takeaway,dineInQr,coupons,printing,scheduledOrders,feedback_
- Business: the switch is on and the list is all 18 — _18_
- Custom is untouched
- outlet and people limits and website prices are untouched
- the plans that had no table limit get one (Starter 5, Business 20); Custom is left alone — _5/20/undefined_
- the dry run said so beforehand
- run again: everything is already up to date (safe to repeat)
- a table limit someone has already set is never changed by the update
- a store on the updated Business plan now has the new features
- a store on Starter has ratings and pre-orders, and still no delivery or kitchen display
- a plan that isn't there is skipped, never invented

**Step 6 — seed-plans.js**

- on an empty database it creates Starter, Business and Custom — _Business,Custom,Starter_
- Starter is made from the preset, at ₹799
- Business is made with 'includes every feature', at ₹2,499, as the highlighted plan
- Custom is made as a custom plan
- the new plans carry their table limits (Starter 5, Business 20)
- running it twice creates nothing new
- an install whose plans are still called Basic and Pro keeps them (no duplicate Starter / Business appears) — _Basic,Custom,Pro_
- …and update-plans.js still finds them by their old names and brings them up to date

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-27 09:53 | pass | 51 | 0 | headless | 7.1 s |
| 2026-11-27 05:16 | pass | 51 | 0 | headless | 6.9 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t108-plan-features.mjs`), not this page._
