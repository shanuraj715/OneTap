// T111 — The dashboard: who may see what (permission + plan), what each role is SENT, the new widgets, India's day.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t111-dashboard-roles-api",
  title: "Dashboard: every widget needs a permission (some a plan feature), a person is only SENT the numbers they may see, plus deliveries / bookings / rating widgets and India's day boundary",
  area: "dashboard",
  browser: false,
  fresh: false,
  summary: "Runs suites/dashboard-roles-api.mjs against a private API on an in-memory database. The rules: 20 widgets, each names a real permission (and, for coupons, coins, notifications, deliveries, bookings and ratings, a real plan feature); no widget is shown by default to a role that may not read its numbers; the content editor has no dashboard; the kitchen can't be given Revenue (needs Reports) but the accountant can; a plan without Delivery can't have the deliveries widget; a tick left on a role that may not read the numbers shows nothing; a widget switched off is gone for everyone, the platform super admin included. A store with paid, unpaid, delivery and booking data, a full plan, and an owner, manager, cashier, kitchen, accountant and editor: the owner gets today's five orders and ₹500 revenue (not the two from before India's midnight — the order a minute past midnight counts, the one a minute before does not), yesterday's ₹600 for the 'compared with yesterday' line, a 14-day trend whose last day is today in India, the hour chart on India's clock, deliveries (1 out, 1 waiting for a rider), bookings (3 today, 1 waiting for a yes, 2 still to come; tomorrow's left out), rating 4.0 from 3 ratings (the 40-day-old one is outside 30 days). The KITCHEN is sent no revenue, average or trend even though paid orders exist (those numbers are never even computed), but gets orders, queue, status and recent orders; a cashier gets the queue and bookings but no revenue; the accountant the money and the trend but no bookings and only the lists set for them; the editor gets 403. A store on a small plan gets orders and revenue but nothing about deliveries, bookings or ratings; unlocking Delivery for that store brings deliveries at once. The owner's own choices: switching widgets off stops the server computing them; ticking Revenue for the kitchen changes nothing (the permission wins); taking the kitchen off a widget stops them being sent it; every widget off still answers 200; a dashboard saved before the newest widgets existed still gets them with their defaults.",
  expect: [
    "A person is sent only the numbers behind widgets they may see (permission, plan, and the owner's own choices).",
    "'Today' is India's day: the order a minute past India's midnight counts today, the one a minute before it does not.",
    "The kitchen cannot read the day's revenue by calling the API.",
  ],
  expectNot: [
    "Ticking a role for a widget it has no permission for must NOT show it the numbers.",
    "A plan without Delivery / Bookings / Ratings must NOT be sent those numbers.",
    "A store saved before the new widgets existed must NOT lose them.",
  ],
};

export const run = (d) => runSuite(d, "dashboard-roles-api.mjs", { timeoutMs: 6 * 60_000 });
