// T114 — Book a table page: open to everyone, a date picker, from/to time pickers, a searchable event list with Other, the WhatsApp number, the price — and sign-in only AFTER the form is filled
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t114-booking-form-ui",
  title: 'Book a table page: open to everyone, a date picker, from/to time pickers, a searchable event list with Other, the WhatsApp number, the price — and sign-in only AFTER the form is filled',
  area: "bookings",
  browser: true,
  fresh: false,
  summary: "Chrome against the bench storefront (Acme Momos, /main) with bookings at ₹400 per person per hour, 19 of 20 seats taken tomorrow 8 PM–9:30 PM. Signed out: a notice says every request is approved by hand and the update comes on WhatsApp; there is NO sign-in card or prompt up front (a quiet line says it comes as the last step and nothing typed is lost); day, time pickers, event and WhatsApp are all there; 'To' waits for a start; the box says what it waits for; the button reads 'Continue' and, pressed on an empty form, lists what is missing without asking for a sign-in. The day is a date picker (the popover input; the calendar is the filled one): days before today and beyond the 7 days ahead can't be chosen, choosing tomorrow and OK sets it. The time: start times run 11:00 AM to 10:00 PM every 30 minutes with the full ones greyed out and not choosable; choosing 6 PM opens 'To' at the usual stay (7:30 PM · 1 hr 30 min); finish times run 1 to 4 hours later, the one that would run into the 8 PM booking is greyed out; the box shows total time and the price worked out (2 × ₹400 × 1½ h = ₹1,200: ₹600 now, ₹600 there), later finish → ₹1,600, 3 guests → ₹2,400, back to 2 keeps the times. The occasion: a searchable list (cursor in the search box, 'birth' → Birthday, no match says so, 'anni' + Enter chooses Anniversary), 'Other' last: a box for the event's name, empty is refused. WhatsApp: a short number is refused, dashes accepted. Then, with the form complete, pressing Continue shows the sign-in card ('One last step — sign in') with every answer still in place; signing in leaves the WhatsApp number typed earlier. A notice says 50% of the booking amount is paid online and the food and drinks are extra (booking amount plus what you eat and drink). A 'Have a coupon?' box lists the restaurant's table-booking offer as a chip (a food-only coupon is not listed); a food-only coupon and an unknown code are refused with a clear message and the price stays; the offer applies (−₹200: ₹1,400, ₹700 now, ₹700 + food and drinks there), is worked out again for 3 guests, and can be removed (full price back) and applied again. The button becomes 'Pay ₹700 & request booking'; paying (test gateway) shows 'Booking request received' with the range, 'Coupon … saved you ₹200', ₹700 paid, ₹700 at the restaurant, the event and the WhatsApp number; the restaurant sees it paid and waiting with the coupon; the account page lists it with its range, length, event and money. On a phone nothing scrolls sideways and the time list, calendar and event list fit the screen.",
  expect: [
    "The whole form can be filled in without signing in; the sign-in step appears only when the form is complete, with every answer kept.",
    "The date, the from/to times, the total time and the estimated price are worked out as the guest chooses.",
    "The event is chosen from a searchable list, with 'Other' opening a box for the name.",
    "A booking coupon takes money off and the 50% advance follows the lower amount; the notice says food and drinks are extra.",
    "The 50% advance is paid and the restaurant sees the booking paid and waiting for approval.",
  ],
  expectNot: [
    "No sign-in prompt before the form is filled in.",
    "A time the table can't take must NOT be choosable.",
    "A food-only coupon must NOT work on a booking.",
    "No sideways scrolling on a phone.",
    "No errors in the browser.",
  ],
};

export const run = (d) => runSuite(d, "booking-form-ui.mjs", { timeoutMs: 8 * 60_000 });
