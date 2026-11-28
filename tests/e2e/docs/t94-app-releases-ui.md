# T94 — Console → App Management: choose an .apk, see the upload progress, publish it, make an update required, edit the notes, withdraw and delete

**Area:** app · **Last result:** ✅ PASSED (54 passed, 0 failed · 2026-11-28 13:48 · headless · 15.4 s)

**Run it alone:** `node run.mjs --only t94` (add `--visible` to watch it)

## What this test does

Runs suites/app-releases-ui.mjs in Chrome against the bench (the platform admin). The sidebar's 'App Management' opens an empty page that says no version is offered, updates are optional, and shows the download page's address. 'New version': Upload is off until a file and a version are given; a non-.apk and a file over the limit are refused at once, the version box is filled from the file name, a wrong format or a taken build number is explained and blocks the button, 'Update required' (with Publish now) warns that older phones will be blocked. On a slowed connection a progress bar counts up and 'Cancel upload' stops it and creates nothing; a whole 9 MB upload (3 pieces) ends with 'is live' and the version listed Published with its size, 0 downloads and notes; the server holds the file with its real size and SHA-256 and the website's list has it. A second version uploaded as a draft is invisible to phones, Publish offers it (optional), 'Required' makes it compulsory (the summary says everything older is stopped; an old build is refused at sign-in) and unticking undoes it. Notes can be edited and reach phones; Withdraw hides it and switches off its APK link; Publish again brings it back; the APK link downloads the exact file and the counter moves; 'File' shows the SHA-256; Delete asks first and removes the file. On a phone-sized screen nothing sticks out sideways.

## Steps

1. The page, with nothing uploaded yet
2. The 'New version' pop-up checks the file and the version before it lets anything go
3. Uploading shows its progress, and can be cancelled
4. A whole upload, published
5. A second version as a draft, then published, and made required
6. Notes, withdraw, download
7. Delete
8. On a phone-sized screen
9. Every app has its own tab, list and numbers

## What to expect (these must happen)

- Publish/withdraw/required changes on the page change what the phone is told at once.
- The upload shows progress, can be cancelled, and a cancelled upload leaves nothing behind.
- The APK link downloads exactly what was uploaded.

## What must NOT happen

- A non-APK, an oversized file, a malformed version or a taken build number must NOT be uploadable.
- A draft or withdrawn version must NOT be offered to phones or downloadable.
- No errors in the browser.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (54)

**Step 1 — The page, with nothing uploaded yet**

- the sidebar has an 'App Management' item that opens the page — _http://localhost:3171/platform/app-management_
- it says no version is being offered to phones
- and that updates are optional right now
- it shows the download page staff are sent to — _localhost:3173/app_

**Step 2 — The 'New version' pop-up checks the file and the version before it lets anything go**

- 'Upload and publish' is off until a file and a version are chosen
- a file that isn't an .apk is refused straight away
- a file over the size limit says so (with the limit) and can't be sent
- the version box is filled in from the file's name — _v-26.11.26-001_
- now the button is ready
- a version that isn't v-YY.MM.DD-NNN is explained and blocks the button
- fixing it clears the message
- no warning while 'Update required' is off
- ticking 'Update required' (with Publish now) warns that older phones will be blocked

**Step 3 — Uploading shows its progress, and can be cancelled**

- a progress bar says how much has been sent — _Sending 0 B of 9.0 MB 0%_
- 'Cancel upload' is offered while it is going
- the percentage climbs while it sends — _0% → 19%_
- cancelling creates nothing
- and the form is ready to try again

**Step 4 — A whole upload, published**

- it says it is live, and that staff may choose Later
- the version is listed: Published, its size, 0 downloads and its notes
- the summary now says phones are offered v-26.11.26-001
- the server holds the file with its real size and SHA-256 — _9437369 bytes_
- a phone already on build 1 is told nothing
- the website's list has it

**Step 5 — A second version as a draft, then published, and made required**

- a build number that is taken is refused with the version it clashes with
- the second one is listed as a Draft
- a draft is invisible to phones
- published: a phone on build 1 is offered it — optional
- the summary now offers v-26.11.26-002 and still says updates are optional
- ticking 'Required' makes the update compulsory for build 1
- the card is marked, and the summary says everything older than v-26.11.26-002 is stopped
- an old build is now turned away at sign-in (426) — _426_
- unticking it makes it optional again, on the page and for phones

**Step 6 — Notes, withdraw, download**

- edited release notes show on the card
- …and reach phones
- a withdrawn version vanishes for phones
- and its APK link is switched off
- the APK link downloads the file — _200 69864 bytes_
- the download counter shows on the card after the page is reloaded — _1 download_
- 'File' shows the SHA-256 and the file name

**Step 7 — Delete**

- it asks first, and says the version is published right now
- the version and its file are gone

**Step 8 — On a phone-sized screen**

- nothing sticks out sideways
- the card's buttons are still reachable

**Step 9 — Every app has its own tab, list and numbers**

- the page has a tab for each app (OMA is open first)
- the KDA tab does not show OMA's versions
- the pop-up names the app it is for
- the version is filled from the file name (new form)
- it appears in the KDA list, with build 1 (OMA has its own build 1)
- it is stored for KDA only
- the summary shows KDA's own download page (/apps/kda)
- back on the OMA tab: its own list and its own page (/apps/oma)
- a version in the OLD form is explained and blocks the upload
- no errors in the browser

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-28 13:48 | pass | 54 | 0 | headless | 15.4 s |
| 2026-11-28 13:36 | pass | 54 | 0 | headless | 15.9 s |
| 2026-11-28 13:35 | fail | 53 | 1 | headless | 15.5 s |
| 2026-11-28 03:10 | pass | 54 | 0 | headless | 16.0 s |
| 2026-11-27 16:46 | pass | 54 | 0 | headless | 15.8 s |
| 2026-11-27 16:33 | pass | 54 | 0 | headless | 23.6 s |
| 2026-11-26 22:05 | pass | 54 | 0 | headless | 15.7 s |
| 2026-11-26 20:09 | pass | 45 | 0 | headless | 14.8 s |
| 2026-11-26 19:26 | pass | 45 | 0 | headless | 14.4 s |
| 2026-11-26 19:01 | pass | 45 | 0 | headless | 14.5 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t94-app-releases-ui.mjs`), not this page._
