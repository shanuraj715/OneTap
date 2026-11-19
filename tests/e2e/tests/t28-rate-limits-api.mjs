// T28 — Request limits across the whole API, on its own throwaway database (no browser).
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t28-rate-limits-api",
  title: "Request limits — every protected API stops at its limit with a clear 429, per account sign-in guard, live connections, and nothing that changes data is left unprotected",
  area: "security",
  browser: false,
  fresh: false,
  summary: "Runs suites/rate-limits.mjs: its own in-memory API with every limit scaled to a tenth so 'one more than allowed' is a handful of requests. Pushes each of the 33 limits to its edge — visitors (quotes, coupons, table scans, the enquiry form, payments, webhooks, the print agent, placing orders, profile), sign-in codes (per address, per store), the dashboard and customer sign-in floods, signed-in team members (changes, reports, customer lookups, account changes, secrets, uploads, exports, bulk sends, chat, WhatsApp linking, printers, destructive actions, previews, coin codes), the platform console's outbound lookups, the general limit for visitors and for signed-in users — and checks the answer each time (429, the policy's name, Retry-After, a readable message). Then: one limited visitor doesn't affect another, a made-up address in X-Forwarded-For doesn't give a fresh budget, our own servers are never limited by address, RATE_LIMITS=off really is off; one account guessed from ten different addresses is paused (even for the right password), an email with no account behaves identically, the pause grows 1 → 5 minutes and signing in clears it; WebSocket connections are limited per address and an oversized message closes the connection; and the route inventory shows a named limit on every route that changes data, every limit is attached to something, and docs/api-rate-limiting.md names them all.",
  expect: [
    "Each limit lets exactly its allowance through and refuses the next request with 429, the policy's name, a Retry-After header and a readable message.",
    "A limited address does not limit another; a fake address written in front of the real one in X-Forwarded-For gives no fresh budget.",
    "Our own servers (no forwarded address) are never limited by address; RATE_LIMITS=off turns everything off.",
    "Ten wrong passwords for one account, from ten addresses, pause that account — even the right password is refused — while other accounts sign in; an unknown email behaves the same; the Security page shows only a masked email; the pause is 1 minute, then 5; the right password works when it ends and clears the count.",
    "The code-sending limits stack: per address, per store (from many addresses), and the sign-in floods.",
    "Live-order connections are limited per address (429 + Retry-After), our own network is not, and a preview message over 1 MB closes the connection.",
    "Every route that changes data is on the inventory with a limit of its own (except logout), every limit is used, and the doc names every limit and the exempt route.",
  ],
  expectNot: [
    "A limit must NOT refuse a request inside its allowance, or let the next one through.",
    "One visitor's limit must NOT affect another visitor.",
    "A request from our own servers must NOT be limited by address.",
    "A route that changes data must NOT be added without a limit (the coverage check fails).",
    "The account pause must NOT reveal whether an email has an account, or print the whole email.",
  ],
};

export const run = (d) => runSuite(d, "rate-limits.mjs");
