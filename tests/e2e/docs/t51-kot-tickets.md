# T51 — Kitchen tickets (KOT) — each dish goes to the right printer (kitchen / bar); an order edited after its ticket went out sends an 'ORDER CHANGED' ticket with only the difference; a cancelled order withdraws a waiting ticket or sends 'ORDER CANCELLED — DO NOT COOK'

**Area:** printing · **Last result:** ✅ PASSED (62 passed, 0 failed · 2026-11-21 00:45 · headless · 25.1 s)

**Run it alone:** `node run.mjs --only t51` (add `--visible` to watch it)

## What this test does

Two suites. (1) suites/kot-tickets-api.mjs (its own in-memory API, the text on every ticket is read from the saved print jobs): a Food category (kitchen by default) and a Drinks category set to Bar with Hot Drinks inside it, plus a dish that overrides its category each way; a kitchen printer, a bar printer and a counter receipt printer. Accepting an order gives the kitchen ticket ONLY the kitchen dishes and the bar ticket ONLY the bar dishes (through a sub-category, and by a dish's own setting beating its category's), with quantities and never a price, while the counter receipt keeps the whole order with prices. An order with only kitchen dishes sends nothing to the bar. A dish is never left without a ticket: with the bar printer off its dish prints on the kitchen ticket, with only a bar printer left a kitchen dish prints there, and a KOT printer at any other station (counter) is a master copy with every dish. After the tickets were printed, editing the order sends each printer an 'ORDER CHANGED' ticket with only the difference (ADD 1 x Veg Momos when 2 became 3, REMOVE 1 x Masala Chai, nothing about unchanged dishes), only to the printers that make the changed dishes (a bar-only edit leaves the kitchen alone), a printer that had nothing in the original order still hears about a dish added for it, an edit that changes nothing sends nothing, a changed kitchen note sends 'Note is now: …', and an order edited before any ticket was sent sends no change ticket (its first ticket just shows the new order). Cancelling an order: tickets already printed get a big 'ORDER CANCELLED / DO NOT COOK' ticket with that printer's dishes (once, even if the printer is also set to fire on 'cancelled'), tickets still waiting are withdrawn with no cancelled ticket, a mix of both works, and the counter receipt is untouched. Reprinting a change or cancelled ticket prints that same ticket again; printing by hand on a printer that would get nothing still prints; the print log tells normal, changed and cancelled tickets apart; a dish or category can be set to bar / kitchen / cleared through the menu API, anything else is refused; a store without the Printing feature gets no tickets. (2) suites/kot-menu-ui.mjs in Chrome as the owner of Acme Momos: Menu → a category's ⋯ → Edit… has 'Prepared at' (Same as the category it is inside / Kitchen / Bar / beverages), saves and clears; a dish's Edit form has 'Prepared at' (Same as its category / Kitchen / Bar / beverages), saves and clears; Printing → Queue labels tickets 'order changed' and 'order cancelled'. Everything made is removed.

## Steps

1. every dish goes to the printer of the station that makes it
2. no empty tickets
3. a dish is never left without a ticket
4. an order edited after its ticket went out sends a CHANGE ticket
5. a cancelled order: withdraw a waiting ticket, or send a CANCELLED one
6. reprints, hand printing and the print log
7. setting where a dish or category is prepared
8. a store without the Printing feature
9. Menu → a category → Edit… → Prepared at
10. Menu → a dish → Edit → Prepared at
11. Printing → Queue labels the tickets

## What to expect (these must happen)

- A kitchen ticket has only the dishes made at that printer's station; no empty tickets; a dish always gets a ticket somewhere.
- Editing an order after its ticket was sent prints an ORDER CHANGED ticket with only ADD / REMOVE lines, to the right printers only.
- Cancelling prints ORDER CANCELLED — DO NOT COOK where the order was already printed, and just withdraws tickets still waiting.
- The dashboard has 'Prepared at' on categories and dishes, and the Printing queue labels changed and cancelled tickets.

## What must NOT happen

- A kitchen ticket must NOT show a price.
- The bar must NOT get a ticket for kitchen-only dishes (and vice versa).
- An edit that changes nothing must NOT print a ticket.
- A cancelled ticket must NOT be printed for an order the kitchen never saw.
- The browser must NOT log errors or warnings.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (62)

**Step 1 — every dish goes to the printer of the station that makes it**

- accepting an order queues a ticket for the kitchen printer, one for the bar printer and the counter receipt — _3 jobs_
- the KITCHEN ticket has the kitchen dishes (Veg Momos, and Sweet Lassi — the dish says kitchen although its category says bar)
- …and none of the bar's dishes
- the BAR ticket has the bar dishes (Masala Chai — through Hot Drinks inside Drinks — and Cold Coffee — the dish says bar although its category says nothing)
- …and none of the kitchen's dishes
- quantities are on the tickets ('2 x Veg Momos')
- kitchen tickets never show a price
- the counter receipt still has the whole order, with prices

