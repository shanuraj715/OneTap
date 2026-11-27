# T134 — CHT01 in the dashboards: the platform console's 'Where sales come from' (violet) and the store dashboard's revenue widget (green) — real layers, legend, reading on hover — and the catalogue sample unchanged (sky blue)

**Area:** dashboard · **Last result:** ✅ PASSED (33 passed, 0 failed · 2026-11-28 04:09 · headless · 4.9 s)

**Run it alone:** `node run.mjs --only t134` (add `--visible` to watch it)

## What this test does

Chrome against the bench console. The two dashboards' answers are given known numbers so each figure on screen can be checked exactly. Platform dashboard: a card 'Where sales come from' with the 12 months' total, the change this month, a legend (dine-in, takeaway, delivery, other), violet layers (not the sample's blue), a rupee axis, and a reading bubble on hover whose layers add up to its total; it hides when no month has any split sales; it fits a phone-width screen. Store dashboard: the revenue widget holds a green stacked chart of the last 14 days with a legend and the same hover reading; with no sales it falls back to the plain line chart; the other widgets are untouched. The components catalogue's CHT01 sample still reads 'Sessions 13,277 +35%' in its original blue.

## Steps

1. The platform dashboard: 'Where sales come from' (violet)
2. 1b. A phone-width screen
3. 1c. No sales split yet
4. The store dashboard: the revenue widget (green)
5. 2b. Nothing to stack yet
6. The components catalogue: the sample is unchanged

## What to expect (these must happen)

- The platform dashboard has a violet stacked chart of 12 months split by order type, with a legend and a hover reading that adds up.
- The store dashboard's revenue widget shows a green stacked chart of 14 days with the same hover reading.
- The catalogue's CHT01 sample is unchanged: original sky blue and original numbers.

## What must NOT happen

- The chart must NOT be drawn when there is nothing to stack (the plain line chart or no card shows instead).
- The two dashboards' charts must NOT use the sample's blue.
- The page must NOT scroll sideways on a phone-width screen.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (33)

**Step 1 — The platform dashboard: 'Where sales come from' (violet)**

- the chart card is on the platform dashboard, titled 'Where sales come from'
- only one CHT01 card there
- its big number is the twelve months' sales in rupees — _₹1,46,500_
- …with the change this month, in the green pill
- the legend names each order type (Other too, because there is some) — _Dine-in Takeaway Delivery Other_
- four layers are drawn
- the layers are violet (darkest at the bottom, lightest on top) — not the sample's sky blue
- …and none of the original blues
- the left axis is in rupees, down to ₹0 — _₹50K ₹40K ₹30K ₹20K ₹10K ₹0_
- the bottom axis names months — _Dec Feb Apr Jul Sep Nov_
- hovering the last month reads each layer: dine-in ₹12,000, takeaway ₹6,000, delivery ₹3,000, other ₹10,000 — _Nov Other ₹10,000 Delivery ₹3,000 Takeaway ₹6,000 Dine-in ₹12,000 Total ₹31,000_
- …and the total ₹31,000 (the layers added up)
- hovering the first month reads ₹1,000 + ₹500 + ₹250 = ₹1,750 — _Dec Other ₹0 Delivery ₹250 Takeaway ₹500 Dine-in ₹1,000 Total ₹1,750_
- moving the pointer away hides the reading
- the platform's own charts (Sales by month …) are still there, untouched
- the dashboard still fits the screen's width

**Step 2 — 1b. A phone-width screen**

- on a phone the page does not scroll sideways — _390_
- …and the chart card fits inside the screen — _358_

**Step 3 — 1c. No sales split yet**

- when no month has any split sales the card is not shown (no empty chart)

**Step 4 — The store dashboard: the revenue widget (green)**

- the revenue widget now holds the stacked chart
- three layers: dine-in, takeaway, delivery (no 'Other', there is none)
- the legend names them — _Dine-in Takeaway Delivery_
- the layers are green (emerald), a different colour from the platform's violet and the sample's blue — _rgb(4, 120, 87) \| rgb(16, 185, 129) \| rgb(167, 243, 208)_
- the widget keeps its own card: the chart inside has no second frame
- no sample text ('Sessions') leaks into the real chart
- hovering today reads dine-in ₹700, takeaway ₹420, delivery ₹280, total ₹1,400 — _Nov 28 Delivery ₹280 Takeaway ₹420 Dine-in ₹700 Total ₹1,400_
- the left axis is in rupees — _₹2K ₹1.6K ₹1.2K ₹800 ₹400 ₹0_
- the other widgets are untouched

**Step 5 — 2b. Nothing to stack yet**

- with no sales the widget falls back to the plain line chart (no empty stacked chart)

**Step 6 — The components catalogue: the sample is unchanged**

- CHT01's sample still reads 'Sessions 13,277 +35%'
- …in its original sky blue — _rgb(3, 105, 161) \| rgb(2, 132, 199) \| rgb(125, 211, 252)_
- …with its original axis labels (25,000 … Apr 30)
- the sample now also has a legend (Direct, Search, Social)

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-28 04:09 | pass | 33 | 0 | headless | 4.9 s |
| 2026-11-28 04:09 | fail | 31 | 2 | headless | 5.1 s |
| 2026-11-28 04:08 | pass | 33 | 0 | headless | 4.8 s |
| 2026-11-28 04:08 | fail | 29 | 1 | headless | 34.7 s |
| 2026-11-28 04:07 | fail | 29 | 1 | headless | 19.9 s |
| 2026-11-28 04:07 | fail | 10 | 1 | headless | 6.1 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t134-cht01-dashboards-ui.mjs`), not this page._
