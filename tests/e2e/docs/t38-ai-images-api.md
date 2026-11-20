# T38 — AI dish pictures — several Gemini keys used in turn, only the super admin can use them, and what is made is saved to the dish

**Area:** menu · **Last result:** ✅ PASSED (82 passed, 0 failed · 2026-11-20 06:01 · headless · 4.1 s)

**Run it alone:** `node run.mjs --only t38` (add `--visible` to watch it)

## What this test does

Runs suites/ai-images.mjs: its own in-memory API plus a STAND-IN for Google's server (nothing real is called or billed). Only the platform's super admin can see or add keys or make a picture — a store owner, the kitchen and someone signed out get 401/403 and Google is never called. Keys are added with a name, kept encrypted (only a masked hint comes back), refused if duplicated, and can be tested for free (a model-list call, key in a header never the address), paused, renamed and removed. A request is checked before anything is spent (shape offered, 1–4 pictures, room left on the dish: at most six). The pictures are made at the same time, each on a different key and from a different angle, asked for in the chosen shape and model, described from the dish (name, vegetarian, section) or from the text the super admin typed; each is compressed to WebP, stored in the store's own folder without a domain, and added after the dish's existing pictures. Successive single requests rotate across keys (the one used longest ago first) and paused keys are never used. A key that has used up its quota rests 10 minutes and one Google refuses rests a day — the picture is still made on another key, the next request skips the resting key, and with every key resting the answer says so and Google isn't called. A safety refusal or a words-only answer is explained and punishes no key; one picture failing keeps the others. If the newer Google interface answers 'not found' the older one is used.

## Steps

1. only the platform's super admin
2. adding keys
3. testing, pausing and removing a key
4. one picture
5. several pictures — at once, on different keys, from different angles
6. spreading the work across keys over time
7. a key that has used up its limit is skipped — the picture is still made
8. a key Google refuses
9. every key at its limit
10. when Google won't make it, or is busy
11. the older Google interface is the fallback
12. the limits
13. the description you type is used
14. however Google says 'limit reached', the next key takes over — and the key rests for as long as Google said

## What to expect (these must happen)

- Only the super admin can manage keys or make pictures; others are refused and Google is not called.
- Keys are encrypted at rest, only a masked hint is shown, duplicates are refused, and a key can be tested, paused, renamed and removed.
- Several pictures are made at once on different keys, in the chosen shape and model, and are saved (WebP, domain-free, in the store's folder) after the dish's existing pictures.
- Requests rotate over the keys; a key over its quota or refused by Google is set aside and the picture is made on another key; with every key resting the answer says so.
- Requests that can't work (bad shape, 0 or 5 pictures, no room, another outlet's dish) are refused before anything is spent.

## What must NOT happen

- A store owner or anyone else must NOT be able to see a key, add one or make a picture.
- An API key must NOT appear in any response, in a URL, or in plain text in the database.
- A resting or paused key must NOT be called.
- A refusal from Google's safety filter must NOT rest a key or save anything.
- A dish must NOT get more than six pictures.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (82)

**Step 1 — only the platform's super admin**

- the super admin sees an empty setup with the default model — _200 gemini-nano-banana-2.1_
- a store owner can neither see the keys, add one, nor make a picture — _403/403/403_
- the kitchen can neither see the keys, add one, nor make a picture — _403/403/403_
- someone not signed in can neither see the keys, add one, nor make a picture — _401/401/401_
- …and Google was never called for them

**Step 2 — adding keys**

- something that isn't a key is refused — _400 That doesn't look like a Gemini API key (they are one long word with no spaces)._
- a key can be added with a name
- the answer carries only a masked hint, never the key — _AIza••••xxxx_
- in the database the key is encrypted
- the same key can't be added twice — _That key is already in the list._
- three keys are in the list
- the model can be chosen
- a model name with odd characters is refused

**Step 3 — testing, pausing and removing a key**

- a good key tests fine (a free model-list call, no picture)
- the key travels in a header, never in the address — _?pageSize=1_
- a refused key says so and remembers it — _Google rejected this API key._
- a key can be paused
- …and switched on again, or renamed
- a key can be removed
- removing one that isn't there is a 404

**Step 4 — one picture**

- a picture is made and added to the dish
- Google was asked for the chosen model and shape (16:9) — _{"type":"image","aspect_ratio":"16:9","image_size":"1K"}_
- the request describes the dish: its name, that it's vegetarian, its section
- one of the saved keys was used, in a header
- the picture was compressed to WebP, stored in the store's own folder, and saved without a domain — _/uploads/6aff94fa42fa739c9e4c98bc/6aff94fa42fa739c9e4c98bf/m_
- …and the menu hands out a full address — _http://localhost:3101/uploads/6aff94fa42fa739c9e4c_
- the file opens

**Step 5 — several pictures — at once, on different keys, from different angles**

