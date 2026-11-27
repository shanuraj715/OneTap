// T131 — The server side of the Rasoi Pulse Business app: who may sign in, coupon usage, bookings, counted stock, insights, the expenses ledger, goals, Excel / PDF reports
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t131-business-reports-api",
  title: "Business app server side: owners / managers / accountants may sign in, others are turned away; coupon usage, table bookings, counted stock, plain-English insights, the sales goal, the expenses ledger (+ profit & loss from it) and Excel / PDF / CSV reports hold the right numbers",
  area: "analytics",
  browser: false,
  fresh: false,
  summary: "API checks on an in-memory database with made-up orders (two outlets), coupons, bookings, dishes with counted stock and bills; every expected number is worked out in the test from that data. Sign-in to the new app (owner, manager, accountant in; waiter and cook turned away in words; the other apps' sign-ins unchanged). Coupon usage (case-insensitive codes, cancelled / unpaid / older orders left out, the previous period, unused coupons, per outlet), table bookings (guests, no-shows, advance, party sizes, busiest day), stock (out / low / fine, days left), insights, a plan without coupons or bookings leaving them out, the expenses ledger (rules, totals by category / vendor / outlet / method, the chart, corrections, deleting, who may), profit & loss from the recorded bills, real .xlsx / PDF / CSV files, the monthly goal, and the older analytics unchanged.",
  expect: [
    "Owners, managers and accountants sign in to the Business app; a waiter or a cook is refused with a sentence and no session is left open.",
    "Coupon usage, bookings, stock and expense figures equal the numbers worked out separately from the same data.",
    "The Excel file has a sheet for each chosen section (coupons, reservations, expenses, profit & loss) and the PDF is a real PDF.",
    "Profit & loss worked from the ledger = net sales − food cost − the recorded bills.",
  ],
  expectNot: [
    "A cancelled, unpaid or out-of-range order must NOT count as a coupon use.",
    "A manager must NOT read or write the ledger, or download files.",
    "A plan without coupons or bookings must NOT show them (it answers enabled: false).",
    "The other apps' sign-ins and the store dashboard's analytics must NOT change.",
  ],
};

export const run = (d) => runSuite(d, "business-reports-api.mjs", { timeoutMs: 5 * 60_000 });
