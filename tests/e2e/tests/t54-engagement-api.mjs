// T54 — Table bookings, ratings, "order again", "goes well with" suggestions and abandoned-cart reminders: the API rules, on a throwaway database with a fake SMS gateway (no browser, no real messages).
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t54-engagement-api",
  title: "Bringing customers back — table bookings, ratings, order again, suggestions and abandoned-cart reminders (API rules)",
  area: "customers",
  browser: false,
  fresh: false,
  summary: "Runs suites/engagement-api.mjs: its own in-memory API, a store on a plan with everything and one on a Basic plan without Table reservations, Ratings or Cart reminders, and a fake SMS gateway on this machine. Bookings: off until switched on; days and times from opening hours with minimum notice; capacity counts every booking that overlaps (a declined one frees its seats); sign-in needed; big parties told to call; staff can overbook only on purpose; confirm → seat at a table → complete, with no skipping; cashiers see and run bookings, the kitchen doesn't; guests hold at most 3 upcoming bookings, see only their own (none of the team's notes) and cancel inside the outlet's window; auto-confirm; the plan decides. Ratings: only completed orders from the last 30 days, only your own, one per order and changeable for a week, unknown tags dropped, happy ratings offered the Google review link, the owner's summary (average, stars, comments) and filters, who may see them, the plan decides. Order again: rebuilt against today's menu — sizes, add-ons and notes kept, sold-out and deleted dishes left out with why, dropped add-ons said, priced at today's prices, nobody else's order. Suggestions: the owner's picks, nothing already in the cart, nothing sold out, nothing that needs a choice, what others ordered together, and off when switched off. Cart reminders: nothing kept while off; managers switch them on (not cashiers); sending hours that make sense; one reminder after the delay, by SMS here, saying what was left, what it's worth and linking straight to the cart (which opens on another phone with dishes only); never twice; an order afterwards counts as won back; never again within the customer's gap, outside sending hours or for a cart older than a day; stats with phone numbers partly hidden.",
  expect: [
    "Bookings fit the outlet's capacity and hours; the team confirms, seats and completes them; guests see and cancel their own.",
    "Customers rate their own completed orders; the store sees the average, the stars and the comments; happy customers are offered Google.",
    "Order again rebuilds the cart from today's menu and says what couldn't come back.",
    "Suggestions are one-tap dishes the owner picked or that people order together.",
    "A forgotten cart gets exactly one reminder, at a sensible hour, and a later order counts as won back.",
  ],
  expectNot: [
    "A booking must NOT overfill the outlet unless the team chooses to; a guest must NOT see or cancel someone else's booking.",
    "A rating must NOT be possible for an order that isn't completed, isn't yours, or is too old; it must NOT be changed after a week.",
    "Order again must NOT add dishes that are sold out or gone.",
    "A cart reminder must NOT be sent twice, too soon after another, outside sending hours, for an old cart, or by a store that has them off.",
    "A store whose plan lacks a feature must NOT be able to use it.",
  ],
};

export const run = (d) => runSuite(d, "engagement-api.mjs");
