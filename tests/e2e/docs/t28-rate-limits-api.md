# T28 — Request limits — every protected API stops at its limit with a clear 429, per account sign-in guard, live connections, and nothing that changes data is left unprotected

**Area:** security · **Last result:** ✅ PASSED (124 passed, 0 failed · 2026-11-19 16:30 · headless · 9.2 s)

**Run it alone:** `node run.mjs --only t28` (add `--visible` to watch it)

## What this test does

Runs suites/rate-limits.mjs: its own in-memory API with every limit scaled to a tenth so 'one more than allowed' is a handful of requests. Pushes each of the 34 limits to its edge — visitors (quotes, coupons, table scans, the enquiry form, payments, webhooks, the print agent, placing orders, profile), sign-in codes (per address, per store), the dashboard and customer sign-in floods, signed-in team members (changes, reports, customer lookups, account changes, secrets, uploads, exports, bulk sends, chat, WhatsApp linking, printers, destructive actions, previews, coin codes), the platform console's outbound lookups, the general limit for visitors and for signed-in users — and checks the answer each time (429, the policy's name, Retry-After, a readable message). Then: one limited visitor doesn't affect another, a made-up address in X-Forwarded-For doesn't give a fresh budget, our own servers are never limited by address, RATE_LIMITS=off really is off; one account guessed from ten different addresses is paused (even for the right password), an email with no account behaves identically, the pause grows 1 → 5 minutes and signing in clears it; WebSocket connections are limited per address and an oversized message closes the connection; and the route inventory shows a named limit on every route that changes data, every limit is attached to something, and docs/api-rate-limiting.md names them all.

## Steps

1. visitors — each public entry point has its own limit (a fresh address for each)
2. sign-in codes — per address, and per store
3. signed-in people — each kind of action has its own limit (a different team member for each)
4. the platform console (super admin)
5. one visitor being limited never affects another
6. our own servers and the off switch
7. one account, guessed from many addresses
8. live connections (WebSockets)
9. coverage — nothing that changes data is left without a limit of its own
10. the doc

## What to expect (these must happen)

- Each limit lets exactly its allowance through and refuses the next request with 429, the policy's name, a Retry-After header and a readable message.
- A limited address does not limit another; a fake address written in front of the real one in X-Forwarded-For gives no fresh budget.
- Our own servers (no forwarded address) are never limited by address; RATE_LIMITS=off turns everything off.
- Ten wrong passwords for one account, from ten addresses, pause that account — even the right password is refused — while other accounts sign in; an unknown email behaves the same; the Security page shows only a masked email; the pause is 1 minute, then 5; the right password works when it ends and clears the count.
- The code-sending limits stack: per address, per store (from many addresses), and the sign-in floods.
- Live-order connections are limited per address (429 + Retry-After), our own network is not, and a preview message over 1 MB closes the connection.
- Every route that changes data is on the inventory with a limit of its own (except logout), every limit is used, and the doc names every limit and the exempt route.

## What must NOT happen

- A limit must NOT refuse a request inside its allowance, or let the next one through.
- One visitor's limit must NOT affect another visitor.
- A request from our own servers must NOT be limited by address.
- A route that changes data must NOT be added without a limit (the coverage check fails).
- The account pause must NOT reveal whether an email has an account, or print the whole email.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (124)

**Step 1 — visitors — each public entry point has its own limit (a fresh address for each)**

- public-compute: the first 9 requests are let through — _400,400,400,400,400,400,400,400,400_
- public-compute: request 10 is refused with 429 and the policy's name — _429 public-compute_
- public-compute: the answer carries Retry-After and a readable message — _60s · Too many requests. Please wait 60 seconds and try again._
- coupon-guess: the first 2 requests are let through — _400,400_
- coupon-guess: request 3 is refused with 429 and the policy's name — _429 coupon-guess_
- coupon-guess: the answer carries Retry-After and a readable message — _300s · Too many coupon attempts. Please try again in 5 minutes._
- table-scan: the first 6 requests are let through — _404,404,404,404,404,404_
- table-scan: request 7 is refused with 429 and the policy's name — _429 table-scan_
- table-scan: the answer carries Retry-After and a readable message — _60s · Too many requests. Please wait 60 seconds and try again._
- site-challenge: the first 4 requests are let through — _200,200,200,200_
- site-challenge: request 5 is refused with 429 and the policy's name — _429 site-challenge_
- site-challenge: the answer carries Retry-After and a readable message — _600s · Too many requests — please wait a moment._
- site-lead: the first 1 requests are let through — _400_
- site-lead: request 2 is refused with 429 and the policy's name — _429 site-lead_
- site-lead: the answer carries Retry-After and a readable message
- webhook: the first 24 requests are let through
- webhook: request 25 is refused with 429 and the policy's name — _429 webhook_
- webhook: the answer carries Retry-After and a readable message — _60s · Too many requests._
- print-agent: the first 30 requests are let through
- print-agent: request 31 is refused with 429 and the policy's name — _429 print-agent_
- print-agent: the answer carries Retry-After and a readable message — _60s · Too many requests from this printer agent. Please wait 60 seconds._
- payment: the first 4 requests are let through — _400,400,400,400_
- payment: request 5 is refused with 429 and the policy's name — _429 payment_
- payment: the answer carries Retry-After and a readable message — _600s · Too many payment requests. Please wait 10 minutes._
- order-place: the first 1 requests are let through — _400_
- order-place: request 2 is refused with 429 and the policy's name — _429 order-place_
- order-place: the answer carries Retry-After and a readable message — _600s · You're placing orders too quickly. Please wait 10 minutes._
- customer-account: the first 3 requests are let through — _401,401,401_
- customer-account: request 4 is refused with 429 and the policy's name — _429 customer-account_
- customer-account: the answer carries Retry-After and a readable message — _600s · Too many requests. Please wait 10 minutes._
- api (a visitor): the first 60 requests are let through
- api (a visitor): request 61 is refused with 429 and the policy's name — _429 api_
- api (a visitor): the answer carries Retry-After and a readable message — _60s · You're sending requests too fast. Please wait 60 seconds and try again._

