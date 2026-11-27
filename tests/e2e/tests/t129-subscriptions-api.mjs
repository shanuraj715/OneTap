// T129 — Rasoi Pulse's own sales: payments written down per store, new sale vs re-subscription, the business numbers and charts
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t129-subscriptions-api",
  title: "Rasoi Pulse's own business: payments stores made for their subscription are written down; the dashboard numbers (total sales, new sales, re-subscribed, who ran out) and the day / week / month charts are worked out from them",
  area: "platform",
  browser: false,
  fresh: false,
  summary: "API checks on an in-memory database. Five made-up stores and seven payments dated relative to today. The payment form's rules (amount, date, months, plan, note, duplicates), new sale vs re-subscription worked out from the dates (a late-written older payment, a deleted one), the days a payment covers (an early renewal carries on from where the last ended), total / new / re-subscribed / this month / who is paid up, ran out, never paid, by plan, the latest payments, and three charts (30 days, 12 weeks, 12 months) each against the period before — every expected number is worked out independently in the test from the same dates and amounts. Who may read and who may write (dashboard / store-read / store-manage roles, a restaurant owner, signed out), amounts in paise adding up exactly, and a deleted store's payments staying in the sales history.",
  expect: [
    "Total sales is the sum of everything stores paid; new sales counts first payments; re-subscribed counts later ones.",
    "The first payment of a store (by its date) is the new sale, whatever order they were written in.",
    "Each chart (day, week, month) shows this period against the one before, and the new + re-subscribed split adds up.",
    "Deleting a store leaves its payments in the sales history.",
  ],
  expectNot: [
    "The business numbers must NOT contain any store's orders or sales.",
    "A payment must NOT be accepted with a future date, zero or negative amount, bad months or a store that does not exist.",
    "A team member without the right access must NOT be able to read or write payments.",
    "Amounts must NOT drift (0.07 + 1,999.99 is exactly 2,000.06).",
  ],
};

export const run = (d) => runSuite(d, "subscriptions-api.mjs", { timeoutMs: 4 * 60_000 });
