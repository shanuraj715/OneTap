# API speed report — why some answers take 200 ms or more, and how to get under 50 ms

*Written 2026-11-27. Read this first: "What I measured" (section 3) and "The plan" (section 6). Everything else explains why.*

---

## 1. The short answer

1. **The API's own work is small.** On a quiet machine with the database next door, almost every request is answered in **0.2 to 10 ms**.
2. **The time goes into waiting for the database**, one question after another. Every question has to travel to the database and back. Call that
   trip time **R** (milliseconds). A request that must ask **N questions one after another** takes about **5 ms + N × R**.
3. **That is where your 200 ms comes from.** If the database is 20 ms away (R = 20), a request that needs 9 questions in a row takes 180 ms.
4. **It is worst in one moment.** The API remembers some answers for a short time: *who you are* (30 s), *which store and outlet* (60 s) and *what the plan allows*
   (30 s). When they run out, the **next request has to ask for all of them again, one by one**. In my test that turned a **3.7 ms** request into **180 ms**
   (R = 20 ms) or **330 ms** (R = 40 ms). This happens about once every 30 seconds for each signed-in person, and for each app that polls. So you see
   "usually fast, sometimes slow", which is what a cache that expires looks like.
5. **To get under 50 ms:** (a) find out your real R (section 7), (b) make R small — put the database on, or next to, the server —
   (c) make the "remembered answers expired" path 3 trips instead of 9, and (d) make sure each endpoint needs only one trip.
   Section 6 gives the order, with the expected result of each step.

> **Important:** I could not reach your real server, so I did not measure your real R. I measured the API privately with a pretend distance
> (0, 20 and 40 ms) so you can see what distance does. Run the speed test on the server (section 7) to get the real number. Every conclusion
> below that depends on R says so.

---

## 2. A request, step by step (and what each step costs)

```
phone / browser ──► nginx ──► Node (the API)
                               1. read the request, log it                   ~0.1–0.5 ms
                               2. who are you?          (remembered 30 s)    0 trips  — or 2 trips when it has expired
                               3. which store / outlet? (remembered 60 s)    0 trips  — or 1 trip
                               4. what does the plan allow? (remembered 30 s) 0 trips — or 3 trips
                               5. the real work: ask the database            1–3 trips   ← the part we want
                               6. build the answer (JSON), send it           ~0.1–2 ms
```

Steps 2–4 are the "remembered answers". When all three are fresh they cost nothing. When they have expired they cost **up to 6 trips before the real work even starts.**

---

## 3. What I measured

**How:** `tests/e2e/audit/api-timing.mjs` starts a **private copy** of the API (production mode, so it logs like the server does) with its own throw-away database,
fills it with a made-up restaurant (2,000 orders, 96 dishes, 10 tables), and puts a small **delaying proxy** between the API and the database, so a far-away
database can be simulated honestly: every question really waits R, questions asked together overlap, questions asked one after another add up.
It asks each endpoint 20 times and reports the **middle** time (the median). Nothing real is touched. Re-run it any time:

```bash
node tests/e2e/audit/api-timing.mjs --rtt 0         # the database next door
node tests/e2e/audit/api-timing.mjs --rtt 20        # a database 20 ms away
node tests/e2e/audit/api-timing.mjs --rtt 40 > /tmp/api-log.txt   # (stdout = the API's own log, like pm2's file)
```

### A. When the remembered answers are fresh (the normal case)

Time in milliseconds. "Questions" = database questions per request.

| Endpoint | Questions | DB next door | DB 20 ms away | DB 40 ms away |
|---|---:|---:|---:|---:|
| sign-in check (`/api/auth/me`) | 0 | 0.4 | 0.4 | 0.5 |
| store plan | 0 | 0.3 | 0.4 | 0.5 |
| storefront: find the store / menu / capacity / pickup slots | 0 | 0.3–0.5 | 0.5–0.7 | 0.3–0.6 |
| health | 0 | 0.2 | 0.4 | 0.5 |
| one order | 1 | 0.9 | 25.6 | 46.9 |
| tables | 1 | 1.1 | 25.9 | 48.9 |
| customers | 1 | 0.8 | 27.1 | 48.3 |
| bookings summary | 1 | 0.9 | 26.6 | 46.2 |
| outlet list | 2 | 1.9 | 26.8 | 47.2 |
| orders list (50 orders, 27 KB) | 2 | 3.7 | 26.7 | 49.5 |
| dashboard — owner (18 questions, asked together) | 18 | 6.5 | 28.7 | 50.3 |
| dashboard — kitchen (7 questions) | 7 | 4.2 | 27.0 | 50.3 |
| kitchen board | 2, **one after the other** | 1.8 | 51.7 | **95.9** |
| tables in use | 3, **one after the other** | 1.6 | 77.6 | **138.7** |
| console: stores list | 3, two waves | 1.3 | 52.2 | 94.3 |
| console: overview | 6, two waves | 2.1 | 52.2 | 93.7 |

