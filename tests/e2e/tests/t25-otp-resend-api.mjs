// T25 — Resend rule for verification codes, enforced by the API itself (no browser).
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t25-otp-resend-api",
  title: "Code resend rule — the API makes a number wait 30 s, 1 min, 2 min, 5 min, 15 min, 1 h, then 6 h between codes, however it is called",
  area: "security",
  browser: false,
  fresh: false,
  summary: "Runs suites/otp-resend.mjs: its own in-memory API with the per-address limiter switched off, so only the resend rule is tested. Walks one number through nine codes and checks the wait after each (30 s, 1 min, 2 min, 5 min, 15 min, 1 h, 6 h, 6 h, 6 h) by pretending time has passed; asks early (even 2 seconds early) and gets 429 with 'Please wait …', the seconds left and a Retry-After header; fires 15 requests at the same moment (twice) and 100 in a row and checks exactly one code goes out; writes the same phone number as +91…, 0091…, with spaces, dashes or a leading 0 and checks it is still one number; checks other numbers, email addresses and the staff coin-code flow each have their own clock; checks the sign-in screen is told whether the code already sent is still good; signing in wipes the waits; a day of silence wipes them too; and a code the gateway could not send is not counted, leaves no unsent code behind and never replaces the code the customer already has.",
  expect: [
    "Each code made the next wait longer: 30 s, 1 min, 2 min, 5 min, 15 min, 1 hour, then 6 hours for the 7th code and every one after.",
    "Asking too early gets 429 with 'Please wait N … before asking for another code.', the seconds left in the answer and in a Retry-After header — and no new code is created.",
    "Fifteen requests at the same instant (and a hundred one after another) send exactly one code.",
    "+91 / 0091 / spaces / dashes / a leading 0 are all the same number.",
    "A different number, an email address, and the staff coin-code flow each have their own clock.",
    "A refused request says whether the code already sent is still valid ('liveCode') so the screen can take the customer straight to typing it.",
    "Signing in with a code, or a day without a request, starts the number over at 30 seconds.",
    "A code the gateway couldn't send doesn't count: no unsent code stays, the number may try again after 30 seconds, and the next success is the first code; a failed resend leaves the earlier code working.",
  ],
  expectNot: [
    "A number must NOT get a second code before its wait is over — however the request is sent or spelled.",
    "Parallel requests must NOT each send a code.",
    "A failed send must NOT push the number up the waits, or replace the code the customer already holds.",
    "A nonsense number must NOT leave a record behind.",
  ],
};

export const run = (d) => runSuite(d, "otp-resend.mjs");
