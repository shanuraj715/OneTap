# T13 — Marketing — channels, audience filters (last visit, items, age, gender, order type, area), imports, lists, sending and the sidebar

**Area:** marketing · **Last result:** ✅ PASSED (70 passed, 0 failed · 2026-11-19 13:17 · headless · 1 min 29 s)

**Run it alone:** `node run.mjs --only t13` (add `--visible` to watch it) · starts from fresh fake data

## What this test does

In Chrome as the owner of Marketing Mart: the sidebar keeps running the store (take order, orders, menu…) above a divider and everything else below it; Marketing shows which of the three channels are ready; the live audience count and example people follow every filter exactly (hasn't ordered for N days/weeks/months — whole store or one outlet; ordered chosen items at least N times; age today (grows each year); gender; many takeaways; delivery area); pasted numbers, WhatsApp contacts and saved lists can be mixed in without anyone counted twice; people who said STOP, customers without a phone, and people who never ordered are left out correctly. Then the owner sets up an SMS gateway (a fake one the test runs), sends a personalised SMS campaign and the gateway receives exactly the right numbers; a linked-WhatsApp campaign is queued and cancelled.

## Steps

1. The sidebar: running the store above a divider, everything else below it
2. Marketing: which ways of reaching customers are ready?
3. Who gets it — with no filters
4. Filter: hasn't ordered for …
5. Filter: ordered these items
6. Filter: age today (it grows each year)
7. Filter: gender, and filters working together
8. Filter: more takeaways, and area
9. Other groups: WhatsApp contacts and pasted numbers
10. Contact lists: create one, grow it, use it, delete one
11. Guard rails: nothing can be sent without a channel, a message and people
12. Set up SMS in Notifications, then it becomes available
13. Send an SMS campaign to customers who haven't ordered for 2 months
14. Send over linked WhatsApp, then cancel it before it goes out
15. The Customers page shows ages as they are today

## What to expect (these must happen)

- The sidebar lists Take order, Dashboard, Orders, Menu, Tables and Printing first; then a divider; then Customers, Marketing, WhatsApp and Coupons; then Storefront and Settings.
- Marketing shows linked WhatsApp as Ready, and SMS and the WhatsApp Business API as not available until set up (with the reason and a link to set them up).
- With no filters, 'My customers' is everyone with a phone number: 6 people; the page says one said STOP and one has no phone.
- 'Hasn't ordered for 2 months' = Ravi and Karan; with 'also never ordered' + Dev; 30 days adds Sana; looking at one outlet only counts visits there.
- 'Ordered these items' (Paneer Steamed + Paneer Gravy momos) = Ravi and Priya; 'at least 5 in total' = Ravi; 'all, at least 4 of each' = nobody; 'last month only' = Priya.
- Age uses today's age: 24 in 2020 is 30 in 2026 (Ravi); 19 in 2024 is 21 (Sana); a range finds everyone between.
- Gender, 'orders a lot of one type' (3+ takeaways = Ravi and Sana; 4+ = Sana; 2+ deliveries = Meena) and area ('Laxmi Nagar', or within 2 km of an outlet = Meena) each give exactly those people; filters combine (women AND 30 days = Sana).
- WhatsApp contacts add a person who isn't a customer; pasted numbers show how many are usable, repeated or unusable; the same person from two sources counts once.
- A saved contact list can be created, grown, viewed, used as an audience and deleted.
- An SMS campaign to the lapsed customers reaches the gateway for exactly Ravi's and Karan's numbers, each message with that person's own name and the store's name, and the Campaigns page says 2 sent, 0 failed, Done.
- A linked-WhatsApp campaign queues its messages (the sending worker is off in the bench) and can be cancelled; the report says Cancelled with nothing waiting.
- The Customers page shows each person's age as it is today.

## What must NOT happen

- A channel that isn't set up must NOT be selectable.
- 'Review and send' must NOT be possible with no message or nobody in the audience.
- A customer who said STOP must NOT be in any audience or receive any message.
- A customer with no phone number must NOT be counted as someone who can be messaged.
- People who never ordered must NOT appear in 'hasn't ordered for' unless that is switched on.
- The same person must NOT be counted or messaged twice because they are in two groups.
- The SMS gateway must NOT be called for anyone outside the audience.
- The browser must NOT log JavaScript errors.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (70)

**Step 1 — The sidebar: running the store above a divider, everything else below it**

- first group 'Store & orders': Take order, Dashboard, Orders, Menu, Tables, Printing
- a divider comes before the second group — _[["Store & orders",false],["Customers & growth",true],["Setup",false]]_
- second group 'Customers & growth': Customers, Marketing, WhatsApp, Coupons
- third group 'Setup': Storefront and Settings — _{"group":"Setup","divider":false,"items":["Storefront","Settings"]}_
- did not happen: Marketing or WhatsApp is mixed in with the store-and-orders group

**Step 2 — Marketing: which ways of reaching customers are ready?**

- linked WhatsApp is Ready and can be chosen
- did not happen: SMS can be chosen before it is set up
- did not happen: the WhatsApp Business API can be chosen before it is set up
- SMS and the Business API say why, with a way to set them up

**Step 3 — Who gets it — with no filters**

- My customers, no filters: 6 people have a phone number — _6_
- …and the page says who was left out: 1 said STOP, 1 has no phone number — _Left out: 1 said STOP, 1 customer without a phone number._
- did not happen: the person who said STOP is in the example list
- did not happen: the customer with no phone number is in the example list

**Step 4 — Filter: hasn't ordered for …**

- not ordered for 2 months → Ravi and Karan — _Karan Singh, Ravi Kumar_
- did not happen: Dev (signed up, never ordered) is counted as a lapsed customer
- …with 'also people who never ordered' → Dev joins
- not ordered for 30 days → Karan, Ravi and Sana — _Karan Singh, Ravi Kumar, Sana Khan_
- 4 weeks is understood the same way
- looking at the Second outlet only → Karan and Sana (Ravi never ordered there) — _Karan Singh, Sana Khan_

**Step 5 — Filter: ordered these items**

- ordered Paneer Steamed or Paneer Gravy momos → Ravi and Priya — _Priya Nair, Ravi Kumar_
- …at least 5 in total → Ravi only
- …ALL of them, at least 4 of each → nobody (Ravi had only 3 gravy)
- …ALL of them, at least 2 of each → Ravi
- …only orders from the last month → Priya — _Priya Nair_

**Step 6 — Filter: age today (it grows each year)**

- age 30 → Ravi (he said 24 in 2020) — _Ravi Kumar_
- …and the example row shows his age as 30
- age 21 → Sana (she said 19 in 2024) — _Sana Khan_
- did not happen: someone who said 19 in 2024 is still counted as 19
- ages 21 to 30 → Sana, Meena and Ravi — _Meena Iyer, Ravi Kumar, Sana Khan_

**Step 7 — Filter: gender, and filters working together**

- women → Meena, Priya and Sana (Mail Only has no phone) — _Meena Iyer, Priya Nair, Sana Khan_
- women AND not ordered for 30 days → Sana — _Sana Khan_

**Step 8 — Filter: more takeaways, and area**

- 3 or more takeaway orders → Ravi and Sana — _Ravi Kumar, Sana Khan_
- 4 or more → Sana
- 2 or more deliveries → Meena
- delivered to an address in 'Laxmi Nagar' → Meena
- an area nobody was delivered to → nobody
- within 2 km of the Main outlet → Meena — _Meena Iyer_

**Step 9 — Other groups: WhatsApp contacts and pasted numbers**

- people who messaged on WhatsApp → Chat Only Chandni (a contact who isn't a customer)
- did not happen: Stop Sam (who said STOP) is among the WhatsApp contacts
- pasted numbers → 2 people (a repeat merged, one line unusable)
- …and the page says 2 usable, 1 can't be used, 1 repeated — _2 usable · 1 can't be used · 1 repeated Not used: “call me 123” 2 pe_
- men from the customer list + 2 typed numbers = 3 (Ravi is in both, counted once) — _Karan Singh, Ravi Kumar_

**Step 10 — Contact lists: create one, grow it, use it, delete one**

- the list is saved with 2 people
- it is listed with its count
- viewing it shows Zed and the other number
- adding more puts the new one in and skips the repeat
- did not happen: the deleted list is still listed
- the saved list works as an audience: 3 people — _Zed_

**Step 11 — Guard rails: nothing can be sent without a channel, a message and people**

- did not happen: 'Review and send' is possible with nobody in the audience, no channel and no message

**Step 12 — Set up SMS in Notifications, then it becomes available**

- SMS now shows as Ready and can be chosen
- the Business API still isn't set up

**Step 13 — Send an SMS campaign to customers who haven't ordered for 2 months**

- the audience is Ravi and Karan
- did not happen: 'Review and send' works before a message is written
- a preview shows the message with a sample name
- the confirmation says who and over what
- the page says the campaign is on its way
- Campaigns: it finishes with 2 sent, 0 waiting, 0 failed — _Win-back SMS SMS · 19 Nov, 1:16 pm · 2 people 2 sent · 0 waiting · 0 failed Done_
- the SMS gateway was asked to send to exactly Ravi's and Karan's numbers — _9000000001, 9000000003_
- did not happen: the gateway was asked to message anyone else (Stop Sam, Dev, Meena, Sana, Priya…)
- did not happen: someone got the same message twice
- each text starts with that person's own name and has the store's name — _Hi Karan Singh, we miss you at Marketing Mart! Show this SMS for 20% off._
- the gateway key from Notifications was used

**Step 14 — Send over linked WhatsApp, then cancel it before it goes out**

- women → 3 people
- the page tells her about the STOP line that is added
- the confirmation explains the slow, careful pace for new contacts
- it is queued: 3 waiting, still Sending (the sending worker is off here)
- cancelling stops it: Cancelled, nothing waiting

**Step 15 — The Customers page shows ages as they are today**

- Ravi (24 in 2020) shows 30 — _ Ravi Kumar — 9000000001 Male 30 3 0 21 Aug, 1:15 pm_
- Sana (19 in 2024) shows 21
- did not happen: the browser logged JavaScript errors

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-19 13:17 | pass | 70 | 0 | headless | 1 min 29 s |
| 2026-11-19 12:54 | pass | 70 | 0 | headless | 1 min 28 s |
| 2026-11-19 12:31 | pass | 70 | 0 | headless | 1 min 28 s |
| 2026-11-19 11:11 | pass | 70 | 0 | headless | 1 min 28 s |
| 2026-11-19 01:09 | pass | 70 | 0 | headless | 1 min 29 s |
| 2026-11-18 17:38 | pass | 70 | 0 | headless | 1 min 28 s |
| 2026-11-18 17:08 | pass | 70 | 0 | headless | 1 min 28 s |
| 2026-11-18 15:03 | pass | 70 | 0 | headless | 1 min 29 s |
| 2026-11-18 14:28 | pass | 70 | 0 | headless | 1 min 28 s |
| 2026-11-16 03:14 | pass | 70 | 0 | headless | 1 min 30 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t13-marketing.mjs`), not this page._
