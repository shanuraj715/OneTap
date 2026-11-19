# T24 — Message sending — API rules: codes by linked WhatsApp / WhatsApp Business / SMS, never stored, never shown, capped, plan-gated

**Area:** notifications · **Last result:** ✅ PASSED (61 passed, 0 failed · 2026-11-19 11:19 · headless · 32.9 s)

**Run it alone:** `node run.mjs --only t24` (add `--visible` to watch it)

## What this test does

Runs suites/msg-api.mjs: its own in-memory API with the WhatsApp worker on and WhatsApp's connection (and an SMS gateway and Meta) replaced by stand-ins. Covers choosing and refusing a way to send codes, a code going out over each way, what is stored (the code never), who stays out of the inbox, the daily cap, a number that isn't on WhatsApp, a number that is offline, staff coin codes, plan rules, and a store that turned SMS codes on the old way.

## Steps

1. before anything is chosen
2. choosing a way that can't send is refused
3. linked WhatsApp
4. 3b. the message — several lines and variables
5. problems
6. SMS
7. WhatsApp Business
8. staff coin codes and plan rules
9. a store that turned SMS codes on the old way keeps working

## What to expect (these must happen)

- Before anything is chosen the code is shown on screen (as it always was).
- A way that can't send (no connected number, no gateway, no template, message without {{code}}, plan lacks it) is refused with a reason; 'Don't send' is always allowed; only managers of notifications can change it.
- The message can run over several lines and use nine variables ({{code}}, {{store}}, {{outlet}}, {{name}}, {{phone}}, {{minutes}}, {{date}}, {{time}}, {{store_phone}}): all are filled in, the line breaks reach WhatsApp as typed, a customer we know is greeted by the name on file, a typed name that isn't a plain name becomes 'there', a variable that doesn't exist is refused by name, 1000 characters is the limit; an SMS 'Code message' can use them too.
- Over linked WhatsApp the code goes out from the store's number in seconds, in the store's wording, and is not returned to the caller; 123456 stops working.
- The stored WhatsApp message never contains the code; the stranger's chat stays out of the inbox (and appears once the store really chats with them); a failed code can't be retried from the inbox.
- SMS goes through the gateway in the 'Code message' wording; WhatsApp Business reaches Meta with the template, language, code in {{1}} and (when ticked) the Copy-code button.
- With several numbers connected each code goes out from one of them picked at random (16 customers at once use both); a number that is offline is never picked.
- A number that isn't on WhatsApp is told so; past the daily cap nothing more goes out; with the number offline the customer is asked to try later.
- Staff coin codes use the chosen way.
- A store that switched on SMS codes before this existed keeps them until its owner chooses something.

## What must NOT happen

- A code must NOT be returned to the caller, or accepted as 123456, once a real way is chosen — even when that way is offline.
- The code must NOT be kept in any stored WhatsApp message.
- A stranger who only got a code must NOT appear in the owner's WhatsApp inbox.
- A code must NOT be sent from a number that is offline.
- More codes than the daily cap must NOT go out.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (61)

**Step 1 — before anything is chosen**

- a store that never chose sends nothing and shows the code on screen — _screen_
- linked WhatsApp says why it can't be chosen yet, and the page knows the store's name — _No WhatsApp number is linked yet — link one under WhatsApp → Numbers._
- the sign-in screen still gets the code (as before)

**Step 2 — choosing a way that can't send is refused**

