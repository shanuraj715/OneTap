# T23 — Message sending — codes by linked WhatsApp / WhatsApp Business / SMS, chosen by the owner

**Area:** notifications · **Last result:** ✅ PASSED (81 passed, 0 failed · 2026-11-21 13:23 · headless · 53.0 s)

**Run it alone:** `node run.mjs --only t23` (add `--visible` to watch it) · starts from fresh fake data

## What this test does

In Chrome as the owner of Acme Momos: Settings → Message sending offers four ways to send the sign-in code (linked WhatsApp, WhatsApp Business, SMS, don't send) and says which are ready and why not. Before anything is set up the customer is shown the code on screen. After the owner links a number and chooses it, a new customer signing up on the storefront gets the code on WhatsApp from the store's own number, in the store's own words — it is never shown on screen, 123456 no longer works, and a wrong code is refused. A number that isn't on WhatsApp is told so; with the number offline the customer is asked to try later (and is not shown the code). Then the same for an SMS gateway and for WhatsApp Business (the template, language and Copy-code button arrive at Meta exactly). Choosing a way that isn't set up is refused, a store without the plan features doesn't get the page, and choosing 'Don't send' brings back the on-screen code.

## Steps

1. The owner opens Settings → Message sending
2. Before any setup a new customer is shown the code on screen (as before)
3. The owner links a WhatsApp number and its connection comes online
4. The message can run over several lines
5. The Variables pop-up lists every variable and puts one where the cursor was
6. A variable that doesn't exist, or a message without {{code}}, can't be saved
7. A new customer asks for a code: it arrives on WhatsApp from the store's number
8. The customer who only got a code doesn't clutter the owner's WhatsApp inbox
9. A number that isn't on WhatsApp is told so
10. With the store's number offline the customer is asked to try later — and is not shown the code
11. Staff asking for a coin code use the same chosen way
12. SMS: set up the gateway, then choose it
13. WhatsApp Business: connection details, then a template for the code
14. A store whose plan has neither WhatsApp chat nor WhatsApp & SMS alerts
15. Back to 'Don't send': the on-screen code and 123456 return

## What to expect (these must happen)

- Settings has a 'Message sending' tab; it lists linked WhatsApp, WhatsApp Business, SMS and 'Don't send', with 'Ready' or 'Needs setting up' (and the reason) on each.
- Before the owner chooses anything, 'Don't send' is selected, a note says codes are not being sent yet, and a new customer is shown the code on screen.
- A way that isn't set up can't be chosen (its radio is disabled); the Save button stays off until something changes.
- Choosing linked WhatsApp with a connected number: the preview shows the store's own wording with a sample code; after saving and reloading it is still chosen.
- A new customer asks for a code: the screen says it was sent on WhatsApp, the store's number sends it to that customer's number in the store's own words, the code is NOT on screen, 123456 is refused, the real code signs them up.
- A number that isn't on WhatsApp is told so; with the store's number offline the customer is asked to try again later — and no code is shown or sent.
- SMS: once the gateway is set up it can be chosen; the gateway receives the code in the store's 'Code message' wording for the customer's number; the screen says by SMS.
- WhatsApp Business: a missing template name is refused with a clear message; with a template, Meta receives the template name, language, the code as {{1}} and (when ticked) in the Copy-code button, with the store's token.
- The message box takes several lines (Enter starts a new line), shows a live preview with the line breaks, and counts the characters.
- A 'Variables' button opens a pop-up listing all nine variables ({{code}}, {{store}}, {{outlet}}, {{name}}, {{phone}}, {{minutes}}, {{date}}, {{time}}, {{store_phone}}) with what each is and an example; Insert puts one where the cursor was and the list stays open; Done closes it.
- A variable that doesn't exist is called out by name and Save is off; so is a message without {{code}}; spaces and capitals inside the brackets are fine.
- The customer's WhatsApp message arrives as the same three lines, with their first name, the outlet, the store, the code and the minutes filled in.
- Staff asking a customer for a coin code use the same chosen way.
- 'Don't send' brings back the on-screen code and 123456.

## What must NOT happen

- A code must NOT be shown on screen, or accepted as 123456, once a real way of sending is chosen — even when that way is offline.
- A way that isn't ready must NOT be selectable.
- Line breaks typed in the message must NOT be lost in the preview, when saved, or in what the customer receives.
- A misspelt variable must NOT be saved (it would reach customers as raw {{text}}).
- A code must NOT be sent over a way other than the chosen one.
- The browser must NOT log JavaScript errors.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (81)

**Step 1 — The owner opens Settings → Message sending**

- Settings has a 'Message sending' tab
- it offers all four ways — _linked · business · SMS · don't send_
- 'Don't send' is chosen, and a note says codes are not being sent yet
- linked WhatsApp says why: no number is linked yet
- SMS and WhatsApp Business say what to set up
- linked, WhatsApp Business and SMS are all disabled (none set up)
- each of them shows 'Needs setting up'
- Save is off until something changes

**Step 2 — Before any setup a new customer is shown the code on screen (as before)**

- the code step opens and shows a 'dev code'
- it does not claim to have sent anything — _We sent a 6-digit code to 9811200001._

**Step 3 — The owner links a WhatsApp number and its connection comes online**

- the store has a linked number to switch on — _4 number(s)_
- linked WhatsApp now says Ready and can be chosen
- SMS and WhatsApp Business still say they need setting up
- choosing it shows the wording, a preview, and the number list
- the standard preview uses the store's name and a sample code — _Preview: 482915 is your Acme Momos verification code. It is valid for 10 minutes_
- Save is now on

**Step 4 — The message can run over several lines**

- pressing Enter starts a new line in the box (three lines typed)
- the preview shows the three lines, with the variables filled in — _"Hi Asha, welcome to \n482915 is your Acme Momos code.\nValid for 10 minutes."_
- a counter shows how long the message is

**Step 5 — The Variables pop-up lists every variable and puts one where the cursor was**

- a pop-up opens
- it lists all nine variables — _code, store, outlet, name, phone, minutes, date, time, store_phone_
- each says what it is and gives an example
- {{code}} is marked as required
- the button confirms it
- the pop-up closes
- {{outlet}} went in at the end of the first line — not at the start or the end of the message
- the preview shows it too — _"Hi Asha, welcome to Main\n482915 is your Acme Momos code.\nValid for 10 minutes."_

**Step 6 — A variable that doesn't exist, or a message without {{code}}, can't be saved**

- a misspelt variable is called out by name — _{{cod}} isn't a variable — pick from the Variables list (or check the spelling)._
- Save is off while it is wrong
- a message without {{code}} is refused with a clear reason, and Save is off
- spaces and capitals inside the brackets are fine — _"482915 for Acme Momos"_
- the three-line message is back, with no complaint
- saving works
- after a reload it is still the chosen way, with the same three lines

**Step 7 — A new customer asks for a code: it arrives on WhatsApp from the store's number**

- the screen says the code was sent on WhatsApp — _We sent a 6-digit code to 9811200002 on WhatsApp._
- did not happen: the code is shown on screen ('dev code')
- the store's number sent exactly one message, to the customer's number — _["919811200002@s.whatsapp.net"]_
- …in the store's own words: three lines, with the customer's first name, the outlet, the store, the code and the minutes filled in — _"Hi Linked, welcome to Main\n919057 is your Acme Momos code.\nValid for 10 minutes."_
- the test code 123456 is refused
- the real code signs the customer up

**Step 8 — The customer who only got a code doesn't clutter the owner's WhatsApp inbox**

- the owner's chat list does not contain that customer — _4 chats_

**Step 9 — A number that isn't on WhatsApp is told so**

- the customer is told the number isn't on WhatsApp
- did not happen: a code step opened, or a code was shown

**Step 10 — With the store's number offline the customer is asked to try later — and is not shown the code**

- the customer is asked to try again in a few minutes — _We can't send the code right now._
- did not happen: a code is shown on screen, or the code step opened
- nothing was sent
- the owner's page warns that the chosen number isn't connected
- …and linked WhatsApp stays the chosen way (nothing was switched behind their back)

**Step 11 — Staff asking for a coin code use the same chosen way**

- the coin code request is accepted — _200 {"sent":true}_
- the customer (Asha) got the code on WhatsApp from the store's number — _164058_
- 123456 is refused for coins too — _400_
- the code that was sent is accepted — _200_

**Step 12 — SMS: set up the gateway, then choose it**

- did not happen: the SMS settings still offer the old 'Send login & coin codes by SMS' switch
- SMS is now Ready and can be chosen
- its preview uses the 'Code message' set under Notifications → SMS
- saved
- the screen says the code was sent by SMS — _We sent a 6-digit code to 9811200004 by SMS._
- did not happen: the code is shown on screen
- the gateway was asked to text exactly that customer, with the store's key — _1 request(s)_
- …in the 'Code message' wording — _Code 495900 for Acme Momos_
- nothing went out over WhatsApp
- 123456 is refused
- the code from the SMS signs them up

**Step 13 — WhatsApp Business: connection details, then a template for the code**

- WhatsApp Business is now Ready
- without a template name it is refused with a clear reason — _Enter the name of your approved WhatsApp template._
- saved
- the screen says the code was sent on WhatsApp — _We sent a 6-digit code to 9811200005 on WhatsApp._
- did not happen: the code is shown on screen
- Meta was called once, on the store's phone-number ID, with the store's token — _1 call(s) /v20.0/109876543/messages_
- …to the customer's number, with the approved template and language — _"919811200005"_
- …the code fills {{1}} — _482582_
- …and also goes to the Copy-code button
- nothing went out over SMS or the linked number for this customer
- the code sent through Meta signs them up

**Step 14 — A store whose plan has neither WhatsApp chat nor WhatsApp & SMS alerts**

- the API refuses linked WhatsApp for that store — _409 WhatsApp chat isn't in this store's plan._
- …and SMS — _409_
- did not happen: Beta Bites' Settings tabs include 'Message sending'

**Step 15 — Back to 'Don't send': the on-screen code and 123456 return**

- a warning explains what 'Don't send' means
- saved
- the customer is shown the code on screen again
- 123456 signs them up again

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-21 13:23 | pass | 81 | 0 | headless | 53.0 s |
| 2026-11-21 04:49 | pass | 81 | 0 | headless | 55.5 s |
| 2026-11-20 11:13 | error | 53 | 0 | headless | 30.0 s |
| 2026-11-20 05:57 | pass | 81 | 0 | headless | 54.4 s |
| 2026-11-20 04:54 | pass | 81 | 0 | headless | 54.0 s |
| 2026-11-20 04:29 | pass | 81 | 0 | headless | 53.9 s |
| 2026-11-20 00:21 | pass | 81 | 0 | headless | 53.4 s |
| 2026-11-19 23:44 | pass | 81 | 0 | headless | 53.5 s |
| 2026-11-19 23:27 | pass | 81 | 0 | headless | 53.9 s |
| 2026-11-19 13:19 | pass | 81 | 0 | headless | 55.4 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t23-message-sending.mjs`), not this page._
