// T115 — Dashboard bookings: every upcoming booking in one list, a status changed by hand, the approve / decline / cancel message window, refunds, and a coupon type with our date and time pickers
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t115-booking-dashboard-ui",
  title: "Dashboard bookings: every upcoming booking in one list (the date is only a filter, chosen with our date picker), a status changed by hand, the approve / decline / cancel message window, refunds, and a coupon type with our date and time pickers",
  area: "bookings",
  browser: true,
  fresh: false,
  summary: "Chrome against the bench dashboard (Acme Momos, Main, as the owner). Settings → Pre-orders & bookings has Usual / Shortest / Longest stay, the booking price per person per hour (starts at 0) and the WhatsApp Business template for booking updates; saving stores ₹400 as 40000 paise. The Bookings page opens on 'Upcoming': five bookings made over the next 6 days are all listed, soonest first, under one heading per day ('Tomorrow · …' first), with the counts the server gives — nobody has to change the date. There is no browser date or time box anywhere on the page. The date is only a filter, chosen on our date picker: it shows that day alone with a note and a 'Show all upcoming' button, a day with nothing says so, 'Earlier' and 'All' have their own lists. 'New booking' picks its day on the date picker too, and the new booking appears in the list. A no-show marked by mistake isn't stuck: after No-show only a 'Status' button is left, its menu offers every other status, Confirmed opens the Approve window, the history says 'Changed by hand from no-show', and a jump that skips a step (Confirmed → Completed) says it is a manual change. Approving a paid booking opens a window: no reason needed, how it will be sent ('Sent automatically through your linked WhatsApp number to +91 …' — the number the guest gave), the message already written (confirmed, ₹800 paid in advance, the remaining ₹800 at the restaurant, food and drinks paid for separately), editable; the guest's WhatsApp message goes out exactly as the team wrote it. Declining asks for a reason, says the ₹800 advance will be marked refund due, the message follows the reason and mentions the refund; un-ticking 'Tell … on WhatsApp' disables the message, changes the button to 'Decline without a message' and sends nothing; the row shows 'Refund ₹800 due' and 'Mark refunded' closes it ('Advance refunded'). Cancelling opens its own window and 'Back' changes nothing. Each booking shows its start, end and length, the occasion, the WhatsApp number and the money (₹1,600, ₹800 paid in advance, ₹800 at the restaurant); a booking made with a coupon shows '₹1,500 after the code (−₹100)'. Coupons: the form has no browser date box; 'Order types' has a 'Table booking' tick; 'From' and 'Until' are our date picker plus our time picker (Until starts at 11:59 PM, each side has Clear); the saved coupon is for table bookings with the chosen days. The component catalogue lists the Time Pickers (TP01, TP02), the searchable dropdown (DRP08) and the date pickers (DP02, DP03). Bookings left in the bench by other tests are ignored; what it changes is put back.",
  expect: [
    "The Bookings page opens on every upcoming booking, soonest first, grouped by day — no date has to be chosen.",
    "The date is only a filter, chosen on our date picker (never a browser date box); 'Show all upcoming' undoes it.",
    "A booking marked No-show can be changed to any other status with the 'Status' button.",
    "Approving, declining and cancelling open a window with a reason (decline / cancel), the message already written and editable, and the automatic way it will be sent; 'Tell … on WhatsApp' can be switched off.",
    "A booking shows its end, length, event, WhatsApp number, coupon and what was paid; declining a paid booking shows a refund due and 'Mark refunded' closes it.",
    "A coupon can be made for table bookings, with its start and end chosen on our date and time pickers.",
  ],
  expectNot: [
    "No browser date, time or date-time box on the Bookings page, the New booking window or the coupon form.",
    "No message is sent when 'Tell … on WhatsApp' is un-ticked.",
    "A booking whose advance isn't due back must NOT get a refund button.",
    "No errors in the browser.",
  ],
};

export const run = (d) => runSuite(d, "booking-dashboard-ui.mjs", { timeoutMs: 6 * 60_000 });
