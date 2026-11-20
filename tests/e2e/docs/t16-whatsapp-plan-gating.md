# T16 — WhatsApp chat off (plan or per-store lock) — numbers unlinked at once, no WhatsApp requests, every WhatsApp address is a 404

**Area:** whatsapp · **Last result:** ✅ PASSED (37 passed, 0 failed · 2026-11-20 05:48 · headless · 36.3 s)

**Run it alone:** `node run.mjs --only t16` (add `--visible` to watch it) · starts from fresh fake data

## What this test does

In Chrome as the owner of Acme Momos (Pro plan, four linked/linkable numbers). First the baseline: WhatsApp is in the sidebar, the Numbers page shows the numbers, the dashboard talks to /api/whatsapp, and the browser's only websocket is the live order feed. Then the platform takes WhatsApp chat out of the Pro plan: at once the owner has no WhatsApp in the sidebar, every WhatsApp address (chats, numbers, broadcast, access, clean-up) shows a 404 in the middle of the page with the sidebar still there, and the browser sends no WhatsApp requests at all. When the feature comes back, the numbers are all 'Unlinked' (with the reason) and need linking again, while the chats and messages are still there. A lock for just this store behaves the same way and beats the plan.

## Steps

1. Baseline: WhatsApp chat is on for the Pro plan
2. The platform takes WhatsApp chat out of the Pro plan
3. The owner: no WhatsApp anywhere, and every WhatsApp address is a 404
4. WhatsApp chat comes back: every number was unlinked, the chats are still there
5. Locking WhatsApp chat for just this store beats its plan

## What to expect (these must happen)

- While WhatsApp chat is on: the sidebar has WhatsApp, Numbers lists the numbers, and the dashboard polls /api/whatsapp.
- The dashboard's only websocket is the live order feed (/realtime); WhatsApp chat never opens one in the browser.
- After the platform removes WhatsApp chat from the plan: no WhatsApp item in the sidebar; /whatsapp, /whatsapp/chats, /numbers, /broadcast, /access and /cleanup each show a '404 — Page not found' in the content area with the sidebar still visible and none of the chat screens.
- While it is off the browser sends NO request to /api/whatsapp.
- When the feature is switched back on, every number shows 'Unlinked' with the reason and a 'Link again' button, and the old chats are still listed.
- Locking WhatsApp chat for the one store does the same, even though its plan has it; setting it back to 'From plan' restores the menu.

## What must NOT happen

- A store without WhatsApp chat must NOT show the WhatsApp pages (not even by typing the address).
- A store without WhatsApp chat must NOT keep any number linked.
- The dashboard must NOT send any WhatsApp request while the feature is off.
- Chats and messages must NOT be deleted when the feature goes away.
- The browser must NOT log JavaScript errors.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (37)

**Step 1 — Baseline: WhatsApp chat is on for the Pro plan**

- WhatsApp is in the sidebar
- the Numbers page lists the linked numbers (Counter phone, Number 2, Number 3, New phone)
- Counter phone and Number 3 are connected — _Counter phone Connected +91 90000 00001 · Acme Momos · today: 4/15 new co_
- the dashboard talks to /api/whatsapp while it is on — _4 requests_
- the browser's only websocket is the live order feed (/realtime) — WhatsApp chat doesn't open one — _ws://localhost:3097/realtime?outletId=6aff91b89d30a48c6bc25ac0_
- did not happen: a websocket for WhatsApp is opened by the browser

**Step 3 — The owner: no WhatsApp anywhere, and every WhatsApp address is a 404**

- WhatsApp is gone from the sidebar
- /whatsapp → 404 in the middle of the page
- …and the sidebar is still there (/whatsapp)
- did not happen: …and no chat screen shows (/whatsapp)
- /whatsapp/chats → 404 in the middle of the page
- …and the sidebar is still there (/whatsapp/chats)
- did not happen: …and no chat screen shows (/whatsapp/chats)
- /whatsapp/numbers → 404 in the middle of the page
- …and the sidebar is still there (/whatsapp/numbers)
- did not happen: …and no chat screen shows (/whatsapp/numbers)
- /whatsapp/broadcast → 404 in the middle of the page
- …and the sidebar is still there (/whatsapp/broadcast)
- did not happen: …and no chat screen shows (/whatsapp/broadcast)
- /whatsapp/access → 404 in the middle of the page
- …and the sidebar is still there (/whatsapp/access)
- did not happen: …and no chat screen shows (/whatsapp/access)
- /whatsapp/cleanup → 404 in the middle of the page
- …and the sidebar is still there (/whatsapp/cleanup)
- did not happen: …and no chat screen shows (/whatsapp/cleanup)
- did not happen: the browser sent any request to /api/whatsapp while the feature was off
- did not happen: a websocket for WhatsApp is open

**Step 4 — WhatsApp chat comes back: every number was unlinked, the chats are still there**

- WhatsApp is back in the sidebar
- every number says 'Unlinked' — _4 of 4_
- did not happen: a number still says Connected
- the reason is shown on the cards
- each can be linked again
- the old chats are still listed (nothing was deleted)

**Step 5 — Locking WhatsApp chat for just this store beats its plan**

- WhatsApp is not in the sidebar of a store it is locked for
- its chat address is a 404
- back to 'from plan' (the plan has it) → WhatsApp is back
- did not happen: the browser logged JavaScript errors

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-20 11:04 | pass | 37 | 0 | headless | 35.8 s |
| 2026-11-20 05:48 | pass | 37 | 0 | headless | 36.3 s |
| 2026-11-20 05:13 | pass | 37 | 0 | headless | 36.5 s |
| 2026-11-20 04:45 | error | 33 | 0 | headless | 55.6 s |
| 2026-11-20 04:20 | pass | 37 | 0 | headless | 35.6 s |
| 2026-11-20 00:13 | pass | 37 | 0 | headless | 35.6 s |
| 2026-11-19 12:34 | pass | 37 | 0 | headless | 35.7 s |
| 2026-11-19 11:14 | pass | 37 | 0 | headless | 35.2 s |
| 2026-11-19 01:12 | pass | 37 | 0 | headless | 35.9 s |
| 2026-11-18 17:41 | pass | 37 | 0 | headless | 35.9 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t16-whatsapp-plan-gating.mjs`), not this page._
