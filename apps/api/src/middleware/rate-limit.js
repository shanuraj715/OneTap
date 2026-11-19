import { createHash } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { env } from "../env.js";
import { HttpError } from "./error.js";
import { addressOf, callerIp, humanSeconds, isInternal } from "../modules/security/login-guard.js";

/**
 * Request limits for the whole API — ONE table (POLICIES) of what is limited, how hard, and why.
 * docs/api-rate-limiting.md is written from it, and tests/e2e/suites/rate-limits.mjs fails if a route that changes
 * data is left without a limit (see WRITE_EXEMPT for the few that are deliberately not).
 *
 * How it works
 *  - A limit counts requests per KEY inside a time window and answers 429 (with a Retry-After header and
 *    { code: "rate_limited", retryAfterSec, policy } in the body) once the key goes over.
 *  - The key is who is asking: the signed-in team member ("user"), the customer's sign-in cookie or else the
 *    address ("identity"), the address alone ("ip"), or the store being asked about ("store").
 *  - Addresses are the visitor's real one (login-guard.callerIp: the first address outside our own network,
 *    read from the right of X-Forwarded-For — so nothing a visitor writes in that header can hide them).
 *  - Requests that come from our own network (the storefront's and website's servers, health checks, a laptop) are
 *    never limited BY ADDRESS — they would all look like one visitor. Limits keyed on a person (a user, a store, a
 *    phone number) still apply to them.
 *  - Counters live in this process's memory. That is right for one API process (what runs today); with several
 *    processes each would count on its own, and the store would need to move to the database or Redis.
 *  - RATE_LIMITS=off switches everything off; RATE_LIMIT_SCALE multiplies every limit (0.5 = twice as strict).
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;

/** limit: a number, or a function of the request (e.g. staff and customers placing orders get different budgets) */
export const POLICIES = {
  /* ------------------------------------------------------------------ every request */
  api: {
    windowMs: MINUTE,
    limit: (req) => (req.user ? 1500 : 600),
    allows: "600 per min for a visitor's address · 1,500 per min for a signed-in user",
    key: "user",
    why: "The floor under everything: no one — a script, a stuck app, a stolen session — can hammer any endpoint without limit. Signed-in team members get 1,500 a minute, visitors 600 a minute per address (a restaurant's whole Wi-Fi shares one).",
    message: "You're sending requests too fast. Please wait {wait} and try again.",
  },

  /* --------------------------------------------------------- signing in and getting codes */
  "login-flood": {
    windowMs: MINUTE,
    limit: env.LOGIN_FLOOD_PER_MINUTE,
    allows: "30 requests per min per address; then 5 wrong passwords block the address for 5 min, 15 min, 1 h, 6 h, 24 h (each block longer)",
    key: "ip",
    managedBy: "login-guard",
    why: "A script can't hammer the dashboard sign-in before it even starts guessing. (Wrong guesses are separately counted per address and per account, and block for longer each time.)",
    message: "Too many sign-in requests. Try again in {wait}.",
  },
  "login-account": {
    windowMs: 0,
    limit: 0,
    allows: "10 wrong passwords in 15 min pause the account for 1 min, then 5 min, 15 min, 1 h",
    key: "account",
    managedBy: "login-guard",
    why: "Guessing one account's password from many addresses (a botnet) gets past the per-address block. After 10 wrong passwords for the same email — from anywhere — that account's sign-in pauses for 1 minute, then 5, 15 and 60 minutes. Counts submitted emails whether or not they exist, so it reveals nothing.",
    message: "Too many failed attempts for this account. Try again in {wait}.",
  },
  "otp-flood": {
    windowMs: MINUTE,
    limit: env.LOGIN_FLOOD_PER_MINUTE,
    allows: "30 requests per min per address; 5 wrong codes block the address, longer each time",
    key: "ip",
    managedBy: "login-guard",
    why: "Any burst of sign-in-code requests or code guesses from one address.",
    message: "Too many sign-in requests. Try again in {wait}.",
  },
  "otp-send-ip": {
    windowMs: 10 * MINUTE,
    limit: 15,
    key: "ip",
    why: "Each code costs the store an SMS or a WhatsApp message. One address can't make the store text hundreds of different phone numbers (SMS bombing). 15 per 10 minutes leaves room for a restaurant's shared Wi-Fi.",
    message: "Too many code requests from this network. Please try again in {wait}.",
  },
  "otp-send-store": {
    windowMs: 60 * MINUTE,
    limit: 300,
    key: "store",
    why: "A ceiling on what any attack — however many addresses it uses — can make ONE store spend on codes in an hour.",
    message: "Too many codes have been requested for this store. Please try again in {wait}.",
  },
  "otp-resend-number": {
    windowMs: 0,
    limit: 0,
    allows: "the same number waits 30 s, 1 min, 2 min, 5 min, 15 min, 1 h, then 6 h between codes",
    key: "number",
    managedBy: "otp-throttle",
    why: "The same phone number gets its next code only after 30 s, then 1 min, 2 min, 5 min, 15 min, 1 h, then 6 h — enforced by the server, however the number is written. Stops a victim's phone being flooded.",
    message: "Please wait {wait} before asking for another code.",
  },
  "coins-code": {
    windowMs: 10 * MINUTE,
    limit: 40,
    key: "user",
    why: "Staff asking a customer for a coin-spending code, and typing it in: stops a signed-in account (or a stolen one) trying numbers and codes at speed.",
    message: "Too many coin-code attempts. Please wait {wait}.",
  },

  /* -------------------------------------------------------------- public, no sign-in */
  "site-challenge": {
    windowMs: 10 * MINUTE,
    limit: 40,
    key: "ip",
    why: "The enquiry form's spam-guard puzzle is cheap to hand out but not free; this stops it being farmed.",
    message: "Too many requests — please wait a moment.",
  },
  "site-lead": {
    windowMs: 10 * MINUTE,
    limit: 8,
    key: "ip",
    why: "The enquiry form writes to the database and notifies the team. A cheap per-address cap in front of the spam guard's other checks (puzzle, hidden field, per-phone and site-wide caps).",
    message: "You've sent a few enquiries just now. Please wait {wait} before sending another.",
  },
  "public-compute": {
    windowMs: MINUTE,
    limit: 90,
    key: "ip",
    why: "Price quotes, delivery checks and capacity lookups are open to visitors and each runs several database reads — they must stay fast for real customers, not be a way to load the database.",
    message: "Too many requests. Please wait {wait} and try again.",
  },
  "coupon-guess": {
    windowMs: 5 * MINUTE,
    limit: 20,
    key: "ip",
    why: "Coupon codes are short; without a limit a script can try thousands to find a valid one.",
    message: "Too many coupon attempts. Please try again in {wait}.",
  },
  "table-scan": {
    windowMs: MINUTE,
    limit: 60,
    key: "ip",
    why: "QR scans and table lookups are open to anyone with a link; this stops table ids or tokens being guessed at speed. A dining room's Wi-Fi scanning at once still fits.",
    message: "Too many requests. Please wait {wait} and try again.",
  },
  "customer-account": {
    windowMs: 10 * MINUTE,
    limit: 30,
    key: "identity",
    why: "A customer saving their profile or signing out: a few a day is normal, so a high rate means a script.",
    message: "Too many requests. Please wait {wait}.",
  },
  "order-place": {
    windowMs: 10 * MINUTE,
    limit: (req) => (req.header("x-onetap-outlet") ? 150 : 12),
    allows: "12 per 10 min for a customer · 150 per 10 min for staff at the till",
    key: "identity",
    why: "A customer placing orders: a dozen in ten minutes is generous, more is a script flooding the kitchen. Staff at the till (who send the outlet header) get a much bigger budget.",
    message: "You're placing orders too quickly. Please wait {wait}.",
  },
  payment: {
    windowMs: 10 * MINUTE,
    limit: 40,
    key: "identity",
    why: "Starting and confirming a payment calls the payment gateway; this stops a script burning the store's gateway quota.",
    message: "Too many payment requests. Please wait {wait}.",
  },
  webhook: {
    windowMs: MINUTE,
    limit: 240,
    key: "ip",
    why: "Payment gateways call this with a signature we check — but a flood of forged calls would still cost a signature check and a database read each. A gateway's servers speak for every merchant it has, so the ceiling is generous (4 a second per address) — raise RATE_LIMIT_SCALE if the platform grows to many busy stores.",
    message: "Too many requests.",
  },
  "print-agent": {
    windowMs: MINUTE,
    limit: 300,
    key: "ip",
    why: "The little program at a restaurant's printer asks for jobs every second or two with its own token. 300 a minute leaves room for several printers; it stops a leaked token being used to hammer the queue.",
    message: "Too many requests from this printer agent. Please wait {wait}.",
  },

  /* ----------------------------------------------- signed in: heavy or sensitive actions */
  "team-write": {
    windowMs: MINUTE,
    limit: 240,
    key: "user",
    why: "Every change a team member makes to the dashboard (menu, outlets, orders, tables, pages, settings…). 240 a minute is four a second — more than any person — so a stolen session can't mass-delete or mass-edit in a blink.",
    message: "You're making changes too fast. Please wait {wait}.",
  },
  "account-write": {
    windowMs: 10 * MINUTE,
    limit: 30,
    key: "user",
    why: "Creating team members, changing roles and resetting passwords. Takeover of accounts is the worst thing that can happen to a store, so it is slow on purpose.",
    message: "Too many account changes. Please wait {wait}.",
  },
  "secrets": {
    windowMs: 10 * MINUTE,
    limit: 30,
    key: "user",
    why: "Saving or revealing payment-gateway keys, SMS / WhatsApp connections, storage credentials and printer-agent tokens. They are rarely touched; a flood means something is wrong.",
    message: "Too many settings changes. Please wait {wait}.",
  },
  "pii-read": {
    windowMs: MINUTE,
    limit: 120,
    key: "user",
    why: "Looking up customers and their wallets by phone number. A person looks one up at a time; a loop is someone (or a stolen session) copying the customer list or trying phone numbers to see who has coins.",
    message: "Too many customer lookups. Please wait {wait}.",
  },
  upload: {
    windowMs: 10 * MINUTE,
    limit: 60,
    key: "user",
    why: "Uploads write files to storage and cost bandwidth (images, menu imports, contact files). Stops a session filling the store's disk or bill.",
    message: "Too many uploads. Please wait {wait}.",
  },
  report: {
    windowMs: MINUTE,
    limit: 120,
    key: "user",
    why: "Analytics screens run aggregations over a store's whole order history. A person opening screens and changing filters stays well under two a second; a loop does not.",
    message: "Too many report requests. Please wait {wait}.",
  },
  preview: {
    windowMs: 10 * MINUTE,
    limit: 30,
    key: "user",
    why: "Each live-preview session is kept in the server's memory for three hours; this stops a session being opened thousands of times to fill it.",
    message: "Too many previews opened. Please wait {wait}.",
  },
  export: {
    windowMs: MINUTE,
    limit: 10,
    key: "user",
    why: "Spreadsheet / PDF exports build a whole file in memory from many database rows — the most expensive requests the API serves.",
    message: "Too many exports. Please wait {wait}.",
  },
  "outbound-fetch": {
    windowMs: 10 * MINUTE,
    limit: 30,
    key: "user",
    why: "Resolving a Google Maps short link makes the SERVER call out to the internet. Limited so it can't be used to probe or hammer other sites.",
    message: "Too many lookups. Please wait {wait}.",
  },
  "bulk-send": {
    windowMs: 10 * MINUTE,
    limit: 20,
    key: "user",
    why: "Broadcasts, marketing campaigns and clean-ups message many customers at once. Sending to a customer list is also what gets a WhatsApp number banned, so it is deliberately slow.",
    message: "Too many bulk messages started. Please wait {wait}.",
  },
  "chat-send": {
    windowMs: MINUTE,
    limit: 120,
    key: "user",
    why: "Sending and retrying chat messages from the store's own WhatsApp number. (The WhatsApp worker also paces what actually goes out.)",
    message: "You're sending messages too fast. Please wait {wait}.",
  },
  "wa-link": {
    windowMs: 10 * MINUTE,
    limit: 30,
    key: "user",
    why: "Linking, relinking and unlinking WhatsApp numbers. Repeated linking attempts are what get a number logged out or banned.",
    message: "Too many number changes. Please wait {wait}.",
  },
  hardware: {
    windowMs: MINUTE,
    limit: 60,
    key: "user",
    why: "Test prints, reprints and retries physically drive a printer in the restaurant.",
    message: "Too many print requests. Please wait {wait}.",
  },
  destructive: {
    windowMs: 10 * MINUTE,
    limit: 20,
    key: "user",
    why: "Deleting or switching off a store, an outlet or a chat; publishing a client onboarding as a live store; creating stores. A stolen super-admin session can't wipe the platform at machine speed.",
    message: "Too many of these actions. Please wait {wait}.",
  },

  /* -------------------------------------------------------------------- live connections */
  "ws-connect": {
    windowMs: MINUTE,
    limit: 30,
    key: "ip",
    appliesTo: "the live-order connection `/realtime` and the live-preview connection `/preview` (WebSocket upgrades — not routes, so not in the route list)",
    why: "Live-order and live-preview WebSocket connections: each one is a held-open socket. 30 new connections a minute per address (a few browser tabs reconnecting) is plenty.",
    message: "Too many connections.",
  },
};

