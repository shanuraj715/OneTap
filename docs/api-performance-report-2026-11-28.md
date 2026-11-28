# API performance report — the Server page, and the rest of the API

*Written 2026-11-28 for the owner. Report only: **no application code was changed**. Every change below is "additive" (nothing is removed, no answer changes shape),
and each one says how to check it and how to undo it.*

*Read first: section 1 (the short answer) and section 2 (your screenshot). Section 6 is the order of work.*

*This report builds on `docs/api-optimization-report.md` (2026-11-27). That one explained **database distance** and the **remembered answers**. Nothing from its plan has been built yet,
and it is still true. This report adds what was new in your screenshot and a scan of the whole API.*

---

## 1. The short answer

1. **For the three calls in your screenshot, the API's own work is tiny: about 1 millisecond.** I measured `server` 0.8 ms, `health` 0.6 ms, `history` 0.6 ms on a private copy.
   Yet your browser shows 180–450 ms for them. So **more than 99 % of that time is outside the API code**: the road between your browser and the server
   (Cloudflare, TLS, distance), and — for `server` only — a database ping to Atlas on every second call.
2. **The proof is in your own screenshot.** `history` does no database work and no disk work (it only reads a list in memory), yet it took **266–456 ms**, as slow as or slower than `server`.
   If the code were the problem, `history` would be fast. The server machine is also idle: **load average 0.02, 1.1 GB of 1.9 GB memory free** (I checked at 12:29 server time today).
3. **One call really is slow because of the code: `processes` (284–797 ms).** It does real work on every call: it reads every process of the machine, and about every second call it starts
   a separate program (`pm2 jlist`) and waits for it. That explains why its times jump between about 280 and about 800 ms. This is the one call where code changes will show.
4. **The rest of the API is in good shape.** I checked 180 database reads and every important order query at 40,000 orders. The kitchen board, the dashboard, tables, riders and the order list
   all read **3 to 51 documents** to answer. There is no blocking code in the request paths, and almost every read already uses `.lean()`.
5. **Four things are not good, and they will get worse as you grow** (section 4): three order questions that read the **whole order history** to find a few answers
   (measured: 36,667 documents read to return 151), and a sign-in cache that **every login anywhere throws away for everybody**. Small fixes exist for all of them.

**What I could not do:** measure on the real server. I tried to copy a small timing script there and the permission was refused, so I stopped and did not work around it. Section 5 lists
four checks you can run in a few minutes that will show exactly where the 180 ms+ comes from.

---

## 2. Your screenshot, call by call

The Server page asks the API on a timer (from `apps/admin/src/lib/usePlatform.js`):

| Call | How often | What the API does | API's own time (measured) | What you see | So the rest is… |
|---|---|---|---:|---:|---|
| `server` | every 4 s | reads numbers the sampler already holds in memory + `df` (kept 20 s) + a **database ping** (kept 4.5 s) | **0.8 ms** | 180–240 ms | the road, **plus one trip to Atlas on every second call** (4 s timer vs 4.5 s memory) |
| `history?minutes=30` | every 10 s | filters a list in memory, thins it to ≤240 points (~8 kB) | **0.6 ms** | 266–456 ms | **the road** (no database, no disk) |
| `processes` | every 8 s | reads every process of the machine, **then** runs `pm2 jlist` (kept 15 s) | **87 ms** on my Mac (Linux differs) + `pm2 jlist` (not measured) | 284–797 ms | the road **+ the machine work + the `pm2` start** |
| `health` (dashboard strip only) | every 20 s | same as `server`, smaller answer | **0.6 ms** | — | — |

The three ratios in your screenshot (about 5 : 2.5 : 2 requests) are exactly the three timers above (4 s : 10 s : 8 s). So the page is **not** asking twice for the same thing.
It makes about **29 requests a minute (1,700 an hour) per open Server tab**. That is fine for the server, but each one pays the road.

### Why `processes` jumps between 284 ms and 797 ms
- `processes` is asked every **8 s**; the `pm2 jlist` answer is kept only **15 s**. So **about every second call** (8 s later it is still fresh; 16 s later it is not) starts `pm2 jlist`.
  `pm2` is a Node program: starting it, connecting to the pm2 daemon and printing every app's full details takes a few hundred milliseconds on a 2-core server.
  That fits "fast, slow, fast, slow" and a gap of about 500 ms between the two groups.
