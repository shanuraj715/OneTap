// T104 — How often each mobile app asks the server for new data (set per app by the platform admin).
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t104-app-refresh-interval-api",
  title: "Apps → the refresh interval is one number per app (default 8 s), set by the platform admin, and announced to the app in every answer",
  area: "app",
  browser: false,
  fresh: false,
  summary: "Runs suites/app-refresh-interval-api.mjs against a private API on an in-memory database. With nothing set, every answer to OMA, KDA and RDA (requests carrying x-app-id) has x-refresh-seconds: 8, and the console's list gives the three apps at the default with the limits (3 to 600). Only the platform admin can read or change it (a store owner, a waiter and nobody signed in are refused). Setting RDA to 15 changes the very next answer to the rider app (on any route, errors too) and leaves OMA and KDA at 8; each app keeps its own number (KDA 5, OMA 600 …); it is stored as one document per app; changing it again is seen at once. Numbers below 3, above 600, fractions, text, null, missing are refused with a message a person can act on (400) and change nothing; an unknown app is 404. Requests with no app id, an unknown one, or the dashboard's own calls get no such header. The apps' jest suites compare their own limits with APP_REFRESH.",
  expect: [
    "Default 8 seconds for every app; each app has its own number.",
    "A change is announced with the very next answer, with no restart.",
    "Only the platform admin can change it.",
  ],
  expectNot: [
    "A number outside 3–600 or a non-whole number must NOT be saved.",
    "The dashboard, the storefront and old app builds must NOT get the header.",
    "One app's number must NOT affect another's.",
  ],
};

export const run = (d) => runSuite(d, "app-refresh-interval-api.mjs", { timeoutMs: 4 * 60_000 });