- three pictures are made — _200 added 3_
- …at the same time, not one after another (3 × 0.4 s took under 1.1 s) — _488 ms_
- …each on a DIFFERENT key — _2_,4_,1__
- …and each asked for from a different angle, so they aren't copies
- all in the chosen shape (4:3)
- the dish now has four pictures — _4_

**Step 6 — spreading the work across keys over time**

- two single-picture requests in a row use two different keys (the one used longest ago goes first) — _{"Main account":3,"Second account":2,"Third":1}_
- paused keys are never used

**Step 7 — a key that has used up its limit is skipped — the picture is still made**

- all three pictures are made even though one key is over its limit — _200 []_
- that key now rests, with the reason shown — _cooling · Google says this key's quota or rate limit is used up._
- it was tried exactly once — that is how its limit was found
- the next request doesn't even try the resting key
- testing the keys again ends their rest

**Step 8 — a key Google refuses**

- all three pictures are made on the other keys — _200_
- the refused key is set aside, with Google's reason — _Google rejected this API key._
- …for a long time (it won't work until someone fixes it) — _24 h_

**Step 9 — every key at its limit**

- with every key used up the answer says so (429) — _Google says this key's quota or rate limit is used up. (Main account)_
- nothing was saved
- the next try doesn't bother Google while they all rest, and says when they're back
- once the keys are tested again it works

**Step 10 — when Google won't make it, or is busy**

- a refusal is explained in plain words — _Google's safety filter would not make this picture. Change the description and try again._
- a text-only answer is explained in plain words
- nothing was saved, and no key was punished for it
- one picture failing doesn't lose the others: 2 saved, 1 reported
- the two that worked are on the dish

**Step 11 — the older Google interface is the fallback**

- when the newer interface answers 'not found', the older one makes the picture — _200_
- …with the same shape and description — _/v1beta/models/gemini-3.1-flash-lite-image:generateContent_

**Step 12 — the limits**

- a shape that isn't offered is refused — _400_
- a count of 0 is refused
- a count of 5 is refused
- a count of 1.5 is refused
- a dish that doesn't exist is a 404
- a dish of ANOTHER outlet can't be reached through this one
- none of those cost anything (Google wasn't called)
- a dish with six pictures can't take more — _This dish already has 6 pictures. Remove one first._
- asking for more than fit is refused before anything is spent — _Only 1 more picture fits (a dish can have 6)._
- …and exactly the room left works
- the pictures the dish already had are kept, in order

**Step 13 — the description you type is used**

- an edited description is sent as typed (one picture, so no angle added)

**Step 14 — however Google says 'limit reached', the next key takes over — and the key rests for as long as Google said**

- a limit reported as HTTP 403 with 'quota' in the words: the picture is still made, on another key (the limited key was tried once) — _200  tried 1_
- …and the answer says which key was switched away from, and which made the picture — _{"rested":["Main account"],"used":["Second account"]}_
- …that key rests 10 minutes — _600 s_
- a limit that says 'retry in 40 s': the picture is still made, on another key (the limited key was tried once) — _200  tried 1_
- …and the answer says which key was switched away from, and which made the picture — _{"rested":["Main account"],"used":["Third"]}_
- …that key rests about as long as Google said — _45 s_
- a per-DAY limit: the picture is still made, on another key (the limited key was tried once) — _200  tried 1_
- …and the answer says which key was switched away from, and which made the picture — _{"rested":["Main account"],"used":["Third"]}_
- …that key rests for hours (a daily limit) — _21600 s_
- a plain limit with no hint (429): the picture is still made, on another key (the limited key was tried once) — _200  tried 1_
- …and the answer says which key was switched away from, and which made the picture — _{"rested":["Main account"],"used":["Second account"]}_
- …that key rests 10 minutes — _600 s_
- a key whose Google project can't make pictures (billing off): the picture is still made, on another key (the limited key was tried once) — _200  tried 1_
- …and the answer says which key was switched away from, and which made the picture — _{"rested":["Main account"],"used":["Third"]}_
- …that key rests for a day — _86400 s_
- with TWO keys at their limit the third carries the whole batch, and both are reported — _{"rested":["Main account","Second account"],"used":["Third"]}_

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-20 06:01 | pass | 82 | 0 | headless | 4.1 s |
| 2026-11-20 04:59 | pass | 82 | 0 | headless | 4.0 s |
| 2026-11-20 02:15 | pass | 82 | 0 | headless | 5.1 s |
| 2026-11-20 00:26 | pass | 82 | 0 | headless | 4.2 s |
| 2026-11-19 19:46 | pass | 82 | 0 | headless | 4.3 s |
| 2026-11-19 19:46 | fail | 81 | 1 | headless | 4.6 s |
| 2026-11-19 19:31 | pass | 66 | 0 | headless | 4.0 s |
| 2026-11-19 19:23 | pass | 66 | 0 | headless | 4.3 s |
| 2026-11-19 19:23 | fail | 64 | 2 | headless | 4.4 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t38-ai-images-api.mjs`), not this page._