- The code asks for `pm2` **after** it finishes reading the processes (`monitor.js`, `processSnapshot`), so the two times **add up** instead of overlapping.
- Also: if the previous reading is under 1 s or over 120 s old (the first call after you open the page, or two tabs open at once), it reads everything **twice, half a second apart**, to compute CPU.
  That is a built-in 500 ms. I saw it in my test (back-to-back calls: 626 ms; calls 1.5 s apart: 87 ms).
- I could not measure `pm2 jlist` on your server. This is the **most likely** cause, not a proven one. Check C below.

### Why `server` and `history` are slow even though the code is instant
Whatever sits between your browser and the API adds time to **every** call, including the instant ones:
browser → internet → Cloudflare → your server (nginx) → Node, and back. If the server is far from you or from Cloudflare's nearest office, or if the connection is not reused
and every call pays a new TLS handshake, the floor is a couple of hundred milliseconds. The two checks A and B in section 5 split this for you.

---

## 3. What I measured

All on a **private copy** of the API with its own throw-away database (nothing real touched). Tool: `tests/e2e/audit/api-scan.mjs` (new, in the repo).
Run it again any time: `node tests/e2e/audit/api-scan.mjs --rtt 20 --orders 40000`.

### A. How many documents the database reads (40,000 orders, 90 days, 600 customers)

"Reads" = documents the database had to look at. "Answer" = documents it returned. The time is the database's own time, with the data in memory.

| Question the apps ask | Who asks, how often | Reads | Answer | Time | With the proposed index |
|---|---|---:|---:|---:|---|
| Kitchen board | every 8 s per kitchen screen | 9 | 9 | 5 ms | already fine |
| Dashboard: orders in the queue | dashboard, each minute | 9 | 9 | 0 ms | already fine |
| Storefront capacity (2 counts) | every 10 s per outlet | 9 | 3 | 0 ms | already fine |
| Order list (newest 50) | order screen, apps | 51 | 50 | 0 ms | already fine |
| One table's orders (`sessionId`) | tables, take-order | 3 | 3 | 0 ms | already fine |
| Rider app: my deliveries | every 8 s per rider | 9 | 1 | 0 ms | already fine |
| **Online orders waiting for payment (a count)** | **every orders-list call**, and the dashboard tile | **36,667** | 151 | **79 ms** | 165 reads, 2 ms |
| **Coupon check: this customer's order count** | every checkout that uses a coupon | **36,667** | 67 | **72 ms** | 67 reads, 1 ms |
| **A customer's order history** | storefront account, order again, ratings | **9,030** | 16 | **28 ms** | 16 reads, 0 ms |
| **Stock sweeper (all stores at once)** | every 5 min, in every API process | **39,981** | 0 | **33 ms** | 0 reads, 0 ms |