**What this shows**

- With the answers fresh, the cost is **one R per "wave"** of questions. The dashboard asks 18 questions, but they run side by side, so it costs only about one R.
- **Endpoints that ask in a chain are the slow ones**: *tables in use* (sessions → tables → customers) and *kitchen board* (orders → tables) cost 2–3 R.
- Public storefront reads cost almost nothing. They are remembered and need no sign-in.
- **"Under 50 ms" is only possible for a one-wave endpoint if R is below about 40 ms** (5 ms of work + R). For two waves R must be below ~20 ms.

### B. Right after the remembered answers expired (one request in every ~30 seconds)

I threw away everything remembered, then asked.

| Endpoint | Questions | DB next door | DB 20 ms away | DB 40 ms away |
|---|---:|---:|---:|---:|
| tables | 9 | 3.7 | **181** | **329** |
| orders list (50) | 10 | 6.0 | **188** | **329** |
| dashboard — owner | 27 | 9.4 | **209** | **383** |
| kitchen board | 11 | 4.7 | **233** | **412** |

The same four endpoints, when everything is fresh, take 26 / 27 / 29 / 52 ms at R = 20. **The expiry costs 7 to 9 extra waves.** Looking at *tables*,
the nine questions in a row are: the session → the person → which store this outlet belongs to → the store → its plan → (users, outlets, tables,
platform settings together) → the real question. That is the "200 ms+" you see.

Also the **very first** request for a thing after a restart or a change (nothing remembered yet): storefront menu 31 / 56 / 91 ms, storefront "find the store"
3 / 59 / 99 ms, console stores list 28 / 99 / 178 ms (for R = 0 / 20 / 40).

---

## 4. The causes, biggest first

Each one says **what it is, why it is slow, what to do, the expected gain, the effort and the risk.** Gains are estimates from the model above
(time ≈ 5 ms + waves × R), not promises.

### 4.1 The database is far away (R is large) — the biggest factor, and it needs a measurement

- **What:** the README says the database is a MongoDB Atlas cluster (shared between development and production, as far as I can tell). If the server is in
  one city and the cluster in another, every question pays R.
- **Why it matters:** *everything* in section 3 is multiplied by R. At R = 1 ms (database on the same machine or in the same data centre) the **slowest** endpoint above is under 15 ms.
- **Do:** (1) run the speed test **on the server** with `--only db` — it prints the real R. (2) If R is above ~5 ms, move the database next to the API: the same region at
  least, or MongoDB on the server itself (with backups). (3) Do not share a production database with development: development traffic and the dev-server workers also use it.
- **Gain:** the single biggest. From "R × waves" to "about nothing × waves".
- **Effort / risk:** medium (hosting decision, migration, backups). Do it with a maintenance window.

### 4.2 When the remembered answers expire, a request asks 9 questions one by one — the cause of the "sometimes 200+"

- **Where:** `userFromToken` (auth.service.js: session, then person, 30 s), `outletAccess` (outlet-cache.js, 60 s), `loadStorePlan` (plan.service.js: store → plan → counts, 30 s).
  They run **one after another** inside every signed-in request, and each has its own short life, so they expire at different times.
- **Why slow:** 2 + 1 + 3 + the real question + a few more = **7–9 waves** (section 3B).
- **Do (best first):**
  1. **Refresh in the background.** When an answer is too old, send the old answer now and fetch the new one in the background, so nobody waits ("stale while revalidate"). A
     person almost never sees the slow request again. Nothing about correctness changes — the cache already throws an answer away the moment its data is written
     (`invalidateStorePlan`, tags), so the 30-second life is only a safety net. It can be minutes.
  2. **Fewer waves when it has to ask:** read the session **and** the person in one question (`$lookup`), the store **and** its plan in one question, and run the counts at the same
     time as the store lookup. 9 waves become **3**.
  3. **Warm the answers** when someone signs in and when the API starts, so even the first request is fast.
- **Gain:** the expired request goes from ~330 ms to **~130 ms** (3 waves, R = 40) with step 2, or to **the same as any other request** with step 1.
- **Effort / risk:** low–medium; the code is in three small places and covered by the cache-audit test (t69). Risk: showing a plan or permission that is a few seconds old —
  the existing invalidation already handles this.

### 4.3 Some endpoints ask in a chain instead of together

- **Found:** *tables in use* (3 in a row), *kitchen board* (2 in a row, and it gets *every* open order with the whole document — 75 KB in my first, unrealistic data),
  *one order* (2 when not remembered), the console overview and stores list (two waves). A rough search found **many** "ask, then ask" places: WhatsApp (27),
  printing (24), tables (21), menu (15), orders (13), site (11), platform (11), outlets (11). That count only *suggests where to look*; not all of them are on a hot path.
