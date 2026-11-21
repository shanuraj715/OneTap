# T17 — Analytics — sales, per-outlet graphs, compare outlets, best sellers + what to prepare, profit & loss, weekly/monthly/yearly exports, plan and role access

**Area:** analytics · **Last result:** ✅ PASSED (93 passed, 0 failed · 2026-11-21 13:26 · headless · 1 min 10 s)

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

- the figures equal the worked-out totals (Sales ₹52,164, Net sales ₹49,719, Orders 285, Items sold 558, Cancelled 32, Discounts given ₹496, Average order ₹183)
- Sales says how it moved against the 30 days before (-0.8%) — _Sales ₹52,164 −0.8% vs the period before incl. GST_
- the range shown is the last 30 days — _23 Oct 2026 – 21 Nov 2026 · 30 days_
- did not happen: cancelled orders are counted as sales (orders + cancelled would be 318)
- the day-by-day table has 30 days that add up to 285 orders — _30 rows, 285 orders_
- the hour-by-hour table adds up to 285 orders — _10 hours_
- the 'Busiest times' heat map and the order-type and payment charts are there

**Step 3 — Choosing an outlet, a shorter period or custom dates changes every figure**

- the Outlet box offers the whole store and each outlet — _Whole store \| Marketing Mart — Main \| Marketing Mart — Second_
- Marketing Mart — Main alone: ₹32,874 and 177 orders
- Marketing Mart — Second alone: ₹19,290 and 108 orders
- did not happen: one outlet's page still shows the other outlet's sales or the whole store's
- Last 7 days: ₹9,828, 54 orders
- 'Custom dates…' shows two date pickers (From, To) that start from the range just used
- picking an earlier start date in the calendar widens the figures — _499 orders from 2026-10-01_
- custom dates 2026-11-15 to 2026-11-21, picked in the calendar, give the same ₹9,828 as 'Last 7 days'
- Today (no paid orders yet in the sample) shows ₹0 and 0 orders, not an error

**Step 4 — Sales: one line per outlet, and the order types add up**

- the chart has a line for each outlet (their names are in the legend)
- the order-types table adds up to 285 orders — _285_
- takeaway ₹20688, delivery ₹18594, dine-in ₹12882 (store totals) — _{"t":20688,"d":18594,"i":12882}_
- Marketing Mart — Main's rows add up to 177 orders — _177_
- the best and quietest weekday are named

**Step 5 — Items & stock: best sellers, and how much to prepare**

- the best sellers run Paneer Steamed Momos 139, Cold Coffee 137, Chicken Momos 132
- 'Every item' lists each item with its quantity (Paneer Steamed Momos = 139)
- the prep list is for tomorrow, Sunday — _Tomorrow (Sunday): prepare about_
- tomorrow's list matches the worked-out numbers (Paneer Steamed Momos 6, Paneer Gravy Momos 2, Veg Steamed Momos 3, Chicken Momos 5, Cold Coffee 5)
- every item's seven weekday numbers match the worked-out suggestions (average of the last 6 weeks + 15%, rounded up)
- a bigger safety margin gives a bigger number (Paneer Steamed Momos on Saturday: 6 → 8)

**Step 6 — Customers: who has drifted away, and 'Message them' opens Marketing**

- the 30-, 60- and 90-day groups are listed
- Marketing opens with "hasn't ordered for 30 days" already chosen: the same 3 people — _3 vs 3_

**Step 7 — Compare outlets: side by side for the same dates**

- Sales: Marketing Mart — Main ₹32,874, Marketing Mart — Second ₹19,290 — _["Sales","₹32,874","₹19,290 −41% vs Marketing Mart — Main"]_
- Orders: 177 and 108 — _["Orders","177","108 −39% vs Marketing Mart — Main"]_
- the second outlet's sales are compared with the first (-41%) — _₹19,290 −41% vs Marketing Mart — Main_
- each outlet has its own best sellers (Paneer Steamed Momos — 105 and Chicken Momos — 62)
- there is a day-by-day line for each outlet
- for 2026-11-15 to 2026-11-21, picked in the calendar, the two outlets add up to the store's ₹9,828 — _9828_

**Step 8 — Operations: cancellations and discounts**

- 32 orders were cancelled, 10.1% of 317 — _Cancelled orders 32 10.1% of 317 orders_
- coupon discounts are ₹496
- kitchen speed and the coupon table are shown

**Step 9 — Profit & loss: type the monthly bills once, get the profit**

