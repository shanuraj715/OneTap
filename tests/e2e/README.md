# Rasoi Pulse end-to-end tests

A saved, repeatable test library for the whole product. Every test records **what it does (steps)**, **what must happen**, **what must NOT happen**, and **what passed / failed** — and keeps that in [`docs/`](docs/CATALOG.md) so you can read it without running anything.

```
cd tests/e2e
npm install                       # once (installs Playwright; Google Chrome must be installed for --visible)

node run.mjs                      # run EVERY test, headless (no window), save results + docs
node run.mjs --visible            # run in a real, full-size Chrome window with a red cursor + captions
node run.mjs --only t01 --visible # one test (match by id prefix), watched
node run.mjs --hold --only t01    # keep the window open at the end to look around
node run.mjs --rebuild            # rebuild the dashboard + storefront from the current code first
node run.mjs --list               # the tests and their last result
node run.mjs --docs-only          # regenerate docs/*.md from the saved results
```

The apps are rebuilt automatically when their code changed since the last build, so a plain `node run.mjs` always tests your **current** code.

## It never touches real data

The tests run against a **throwaway bench** (`bench/`): an API on an **in-memory MongoDB** with two fake stores, a build of the dashboard and a build of the storefront, on ports **3097 / 3171 / 3170** (your dev servers on 3070-3073 are never touched). `bench/serve-bench.mjs` refuses to read any `.env`. The bench lives in `.bench/` (git-ignored) and is started/reset by the runner.

| Fake data | |
|---|---|
| Platform console | `super@sandbox.test` / `Super123!` |
| **Acme Momos** (Pro plan, every feature) | owner `o@acme.test` / `Owner123!`, manager `m@acme.test` / `Manager123!`, cashier `s@acme.test` / `Staff1234!`, kitchen `k@acme.test` / `Kitchen123!` · storefront `http://localhost:3170/main` (takeaway + delivery + dine-in) and `/second` (takeaway only) |
| **Beta Bites** (Starter plan: takeaway, dine-in QR, coupons) | owner `o@beta.test` / `Owner123!` · `http://beta.localhost:3170/only` |
| Customers | any phone signs in with code `123456`; returning customer Asha Rao `9876543210` with 50 coins |

`node bench/bench.mjs up | reset | rebuild | down | status` controls the bench by hand.

## What gets saved

| File | What |
|---|---|
| `docs/<id>.md` | the test's summary, **numbered steps**, **what to expect**, **what must NOT happen**, last result with **failed first**, passed checks per step, **findings**, history |
| `docs/CATALOG.md` | all tests at a glance + open findings |
| `results/latest.json` | the full last result of each test |
| `results/history.jsonl` | one line per run (never rewritten) |
| `results/shots/` | screenshots (git-ignored) |

Docs are generated — edit the test file, then re-run (or `--docs-only`).

## Adding a test (what to do whenever you ask for "test X")

1. Create `tests/tNN-short-name.mjs` exporting:
   ```js
   export const meta = { id: "tNN-short-name", title, area, fresh /* true = starts from fresh fake data */, summary,
                         expect: ["…must happen…"], expectNot: ["…must NOT happen…"] };
   export async function run(d, h) { /* d = browser helper, h.ids = ids of the fake stores */ }
   ```
2. In `run`, narrate with `await d.step("…")` (numbered; saved to the doc), assert with `d.check(label, ok, detail)` and **negative** assertions with `d.never(label, badHappened, detail)`. Record anything noticed that isn't pass/fail with `d.finding("…")`.
3. **Do everything in Chrome — no direct API calls** (your standing rule). Drive the screens with the visible helpers (`d.tab`, `d.click`, `d.type`, `d.choose`, `d.press`, `d.spot`, `d.shot`) and the ready-made screen helpers in `bench/ui.mjs` (`signIn`, `createPlan`, `createStore`, `setStorePlan`, `addOutlet`, `switchOutlet`, `addCategory`, `addItem`, `applySettings` / `readBackSettings`, `setAddress`, `setOutletBlocked`, `deleteStore`, `placeTakeaway`, `customerSignIn`, …). Read results from what the screen says (text, greyed-out buttons and their tooltips, 404 pages). To check that a rule is enforced, try the forbidden thing in the UI as the person who shouldn't be able to do it.
4. Run it (`node run.mjs --only tNN --visible`), and the doc is written.

Stand-alone script suites live in `suites/` and are wrapped by a tiny test file using `runSuite(d, "file.mjs")` (`bench/suite.mjs`): lines `=== heading`, `PASS  label — detail` and `FAIL  label — detail` become steps and checks.

## Notes

- **t08 → t12 are a chain** about one store ("Lifecycle Foods": plans, outlets, subdomain, downgrade, outlet delete, store delete): each continues from the state the previous one left. Run them together (`node run.mjs --only t08,t09,t10,t11,t12`); `t08` starts from fresh data and builds the store, the others fail with a clear message if it doesn't exist. Shared helpers are in `tests/_world.mjs` (files starting with `_` are not tests).

- `t02` skips its one check that asks WhatsApp's real servers for a link QR (nothing gets linked, but it is a real network call). Run it with `WA_REAL_QR=1 node run.mjs --only t02`.
- The storefront bench build imports `lucide-react`, which `apps/storefront/package.json` does not declare (it only resolves through pnpm hoisting) — the bench starts Next through the pnpm launcher for that reason.
- This folder is **not** a pnpm workspace package, so it never ships with the apps; exclude `tests/` when you rsync the repo to a server.

## The cache audit

`node audit/db-calls.mjs` (with the bench running) asks every GET read of the API twice and prints how many database
operations each one caused the first and the second time — what is remembered shows `0` the second time, what must be
live (orders, tables, bookings, the kitchen…) shows its reads every time. The bench API records them for any request that
carries an `x-audit` header (port 3189). `t69` checks the same rules, and that every remembered thing is dropped the moment
it changes, on its own in-memory API.
