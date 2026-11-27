# T120 — Staff apps (OMA, KDA, RDA): the live connection — who may listen, what they are told, who is let go (server side)

**Area:** apps · **Last result:** ✅ PASSED (48 passed, 0 failed · 2026-11-27 16:11 · headless · 24.0 s)

**Run it alone:** `node run.mjs --only t120` (add `--visible` to watch it)

## What this test does

Runs suites/app-live-api.mjs against a private API on an in-memory database with the realtime hub attached; real WebSocket clients play the apps.

## Steps

- _(set-up)_
1. Who may listen
2. What an app is told — never the data
3. Several changes at once are one message; other stores and outlets hear nothing
4. Tables, dishes — and a dish that goes out of its hours
5. People who must be let go
6. The platform's switch for live updates
7. A quiet line is not a dead line

## What to expect (these must happen)

- An app connects with its Bearer sign-in (a rider with the rider's token) and gets the same role / outlet / paused-store checks as its ordinary calls.
- An app is told only 'changed: orders / tables / menu / deliveries', only its own kinds, only for its own outlet; a burst of changes is one message.
- A change made by any code (straight through the models) reaches the apps; a dish going out of its hours is noticed by the clock watcher.
- A signed-out person, a rider whose PIN was reset or who was switched off, and a paused store's team are let go; the platform's switch ends every connection (4410) and new ones are refused (503).

## What must NOT happen

- No name, phone, dish, price or order id ever travels over an app's connection.
- A waiter must NOT be able to listen as the kitchen app, or an editor as OMA.
- The dashboard's own live connection (cookie, full events) must NOT change.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (48)

**Set-up — Setup**

- set-up: a waiter, a cook, an editor, another store's waiter and a rider can sign in to their apps

**Step 1 — Who may listen**

- a waiter's OMA connects with the same Bearer sign-in its other calls use, and is greeted
- a cook's KDA connects
- a rider's RDA connects with the rider's own token (no outlet needed: the token knows it)
- a waiter can NOT listen as the kitchen app (the kitchen permission is checked): 403
- an editor (no right to see orders) can NOT listen as OMA: 403
- nobody signed in, or a made-up token: 401
- the rider app with no token or a forged one: 401
- an unknown app name, or no outlet: 400
- another store's outlet is refused (403)
- …and another store's waiter can't listen to this one (403)
- the dashboard's own connection (session cookie, no app) works exactly as before
- …and a Bearer token alone does NOT open a dashboard connection (apps must say which app they are)

**Step 2 — What an app is told — never the data**

- the dashboard still receives the full order event (data inside)
- an app never receives it
- an order written to the database (by ANY code) tells OMA and KDA 'orders' and RDA 'deliveries' — _orders \| orders \| deliveries_
- each app hears only its own kinds of change (the rider isn't told about orders, the kitchen not about tables)
- nothing the apps received holds a name, a phone, a dish, a price or an order id
- a message is exactly { type: 'changed', what: [...], at }

**Step 3 — Several changes at once are one message; other stores and outlets hear nothing**

- six writes within a moment reach OMA as ONE message — _1 messages_
- another store's app, and another outlet's app of the same store, hear nothing
- …not even a stray event

**Step 4 — Tables, dishes — and a dish that goes out of its hours**

- a table written → OMA hears 'tables' (the kitchen and the rider do not)
- a party seated at it (a table-session write) → 'tables' again
- a dish added in the dashboard → OMA and KDA hear 'menu' — _orders,orders,tables,tables,menu \| orders,orders,menu_
- …the rider does not
- changing a dish → they hear 'menu' again
- looking again with nothing changed sends nothing
- when the clock passes the dish's serving hours — no write at all — OMA and KDA are told 'menu' — _1 new for OMA_

**Step 5 — People who must be let go**

- a second rider connects
- a rider whose PIN was reset is let go at once (close 4401) — _4401_
- …the other rider's connection stays
- a rider switched off is let go at once too
- …and can't connect again (403, 'switched off')
- (a fresh waiter connection)
- a waiter who signs out has the live connection ended at the next check (close 4401) — _4401_
- …while the cook's stays
- (a fresh cook connection)
- the platform switches the store off
- the team's apps are cut off at once (close 4403) — _4403_
- …and can't reconnect while it is off (403)

**Step 6 — The platform's switch for live updates**

- (a connection while live updates are on)
- switching live updates off lets every connection go (close 4410: 'ask on a timer') — _4410_
- …and a new connection is refused with 503 while it is off
- switched on again: apps can connect again with nothing else to do

**Step 7 — A quiet line is not a dead line**

- (a fresh connection)
- within about 20 seconds an app gets a 'tick', so it can tell silence from a dead connection
- the server counts exactly the apps still connected — _2 counted, 2 open_

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-27 16:11 | pass | 48 | 0 | headless | 24.0 s |
| 2026-11-27 16:11 | fail | 47 | 1 | headless | 23.0 s |
| 2026-11-27 16:10 | fail | 19 | 1 | headless | 5.6 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t120-app-live-api.mjs`), not this page._
