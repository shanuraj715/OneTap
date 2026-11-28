# T95 — Website → /app: the staff app's download page shows the latest published version, its notes and every version, and follows publish / withdraw / required in seconds

**Area:** app · **Last result:** ✅ PASSED (37 passed, 0 failed · 2026-11-28 15:39 · headless · 3.9 s)

**Run it alone:** `node run.mjs --only t95` (add `--visible` to watch it)

## What this test does

Runs suites/app-releases-website-ui.mjs in Chrome against the bench API and the marketing website on :3173 (built from the current code into .bench/website and started by the suite if needed — never touching apps/website/.next). With nothing published the page says so, offers no download, still explains the app and the install steps, has a titled tab and asks search engines not to list it. Publishing a version (through the console's API) makes a 'Download v-…' button appear that points at the API's download address, shows Android 11+ and the file size, puts the version and its notes on a receipt-style ticket and in a 'Every version' list marked Latest; the button's file is byte-for-byte the upload. A required version gets a 'Required' stamp and pill, the list is newest first with each version's own notes, and 'Check the file' reveals the SHA-256. Withdrawing a version and uploading a draft change nothing public except that the withdrawn one disappears (and its file 404s). On a 390 px screen nothing sticks out sideways. A website page can't be created at /app (reserved).

## Steps

1. Nothing is published yet
2. A published version appears
3. A required version
4. Drafts and withdrawn versions stay hidden
5. A phone-sized screen
6. 5b. The old address and the pages of the other apps
7. /app and /apps can't be taken by a website page

## What to expect (these must happen)

- The page follows publish / withdraw / required within seconds, without a rebuild.
- The download button's file is exactly what was uploaded.
- Required versions are visibly marked; the SHA-256 can be checked.

## What must NOT happen

- A draft or withdrawn version must NOT be shown or downloadable.
- The page must NOT be indexed by search engines.
- No errors in the browser; nothing off the edge on a phone.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (37)

**Step 1 — Nothing is published yet**

- the page says no version has been published
- and offers no download button
- and no version list
- the page still introduces the app
- and still explains how to install
- the browser tab has a title that names the app — _Rasoi Pulse OMA, Order Management App · Rasoi Pulse_
- the page asks search engines not to list it

**Step 2 — A published version appears**

- the download button names the version
- …and points at the API's download address — _http://localhost:3097/api/app-updates/download/6b0aa8527ffdeabc9bc46bdc_
- it says Android 11 or newer and the file's size — _58 KB_
- the ticket shows the version and its release notes
- no 'Required' stamp on an optional version
- the button's file is exactly the uploaded APK
- the version list has it, marked Latest

**Step 3 — A required version**

- the button now offers v-26.11.26-002
- its ticket carries a 'Required' stamp
- the list has both versions — _2_
- newest first: 002, marked Latest and Required
- 001 below it, with neither mark
- each keeps its own notes
- 'Check the file' shows the file's SHA-256 — _25f9f39a2a2f…_

**Step 4 — Drafts and withdrawn versions stay hidden**

- withdrawing 002 hides it, and the draft 003 was never shown; 001 is the latest again
- so the 'Required' stamp is gone too
- and the withdrawn file can't be downloaded

**Step 5 — A phone-sized screen**

- nothing sticks out sideways
- the download button fits the screen — _251 px wide_
- and so does the ticket — _24 → 366_

**Step 6 — 5b. The old address and the pages of the other apps**

- /app (the address the first apps were given) redirects to /apps/oma — _308 /apps/oma_
- /apps/kda is the Kitchen app's own page: its name, who it is for and ITS version (not OMA's)
- its tab title and install text name the Kitchen app
- its download button works
- /apps lists every app with its newest version
- each app links to its own page
- a page for an app that doesn't exist says it couldn't find that page (like every unknown address on the site) and offers no download
- the index page asks search engines not to list it

**Step 7 — /app and /apps can't be taken by a website page**

- creating a page called 'apps' in the console is refused — _"/apps" is used by the website itself — pick another address._
- no errors in the browser

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-28 15:39 | pass | 37 | 0 | headless | 3.9 s |
| 2026-11-28 15:32 | pass | 37 | 0 | headless | 18.1 s |
| 2026-11-28 14:15 | pass | 37 | 0 | headless | 4.0 s |
| 2026-11-28 14:01 | pass | 37 | 0 | headless | 1.8 s |
| 2026-11-28 13:48 | pass | 37 | 0 | headless | 1.6 s |
| 2026-11-28 13:36 | pass | 37 | 0 | headless | 13.5 s |
| 2026-11-28 03:10 | pass | 37 | 0 | headless | 2.3 s |
| 2026-11-27 16:57 | pass | 37 | 0 | headless | 2.2 s |
| 2026-11-27 16:47 | pass | 37 | 0 | headless | 18.0 s |
| 2026-11-27 11:06 | pass | 37 | 0 | headless | 18.9 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t95-app-releases-website-ui.mjs`), not this page._