- linked WhatsApp with no connected number is refused — _409 No WhatsApp number is linked yet — link one under WhatsApp → Numbers._
- SMS with no gateway is refused — _409 Your SMS gateway isn't set up yet — add its details under Notifications → SMS._
- WhatsApp Business without a template name is refused — _400 Enter the name of your approved WhatsApp template._
- a message without {{code}} is refused
- an unknown way is refused
- only people allowed to manage notifications can change it (a manager can't)
- …but a manager can read it

**Step 3 — linked WhatsApp**

- linked WhatsApp can be chosen once a number is online
- the request is answered 'sent' and the code is NOT returned — _{"channel":"sms","sent":true,"via":"linked","resendAfterSec":30}_
- the code went out over the linked number, to the right person — _919876543210@s.whatsapp.net_
- …in the store's own words — _Your Acme code: 887331_
- …within seconds — _1258 ms_
- the stored message says a code was sent — never the code itself — _🔒 Verification code_
- the code is nowhere in any stored WhatsApp message
- the stranger's chat is hidden, and sending the code didn't count as a conversation — _{"hidden":true}_
- …so the owner's chat list doesn't show them
- a failed code can't be re-sent from the inbox — _404_
- the test code 123456 no longer works once codes are really sent — _400_
- the code that was sent signs the customer up — _200_
- when the store starts a real chat with that customer… — _201_
- …they show up in the inbox

**Step 4 — 3b. the message — several lines and variables**

- a four-line message using every variable is saved exactly as typed (line breaks kept) — _200_
- every variable is filled in, the four lines arrive as four lines
- …the line breaks reach WhatsApp as typed
- a customer we already know is greeted by the name on file, not by what was typed into the form — _Hi Asha_
- a typed name that isn't a plain name (a link, digits, nothing) is replaced by 'there'; an accented name is kept — _["Hi there","Hi there","Hi there","Hi there","Hi Zoë"]_
- a variable that doesn't exist is refused, naming the ones that are wrong
- spaces and capitals inside the brackets are fine, blank lines too — _200_
- a message longer than 1000 characters is refused — _400_
- (the earlier wording is put back for the checks below)
- a code goes out at once even with 30 broadcast messages queued ahead of it — _200 in 2051 ms_
- …while the broadcast keeps waiting for its own slow pace
- 16 customers ask for a code at once with two numbers online — all are sent — _200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200_
- the codes were spread over BOTH connected numbers (picked at random) — _{"919000000002":8,"919000000001":10}_
- …and each customer got exactly one code
- a number that is offline is never picked — _919000000001_

**Step 5 — problems**

- a number that isn't on WhatsApp is told so — _502 That number isn't on WhatsApp. Use a number that is._
- past the daily cap no more codes go out (the number is protected from a flood) — _502 Too many codes have been sent today. Please try again later._
- with the number offline the customer is asked to try later — and is NOT shown the code — _502 We can't send the code right now. Please try again in a few minutes._
- nothing else was sent
- …and 123456 does not let them in — _400_

**Step 6 — SMS**

- the owner sets up the SMS gateway
- SMS can now be chosen
- the code goes through the gateway in the 'Code message' wording — _200 Code 457116 for Acme_
- an SMS 'Code message' can use the same variables — _466708 is your Acme code, there (Main)_

**Step 7 — WhatsApp Business**

- the owner adds the WhatsApp Business connection
- WhatsApp Business can now be chosen, with a template
- Meta receives the template, language and number — _200 /v20.0/109876543/messages_
- …with the code in {{1}} and in the Copy-code button
- without the button ticked only the body carries the code

**Step 8 — staff coin codes and plan rules**

- coin codes need a customer who has coins (a number that never ordered has none) — _404_
- a staff coin code uses the chosen way too (SMS here) — _200_
- a store whose plan lacks WhatsApp chat can't choose linked WhatsApp — _409 WhatsApp chat isn't in this store's plan._
- …nor SMS or WhatsApp Business (WhatsApp & SMS alerts) — _409_
- …but 'Don't send' is always allowed

**Step 9 — a store that turned SMS codes on the old way keeps working**

- with no choice saved, the old 'codes by SMS' switch still counts: SMS — _{"m":"sms","e":false}_
- …and codes still go out by SMS
- once the owner chooses 'Don't send' that wins over the old switch

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-19 11:19 | pass | 61 | 0 | headless | 32.9 s |
| 2026-11-19 01:23 | pass | 47 | 0 | headless | 8.9 s |
| 2026-11-19 01:21 | pass | 47 | 0 | headless | 7.9 s |
| 2026-11-19 00:59 | pass | 45 | 0 | headless | 6.1 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t24-message-sending-api.mjs`), not this page._
