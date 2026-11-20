// T56 — The customer's side of the growth features, in Chrome on the bench storefront.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t56-growth-storefront",
  title: "Storefront: only N left, combos and dish hours on the menu, suggestions, a pre-order for later, rating an order, order again and booking a table",
  area: "storefront",
  browser: true,
  fresh: false,
  summary: "Runs suites/growth-storefront-ui.mjs in Chrome as a customer of the bench store (Acme Momos, /main), after setting up a counted dish (3 left), a combo, a breakfast dish whose hours start later, a 'goes well with' pick and the outlet's pre-order / booking / rating settings through the API: the cards say 'Only 3 left', 'Combo · save ₹20' and 'Available …' (the breakfast dish can't be opened); the pop-up warns about the stock and its + stops at 3; the combo's pop-up lists its dishes and the saving; on the order page the customer signs in, adds the suggested Masala Coke in one tap, picks 'Later' and a pickup time (the button asks for a time until one is picked, then says 'Place pre-order') and places it — the confirmation says pre-order and when; stock went down by what was ordered; once completed, the Account page lets them rate it (5 stars, a tag, a comment → thanks and the Google review link; the store sees it) and 'Order again' refills the cart; 'Book a table' books tomorrow for 2 with a note → 'Booking request sent' and the Account page lists it waiting to be confirmed; the restaurant sees the note. Everything it changes on the bench is put back.",
  expect: [
    "The menu shows stock, combos and dish hours.",
    "The quantity can't go past what's left.",
    "Suggestions add in one tap; a pre-order is placed for a chosen pickup time.",
    "A completed order can be rated and ordered again from the Account page.",
    "A table can be booked and shows on the Account page.",
  ],
  expectNot: [
    "A dish outside its hours must NOT be orderable from the menu.",
    "'Place pre-order' must NOT be possible without a pickup time.",
    "No errors in the browser console.",
  ],
};

export const run = (d) => runSuite(d, "growth-storefront-ui.mjs");