**Step 2 — no empty tickets**

- an order with only kitchen dishes sends nothing to the bar printer — _kitchen 1, bar 0_
- …and the counter receipt still prints

**Step 3 — a dish is never left without a ticket**

- with the bar printer switched off, the bar's dish comes out on the kitchen ticket
- with ONLY a bar printer left, a kitchen dish still prints (on the bar printer)
- a KOT printer at any other station (here: counter) is a master copy with every dish
- …while the kitchen and bar printers still split as before

**Step 4 — an order edited after its ticket went out sends a CHANGE ticket**

- (setup) the first tickets were sent and printed
- both printers that make a changed dish get a change ticket — _5 jobs_
- each change ticket says ORDER CHANGED at the top
- kitchen: ADD 1 x Veg Momos (it went from 2 to 3) and ADD 1 x Paneer Roll
- …and nothing about what did not change (Sweet Lassi), nor the whole quantity
- …and nothing about the bar's dish
- bar: REMOVE 1 x Masala Chai, nothing to add
- …and none of the kitchen's dishes
- adding a bar dish sends a change ticket to the bar only — the kitchen is not disturbed
- an edit that changes nothing sends no ticket
- changing only the kitchen note sends a ticket that says what the note is now
- (setup) an order that started with only a kitchen dish: the bar printer got nothing
- …and when a chai is added later, the bar printer gets it
- an order edited before its kitchen ticket was sent sends no change ticket
- …the ticket that is sent later simply shows the new order (4 x Veg Momos)

**Step 5 — a cancelled order: withdraw a waiting ticket, or send a CANCELLED one**

- both printers that had printed the order get one CANCELLED ticket (even though the kitchen printer is also set to fire on 'cancelled' — no second ticket) — _kitchen 1, bar 1, total 5_
- the kitchen's says ORDER CANCELLED / DO NOT COOK and names the order and ITS dishes only
- …and the bar's names the bar's dish
- the counter receipt is not turned into a cancelled ticket
- tickets still waiting to print are withdrawn when the order is cancelled — _cancelled,cancelled_
- …and no CANCELLED ticket is printed for something the kitchen never saw
- kitchen already printed → it gets the CANCELLED ticket; bar still waiting → its ticket is just withdrawn

**Step 6 — reprints, hand printing and the print log**

- reprinting a change ticket prints that same change ticket again (marked REPRINT)
- reprinting the bar's ticket still has only the bar's dishes
- printing an order by hand on a printer that would otherwise get nothing still prints (the whole order) — a person asked for it
- the print log says which tickets are normal, changed or cancelled — _kot,change,cancel_

**Step 7 — setting where a dish or category is prepared**

- a dish can be set to 'bar' — _200_
- …and set back to 'same as its category'
- any other place is refused — _400_
- a category can be set too
- the menu carries each category's and dish's setting

**Step 8 — a store without the Printing feature**

- no tickets of any kind are queued

**Step 9 — Menu → a category → Edit… → Prepared at**

- the category's Edit window has a 'Prepared at' choice
- …offering 'Same as the category it is inside', 'Kitchen' and 'Bar / beverages' — _Same as the category it is inside \| Kitchen \| Bar / beverages_
- a category that was never set starts on 'Same as the category it is inside'
- a line explains what it decides
- Save keeps it: Beverages is now made at the Bar
- opening it again still shows 'Bar / beverages'
- choosing 'Same as the category it is inside' clears it again

**Step 10 — Menu → a dish → Edit → Prepared at**

- the dish form has 'Prepared at', starting on 'Same as its category'
- …with Kitchen and Bar / beverages to pick from
- Save keeps it on the dish
- …and the form shows it when reopened
- …and goes back to 'same as its category'

**Step 11 — Printing → Queue labels the tickets**

- (setup) the order has its ticket and a change ticket — _cancel,change,kot_
- the Queue marks the change ticket 'order changed'
- …and the ticket that tells the kitchen 'order cancelled'
- the browser logged no errors or warnings

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-21 00:45 | pass | 62 | 0 | headless | 25.1 s |
| 2026-11-20 16:05 | pass | 62 | 0 | headless | 24.9 s |
| 2026-11-20 12:10 | pass | 62 | 0 | headless | 24.3 s |
| 2026-11-20 11:15 | pass | 62 | 0 | headless | 24.4 s |
| 2026-11-20 10:51 | pass | 62 | 0 | headless | 25.0 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t51-kot-tickets.mjs`), not this page._