- **The first six are already well served** by the indexes the models have (`status_1`, `sessionId_1`, and the order list's compound index). My first guess, that the kitchen board
  scans the whole history, was **wrong**. I tested it and it does not. Do not spend time there.
- **The last four read the whole history.** The first two use the `status` index with "not cancelled", which matches almost every order. The history question walks the
  `createdAt` index until it has found 16 orders of that customer; for a customer who ordered once it walks **everything**, and with many stores in one database it walks **other stores' orders too**.
  The sweeper has no brand in its filter at all, so it looks at every store's orders.
- **They grow in a straight line.** With 20,000 orders instead of 40,000 the reads were half (18,334 and 19,984). At 400,000 orders the unpaid count would read ~370,000 documents on **every order-list call**.
  Today, with your real (small) data, the cost is probably a few milliseconds. **These are insurance for growth. They will not change your screenshot.**

Index cost (40,000 orders, 19.2 MB of data): the unpaid-orders index is **20 kB**, the stock-hold one **8 kB**, the customer-history one **772 kB**. All three are small.

### B. The Server page's own calls (database 0 ms and 20 ms away)

| Call | Size | After gzip | Median | 95 % | Note |
|---|---:|---:|---:|---:|---|
| `server` | 4.1 kB | 1.4 kB | 0.8 ms | 2.1 ms | the database ping is not in these numbers (kept 4.5 s, my calls were back to back); on your page every 2nd call pays it |
| `server/health` | 1.5 kB | 0.6 kB | 0.7 ms | 1.2 ms | |
| `server/history` | 0.2 kB* | 0.2 kB | 0.6 ms | 1.3 ms | *few points in a fresh test; your page gets ≤240 points (~8 kB, ~2.6 kB over the wire) |
| `server/processes` | 7.7 kB | 1.3 kB | **87 ms** (one reading) / **635 ms** (two readings) | 91 / 656 ms | macOS `ps` here; **Linux `/proc` + `pm2 jlist` on your server will differ** |

### C. What one login does to everybody else

The API remembers "who is this?" for 30 s. Any write to a **user, a session or a platform role** throws away **every** person's remembered answer (`modules/cache/invalidation.js`, tag `ns:auth`).
A login writes a session, so every login, logout or app sign-in makes the next request of **every other signed-in person** ask the database again (session, then user: **2 more questions, one after the other**).

| The owner asks for the order list… | Database questions | Time (DB next door) | Time (DB 20 ms away) |
|---|---:|---:|---:|
| everything remembered | 2 | 1.9 ms | 25 ms |
| right after somebody else signed in | 4 | 3.0 ms | **69 ms** |
| the request after that | 2 | 1.8 ms | 24 ms |

So one slow request (+44 ms at 20 ms distance) per login, per active person. With a few tablets, apps and staff that is dozens of slower requests a day — a small cost, not the cause of your screenshot,
but it is the kind of "sometimes slow" that is easy to remove (R4).

### D. Sizes — compression is already handled

| Answer | Raw | gzip | brotli |
|---|---:|---:|---:|
| Order list (50) | 27.8 kB | 1.8 kB | 1.3 kB |
| Kitchen board | 4.0 kB | 0.6 kB | 0.5 kB |
| Dashboard | 4.5 kB | 1.0 kB | 0.8 kB |

The API sends no compression itself, but your screenshot shows ~2.6 kB transfers for an ~8 kB answer, so **Cloudflare is compressing for the browser**. Compression is not a problem. (Between your
server and Cloudflare the answer is still sent raw; with the sizes above that is a few milliseconds at most.)

---

## 4. What to change, in order (all non-breaking)

Each item: **what**, **evidence**, **change**, **gain**, **risk**, **how to check**, **how to undo**.

### R1. Add a `Server-Timing` header to every API answer — *do this first, it tells us everything else*
- **What:** the API tells the browser how long it spent: `Server-Timing: app;dur=1.2, db;desc="2 questions"`. Chrome shows it in the request's **Timing** tab.
- **Why first:** it ends this argument for good. For any request in your screenshot you will see "the server spent 1 ms; the other 200 ms is the road".
- **Change:** one small middleware next to `requestStats` in `apps/api/src/app.js` (about 15 lines). It adds a header; it does not touch the body.
- **Gain:** none by itself; it makes every later gain visible. **Risk:** none (an extra header). **Check:** open any request in DevTools → Timing. **Undo:** delete the middleware.

### R2. Three small indexes — *insurance against growth; measured*
- **Evidence:** section 3A. Unpaid-orders count 36,667 → 165 reads (79 → 2 ms); coupon check 36,667 → 67 reads (72 → 1 ms); customer history 9,030 → 16 reads (28 → 0 ms); stock sweeper 39,981 → 0.
- **Change** (`packages/db/src/models/order.js`, all additive):
  1. `{ brandId: 1, outletId: 1 }` with `partialFilterExpression: { "payment.status": "pending" }` — the unpaid count (20 kB).
  2. `{ brandId: 1, "customer.customerId": 1, createdAt: -1 }` — history, coupon check, order-again, ratings, marketing counts (~19 bytes per order).
  3. `{ createdAt: 1 }` with `partialFilterExpression: { "stockHold.held": true }` — the stock sweeper (8 kB).
- **Do not add** the other indexes I tried (a `status` compound, a rider one): the existing ones already answer those questions with 9 reads.
- **Gain:** nothing visible today; keeps the order list, dashboard tile, checkout and storefront account flat as orders grow into the hundreds of thousands.
- **Risk:** low. Writes get a tiny bit more work (3 more index entries per order, partial ones only for the rare orders). Building an index on a **big** collection uses the database for a while:
  the models do not turn auto-indexing off, so the API builds new indexes itself at start-up. Do it at a quiet hour, one process first.
- **Check:** `explain` on the three queries (the new script prints it); the order list and checkout tests. **Undo:** drop the index; queries go back to today's plan, nothing else changes.

### R3. Server page: take the slow parts out of the request — *this is the one that shows in your screenshot (`processes`, a little of `server`)*
All four keep the **same JSON, the same fields, the same page**. The data can be at most one poll older, which is what the 15 s `pm2` memory already allows today.
1. **`pm2 jlist` in the background.** When the remembered `pm2` list is older than 15 s, answer **now** with the old list and refresh it in the background (one at a time).
   The request never waits for the `pm2` program. *Expected: `processes` stops jumping to ~800 ms.* (`collect.js` `readPm2`, `monitor.js` `processSnapshot`.)
2. **Ask `pm2` and read the processes at the same time** (today one after the other). Even without step 1 it saves the shorter of the two.
3. **Database ping in the background** (`pingDatabase`): answer with the last ping value, and refresh it when older than 4.5 s. The request never waits for Atlas.
   *Expected: `server` loses one database round trip on every second call.*
4. **Two readings within 1 s:** when a second tab asks right after the first, reuse the first reading instead of waiting another 500 ms. The CPU numbers of that one call are slightly rougher.
- **Gain (an estimate, not measured on your server):** `processes` from 284–797 ms to a steady "road + ~60–100 ms". `server`: minus R (the real distance to Atlas) on every second call.
  **The road itself does not change** — that is the part R1 and section 5 will explain.
- **Risk:** low. There is **no dedicated test for the Server page yet** (only the rate-limit test touches it), so the change must bring its own: "the second call inside 15 s does not start `pm2` again",
  "an old `pm2` answer is refreshed after the call", "the answer has the same fields as before", and the existing phone/desktop view of the page checked by eye.
- **Undo:** revert the commit.

### R4. Precise sign-in memory — *removes the "one slow request after anybody's login"*
- **Evidence:** section 3C: 2 → 4 questions, 25 → 69 ms at 20 ms distance, for every other person, every time anyone signs in.
- **Change:** tag each remembered sign-in with **its own user** (`auth:user:<id>`) as well as `ns:auth`; let a Session or User write expire only that person's tag; keep "a platform role changed → everybody" as it is.
  Code: `modules/auth/auth.service.js` (`userFromToken`) and `modules/cache/invalidation.js` (`expireForWrite`).
- **Gain:** a login no longer slows anybody else. **Risk:** medium-low — a security-relevant cache. The rule to keep: *a person's own session or user change must take effect at once* (sign-out, disabled user,
  role change), and a **role** change must still reach everyone. Tests to run: the cache audit (t67–t70), platform roles (t121/t122), login protection, plus two new ones (another person's login does not
  expire mine; my own sign-out does).
