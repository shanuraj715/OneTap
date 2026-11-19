# T17 — Analytics — sales, per-outlet graphs, compare outlets, best sellers + what to prepare, profit & loss, weekly/monthly/yearly exports, plan and role access

**Area:** analytics · **Last result:** ✅ PASSED (93 passed, 0 failed · 2026-11-20 00:32 · headless · 1 min 10 s)

**Run it alone:** `node run.mjs --only t17` (add `--visible` to watch it) · starts from fresh fake data

## What this test does

In Chrome as the owner of Marketing Mart (Pro plan, two outlets, about ten weeks of orders). Analytics sits at the top of 'Customers & growth'. The Overview's sales, net sales, orders, items sold, cancellations and discounts for the last 30 days equal the totals worked out from the stored orders, with the change against the 30 days before; choosing one outlet, 'Last 7 days' or custom dates picked in the calendar changes them to the expected figures. Sales shows each outlet as its own line; Items & stock ranks the best sellers and gives, for tomorrow and for every weekday, how many of each item to prepare (the average of recent weeks plus a safety margin that can be changed); Customers lists who has drifted away and 'Message them' opens Marketing with that filter; Compare outlets puts the outlets side by side for the same dates. Profit & loss takes the monthly bills (typed once, remembered in the browser, optionally saved to the store) and shows food cost, expenses, net profit and break-even, per outlet too. Reports downloads Excel, CSV, PDF and JSON for a week, month, year or custom dates, for the whole store or one outlet, and the files hold the same numbers; GST and the daily cash close agree with each other. A manager sees the figures but not profit/exports, an accountant sees everything, a cashier sees nothing, and a store whose plan lacks Analytics sees a notice until the platform unlocks it for that store.

## Steps

1. The owner of Marketing Mart finds Analytics in the sidebar
2. Overview: the last 30 days match the totals worked out from the stored orders
3. Choosing an outlet, a shorter period or custom dates changes every figure
4. Sales: one line per outlet, and the order types add up
5. Items & stock: best sellers, and how much to prepare
6. Customers: who has drifted away, and 'Message them' opens Marketing
7. Compare outlets: side by side for the same dates
8. Operations: cancellations and discounts
9. Profit & loss: type the monthly bills once, get the profit
10. The bills are remembered; 'Save to my store' keeps a copy for other devices
11. Reports: this week / last week / this month / last month / this year / last year
12. Reports: Excel — a sheet per section with the right totals
13. Reports: one outlet as CSV, and PDF and JSON
14. GST and the daily cash close agree
15. Who can see what: manager, accountant, cashier
16. Plans: a store without Analytics sees a notice; the platform can unlock or lock it for one store

## What to expect (these must happen)

