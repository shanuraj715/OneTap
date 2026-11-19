# T21 — Client onboarding form — plan first, plan-fit alerts and 'allow anyway', full form, save / reset / cancel, PDF + print, publish as store

**Area:** onboarding · **Last result:** ✅ PASSED (120 passed, 0 failed · 2026-11-20 00:20 · headless · 51.6 s)

**Run it alone:** `node run.mjs --only t21` (add `--visible` to watch it) · starts from fresh fake data

## What this test does

In Chrome as the platform admin. Onboarding in the sidebar opens the list of requirement forms. 'New requirement form' asks for the plan first; once Starter is chosen, everything it doesn't include (Marketing, Delivery, online payments, an own domain, the Glass style…) is disabled with 'Not in the Starter plan', and asking for more outlets than the plan allows raises an error alert and keeps Publish disabled. 'Add … for this client' lets the representative give the client those extras regardless; the Plan fit panel then shows them as allowed. The form is filled in completely (meeting, owner, features, two outlets with address, a pin from a long Google link and from a short link, takeaway / dine-in / delivery, delivery distance, common and own opening hours, GST, colours and style, address, setup notes), saved as a draft, listed, and reopened with every answer intact. Reset and Cancel ask first (keep / discard). Export PDF downloads a real PDF holding the answers (not a password) and Print opens the print dialog with it. Publish as store asks for the owner's password, creates the store with both outlets, their hours, delivery distance, order types, colours and the allowed extras as per-store unlocks; the form becomes read-only. The owner signs in with that password and finds the settings; the storefront uses the colour. A second form with the same name, email and address is refused with nothing created. A Custom plan has no gating.

## Steps

1. The Onboarding list (empty at first)
2. A new form asks for the plan first; the plan decides what can be chosen
3. Asking for more than the plan: error alerts, and 'Add … for this client'
4. Fill in the whole form
5. Save, list, reopen — every answer is still there
6. Cancel and Reset ask first, and never touch the saved draft
7. Export as PDF, and print
8. Publish as store
9. What was created: the store, its plan and extras, its outlets and settings, its look
10. A second form with the same name, email and address creates nothing
11. A Custom plan is not gated

## What to expect (these must happen)

- Onboarding is in the platform sidebar; its list starts empty with All / Drafts / Published counts.
- A new form asks for the plan first; with no plan, 'Plan fit' says to choose it and Publish is disabled.
- On Starter: Marketing, Online payments, Own domain name, Delivery and the Glass style are disabled/flagged 'Not in the Starter plan'; Coupons, Takeaway and Dine-in are fine.
- 2 outlets on a 1-outlet plan: an error alert in the form, an issue in Plan fit, Publish disabled; 'Add the extra outlets for this client' turns it into 'Added for this client'.
- A locked choice has one box, 'Add … for this client' (with its monthly price): adding Delivery / Marketing / the Glass style also ticks it; 'Take away' puts it back and unticks it.
- A long Google link, a short link (followed by the server) and plain coordinates set the pin; a non-Google link, a link with no pin and plain text give clear errors.
- Save creates the draft (listed with plan, outlet count, Draft); reopening and reloading shows every answer exactly as saved.
- Reset asks 'Clear the whole form?' (keep / clear); Cancel with unsaved changes asks 'Leave without saving?'; a reset form that is cancelled leaves the saved draft untouched; Cancel with no changes just leaves.
- Export PDF downloads onboarding-onboard-cafe.pdf containing the store, plan, outlets, pins, delivery distance, hours, colours, features and what was added for this client beyond the plan — and no password; Print opens the print dialog with that PDF.
- Publish: summary of what will be created, a password of 8+ characters is required (Generate fills one), then the result with the owner's email and the store address; the form becomes read-only and still exports.
- The store appears on the Starter plan with Marketing and Delivery 'Unlocked for this store'; the owner signs in with the chosen password; outlet 1 has its address details, 10:00–23:00, prep 20, delivery 4 km / ₹30 / free above ₹500 / minimum ₹150, delivery on; outlet 2 has 09:00–21:00 and no delivery; the storefront lists both outlets and uses the chosen green.
- A second form with the same name, owner email and address shows what's taken and can't be published; no extra store is created; a draft can be deleted.
- A Custom plan has no disabled choices and shows the limits to set.

## What must NOT happen

- A choice the plan doesn't include must NOT be tickable until 'Add … for this client' is chosen.
- A form that exceeds the plan without being allowed must NOT be publishable.
- Reset or Cancel must NOT throw away answers without asking.
- A reset that is cancelled must NOT change the saved draft.
- The owner's password must NOT be saved in the form or printed in the PDF.
- A published form must NOT be editable or publishable again.
- A name, email or address that already exists must NOT create a second store.
- A link that isn't Google Maps must NOT be opened by the server.
- The browser must NOT log JavaScript errors.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (120)

**Step 1 — The Onboarding list (empty at first)**

- 'Onboarding' is in the platform sidebar and opens the list
- it starts empty: 'No forms yet', All 0 · Drafts 0 · Published 0