- **Do:** where the second question does not need the first answer, ask both at once (`Promise.all`); where it does (sessions → tables), use one question with `$lookup`.
  Pick the endpoints the apps call most (kitchen board, tables in use, orders) first.
- **Gain:** *tables in use* 139 → ~50 ms and *kitchen board* 96 → ~50 ms at R = 40.
- **Effort / risk:** low per endpoint. Each change is covered by the cache audit and the endpoint's own test.

### 4.4 Work that never stops (background timers)

These run **in the API process itself** and ask the database even when nobody uses the product:

| What | How often | Where |
|---|---|---|
| WhatsApp worker (checks the message queue, keeps connections) | every **2 s** (+ a heartbeat every 20 s) | only the process with `WHATSAPP_WORKER=on` — **in production that is the API process** |
| Print dispatcher (cloud print jobs) | every **5 s** | every process |
| Server monitor (CPU / memory / disk samples) | every **5 s** | every process |
| Marketing worker | every tick while on | the process with `MARKETING_WORKER=on` |
| Missed-order sweeper | every 60 s | every process |
| Cart-reminder worker | every 60 s | sender process |
| Cache sweeper | every 60 s | every process |
| Stock sweeper | every 5 min | every process |

- **Why slow:** at least **1–2 database questions per second all day**, and the WhatsApp worker also decrypts messages and handles pictures **on the same event loop that answers requests**.
  While Node is busy with that, a request waits even though its database answer is ready. (The **Server** page in the console shows "loop lag p99" — if it is more than
  ~20 ms during the day, this is part of your slowness.)
- **Do:** run the workers as **their own pm2 app** (the code already supports this: one process with `WHATSAPP_WORKER=on`, the others off) so the API process only answers
  requests; make idle timers slower (print dispatcher every 5 s → only poll when a print job was just created, or every 30 s as a safety net).
- **Gain:** removes random stalls; lowers database load. **Effort / risk:** low–medium (deploy change: one more pm2 app).

### 4.5 People and apps ask again and again (polling)

- **Found:** the three apps ask every **8 s** by default (set per app in the console), the dashboard every **60 s**, the live feed falls back to **5 s** polling. One tablet = ~450 requests an hour.
- **Why it matters:** every poll can hit an expired answer (4.2). More requests = more chances to be the slow one, and more load.
- **Do:** raise the default to 15–30 s for the screens that don't need seconds (dashboard, reports); use ETags so "nothing changed" costs a tiny answer; keep push (WebSocket) for orders.
- **Gain:** fewer slow requests, lower load. **Effort / risk:** low (a setting) – but ask before changing what staff see.

### 4.6 Every request writes a 1.5 KB log line — and it contains the session cookie (a security problem)

- **Found:** `pinoHttp({ logger })` logs the whole request and response including **all headers**. In production mode one request is **~1.5 KB of log** (I measured: 620 requests = 940 KB).
  The line includes `"cookie":"rasoipulse_session=…"` — **anyone who can read the log can sign in as that person** — and the long content-security-policy header again and again.