**Step 2 — sign-in codes — per address, and per store**

- otp-send-ip: the first 2 requests are let through — _200,200_
- otp-send-ip: request 3 is refused with 429 and the policy's name — _429 otp-send-ip_
- otp-send-ip: the answer carries Retry-After and a readable message — _600s · Too many code requests from this network. Please try again in 10 minutes._
- otp-send-store: the store's remaining 28 codes, asked for from 28 different addresses, are all sent — _200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,_
- otp-send-store: the next one — from a brand-new address — is refused: the store's own ceiling — _429 Too many codes have been requested for this store. Please try again in 60 minutes._
- login-flood: the 9th sign-in request in a minute from one address is refused (8 allowed) — _400,400,400,400,400,400,400,400,429_
- otp-flood: the same for code guesses (8 a minute per address) — _400,400,400,400,400,400,400,400,429_

**Step 3 — signed-in people — each kind of action has its own limit (a different team member for each)**

- team-write (changes): the first 24 requests are let through
- team-write (changes): request 25 is refused with 429 and the policy's name — _429 team-write_
- team-write (changes): the answer carries Retry-After and a readable message — _60s · You're making changes too fast. Please wait 60 seconds._
- team-write: reading is not counted — 40 reads in a row are fine
- report: the first 12 requests are let through — _400,400,400,400,400,400,400,400,400,400,400,400_
- report: request 13 is refused with 429 and the policy's name — _429 report_
- report: the answer carries Retry-After and a readable message — _60s · Too many report requests. Please wait 60 seconds._
- pii-read: the first 12 requests are let through — _200,200,200,200,200,200,200,200,200,200,200,200_
- pii-read: request 13 is refused with 429 and the policy's name — _429 pii-read_
- pii-read: the answer carries Retry-After and a readable message — _60s · Too many customer lookups. Please wait 60 seconds._
- account-write: the first 3 requests are let through — _403,403,403_
- account-write: request 4 is refused with 429 and the policy's name — _429 account-write_
- account-write: the answer carries Retry-After and a readable message — _600s · Too many account changes. Please wait 10 minutes._
- secrets: the first 3 requests are let through — _400,400,400_
- secrets: request 4 is refused with 429 and the policy's name — _429 secrets_
- secrets: the answer carries Retry-After and a readable message — _600s · Too many settings changes. Please wait 10 minutes._
- upload: the first 6 requests are let through — _400,400,400,400,400,400_
- upload: request 7 is refused with 429 and the policy's name — _429 upload_
- upload: the answer carries Retry-After and a readable message — _600s · Too many uploads. Please wait 10 minutes._
- export: the first 1 requests are let through — _400_
- export: request 2 is refused with 429 and the policy's name — _429 export_
- export: the answer carries Retry-After and a readable message — _60s · Too many exports. Please wait 60 seconds._
- bulk-send: the first 2 requests are let through — _400,400_
- bulk-send: request 3 is refused with 429 and the policy's name — _429 bulk-send_
- bulk-send: the answer carries Retry-After and a readable message — _600s · Too many bulk messages started. Please wait 10 minutes._
- chat-send: the first 12 requests are let through — _400,400,400,400,400,400,400,400,400,400,400,400_
- chat-send: request 13 is refused with 429 and the policy's name — _429 chat-send_
- chat-send: the answer carries Retry-After and a readable message — _60s · You're sending messages too fast. Please wait 60 seconds._
- wa-link: the first 3 requests are let through — _400,400,400_
- wa-link: request 4 is refused with 429 and the policy's name — _429 wa-link_
- wa-link: the answer carries Retry-After and a readable message — _600s · Too many number changes. Please wait 10 minutes._
- hardware: the first 6 requests are let through — _400,400,400,400,400,400_
- hardware: request 7 is refused with 429 and the policy's name — _429 hardware_
- hardware: the answer carries Retry-After and a readable message — _60s · Too many print requests. Please wait 60 seconds._
- destructive: the first 2 requests are let through — _400,400_
- destructive: request 3 is refused with 429 and the policy's name — _429 destructive_
- destructive: the answer carries Retry-After and a readable message — _600s · Too many of these actions. Please wait 10 minutes._
- preview: the first 3 requests are let through — _400,400,400_
- preview: request 4 is refused with 429 and the policy's name — _429 preview_
- preview: the answer carries Retry-After and a readable message — _600s · Too many previews opened. Please wait 10 minutes._
- coins-code: the first 4 requests are let through — _400,400,400,400_
- coins-code: request 5 is refused with 429 and the policy's name — _429 coins-code_
- coins-code: the answer carries Retry-After and a readable message — _600s · Too many coin-code attempts. Please wait 10 minutes._
- api (a signed-in user): the first 150 requests are let through
- api (a signed-in user): request 151 is refused with 429 and the policy's name — _429 api_
- api (a signed-in user): the answer carries Retry-After and a readable message — _60s · You're sending requests too fast. Please wait 60 seconds and try again._