- **Undo:** revert the commit (the old behaviour is the safe one).

### R5. Carried over from the 2026-11-27 report (still true, not built)
- **Background refresh for "who / which store / plan"** (§4.2 there): turns the ~9-question expiry request (330 ms at 40 ms distance) into a normal one. Biggest remaining gain for the whole API once R is known.
- **Chains → together** (§4.3 there): *tables in use* (3 in a row), *kitchen board* (2 in a row).
- **Database next to the server** (§4.1 there) — **the decision that matters most if the real distance is large.** The `server` call's database ping shows it on the Server page itself.
- **Workers in their own pm2 app** (§4.4 there): WhatsApp, print and monitor timers share the process that answers requests.

### R6. Optional: one combined call for the Server page
Add a new route `/api/platform/server/bundle` that returns the server numbers, the processes and the history together; the page then makes ~15 calls a minute instead of ~29.
The old routes stay, so nothing breaks. Do it **only if** the road turns out to be the problem (it cuts the number of times you pay the road, not the road itself). Not needed for the server's health.
*The page already pauses polling in a background tab (react-query's default), so a forgotten tab costs nothing.*

---

## 5. What you can check in a few minutes (I was not allowed to do this on the server)

These are read-only. They split the 180–450 ms into "road" and "code".

- **A. In Chrome** — open the Server page, DevTools → Network → click one `history` request → **Timing** tab. Read three numbers:
  *Initial connection* + *SSL* (if large on every request, connections are not being reused), *Waiting for server response* (the road + the server), *Content download*.
- **B. On the server** — time the API **without** the road (`/health` needs no sign-in):
  `for i in 1 2 3 4 5 6 7 8 9 10; do curl -s -o /dev/null -w 'connect %{time_connect}  first-byte %{time_starttransfer}  total %{time_total}\n' http://127.0.0.1:3092/health; done`
  Then the same from your laptop against your public API address. **The difference is the road.** If the server's own number is a few milliseconds, the code is not the problem.
- **C. On the server** — time the `pm2` program: `time pm2 jlist > /dev/null` (three times). If it is 300–600 ms, R3 step 1 is your `processes` fix.
- **D. On the server** — the real database distance: `cd /var/www/tablepe-prod/apps/api && npm run speed -- --only db` (from the 2026-11-27 report, §7). If one simple question takes more than ~5 ms,
  every endpoint is paying it (R5, "database next to the server").
- The Server page itself shows **"loop lag"**. Under ~10 ms means Node is not being held up.

If you want me to run A–D, allow it explicitly and I will do only these read-only commands.

---

## 6. Order of work

| # | Step | Effort | Risk | What it fixes |
|---|---|---|---|---|
| 0 | Checks A–D (section 5) | 10 min, you | none | tells us whether the road or the code is the problem |
| 1 | **R1** `Server-Timing` header | 30 min | none | makes every number visible, for ever |
| 2 | **R3** Server page: `pm2` and the ping out of the request | ½ day + tests | low | the `processes` jumps; part of `server` |
| 3 | **R2** three indexes | 1–2 h + build time | low | growth insurance (order list, checkout, account, sweeper) |
| 4 | **R4** precise sign-in memory | ½–1 day + tests | medium-low | no slow request after anybody's login |
| 5 | **R5** background refresh, chains → together, database location, workers | per the 2026-11-27 plan | per item | the "sometimes 200 ms+" on every signed-in endpoint |
| 6 | **R6** combined Server call | 2 h | low | fewer requests (only if the road is slow) |

Each step is a separate small commit, can be deployed alone, and can be undone by reverting that commit. Nothing is deployed until you say yes.

---

## 7. What I checked and found fine (so nobody wastes time)

- **No blocking code in request paths.** The only `…Sync` calls are at start-up (version file, encryption key) and in scripts. Password hashing is the async kind.
- **Reads are lean.** 169 of 180 `find()` calls use `.lean()`; the other 11 are small lists (coupons, printers, print templates, a print-job list capped at 200) or jobs that change and save the documents they read (store delete, the print dispatcher, the booking sweeper).
  Making the small lists lean would save a few milliseconds at most; not worth the risk. 136 `find()` calls have no `.limit()`, but the ones on big collections
  are bounded by their filter (open orders, one table session, one customer) or are rare, user-started jobs (WhatsApp broadcast list, marketing audience). No change needed.
- **The big order questions** (kitchen board, dashboard queue, storefront capacity, order list, table session, rider list) read 3–51 documents at 40,000 orders. Fine.
- **The Server page** itself does very little work per call (about 1 ms). (I did not measure the 5-second sampler on its own; the earlier report listed it as a constant background cost.)
- **Per-request overhead** (JSON body copy, picture-address rewrite, rate limiter) was measured at under 0.1 ms each in the earlier report. Not worth touching.
- **Compression:** done by Cloudflare. **Sizes:** small.
- **The server machine:** idle (load 0.02, 280 days up, 1.1 GB free).

## 8. What I could not check

- **The real distance to Atlas**, **the real `pm2 jlist` time**, and **the real road** (checks A–D). Everything about those is reasoning, labelled "likely".
- **Linux numbers for `processes`.** My Mac uses a different way to list processes (`ps`), so only the **shape** (one reading vs two, the 500 ms wait) carries over, not the 87 ms.
- **Your real order count.** I used 20,000 and 40,000 orders in one store; the growth is a straight line, so you can scale it to yours.
- **Cloudflare settings** (cache rules, Argo, HTTP/3) and the **nginx file** on the server (not in the repository).

## 9. Re-running the evidence

```bash
node tests/e2e/audit/api-scan.mjs --rtt 0  --orders 40000     # plans, Server page, sign-in wipe, sizes (database next door)
node tests/e2e/audit/api-scan.mjs --rtt 20 --orders 20000 --json /tmp/scan.json
node tests/e2e/audit/api-timing.mjs --rtt 20                  # the 2026-11-27 endpoint table
```
It starts its own private API and database (no `.env` is read, no real data is touched) and prints the tables to the terminal.
