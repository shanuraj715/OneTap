# T02 — WhatsApp chat — API rules and the careful-pace sending worker

**Area:** whatsapp · **Last result:** ✅ PASSED (132 passed, 0 failed · 2026-11-18 17:29 · headless · 10.4 s)

**Run it alone:** `node run.mjs --only t02` (add `--visible` to watch it)

## What this test does

Runs suites/wa-api.mjs: its own in-memory API with the WhatsApp worker switched on and WhatsApp's connection replaced by a stand-in. Covers who can use chat, linking numbers, chats and sending, the pacing rules, incoming messages, broadcasts, order updates, clear/delete, colours, stats, sharing chats between numbers, clean-up by age, deleting a message for everyone, and what happens when a store loses WhatsApp chat (numbers unlinked at once, connections closed, waiting messages failed).

## Steps

1. who can use it
2. linking numbers
3. chats and sending
4. the worker sends — at a careful pace
5. incoming messages
6. broadcasts
7. order updates
8. clear and delete
9. colours, stats, sharing chats out, cleanup, delete for everyone
10. a real link QR from WhatsApp's servers (nothing is linked)
11. WhatsApp chat taken away from a store — its numbers are unlinked and nothing stays connected

## What to expect (these must happen)

- By default only the owner can use WhatsApp chat; the owner can hand access to other roles (read / send); super admin can see chats.
- Numbers link by QR, can be given an alias and colour, and a chat keeps going out through the number it started on.
- If a chat's number is offline the owner is offered another number, and the choice becomes that chat's number from then on.
- New (cold) numbers are messaged slowly: minutes apart, daily caps, quiet hours; existing chats go out at normal speed with a short typing delay.
- Broadcasts go to each customer once, reuse the number of an existing chat, add 'Reply STOP', and skip anyone who opted out.
- Order-status updates go out from the linked numbers when switched on.
- Chats / messages can be cleared by age or date; deleting a message can also delete it for everyone on WhatsApp.
- A session's keys are stored encrypted and read back intact.
- When a store loses WhatsApp chat (its plan lacks it, a lock for the store, or the plan is edited) every one of its numbers is unlinked at once, the worker closes the connections, and waiting messages are failed; stored chats are kept.

## What must NOT happen

- A role without access must NOT read or send chats.
- A new number must NOT be sent more than the daily cap or outside quiet hours.
- An opted-out customer must NOT receive broadcasts.
- One store's chats / numbers must NOT be visible to another store.
- Stored session keys must NOT be readable as plain text.
- A store without WhatsApp chat must NOT keep any connection to WhatsApp open.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (132)

**Step 1 — who can use it**

- the owner can do everything — _manage_
- a manager can't, until the owner allows it
- …nor a cashier
- the owner gives managers 'read and reply' and cashiers 'read'
- the manager now reads and replies
- the cashier now only reads
- only the owner changes who has access
- only the owner links numbers
- the platform super admin can read
- a store whose plan lacks it is told so — _WhatsApp chat isn't included in your plan._
- another store's owner can't read this store's chats

**Step 2 — linking numbers**

- linking a number starts as 'waiting for the scan' — _pending_
- a number needs a name
- both show as online, with their names
- a number can be renamed
- a linked number must be unlinked before it's removed
- people who aren't the owner never see a link QR

**Step 3 — chats and sending**

- a number that can't be a phone is refused
- a 10-digit number becomes an Indian one — _919876543210_
- the same number written differently opens the same chat
- a read-only role can't send
- an empty message is refused
- a first message to a new number is queued as a first contact (paced) — _queued cold_
- the chat is given a number automatically — _Counter phone_
- …and a follow-up before anything was actually sent is still a first contact
- its number offline → 409 that names the numbers that ARE online — _Counter phone isn't connected right now._
- sending again from the other number works
- …and that number becomes the chat's number from now on
- (earlier queued messages stay with the number they were written on) — _2_
- moving a chat to another number takes its waiting messages along
- with no number online, a brand-new chat can't start
- an attachment uploads — _http://localhost:3098/uploads/6afd930e7b99fda52e60_
- a photo with a caption is queued
- a read-only role can't upload

**Step 4 — the worker sends — at a careful pace**

- one message goes out, to the right number — _919876543210@s.whatsapp.net_
- …after showing 'typing…'
- …and is marked sent, with WhatsApp's id saved first
- the next first contact must wait 2–4 minutes — _155 s_
- so the next queued first-contact message does NOT go out yet
- a reply to someone who wrote to us is a running conversation
- …and goes out straight away, ahead of the waiting first contacts
- 15 first contacts a day per number: the rest wait for tomorrow — _2026-11-19T03:35:16.650Z_
- a number that isn't on WhatsApp is never messaged — _This number isn't on WhatsApp._
- a failed message can be tried again
- a photo goes out as a photo, with its caption, read back from storage

**Step 5 — incoming messages**

- a customer's message opens a chat on the number they wrote to, unread, with their WhatsApp name
- the same message delivered twice is kept once
- a message addressed by WhatsApp's private id is matched to the real phone number
- group chats are ignored
- a reply typed on the phone itself shows in the dashboard too
- WhatsApp's echo of our own message isn't recorded twice
- old history the phone hands over when linking isn't replayed
- 'STOP' opts them out of offers
- the unread filter finds them — _[1,2]_
- the super admin reading doesn't clear the store's unread badge
- …but can read the messages — _3_
- the store's own team reading does
- search by name
- search by number

