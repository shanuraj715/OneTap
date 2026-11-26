// T106 — The API speed-test script (run on the server): response time inside the API, database speed, query plans, load, comparing runs.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t106-api-speed-test",
  title: "API speed test (apps/api/src/scripts/speed-test.js): time inside the API, time waiting for the database, query plans, load, and before/after comparison — read-only",
  area: "api",
  browser: false,
  fresh: false,
  summary: "Runs suites/api-speed-test.mjs: the script is started as a separate process against a throwaway in-memory database. Unit checks: percentile / stats / merged overlapping query times, query shapes (values taken out; $in lists one shape; Mongoose's Map sorts read), reading MongoDB explain answers (index used, whole-collection scan, in-memory sort, reading far more than returned; a scan over a handful of documents is noted but not a problem), and a read-only guard that refuses every method except GET and the sign-in/sign-out POSTs. Full run (signed in as the platform admin): the report has the machine line, database section (ping and small read, 20+ timings each), per-endpoint response times (first / typical / slow 95% / worst / answer size) for public and dashboard endpoints, the inside-the-API table (server time never longer than the whole trip, queries and waiting-for-db for DB endpoints, none for health, the storefront menu answered from memory after the first request), query plans, and a 'things to look at' list; it never prints the password or a database address with a login. Nothing changes in the database except one sign-in record: the session is closed again and orders, menu, outlets, stores, users and tables are untouched; index and collection auto-creation is switched off. Without credentials only public endpoints are tested; a wrong password is reported and the run continues. Load mode (4 at a time for 2 s) sends thousands of requests with no errors and reports the API thread's busy % and event-loop lag; bad option values are refused (exit 1). --url measures a live API from outside (total time only; no inside table, no plans). --compare A B (also --compare A --compare B, or one file = run now and compare) prints before → after with % change; three files, a stray argument and a missing file are refused. Wired as `npm run speed` and in the README.",
  expect: [
    "The report shows time inside the API, time waiting for the database, and the number of queries per endpoint.",
    "Plans flag a missing index, an in-memory sort, or reading far more than returned — but not over tiny collections.",
    "A run can be saved and compared with another (before / after an optimization).",
  ],
  expectNot: [
    "The script must NOT change data: only GET requests, plus one sign-in/sign-out that leaves one sign-in record.",
    "It must NOT print the password or a database address with a login in it.",
    "It must NOT build indexes or create collections on the database it measures.",
  ],
};

export const run = (d) => runSuite(d, "api-speed-test.mjs", { timeoutMs: 8 * 60_000 });
