// T139 — Ratings in the browser: stars in the store's colour, rating the order and each dish (Account page and order page), and the store's four views
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t139-ratings-ui",
  title: "Ratings: the customer rates the order and each dish (Account page and order page) with modern stars in the STORE's colour; the store reads them as reviews, by customer, by outlet and by dish",
  area: "feedback",
  browser: true,
  fresh: false,
  summary: "Chrome against the bench (Acme Momos; its colour is changed to teal for the run and put back). A customer signed in through the API has three completed orders. Account page: 'Rate this order' with a non-yellow star, the box with five stars (teal, read as the browser painted them), the word 'Excellent', 'Rate each dish' listing both dishes with quantities (only once the order has stars), a note for a dish, taking a dish rating back by touching its star again, Send, the store receiving the order's 5★ and review and the dish ratings, the order then showing its stars and a chip per dish. Order page: rate with no dish ratings, then 'Change' (earlier rating filled in, a dish rating added), earlier dish notes coming back, arrow keys and plain star labels. Admin panel Ratings: four tabs; reviews list the dishes rated; By customer (count, average, search by name and phone); By outlet (a card per outlet); By dish (averages, counts, 'Read reviews', sort worst first, search). Stars in the admin panel use the store's teal too. A phone-width screen does not scroll sideways.",
  expect: [
    "A customer can rate the order 1–5 with a review and rate each dish on its own, from the Account page and from the order page.",
    "The stars are the store's colour (teal in this run), never the stock yellow, on the storefront and in the admin panel.",
    "The store sees the ratings by review, by customer, by outlet and by dish, with the right averages and counts.",
  ],
  expectNot: [
    "The dish section must NOT appear before the order has stars; nothing about a dish is forced.",
    "A star must NOT be yellow.",
    "A phone-width page must NOT scroll sideways.",
  ],
};

export const run = (d) => runSuite(d, "ratings-ui.mjs", { timeoutMs: 8 * 60_000 });