**Step 2 — A new form asks for the plan first; the plan decides what can be chosen**

- the first section on the page is '1 · Plan'
- with no plan, 'Plan fit' says to choose it first
- …and Publish as store is disabled, with 'Choose a plan.' among the things missing
- the disabled Publish button is visibly greyed out (faded, grey, 'not-allowed' pointer) — _{"filter":"grayscale(1)","opacity":0.5,"cursor":"not-allowed"}_
- and next to it says how much is left: '… things to finish before it can be published'
- choosing Starter shows what it includes: 'Up to 1 outlet and 3 people' — _Takeaway, dine-in QR and coupons · Up to 1 outlet and 3 people._
- Coupons (in the plan) is a plain tick box
- Marketing is locked — 'Not in the Starter plan'
- Analytics & reports is locked — 'Not in the Starter plan'
- Own favicon is locked — 'Not in the Starter plan'
- Coin wallet is locked — 'Not in the Starter plan'
- Printing is locked — 'Not in the Starter plan'
- WhatsApp chat is locked — 'Not in the Starter plan'
- each locked one has ONE box: 'Add … for this client' (with what it costs a month)
- Takeaway and Dine-in at the first outlet are fine, Delivery is locked
- an own domain can't be typed ('Own domain' box disabled, with its own 'Add' box)
- the Glass style is marked 'not in plan'

**Step 3 — Asking for more than the plan: error alerts, and 'Add … for this client'**

- 'Total outlets' is a − / + stepper: at 1 the − is greyed out
- + adds an outlet card (2 cards, the box says 2)
- − takes it away again (1 card)
- the number box has no browser arrows (it has its own − and +)
- 2 outlets on a 1-outlet plan: an error alert in the form
- …the same problem is listed in Plan fit (not allowed yet)
- …and Publish stays disabled
- there are now two outlet cards
- 'Add the extra outlets for this client' turns the alert into 'Added for this client' and Plan fit marks it added
- 'Add Delivery for this client' (outlet 1) adds it AND ticks it: the row says 'Added for this client'
- ticking Delivery shows the delivery block (distance, fee, free above, minimum) and asks for the map pin
- outlet 2 can now have Delivery too (it is added for the whole client) but it isn't ticked there
- 'Add Marketing for this client' adds and ticks it: 'Added for this client', and Plan fit lists it as added
- 'Take away' puts it back: locked again, unticked, and gone from Plan fit
- choosing the Glass style raises an issue in Plan fit
- 'Add Glass style for this client' clears it ('added')

**Step 4 — Fill in the whole form**

