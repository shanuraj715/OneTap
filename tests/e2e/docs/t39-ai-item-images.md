# T39 — AI dish pictures — keys added in the platform console, a sparkles button on the dish row (super admin only), shape and count chosen in a pop-up, pictures saved to the dish

**Area:** menu · **Last result:** ✅ PASSED (32 passed, 0 failed · 2026-11-21 00:20 · headless · 19.5 s)

**Run it alone:** `node run.mjs --only t39` (add `--visible` to watch it) · starts from fresh fake data

## What this test does

In Chrome as the platform admin: the console has an 'AI pictures' page where two Gemini keys are added (one named Primary, one 'quota-…' that the stand-in Google will say has used up its limit); each shows only a masked hint and a Ready state, Test says Google accepted the key, and the model is switched to Nano Banana 2 Lite. Then Stores → Acme Momos → Open store dashboard → Menu → Steamed Momos: every dish row has a ✦ button. Pressing it on 'Veg Steamed Momos' opens a pop-up with the five shapes (1:1, 4:3, 3:2, 16:9, 3:4) and 1–4 pictures; 16:9 and 3 are chosen and 'Make 3 pictures' pressed — a 'Making…' message shows, then three new pictures appear in the pop-up, and the dish now has them. The stand-in Google was asked three times for 16:9 with the chosen model and a description naming the dish and saying it's vegetarian; the quota key was tried once and is now Resting in the console with its reason, and all three pictures came from the Primary key. The pop-up stops at the room left on a dish (6 pictures). Signed in as the store's owner: the same Menu page has NO sparkles button on any dish, the console's AI page isn't theirs, and the API refuses their request. Finally the keys can be removed.

## Steps

1. The platform admin adds two Gemini keys
2. Opening Acme Momos' dashboard as the platform admin: every dish has a ✦ button
3. The pop-up asks for the shape and how many pictures
4. Square, three pictures (a dish holds up to six square ones; the other shapes hold one each)
5. What Google was asked, and what the dish has now
6. The pop-up stops at the room left on a dish
7. The key that hit its limit is resting
8. A store owner never sees any of it
9. Removing the keys again

## What to expect (these must happen)

- The console has an AI pictures page: keys are added with a name, shown only as a masked hint with a state, can be tested, and the model can be chosen.
- Only when the platform admin has opened a store's dashboard does every dish row have a sparkles button.
- The pop-up asks for the shape (five choices) and how many pictures (1–4, never more than the dish has room for) before anything is made; the chosen shape and count are what Google is asked for.
- The new pictures show in the pop-up and on the dish; a key that reports its limit is rested in the console and the pictures are made on the other key.
- A store owner never sees the sparkles button and can't use the API.

## What must NOT happen

- A store owner or their team must NOT see the AI button, the AI page, or a key.
- An API key must NOT be visible anywhere after it is saved (only its first and last characters).
- The pop-up must NOT offer more pictures than the dish has room for.
- The browser must NOT log JavaScript errors.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (32)

**Step 1 — The platform admin adds two Gemini keys**

- with no key yet, the page says so
- both keys are listed, each Ready
- a key is shown only as its first and last characters, never in full — _AIza••••aaaa_
- the key box is empty again after adding
- Test says Google accepted the key
- the model can be chosen

**Step 2 — Opening Acme Momos' dashboard as the platform admin: every dish has a ✦ button**

- every dish row has the sparkles button — _4 buttons on 4 rows_

**Step 3 — The pop-up asks for the shape and how many pictures**

- it names the dish and how many of its six square pictures are used
- five shapes are offered — _1:1 4:3 3:2 16:9 3:4_
- 1 to 4 pictures can be chosen — _1,2,3,4_
- nothing is made yet (Google has not been asked)

**Step 4 — Square, three pictures (a dish holds up to six square ones; the other shapes hold one each)**

- the button says what it will make
- while it works, the pop-up says so and can't be cancelled
- three new pictures are shown
- each picture really loads
- it says which key made them
- and that the Backup key reached its limit so another key was used automatically

**Step 5 — What Google was asked, and what the dish has now**

- Google was asked for three pictures, all 1:1, with the chosen model
- each description names the dish and says it is vegetarian
- all three pictures came from the Primary key
- the Backup key was tried once, said its limit was used up, and was left alone after that — _1 try_
- the dish now has three more pictures — _3_
- they are WebP files on this server, and open
- the dish row now shows a picture

**Step 6 — The pop-up stops at the room left on a dish**

- with 3 pictures, only 3 more can be chosen — _3 enabled_

**Step 7 — The key that hit its limit is resting**

- Backup shows Resting, with Google's reason
- Primary shows the three pictures it made and is Ready

**Step 8 — A store owner never sees any of it**

- the owner sees the dishes but no sparkles button on any of them
- …and no AI pop-up trigger anywhere on the page
- the API refuses the owner too (403 for making pictures and for the key list) — _403/403_
- Google was not asked again

**Step 9 — Removing the keys again**

- both keys can be removed

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-21 00:20 | pass | 32 | 0 | headless | 19.5 s |
| 2026-11-21 00:19 | error | 11 | 0 | headless | 39.7 s |
| 2026-11-21 00:18 | error | 10 | 1 | headless | 39.8 s |
| 2026-11-21 00:13 | error | 10 | 1 | headless | 39.5 s |
| 2026-11-20 11:14 | pass | 32 | 0 | headless | 18.9 s |
| 2026-11-20 06:02 | pass | 32 | 0 | headless | 19.3 s |
| 2026-11-20 04:59 | pass | 32 | 0 | headless | 19.2 s |
| 2026-11-20 02:15 | pass | 32 | 0 | headless | 19.3 s |
| 2026-11-20 00:26 | pass | 32 | 0 | headless | 19.1 s |
| 2026-11-19 19:47 | pass | 32 | 0 | headless | 19.5 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t39-ai-item-images.mjs`), not this page._