**Step 6 — broadcasts**

- only the owner sends broadcasts
- preview: 3 people (duplicates merged), 1 opted out
- a broadcast queues one message per person
- every one says how to stop offers
- the opted-out customer gets nothing
- someone with a chat gets it from that chat's number
- new people are spread across the online numbers
- nobody here has written to us, so all are paced as first contacts
- cancelling removes what hadn't gone yet

**Step 7 — order updates**

- accepted → the default message, paced as an order update — _Hi Meera, your order #0042 at Acme Momos is Accepted. Total ₹350._
- ready → the store's own wording
- a status that isn't switched on sends nothing
- switched off sends nothing
- the setting saves with the outlet's notification settings
- an order's status change (the real notification path) queues the WhatsApp update — _Hi Dev, your order #0043 at Main is Ready. Total ₹120._
- …only for the statuses the outlet switched on
- the dashboard gets the number of chats with unread messages (for the menu badge) — _1_

**Step 8 — clear and delete**

- clear empties the chat but keeps it
- a single message can be deleted
- a read-only role can't delete chats
- delete removes the chat
- unlink asks the worker to log the number out

**Step 9 — colours, stats, sharing chats out, cleanup, delete for everyone**

- every number gets its own colour — _#2E7D32 #1565C0 #C62828 #6A1B9A_
- the owner can pick a colour
- …a real colour only
- …and only the owner
- stats: chats per number — _Counter phone=60, Delivery phone=40, Number 3=0, Number 4=0_
- …how many of them wrote to us, and unread — _40 replied, 1 unread_
- stats are the owner's
- preview: share evenly → 25 each, 50 chats move — _Counter phone 60→25, Delivery phone 40→25, Number 3 0→25, Number 4 0→25_
- a preview changes nothing
- …or empty numbers 1 and 2 into 3 and 4, 50 / 50 — _Counter phone 60→0, Delivery phone 40→0, Number 3 0→50, Number 4 0→50_
- only linked numbers can take chats
- sharing out: every number now has 25 chats — _25,25,25,25_
- people who never wrote move first (all 34 of them moved), active conversations stay put as far as possible — _34 of the 50 moved never wrote_
- running it again moves nothing
- a message waiting to go out moves with its chat
- a moved chat remembers which number the customer was talking to
- …so the new number's first message to them is paced as a first contact (ban safety) — _cold_
- a chat that stayed on its number carries on at normal speed
- the chat list carries each chat's number colour
- if the customer writes to the old number, the chat follows them back to it
- cleanup preview: 2 messages older than 30 days, in 1 chat (a message still waiting is never removed) — _{"scope":"messages","messages":2,"chats":1}_
- a date in the future is refused
- cleanup is the owner's
- old messages removed, the waiting one and the chat kept
- whole chats quiet since a date, for one number — _24 chats_
- …removed, other numbers' chats untouched
- only our own recent sent messages offer 'delete for everyone'
- a customer's message can't be deleted for everyone
- nor one older than 48 hours
- deleting for everyone is handed to the worker
- the worker asks WhatsApp to delete it for everyone — _{"delete":{"remoteJid":"919810000061@s.whatsapp.net","fromMe":true,"id":"WAID-1"}}_
- …and it shows as deleted
- when the customer deletes theirs for everyone, it shows as deleted here too
- 'delete for me' removes it from the dashboard only

**Step 10 — a real link QR from WhatsApp's servers (nothing is linked)**

- a session's keys are stored encrypted — _creds,pre-key-1_
- …and read back intact (what lets a number stay linked after a restart)

**Step 11 — WhatsApp chat taken away from a store — its numbers are unlinked and nothing stays connected**

- the worker closes (and logs out) the connection of a store whose plan lacks WhatsApp chat
- …the number shows as unlinked, with the reason
- …and what was waiting to go out is failed, not left to leak out later
- a store that has WhatsApp chat is left alone
- the platform locks WhatsApp chat for one store — _200_
- …its number is unlinked AT ONCE (no waiting for the worker) — _logged_out wantsLogout=true_
- …and its waiting messages are failed at once
- …then the worker closes the connection and logs the phone out
- …and the card keeps the reason
- a store on a plan that has WhatsApp chat keeps its number
- the platform takes WhatsApp chat out of that plan — _200_
- …every store on it is unlinked AT ONCE
- …and its connection is closed
- the stored messages are kept
- the number stays unlinked when the feature returns — it must be linked again with a new scan — _logged_out_

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-18 17:29 | pass | 132 | 0 | headless | 10.4 s |
| 2026-11-18 17:20 | pass | 132 | 0 | headless | 10.6 s |
| 2026-11-18 16:59 | pass | 132 | 0 | headless | 12.9 s |
| 2026-11-18 14:53 | pass | 132 | 0 | headless | 10.3 s |
| 2026-11-18 14:19 | pass | 132 | 0 | headless | 12.5 s |
| 2026-11-16 03:05 | pass | 133 | 0 | headless | 13.8 s |
| 2026-11-16 02:14 | pass | 118 | 0 | headless | 12.3 s |
| 2026-11-16 01:57 | pass | 133 | 0 | headless | 11.9 s |
| 2026-11-16 01:39 | pass | 118 | 0 | headless | 14.3 s |
| 2026-11-16 00:52 | pass | 118 | 0 | headless | 13.1 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t02-whatsapp-api.mjs`), not this page._
