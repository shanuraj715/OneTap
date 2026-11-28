# T139 — Ratings: the customer rates the order and each dish (Account page and order page) with modern stars in the STORE's colour; the store reads them as reviews, by customer, by outlet and by dish

**Area:** feedback · **Last result:** ✅ PASSED (35 passed, 0 failed · 2026-11-28 13:20 · headless · 6.2 s)

**Run it alone:** `node run.mjs --only t139` (add `--visible` to watch it)

## What this test does

Chrome against the bench (Acme Momos; its colour is changed to teal for the run and put back). A customer signed in through the API has three completed orders. Account page: 'Rate this order' with a non-yellow star, the box with five stars (teal, read as the browser painted them), the word 'Excellent', 'Rate each dish' listing both dishes with quantities (only once the order has stars), a note for a dish, taking a dish rating back by touching its star again, Send, the store receiving the order's 5★ and review and the dish ratings, the order then showing its stars and a chip per dish. Order page: rate with no dish ratings, then 'Change' (earlier rating filled in, a dish rating added), earlier dish notes coming back, arrow keys and plain star labels. Admin panel Ratings: four tabs; reviews list the dishes rated; By customer (count, average, search by name and phone); By outlet (a card per outlet); By dish (averages, counts, 'Read reviews', sort worst first, search). Stars in the admin panel use the store's teal too. A phone-width screen does not scroll sideways.

## Steps

1. The Account page: Rate this order
2. The order page: rate, then change
3. The same rating for a third order, by keyboard
4. The store: Ratings
5. Phone width

## What to expect (these must happen)

- A customer can rate the order 1–5 with a review and rate each dish on its own, from the Account page and from the order page.
- The stars are the store's colour (teal in this run), never the stock yellow, on the storefront and in the admin panel.
- The store sees the ratings by review, by customer, by outlet and by dish, with the right averages and counts.

## What must NOT happen

- The dish section must NOT appear before the order has stars; nothing about a dish is forced.
- A star must NOT be yellow.
- A phone-width page must NOT scroll sideways.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (35)

**Step 1 — The Account page: Rate this order**

- a completed order says 'Rate this order'
- …with a star that is not yellow — _rgb(13, 148, 136)_
- the box opens with the five order stars only — _5_
- the dish section waits until the order has stars (nothing is forced)
- 5 stars says 'Excellent'
- all five stars are filled in the STORE's colour (teal, from --color-primary), not yellow — _{"stop":"rgb(13, 148, 136)","theme":"rgb(13, 148, 136)","count":5}_
- now 'Rate each dish' appears: five stars for each of the two dishes
- …each with its quantity — _Sweet Lassi ×2 \| Masala Coke_
- touching the same star again takes a dish rating back
- Send rating thanks them
- the store has the order's 5★ and review, the lassi 5★ with its note and the coke 2★
- the order now shows what was given: its stars and a chip for each dish — _Sweet Lassi 5★ Masala Coke 2★_

**Step 2 — The order page: rate, then change**

- an order can be rated from its own page, with no dish ratings at all (4★) — _[]_
- the order page then says 'You rated it'
- 'Change' opens with the earlier rating filled in
- changing it adds a dish rating to the same rating — _[{"itemId":"6b0a87a91b2fa75089c28c7a","name":"Masala Coke","rating":4,"comment":""}]_
- an earlier dish rating and its note come back in the box

**Step 3 — The same rating for a third order, by keyboard**

- the arrow keys move the rating (1 → 3)
- each star has a plain label (Poor … Excellent) for screen readers

**Step 4 — The store: Ratings**

- four tabs: Reviews, By customer, By outlet, By dish — _Reviews \| By customer \| By outlet \| By dish_
- Reviews: each review lists the dishes that were rated, with their notes
- the average's stars are the store's teal in the admin panel (not the console's own red, not yellow) — _{"stop":"rgb(13, 148, 136)","theme":"rgb(198, 54, 47)","count":5}_
- …they use the store's own colour (teal #0D9488 set for this run) — _rgb(13, 148, 136)_
- By customer: Rina rated 2 orders (the third was only started, never sent) — _2 ratings_
- …her average is 4.5 (5 and 4) — _4.5_
- searching for nobody says 'Nobody matches'
- searching by her phone number finds her
- By outlet: each outlet has its average and its number of ratings
- …one card for every outlet — _2_
- By dish: Sweet Lassi 5.0 from 1 rating
- …Masala Coke 3.0 from 2 ratings (2 and 4)
- 'Read reviews' shows the note and who wrote it
- sorted worst first: Masala Coke comes first
- searching 'lassi' leaves one dish

**Step 5 — Phone width**

- the rating box fits a phone's width (no sideways scroll)

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-28 13:20 | pass | 35 | 0 | headless | 6.2 s |
| 2026-11-28 13:19 | fail | 31 | 4 | headless | 6.0 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t139-ratings-ui.mjs`), not this page._
