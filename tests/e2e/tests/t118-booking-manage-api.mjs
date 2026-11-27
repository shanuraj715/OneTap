// T118 — Table bookings (the team's side): every upcoming booking in one list, a status changed by hand, an approve/decline/cancel message sent automatically, and coupons for bookings — the API
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t118-booking-manage-api",
  title: "Table bookings (the team's side): every upcoming booking in one list, a status changed by hand, an approve/decline/cancel message sent automatically, and coupons for bookings — the API",
  area: "bookings",
  browser: false,
  fresh: false,
  summary: "Runs suites/booking-manage-api.mjs against a private API on an in-memory database with a fake SMS gateway, a fake WhatsApp Business (Graph) server and a linked WhatsApp account (nothing real is messaged). The list: with no date asked for, GET /api/reservations is every upcoming booking (today onwards, across days), soonest first, with its counts — it used to be 'today only'; 'earlier' is the past, 'all' both in date order, a date filters to that day alone, an empty day is empty, an unknown scope falls back to upcoming; the kitchen still can't see bookings; a booking waiting for its advance isn't listed until paid. Changing a status by hand: a no-show can NOT go back by the usual steps (409), but by hand it can (back to confirmed), the history says it was changed by hand and from what, any status can be moved to every other in turn, the kitchen can't (403), a status that doesn't exist is refused (400); cancelling a paid booking by hand puts its advance on the refund list, bringing it back takes it off, and an advance already sent back stays 'refunded'. The message: a ready-written one for approve / decline / cancel (confirmed + what was paid + 'food and drinks are paid for separately', to the WhatsApp number given; the decline carries the reason and says the advance will be refunded), a route preview (none, SMS, WhatsApp Business, linked WhatsApp); with no way to send the booking is still answered and nothing goes out; SMS gateway → SMS; Business credentials alone aren't enough (an approved template is needed), with a template named it goes through WhatsApp Business (preferred over SMS) as that template with the team's words in its one placeholder, line breaks turned into spaces; a linked WhatsApp number is used first and queues exactly the words the team wrote to the number the guest gave; 'don't send' sends nothing; an older client with no choice still sends the usual message. Coupons: made for table bookings only when 'Table booking' is ticked (none ticked = food orders only), listed in the public offers; a food-only coupon, an unknown code and a buy-one-get-one are refused on a booking with clear words, a minimum amount is respected; the price is worked out with the coupon and the 50% advance is half of what is LEFT (₹2,000 − ₹400 → ₹800 now; the gateway is asked for ₹800); the use is counted when the booking is made, a one-use coupon can't be used twice (refused in words, never quietly booked at full price), and is given back when the advance is never paid or the guest gives up; a 100% coupon leaves nothing to pay and the booking goes straight to the team; the team and the guest see the coupon and what it took off; with no booking charge there is nothing to take off; coupons need the plan feature.",
  expect: [
    "The default list shows every upcoming booking, soonest first, with no date chosen.",
    "A booking's status can be changed by hand from any status to any other, and what was paid in advance follows.",
    "Approving, declining and cancelling can tell the guest automatically: linked WhatsApp, else WhatsApp Business, else SMS.",
    "A booking coupon takes money off the booking amount and the advance is half of what is left.",
  ],
  expectNot: [
    "A coupon not ticked for table bookings must NOT work on one.",
    "A buy-X-get-Y coupon must NOT work on a booking.",
    "A message must NOT be sent when the team switched it off.",
  ],
};

export const run = (d) => runSuite(d, "booking-manage-api.mjs", { timeoutMs: 6 * 60_000 });
