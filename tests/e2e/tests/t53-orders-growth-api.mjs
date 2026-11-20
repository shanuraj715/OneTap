// T53 — Out for delivery + riders, pre-orders, counted stock, dishes with hours, combos and "buy X get Y free": the API rules, on a throwaway database (no browser).
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t53-orders-growth-api",
  title: "Orders that grow the business — out for delivery with a rider, pre-orders for later, stock counts, menu hours, combos and buy-X-get-Y coupons (API rules)",
  area: "orders",
  browser: false,
  fresh: false,
  summary: "Runs suites/orders-growth-api.mjs: its own in-memory API with a store on a plan that has everything and one on a Basic plan (no Pre-orders, no Delivery). Stock: an order takes counted stock at once (two lines of the same dish add up, a combo takes its parts), a refused order takes nothing, cancelling or deleting an order that was never handed over gives it back exactly once, an edit takes or gives the difference, a daily-counted dish refills on the first menu read of a new India-time day (but never over a count the owner just typed), and an online order nobody pays for within 30 minutes gives its stock back. Menu hours: a category's hours reach its dishes, outside them the dish shows when it is served (or is hidden), customers can't order it but staff can, and a pre-order is checked against its pickup time. Pre-orders: off until switched on, pickup times every 15 min from 30 min ahead within opening hours, a full time is refused and shown full, only takeaway, the plan decides, the Account page and the dashboard carry the pickup time, and the missed-order alert waits until an hour before pickup. Riders: only a delivery order goes out, managers keep the rider list, cashiers can hand an order to a rider, the customer sees the rider's name and number only while it is on the way, a switched-off or unknown rider is refused, orders keep the rider they went out with. Combos: no combo inside a combo or inside itself, savings worked out, an ordered combo carries its parts, each part prints on its own station's kitchen ticket, and a pre-order's ticket starts with PRE-ORDER and the full pickup time. Buy X get Y: the cheapest covered dishes are free, chosen categories and dishes, a cap on free dishes, helpful messages when the cart doesn't qualify, and the order gets the same discount.",
  expect: [
    "Counted stock goes down with every order, can never go below zero, and comes back on cancel / delete / unpaid online orders — exactly once.",
    "A daily-counted dish refills itself on a new day; switching counting off works.",
    "A dish outside its hours shows 'Available …' and can't be ordered by customers (staff can); a pre-order for a time inside its hours can.",
    "Pre-orders: the right pickup times, full times refused, takeaway only, plan-gated, pickup time on the Account page and the dashboard, no early red alert.",
    "Only a Ready delivery order goes out for delivery, with a rider from the list or typed in; the customer sees the rider while it's on the way; completed delivery = Delivered.",
    "Combos price at their own price, show their savings, take their parts' stock and split onto the kitchen and bar tickets.",
    "Buy-1-get-1 / buy-2-get-1 give the cheapest covered dishes free, capped, with clear messages.",
  ],
  expectNot: [
    "Stock must NOT go below zero, be taken by a refused order, or be given back twice.",
    "A takeaway or dine-in order must NOT go out for delivery; a rider who is switched off or unknown must NOT be given an order.",
    "A pre-order must NOT be accepted for a time that isn't offered or is full, or on a plan without Pre-orders.",
    "A combo must NOT contain itself or another combo.",
    "A buy-X-get-Y coupon must NOT make anything but the cheapest covered dishes free.",
  ],
};

export const run = (d) => runSuite(d, "orders-growth-api.mjs");