/**
 * Routes that change data and are deliberately NOT given a limit of their own — they are still under the "api"
 * baseline. The coverage test fails for any other change-making route without a named limit, and for an entry here
 * that no longer matches a route.
 */
export const WRITE_EXEMPT = {
  "POST /api/auth/logout": "Ends the caller's own session: cheap, idempotent, nothing to protect.",
};

/* --------------------------------------------------------------------------- keys */

// read on every request (not once at start-up) so the multiplier can be changed while running — the tests rely on it
const scaled = (n) => Math.max(1, Math.round(n * env.RATE_LIMIT_SCALE));
const sha = (v) => createHash("sha256").update(String(v)).digest("hex").slice(0, 20);

/** who is asking, as a key — "user:…", "customer:…", "store:…" or "ip:…" */
const keyOf = {
  ip: (req) => `ip:${addressOf(req)}`,
  user: (req) => (req.user?._id ? `user:${req.user._id}` : `ip:${addressOf(req)}`),
  identity: (req) => {
    if (req.user?._id) return `user:${req.user._id}`;
    const cookie = req.cookies?.onetap_customer; // the customer's sign-in cookie (customer.routes.js CUSTOMER_COOKIE)
    return cookie ? `customer:${sha(cookie)}` : `ip:${addressOf(req)}`;
  },
  store: (req) => `store:${String(req.body?.outletId ?? req.query?.outletId ?? "unknown").slice(0, 40)}`,
};