- the meeting date picked in the calendar is shown
- its web address is made from the name: '/onboard-cafe-cp'
- a long Google link sets the pin: 'Pin set: 28.6315, 77.2167'
- the 'needs the map location' alert goes away
- a link that isn't Google's is refused: 'Only Google Maps links can be opened'
- plain text is refused: 'isn't a link or coordinates'
- a link that leads to no pin says so: 'didn't lead to a map pin'
- a short link is followed by the server: 'Pin set: 28.5245, 77.2066'
- plain coordinates work too: 'Pin set: 28.6, 77.2'
- the 'Fresh green' colour scheme fills the colours (brand colour #2E7D46) and shows a preview
- the TablePe address is checked live: 'onboardcafe.localhost:3170 is free' — _onboardcafe.localhost:3170 is free_
- Plan fit: outlets is allowed
- Plan fit: feature:delivery is allowed
- Plan fit: feature:marketing is allowed
- Plan fit: effect:glass is allowed
- nothing is missing any more: 'Nothing missing. You can save, then publish.' — _Nothing missing. You can save, then publish._
- Publish as store is now enabled and looks it (full colour, no 'things to finish' note) — _{"filter":"none","opacity":1,"cursor":"pointer"}_

**Step 5 — Save, list, reopen — every answer is still there**

- before saving the form says 'Not saved yet'
- Save: 'Saved.' and the form is now a saved draft with its own address — _http://localhost:3171/platform/onboarding/6aff44c64ff21e0cab87a219_
- the Save button is disabled again — nothing has changed since
- the list shows 'Onboard Cafe' as a Draft on Starter with 2 outlets — _Onboard Cafe with Rep One Plan Starter Outlets 2 Draft just now_
- with counts All 1 · Drafts 1 · Published 0
- after reopening and reloading: plan Starter, store and owner email as typed
- …both outlets, with their names, address, delivery 4 km and Delivery ticked
- …outlet 2's own hours 09:00–21:00, both pins, Marketing, common closing 23:00
- …and the plan-fit permissions were saved with it (Plan fit still says 'Allowed anyway' for all four)

**Step 6 — Cancel and Reset ask first, and never touch the saved draft**

- a change shows 'Unsaved changes' and enables Save
- Cancel with unsaved changes asks 'Leave without saving?'
- 'Keep editing' stays on the form with the change still there
- Reset asks 'Clear the whole form?' and says the saved copy stays until Save
- 'Keep my answers' changes nothing
- 'Yes, clear everything' empties the form: no store name, one outlet, no plan
- …and it counts as an unsaved change; Publish is disabled
- 'Discard and leave' goes back to the list
- the saved draft is untouched by the reset: still Onboard Cafe, Starter, tagline 'Fresh and fast', 2 outlets
- Cancel with nothing changed leaves at once, without a question

**Step 7 — Export as PDF, and print**

- the file is onboarding-onboard-cafe.pdf and a real PDF — _onboarding-onboard-cafe.pdf_
- the PDF holds the store, plan and owner
- the PDF holds the owner's email
- the PDF holds both outlets and their addresses
- the PDF holds the map pins
- the PDF holds the delivery distance and fee
- the PDF holds outlet 2's own hours
- the PDF holds the common hours
- the PDF holds the brand colour
- the PDF holds what was added for this client beyond the plan
- the PDF holds the sign-off lines
- no blank pages: every page has real content (not just a footer) — printing it gives no empty sheets — _1092 / 1040 / 624_
- each page carries its own footer 'Page i of N', and N is the real number of pages — _3 pages_
- did not happen: the PDF contains a password
- the PDF has several pages with 'Page 1 of N' footers — _3 pages_
- Print opens the print dialog with the PDF ('The print dialog was opened.') — _1 print calls_
- …and what was printed is the same document (a PDF loaded in a hidden frame)

**Step 8 — Publish as store**

- the dialog summarises what will be created: store, plan + what is allowed beyond it, both outlets, address, owner
- 'Create the store' is disabled until there is a password
- a 3-character password is not enough
- 'Generate' fills in a strong password (12 characters), which enables the button — _12 chars_
- the result says 'Onboard Cafe is live' with 2 outlets, the owner's email and the store address
- did not happen: the result screen shows the password
- the form is now read-only: a published banner, no Save / Reset / Publish buttons, fields disabled
- did not happen: a published form can be edited
- it can still be exported: the PDF now says 'Published as a store' and still has no password
- the list shows it as Published (All 1 · Drafts 0 · Published 1) — _Onboard Cafe with Rep One Plan Starter Outlets 2 Published just now_
- did not happen: a published form has a delete button

**Step 9 — What was created: the store, its plan and extras, its outlets and settings, its look**

- the store is in Stores on the Starter plan with 2 of 2 outlets — _Onboard Cafe ola@onboardcafe.test Plan Starter People 1 / 3 Outlets 2 / 2 Within plan_
- Marketing and Delivery are 'Unlocked for this store' — _Unlocked for this store / Unlocked for this store_
- Coupons, which the plan has, is just 'From plan'
- Analytics & reports, which nobody asked for, is not unlocked
- the owner signs in with the password set while publishing
- their store has both outlets: 'Onboard Cafe CP' and 'Onboard Cafe Saket'
- outlet 1's settings are exactly what the form said: phone, GSTIN, FSSAI, 10:00–23:00, last order 30, prep 20, minimum ₹150, delivery ₹30 / free above ₹500 / 4 km, takeaway + dine-in + delivery
- …and the map location is set (Settings shows the pin)
- outlet 2 has its own hours 09:00–21:00 (last order 15), takeaway + dine-in and NO delivery
- the store's address opens: both outlets are offered
- the storefront uses the chosen brand colour #2E7D46 — _#2E7D46_
- …and shows the tagline

**Step 10 — A second form with the same name, email and address creates nothing**

- it lists what is taken: the store name, the owner's email and the address
- Publish as store stays disabled
- no second store was created — _4 stores before_
- the new form is a Draft in the list
- a draft can be deleted (a question is asked first); the published one stays

**Step 11 — A Custom plan is not gated**

- it shows the limits to set for this client (outlets, people) and says what 'custom' means
- no choice is locked: Marketing and Delivery can be ticked, with no 'Not in the … plan' notes
- 3 outlets on a Custom plan raise no alert (the limits follow the form) — _Everything in the form fits the Bench Custom plan._
- did not happen: the browser logged JavaScript errors

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-20 00:20 | pass | 120 | 0 | headless | 51.6 s |
| 2026-11-19 12:41 | pass | 120 | 0 | headless | 54.6 s |
| 2026-11-19 11:28 | pass | 120 | 0 | headless | 52.0 s |
| 2026-11-19 11:17 | error | 0 | 0 | headless | 0.4 s |
| 2026-11-19 01:19 | pass | 120 | 0 | headless | 51.8 s |
| 2026-11-18 17:53 | pass | 120 | 0 | visible | 4 min 13 s |
| 2026-11-18 17:48 | pass | 118 | 0 | headless | 52.8 s |
| 2026-11-18 17:28 | pass | 118 | 0 | headless | 52.9 s |
| 2026-11-18 17:25 | fail | 117 | 1 | headless | 51.8 s |
| 2026-11-18 16:56 | pass | 112 | 0 | headless | 52.7 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t21-onboarding.mjs`), not this page._
