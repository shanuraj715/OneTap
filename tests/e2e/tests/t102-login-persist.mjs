// T102 — A signed-in customer stays signed in, even when the server can't answer "who am I?" for a moment.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t102-login-persist",
  title: "Storefront: a customer who signed in stays signed in for 180 days, through reloads, new tabs and a server that can't answer for a moment (restart, deploy, rate limit, dropped connection) — without being sent back to the login form",
  area: "storefront",
  browser: true,
  fresh: false,
  summary: "Chrome against the bench's Acme store. The customer signs in once with a code; the cookie is HttpOnly and lasts 180 days. After a reload and in a new tab the checkout opens signed in. Then the 'who am I?' call is made to fail twice — with a 502, with a 429 and with a dropped connection, one after the other — and each time the login form never appears (the page waits and retries, a little longer each time) and the checkout comes up signed in as soon as the server answers. A clear answer of 'nobody is signed in' still shows the login form.",
  expect: [
    "A customer signed in once is still signed in after a reload and in a new tab; the sign-in cookie lasts 180 days.",
    "A failed check of the sign-in (502, 429, no connection) is retried and never shows the login form.",
  ],
  expectNot: [
    "A hiccup of the server must NOT send a signed-in customer back to the login form (and cost another code).",
    "A real 'nobody is signed in' answer must NOT be hidden: the login form still shows.",
  ],
};

export const run = (d) => runSuite(d, "storefront-login-persist.mjs", { timeoutMs: 5 * 60_000 });