/** A limit that is keyed on an address is skipped for our own servers; one keyed on a person is not. */
const skipFor = (req, key) => env.RATE_LIMITS === "off" || (key.startsWith("ip:") && isInternal(callerIp(req)));

/** The number of requests a policy allows a given request (scaled) — also used by the tests. */
export const limitFor = (name, req = {}) => {
  const p = POLICIES[name];
  return scaled(typeof p.limit === "function" ? p.limit(req) : p.limit);
};

/* ------------------------------------------------------------------------ limiters */

const made = new Map();

/**
 * The middleware for one policy. The same policy always returns the same limiter, so every route that names it
 * shares one counter per key.
 */
export function limiter(name) {
  const policy = POLICIES[name];
  if (!policy || !policy.windowMs) throw new Error(`No request limit called "${name}" (see POLICIES in middleware/rate-limit.js)`);
  if (made.has(name)) return made.get(name);

  const pick = keyOf[policy.key];
  const mw = rateLimit({
    windowMs: policy.windowMs,
    limit: (req) => limitFor(name, req),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => pick(req),
    skip: (req) => skipFor(req, pick(req)),
    validate: { keyGeneratorIpFallback: false },
    handler: (req, res, next, options) => {
      const retry = Number(res.getHeader("Retry-After")) || Math.ceil(options.windowMs / 1000);
      next(new HttpError(429, policy.message.replace("{wait}", humanSeconds(retry)), { code: "rate_limited", retryAfterSec: retry, policy: name }));
    },
  });
  mw.policy = name;
  made.set(name, mw);
  return mw;
}