**Step 4 — the platform console (super admin)**

- outbound-fetch: the first 3 requests are let through — _400,400,400_
- outbound-fetch: request 4 is refused with 429 and the policy's name — _429 outbound-fetch_
- outbound-fetch: the answer carries Retry-After and a readable message — _600s · Too many lookups. Please wait 10 minutes._

**Step 5 — one visitor being limited never affects another**

- address A is over its coupon limit
- address B, at the same moment, is untouched
- a made-up address written in front of the real one doesn't give a fresh budget — _429_

**Step 6 — our own servers and the off switch**

- an address-keyed limit never applies to our own network (8 requests, none refused)
- …not even the general limit — _65 requests_
- (limits keyed on a store or an account don't look at the address at all)
- with RATE_LIMITS=off nothing is limited

**Step 7 — one account, guessed from many addresses**

- the 10th wrong password, from a new address each time, pauses the account — _401,401,401,401,401,401,401,401,401,429_
- …and even the RIGHT password is refused from a brand-new address while it is paused — _429 Too many failed attempts for this account. Try again in 60 seconds._
- …with a message that says what happened and how long
- another account is not affected — _200_
- an email that has no account behaves the same: 401 nine times, then paused — nothing is revealed — _401,401,401,401,401,401,401,401,401,429_
- the console's Security page sees the account (masked as o•••@acme.test), never the whole email — _o•••@acme.test_
- when the pause is over the right password works again — _200_
- …and signing in cleared the account's count
- the first pause is 1 minute, the second 5 minutes — _60s then 300s_

**Step 8 — live connections (WebSockets)**

- live-order connections: 3 attempts a minute per address, the next is refused with 429 and Retry-After — _401,401,401,429_
- another address is not affected (it is only asked to sign in)
- our own network is never limited by address — _401_
- a preview viewer connects — _101_
- a message bigger than the preview allows closes the connection (1009 message too big) — _1009_

**Step 9 — coverage — nothing that changes data is left without a limit of its own**

- the inventory sees the whole API — _280 routes, 161 change data_
- every route is under the general limit — except /health, which the server's own monitoring calls — _GET /health_
- every route that changes data has a limit of its own (or is on the short exempt list) — _none missing_
- the exempt list names only routes that exist
- every limit in the table is attached to at least one route — _all used_
- dashboard sign-in: flood limit + per-account guard
- asking for a code: flood + per address + per store + per phone number
- typing a code: flood limit (and the attempts-per-code and block-after-failures rules)
- the enquiry form: both of its public calls
- deleting and creating stores are in the destructive group
- customer lists and server snapshots are limited reads

**Step 10 — the doc**

- docs/api-rate-limiting.md exists
- it names every limit in the table — _all named_
- it lists the routes that are exempt, and why

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-19 16:30 | pass | 124 | 0 | headless | 9.2 s |
| 2026-11-19 15:50 | pass | 124 | 0 | headless | 8.6 s |
| 2026-11-19 13:35 | pass | 124 | 0 | headless | 9.1 s |
| 2026-11-19 13:27 | pass | 124 | 0 | headless | 8.8 s |
| 2026-11-19 13:07 | pass | 124 | 0 | headless | 9.0 s |
| 2026-11-19 12:47 | pass | 124 | 0 | headless | 9.6 s |
| 2026-11-19 12:44 | pass | 124 | 0 | headless | 7.6 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t28-rate-limits-api.mjs`), not this page._