- The sidebar shows Analytics first in 'Customers & growth'; its tabs are Overview, Sales, Items & stock, Customers, Compare outlets, Operations, Profit & loss and Reports.
- Overview, last 30 days, whole store: sales, net sales (without GST), orders, items sold, cancelled orders, discounts and the average order each equal the totals worked out separately from the stored orders, with the change against the 30 days before; the day-by-day and hour-by-hour tables add up to the same order count.
- Each outlet alone shows exactly its own sales and orders; Last 7 days and the same dates picked in the calendar both give the 7-day totals; Today gives the (empty) today.
- Sales shows one line per outlet, and the order-types table adds up to the same orders and to the takeaway/delivery/dine-in sales of the store.
- Items & stock lists the best sellers in order with their quantities; for outlet Main, tomorrow's prep list and the weekday table give the suggested quantities worked out separately (average of the last 6 weeks + 15%, rounded up), and a bigger safety margin gives bigger numbers.
- Customers: 'Message them' for the 30-day group opens Marketing with that filter and the same number of people.
- Compare outlets: the two outlets side by side with their own sales and orders, each outlet's own best sellers, and for dates picked in the calendar the two outlets add up to the store's sales.
- Operations: the cancelled orders and their share of all placed orders, and the coupon discounts, equal the worked-out totals.
- Profit & loss: monthly bills typed per outlet and for the whole store give food cost, expenses and net profit that match the arithmetic for these 30 days; the same figures per outlet; a bill added by hand counts and can be removed; the food-cost % changes the result.
- The bills are remembered after a reload; 'Save to my store' keeps a copy that 'Use the version saved to my store' restores after the browser's memory is wiped.
- Reports: Excel has a sheet per section with the right totals (sales, orders, GST, profit & loss); CSV holds one table and sums to the outlet's sales; PDF is a real PDF; JSON has the range and the summary; this week / last week / this month / last month / this year / last year give the right dates.
- GST totals match (orders, taxable value, CGST, SGST, total GST); the daily cash close for a day picked in the calendar equals that day's invoice total in the GST table.
- A manager has Analytics without Profit & loss and Reports (their addresses are 404s); an accountant has all tabs; a cashier has no Analytics at all (404).
- A store on a plan without Analytics sees 'Analytics isn't in your plan'; unlocking it for that store opens it; locking it for Marketing Mart removes it even though the plan has it; 'From plan' restores it.

## What must NOT happen

- Cancelled or unpaid orders must NOT count as sales.
- Choosing one outlet must NOT show the other outlet's sales.
- A manager must NOT see Profit & loss or Reports, even by typing the address.
- A cashier must NOT see Analytics.
- A store whose plan lacks Analytics must NOT show the pages.
- A bill removed from the list must NOT still count in the profit.
- The browser must NOT log JavaScript errors.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (93)

**Step 1 — The owner of Marketing Mart finds Analytics in the sidebar**

- Analytics is the first item of 'Customers & growth'
- the tabs are Overview, Sales, Items & stock, Customers, Compare outlets, Operations, Profit & loss, Reports

**Step 2 — Overview: the last 30 days match the totals worked out from the stored orders**

- the figures equal the worked-out totals (Sales ₹50,909, Net sales ₹48,523, Orders 283, Items sold 547, Cancelled 31, Discounts given ₹561, Average order ₹180)
- Sales says how it moved against the 30 days before (-0.9%) — _Sales ₹50,909 −0.9% vs the period before incl. GST_
- the range shown is the last 30 days — _22 Oct 2026 – 20 Nov 2026 · 30 days_
- did not happen: cancelled orders are counted as sales (orders + cancelled would be 318)
- the day-by-day table has 30 days that add up to 283 orders — _30 rows, 283 orders_
- the hour-by-hour table adds up to 283 orders — _11 hours_
- the 'Busiest times' heat map and the order-type and payment charts are there

**Step 3 — Choosing an outlet, a shorter period or custom dates changes every figure**

- the Outlet box offers the whole store and each outlet — _Whole store \| Marketing Mart — Main \| Marketing Mart — Second_
- Marketing Mart — Main alone: ₹33,417 and 178 orders
- Marketing Mart — Second alone: ₹17,492 and 105 orders
- did not happen: one outlet's page still shows the other outlet's sales or the whole store's
- Last 7 days: ₹10,342, 56 orders
- 'Custom dates…' shows two date pickers (From, To) that start from the range just used
- picking an earlier start date in the calendar widens the figures — _487 orders from 2026-10-01_
- custom dates 2026-11-14 to 2026-11-20, picked in the calendar, give the same ₹10,342 as 'Last 7 days'
- Today (no paid orders yet in the sample) shows ₹0 and 0 orders, not an error

**Step 4 — Sales: one line per outlet, and the order types add up**

- the chart has a line for each outlet (their names are in the legend)
- the order-types table adds up to 283 orders — _283_
- takeaway ₹19828, delivery ₹17097, dine-in ₹13984 (store totals) — _{"t":19828,"d":17097,"i":13984}_
- Marketing Mart — Main's rows add up to 178 orders — _178_
- the best and quietest weekday are named

