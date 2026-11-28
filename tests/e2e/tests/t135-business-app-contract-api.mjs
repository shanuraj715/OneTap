// T135 — The Business app's contract with the real server: every address it calls answers with the fields the app reads, in the types it reads them
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t135-business-app-contract-api",
  title: "Business app contract: every address the app calls (outlets, options, 15 reports, people, bookings, ratings, coupons, stock, expenses, report files) answers with the fields and types the app reads",
  area: "platform",
  browser: false,
  fresh: false,
  summary: "A private API on an in-memory database with orders in two outlets, a coupon, a booking, dishes with counted stock, a rating, a bill and a target. The app signs in the way it does on the phone and calls each address with the request it really sends; each answer is checked against the field list written from the app's own types (names, types, nullable fields). Includes the case a phone run found: /api/outlets answers `_id`, not `id`. Writes are checked too (a bill, a person, a coupon switch, counted stock) and the four report file kinds (Excel, PDF, CSV, JSON) come back with the right content type and a .ext name.",
  expect: [
    "Every report the app asks for has the fields the app reads, with the right types.",
    "/api/outlets answers `_id` for each outlet.",
    "Adding / changing / removing a person, a bill, a coupon switch and a stock count all work and answer what the app expects.",
    "Excel, PDF, CSV and JSON reports come back as files with the right type and name.",
  ],
  expectNot: [
    "The app must NOT be reading a field the server does not send (a wrong name or type).",
  ],
};

export const run = (d) => runSuite(d, "business-app-contract-api.mjs", { timeoutMs: 5 * 60_000 });
