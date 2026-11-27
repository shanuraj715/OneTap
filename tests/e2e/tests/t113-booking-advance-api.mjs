// T113 — Table bookings: a start and an end time, a price, a 50% advance paid online, refunds and the WhatsApp number — the rules and the API
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t113-booking-advance-api",
  title: 'Table bookings: a start and an end time, a price, a 50% advance paid online, refunds and the WhatsApp number — the rules and the API',
  area: "bookings",
  browser: false,
  fresh: false,
  summary: "Runs suites/booking-advance-api.mjs against a private API on an in-memory database with a fake SMS gateway (the guest's updates go to the WhatsApp number — here the SMS fallback, so they can be read). The rules: a booking has a start and a finish chosen by the guest (1 hour to 4 hours by default, in 30-minute steps); the price is the outlet's rate per person per hour × guests × hours, to the whole rupee, and the guest pays HALF online and half at the restaurant (the halves always add up; an outlet with no price charges nothing); a WhatsApp number is understood however it is typed; two bookings that follow each other never count as double (peak guests at one moment). What the booking page is told: the price, the 50%, whether an advance can be taken online, the finish times for a chosen start with each one's price and whether the table is free that long. Booking rules in words: signed in only; a finish before the start, a stay shorter than the shortest or longer than the longest, a finish off the step, a finish after closing, a bad WhatsApp number and a too-long event name are all refused and leave nothing behind. A booking that costs money is created waiting for its advance: the team does not see it, the 'to confirm' badge doesn't count it, nobody is messaged — but its seats are held for 15 minutes, after which they are free again, it disappears from the guest's account, paying says it has expired and the sweep cancels it (and never shows it to the team as a cancelled booking). Paying through the test gateway: only the guest's own booking, the gateway is asked for the advance (not the whole amount), another guest can't pay or confirm it and is checked BEFORE anything is settled, a wrong signature is refused; once paid it goes to the team (still 'requested': a person approves it), the guest is told on the WhatsApp number they gave (not the sign-in number) that it was received, what for and that the advance is paid; confirming twice changes nothing. The team's decision: declining or cancelling a paid booking marks the advance as due for a refund and tells the guest; 'mark refunded' closes it (not twice, not when none is due); a no-show keeps the advance; confirming says what was paid and what is left. A guest cancelling a paid booking puts the advance on the refund list; an unpaid one is just dropped. No WhatsApp number given → the update goes to the sign-in number. No price → no payment, the usual 90 minutes. A price but only cash on → no advance, the whole amount at the restaurant. An outlet that confirms by itself confirms only after payment. An advance that arrives after the hold ran out is not lost: the booking stays cancelled and the money is marked for a refund. Orders' payment rules are untouched.",
  expect: [
    "A booking has a start and an end; its price and the 50% advance follow from the stay and the party.",
    "An unpaid booking is invisible to the team, holds its seats for 15 minutes, then is let go.",
    "The advance goes through the payment gateway, only for the guest's own booking, and the guest is updated on the WhatsApp number they gave.",
    "A declined or cancelled paid booking puts the advance on a refund list; a no-show keeps it.",
  ],
  expectNot: [
    "A refused request must NOT leave a booking behind.",
    "Another guest must NOT be able to pay or confirm someone else's booking.",
    "A booking that was never paid must NOT reach the team, even as 'cancelled'.",
    "Money that arrives late must NOT be lost.",
  ],
};

export const run = (d) => runSuite(d, "booking-advance-api.mjs", { timeoutMs: 6 * 60_000 });