**Step 5 — Items & stock: best sellers, and how much to prepare**

- the best sellers run Paneer Steamed Momos 133, Cold Coffee 133, Chicken Momos 128
- 'Every item' lists each item with its quantity (Paneer Steamed Momos = 133)
- the prep list is for tomorrow, Saturday — _Tomorrow (Saturday): prepare about_
- tomorrow's list matches the worked-out numbers (Paneer Steamed Momos 7, Paneer Gravy Momos 3, Veg Steamed Momos 3, Chicken Momos 4, Cold Coffee 6)
- every item's seven weekday numbers match the worked-out suggestions (average of the last 6 weeks + 15%, rounded up)
- a bigger safety margin gives a bigger number (Paneer Steamed Momos on Saturday: 7 → 10)

**Step 6 — Customers: who has drifted away, and 'Message them' opens Marketing**

- the 30-, 60- and 90-day groups are listed
- Marketing opens with "hasn't ordered for 30 days" already chosen: the same 3 people — _3 vs 3_

**Step 7 — Compare outlets: side by side for the same dates**

- Sales: Marketing Mart — Main ₹33,417, Marketing Mart — Second ₹17,492 — _["Sales","₹33,417","₹17,492 −48% vs Marketing Mart — Main"]_
- Orders: 178 and 105 — _["Orders","178","105 −41% vs Marketing Mart — Main"]_
- the second outlet's sales are compared with the first (-48%) — _₹17,492 −48% vs Marketing Mart — Main_
- each outlet has its own best sellers (Paneer Steamed Momos — 105 and Chicken Momos — 54)
- there is a day-by-day line for each outlet
- for 2026-11-14 to 2026-11-20, picked in the calendar, the two outlets add up to the store's ₹10,342 — _10342_

**Step 8 — Operations: cancellations and discounts**

- 31 orders were cancelled, 9.9% of 314 — _Cancelled orders 31 9.9% of 314 orders_
- coupon discounts are ₹561
- kitchen speed and the coupon table are shown

**Step 9 — Profit & loss: type the monthly bills once, get the profit**

- the 'Shared by every outlet' list adds up to ₹2,500 a month — _₹2,500_
- net profit = 48523 net sales − 35% food − 22500 a month × 0.989 months = ₹9282 — _saw 9282_
- it is called a profit (not a loss)
- the table lists every bill by name with its share for these days
- profit by outlet: Marketing Mart — Main ≈ ₹6227, Marketing Mart — Second ≈ ₹3055 (own bills + a share of the shared ones by sales)
- a bill added by hand counts (₹1,000 a month more) — _saw 8293_
- did not happen: the removed bill still counts in the profit
- food cost 30% instead of 35% raises the profit to match — _saw 11708_

**Step 10 — The bills are remembered; 'Save to my store' keeps a copy for other devices**

- after a reload the rent typed for the first outlet is still there — _5000_
- …and so is the profit — _saw 9282_
- 'Save to my store' says it was saved — _Saved to your store — any device you sign in on will have these numbers._
- with the browser's memory wiped (a new device) the saved bills load by themselves — _Loaded the numbers saved to your store._
- …and the profit is the same again — _saw 9282_
- changing a bill changes the profit — _saw 4337_
- 'Use the version saved to my store' puts the saved bill back — _saw 9282_

**Step 11 — Reports: this week / last week / this month / last month / this year / last year**

- each weekly, monthly and yearly choice covers exactly the right dates

**Step 12 — Reports: Excel — a sheet per section with the right totals**

