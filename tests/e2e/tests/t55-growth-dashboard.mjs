// T55 — The dashboard screens of the growth features, in Chrome on the bench store.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t55-growth-dashboard",
  title: "Dashboard: pre-orders & bookings settings, riders, out for delivery, stock / combo / hours in the menu, buy-X-get-Y coupons, bookings, ratings and cart reminders",
  area: "dashboard",
  browser: true,
  fresh: false,
  summary: "Runs suites/growth-dashboard-ui.mjs in Chrome as the owner of the bench store (Acme Momos, Main): the sidebar shows Bookings and Ratings; Settings → Pre-orders & bookings switches pre-orders and table bookings on and saves their numbers; Settings → Ratings & suggestions saves the Google review link and the suggestions heading; Settings → Delivery riders adds a rider; on Orders a Ready delivery order's next step is 'Out for delivery', which asks who is taking it and then shows 'with Ramesh' and 'Delivered'; a pre-order is tagged with its pickup time; the dish form has Stock, Hours, Combo and Goes well with — stock saved shows '3 left' on the dish row, a combo is created from the form; a category's Edit window has Hours; a 'Buy X, get Y free' coupon is created and listed as 'Buy 1 get 1 free'; a phone booking is added on Bookings and shows confirmed; the Ratings page shows its summary and Cart reminders shows a message preview and its numbers. Everything it changes on the bench is put back.",
  expect: [
    "Settings tabs save pre-orders, table bookings, the Google link and the suggestions heading.",
    "A rider can be added and an order sent out with them; the row then says who has it and offers 'Delivered'.",
    "A pre-order shows its pickup time on the Orders list.",
    "Stock, combos and hours can be set from the menu editor.",
    "A buy-X-get-Y coupon can be created from the Coupons page.",
    "Bookings, Ratings and Cart reminders pages work.",
  ],
  expectNot: [
    "No errors in the browser console.",
    "The bench must NOT be left changed (riders, coupons, dishes, settings are put back).",
  ],
};

export const run = (d) => runSuite(d, "growth-dashboard-ui.mjs");