- **Why slow:** writing and serialising 1.5 KB per request (small, but constant: ~160 MB a day for ten tablets) and pm2 has to rotate it.
- **Do:** log only method, URL, status and time, and **redact** `cookie` and `authorization` (pino's `redact` option); do not log the polling GETs and `/health` at all.
  Also: **rotate the existing logs and treat the sessions in them as exposed** (signing everyone out replaces them).
- **Gain:** a little speed; a real security fix. **Effort / risk:** very low.

### 4.7 Big answers are not compressed (unless nginx does it)

- **Found:** the API has no compression. The orders list is **27 KB**, the menu **32 KB**, the kitchen board up to ~75 KB with many orders. On a phone at 1 Mbit/s, 32 KB takes ~250 ms to arrive, whatever the server does.
- **Do:** check the nginx site config for `gzip on; gzip_types application/json;` (Ubuntu's default only compresses HTML). I could not see your server's nginx file.
- **Gain:** JSON shrinks 5–10×. **Effort / risk:** very low.

### 4.8 Indexes will matter as orders grow

- **Found:** orders have good indexes for "this outlet, newest first" and for the order number. The questions *"orders in the queue"* (status) and *"online orders waiting for payment"* filter by status/payment, which no index covers.
  With 2,000 orders it is invisible; with a few hundred thousand it is a scan every minute for every dashboard.
- **Do:** add `{brandId, outletId, status, createdAt}`; use the speed test's *query plans* section on the server to see which questions scan.
- **Effort / risk:** low (an index builds in the background).

### 4.9 Smaller things

- **"Today" on the dashboard** used the server's clock zone for the day start and the trend dates. On a server not set to India time, the trend could shift by a day and "today" would start at 05:30. **Fixed in this change:** the dashboard now uses the Indian day everywhere.
- **The dashboard** used to run 15 questions for every role. It now runs **only those behind widgets the person can see** (a kitchen role: 7 instead of 18). Next step: remember the numbers for 10–30 s (they are the same for everyone) and merge the small counts into one `$facet` question.
- **Creating or deleting a table** expired **everything** remembered about the store (menu, settings, offers). Found and fixed while writing the new table limit: it now drops only the plan answer.
- The database connection has only a 5-second server-selection timeout: while the database is down, a request waits 5 s before failing.
- Small per-request work (JSON body copy, the picture-address rewrite, rate limiting in memory) measured under 0.1 ms each — not worth touching.

---

## 5. Odd async patterns I looked for, and what I found

| Pattern | Found? | Verdict |
|---|---|---|
| Questions asked one after another that could be asked together | **Yes**, on several endpoints (4.3), and the sign-in/plan path (4.2) | Fix |
| `await` inside a loop (one question per item) | A few: stock updates, the marketing worker (it sleeps 150 ms between messages on purpose), store delete, page creation | Fine: background or rare. None on the hot reads I measured |
| Fire-and-forget (`void promise.catch(...)`) | Yes: start-up repairs, sweepers, cache invalidation helpers | Fine — each logs its error; none can crash a request |
| Timers that can overlap | Print dispatcher, marketing, cart reminders and the WhatsApp tick all have a "busy" guard | Good |
| A background job that blocks request handling | The WhatsApp worker shares the event loop with the API in production | **Fix** (4.4) |
| Work that is repeated for nobody | The dashboard computed every number for every role | **Fixed** |
| A cache cleared too widely | Table create/delete cleared the whole store's cache | **Fixed** |

---

## 6. The plan, in order

*Budget for an answer under 50 ms:* nginx 1 ms + Node 3 ms + **one wave** (R). So it needs **R ≤ ~40 ms for one-wave endpoints, ≤ ~20 ms for two-wave ones.**

| # | Step | Needs | Expected result (R = 40 ms) |
|---|---|---|---|
| 0 | **Measure on the server** (section 7) and keep the file as the "before" | 10 minutes | the real R, the real numbers |
| 1 | **Put the database next to the API** if R > ~5 ms | hosting decision | every endpoint ≈ 5–15 ms |
| 2 | **Background refresh** of "who / which store / plan" (4.2.1) | code, ~1 day | the "sometimes 330 ms" disappears |
| 3 | **Fewer waves when it must ask** (4.2.2): 9 → 3 | code | cold request 330 → ~130 ms |
| 4 | Chains → together (4.3): tables in use, kitchen board, one order, console | code per endpoint | 139 → ~50, 96 → ~50 |
| 5 | WhatsApp / marketing workers in their own pm2 app; slower idle timers (4.4) | deploy | no more stalls |
| 6 | Log line + redact cookie (4.6) — **do this first for security**; gzip (4.7); status index (4.8) | small | less disk, smaller answers, safe logs |
| 7 | Cache the dashboard numbers for 10–30 s (4.9) | code | dashboard cold 100 → 50 |

I would **start with 6 (the cookie in the logs), 0, and 2–3**: they cost the least and fix the "sometimes slow" feeling whatever R turns out to be. Step 1 matters most if R is large.

---

## 7. How to measure on the real server (and again after each step)

The speed test is already in the repo and runs **on the server**, so the network to a phone is not included:

```bash
cd /var/www/<app>/apps/api
export SPEED_EMAIL=<an owner's email> SPEED_PASSWORD=<their password>      # never put these on the command line
npm run speed -- --only db                                                # first, quick: the database's own speed and R
npm run speed -- --runs 30 --json ~/speed-before.json                     # the "before": the API, the endpoints, the query plans
# …make a change, then:
npm run speed -- --compare ~/speed-before.json                            # before / after, side by side
```

`--only db` tells you R. If it prints more than ~5 ms for one simple question, section 4.1 is your first step.
`--load 5 --duration 10` also sends five requests at a time, to see how it behaves under load.

To see the effect of distance without touching the server, use the private measurement in section 3 (`api-timing.mjs --rtt N`).

---

## 8. What I could not check

- **Your real R and your real numbers** — I had no access to the server or the real database. Everything above is from a private copy with a pretend distance. Run section 7.
- **Your nginx and pm2 settings** (compression, how many API processes, log rotation).
- **How busy the server's CPU is** during the day (the Server page's "loop lag" and load show it).
- **Real data size.** I used 2,000 orders and 96 dishes. A busy store has far more orders: the indexes (4.8) will matter then.