- the file is named like a report and ends .xlsx — _tablepe-marketing-mart-2026-10-22_to_2026-11-20.xlsx_
- there is a sheet for each chosen section
- did not happen: a section that was not chosen (Sales by hour, Every order) is in the file
- Summary: sales 50909, net 48523.31, GST 2385.69, orders 283, cancelled 31
- 'Sales by day' has 30 days adding up to ₹50909 — _30 rows_
- the GST sheet's days add up to ₹2385.69 GST, and its Total row says ₹2385.69 too — _29 days, total row ["Total",283,47723.31,1192.24,1193.45,2385.69,0,50909]_
- the Profit & loss sheet uses the bills typed earlier: net profit ≈ ₹9282 — _sheet says 9282.09_

**Step 13 — Reports: one outlet as CSV, and PDF and JSON**

- the CSV has a header and one row per day, with the BOM Excel needs — _Day,Orders,Sales (incl. GST),Net sales_
- Marketing Mart — Main's CSV adds up to ₹33417 and 178 orders (not the whole store's)
- did not happen: the outlet's CSV contains the whole store's sales
- the weekly PDF is a real PDF file — _7278 bytes_
- the yearly JSON says 2026-01-01 to 2026-12-31 for the whole store — _[{"from":"2026-01-01","to":"2026-12-31"},"Whole store"]_
- …and its summary holds at least the last 30 days' sales (the whole year includes them) — _123960_

**Step 14 — GST and the daily cash close agree**

- the GST total row: 283 orders, taxable ₹47,723, CGST ₹1,192, SGST ₹1,193, GST ₹2,386 — _Total 283 ₹47,723 ₹1,192 ₹1,193 ₹2,386 ₹50,909_
- the cash close for 2026-11-19, picked in the calendar, equals that day's invoice total in the GST table (₹1565) — _₹1,565 vs 1565_

**Step 15 — Who can see what: manager, accountant, cashier**

- the manager has Analytics in the sidebar
- …with Overview, Sales, Items & stock, Customers, Compare outlets and Operations
- did not happen: the manager is offered Profit & loss or Reports
- …and sees the same sales (₹50,909)
- /analytics/profit is a 404 for the manager
- did not happen: the manager sees the profit screen
- /analytics/reports is a 404 for the manager
- did not happen: the manager sees the reports screen
- the accountant has every tab, including Profit & loss and Reports
- …and can download (the Download button and the GST table are there)
- did not happen: the cashier has Analytics in the sidebar
- /analytics/overview is a 404 for the cashier

**Step 16 — Plans: a store without Analytics sees a notice; the platform can unlock or lock it for one store**

- did not happen: a store on the Starter plan has Analytics in its sidebar
- opening the address says 'Analytics isn't in your plan'
- did not happen: the Starter store sees sales figures
- the plan form has an 'Analytics & reports' switch, ticked on Pro
- unlocked for Beta Bites: Analytics appears in its sidebar
- …and its (empty) Overview opens, with no plan notice — _₹0_
- did not happen: Marketing Mart keeps Analytics after the platform locked it for the store
- its address now says 'Analytics isn't in your plan'
- back to 'from plan' (Pro has it): Analytics is back
- did not happen: the browser logged JavaScript errors

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-20 00:32 | pass | 93 | 0 | headless | 1 min 10 s |
| 2026-11-20 00:30 | fail | 92 | 1 | headless | 1 min 9 s |
| 2026-11-20 00:14 | fail | 92 | 1 | headless | 1 min 9 s |
| 2026-11-19 12:56 | pass | 93 | 0 | headless | 1 min 10 s |
| 2026-11-19 12:35 | pass | 93 | 0 | headless | 1 min 10 s |
| 2026-11-19 11:15 | pass | 93 | 0 | headless | 1 min 8 s |
| 2026-11-19 01:22 | pass | 93 | 0 | headless | 1 min 11 s |
| 2026-11-19 01:13 | fail | 92 | 1 | headless | 1 min 10 s |
| 2026-11-18 17:42 | pass | 93 | 0 | headless | 1 min 10 s |
| 2026-11-18 15:06 | pass | 93 | 0 | headless | 1 min 10 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t17-analytics.mjs`), not this page._