- the 'Shared by every outlet' list adds up to ₹2,500 a month — _₹2,500_
- net profit = 49719 net sales − 35% food − 22500 a month × 0.990 months = ₹10035 — _saw 10035_
- it is called a profit (not a loss)
- the table lists every bill by name with its share for these days
- profit by outlet: Marketing Mart — Main ≈ ₹5940, Marketing Mart — Second ≈ ₹4094 (own bills + a share of the shared ones by sales)
- a bill added by hand counts (₹1,000 a month more) — _saw 9044_
- did not happen: the removed bill still counts in the profit
- food cost 30% instead of 35% raises the profit to match — _saw 12521_

**Step 10 — The bills are remembered; 'Save to my store' keeps a copy for other devices**

- after a reload the rent typed for the first outlet is still there — _5000_
- …and so is the profit — _saw 10035_
- 'Save to my store' says it was saved — _Saved to your store — any device you sign in on will have these numbers._
- with the browser's memory wiped (a new device) the saved bills load by themselves — _Loaded the numbers saved to your store._
- …and the profit is the same again — _saw 10035_
- changing a bill changes the profit — _saw 5084_
- 'Use the version saved to my store' puts the saved bill back — _saw 10035_

**Step 11 — Reports: this week / last week / this month / last month / this year / last year**

- each weekly, monthly and yearly choice covers exactly the right dates

**Step 12 — Reports: Excel — a sheet per section with the right totals**

- the file is named like a report and ends .xlsx — _tablepe-marketing-mart-2026-10-23_to_2026-11-21.xlsx_
- there is a sheet for each chosen section
- did not happen: a section that was not chosen (Sales by hour, Every order) is in the file
- Summary: sales 52164, net 49718.57, GST 2445.43, orders 285, cancelled 32
- 'Sales by day' has 30 days adding up to ₹52164 — _30 rows_
- the GST sheet's days add up to ₹2445.43 GST, and its Total row says ₹2445.43 too — _29 days, total row ["Total",285,48918.57,1222.08,1223.35,2445.43,0,52164]_
- the Profit & loss sheet uses the bills typed earlier: net profit ≈ ₹10035 — _sheet says 10034.81_

**Step 13 — Reports: one outlet as CSV, and PDF and JSON**

- the CSV has a header and one row per day, with the BOM Excel needs — _Day,Orders,Sales (incl. GST),Net sales_
- Marketing Mart — Main's CSV adds up to ₹32874 and 177 orders (not the whole store's)
- did not happen: the outlet's CSV contains the whole store's sales
- the weekly PDF is a real PDF file — _7337 bytes_
- the yearly JSON says 2026-01-01 to 2026-12-31 for the whole store — _[{"from":"2026-01-01","to":"2026-12-31"},"Whole store"]_
- …and its summary holds at least the last 30 days' sales (the whole year includes them) — _125855_

**Step 14 — GST and the daily cash close agree**

- the GST total row: 285 orders, taxable ₹48,919, CGST ₹1,222, SGST ₹1,223, GST ₹2,445 — _Total 285 ₹48,919 ₹1,222 ₹1,223 ₹2,445 ₹52,164_
- the cash close for 2026-11-20, picked in the calendar, equals that day's invoice total in the GST table (₹2062) — _₹2,062 vs 2062_

**Step 15 — Who can see what: manager, accountant, cashier**

- the manager has Analytics in the sidebar
- …with Overview, Sales, Items & stock, Customers, Compare outlets and Operations
- did not happen: the manager is offered Profit & loss or Reports
- …and sees the same sales (₹52,164)
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
| 2026-11-21 13:26 | pass | 93 | 0 | headless | 1 min 10 s |
| 2026-11-21 04:42 | pass | 93 | 0 | headless | 1 min 12 s |
| 2026-11-20 11:06 | pass | 93 | 0 | headless | 1 min 9 s |
| 2026-11-20 05:49 | pass | 93 | 0 | headless | 1 min 11 s |
| 2026-11-20 05:14 | pass | 93 | 0 | headless | 1 min 11 s |
| 2026-11-20 04:47 | error | 87 | 0 | headless | 1 min 22 s |
| 2026-11-20 04:21 | pass | 93 | 0 | headless | 1 min 8 s |
| 2026-11-20 00:32 | pass | 93 | 0 | headless | 1 min 10 s |
| 2026-11-20 00:30 | fail | 92 | 1 | headless | 1 min 9 s |
| 2026-11-20 00:14 | fail | 92 | 1 | headless | 1 min 9 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t17-analytics.mjs`), not this page._
