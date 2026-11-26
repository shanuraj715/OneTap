// T87 — Sign-in for the staff Android app: token in the answer, Bearer on every request, the same guards as the dashboard.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t87-staff-app-auth-api",
  title: "Staff app sign-in: a session token in the answer, used as a Bearer token, with the dashboard's brute-force guards (address block, account pause, flood limit)",
  area: "security",
  browser: false,
  fresh: false,
  summary: "Runs suites/staff-app-auth-api.mjs on a private API with an in-memory database (no browser). POST /api/auth/app-login gives the session token in the answer and sets no cookie; the token then works as 'Authorization: Bearer' for /api/auth/me and the staff endpoints (tables, tables in service, menu) while the outlet still has to be named; no token / a made-up token / an expired one are 401; signing out with the token ends that session only; the dashboard's own cookie sign-in is unchanged (no token in its answer); roles are still enforced (a kitchen account may sign in but is refused when it tries to place an order, 403). The guards: a wrong password and an unknown email get the identical message; 4 wrong passwords from one address block it (even the right password is then refused with a countdown, GET /api/auth/guard says so) and the block is shared with the dashboard sign-in; wrong passwords for one account from many addresses pause that account on both routes; a burst from one address hits the login-flood limit with a Retry-After.",
  expect: [
    "The app route gives a token, never a cookie; the token works as a Bearer token and is dropped by signing out or expiry.",
    "Wrong passwords block the address and pause the account across BOTH the app and dashboard sign-in routes.",
  ],
  expectNot: [
    "The app route must NOT be a way around the dashboard's brute-force guards.",
    "The dashboard's sign-in must NOT start returning the token in its answer.",
    "A wrong password and an unknown email must NOT be told apart.",
  ],
};

export const run = (d) => runSuite(d, "staff-app-auth-api.mjs", { timeoutMs: 5 * 60_000 });