/** Apply a limit to changes only (POST / PUT / PATCH / DELETE) — reads pass straight through. */
export function onlyWrites(mw) {
  const wrapped = (req, res, next) => (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS" ? next() : mw(req, res, next));
  wrapped.policy = mw.policy;
  wrapped.writesOnly = true;
  return wrapped;
}

/**
 * Says "this route is protected by <policy>" for limits that are applied INSIDE the route handler (the sign-in guard,
 * the per-number code wait). Changes nothing at run time; it keeps the route inventory and the docs honest.
 */
export function usesPolicy(name) {
  if (!POLICIES[name]) throw new Error(`No request limit called "${name}"`);
  const mw = (_req, _res, next) => next();
  mw.policy = name;
  return mw;
}

/* ------------------------------------------------------------- WebSocket connections */

const attempts = new Map();

/**
 * For the `upgrade` event, where Express middleware never runs: may this address open another live connection?
 * → { ok, retryAfterSec }. Our own network is never limited by address.
 */
export function allowUpgrade(req, name = "ws-connect") {
  if (env.RATE_LIMITS === "off" || isInternal(callerIp(req))) return { ok: true };
  const p = POLICIES[name];
  const key = `${name}|${addressOf(req)}`;
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < p.windowMs);
  recent.push(now);
  attempts.set(key, recent);
  if (attempts.size > 5000) for (const [k, v] of attempts) if (!v.some((t) => now - t < p.windowMs)) attempts.delete(k);
  return recent.length > scaled(p.limit) ? { ok: false, retryAfterSec: Math.ceil((p.windowMs - (now - recent[0])) / 1000) } : { ok: true };
}

/** Refuse a WebSocket upgrade with a plain 429. */
export function refuseUpgrade(socket, retryAfterSec) {
  socket.write(`HTTP/1.1 429 Too Many Requests\r\nRetry-After: ${retryAfterSec}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}
