# T93 — App Management: the platform admin uploads an APK in pieces and publishes it (optionally forcing an update); phones ask 'is there a newer version?'; old builds are turned away at sign-in when an update is forced

**Area:** app · **Last result:** ✅ PASSED (98 passed, 0 failed · 2026-11-28 03:11 · headless · 6.6 s)

**Run it alone:** `node run.mjs --only t93` (add `--visible` to watch it)

## What this test does

Runs suites/app-releases-api.mjs on a private API with an in-memory database and a temporary folder for the files (no browser). Only the platform admin can manage releases. An upload is split into 4 MB pieces (a wrong piece, a repeated piece, a missing piece, a too-big file, a non-.apk, a zip with no AndroidManifest.xml, a bad version and a repeated build number are all refused with clear words; pieces can arrive out of order and be re-sent). A finished upload is a draft with the file's real size and SHA-256 on disk; drafts are invisible to phones and the website. Publishing: a phone on an older build is told a newer one exists (optional), a forced release makes the update REQUIRED for every older build — including one that skipped it and sees a later optional release — with what's new listed newest first; a phone on the newest build, a newer build, or with no build number is told nothing. A forced update turns old builds away at app sign-in (426 update_required, before any password is checked) while newer builds, older apps that send no number and the dashboard sign-in are unaffected. The APK downloads byte for byte with a clear name, supports resuming (byte ranges) and counts a download once; withdrawn/draft/made-up addresses are 404. The website's list shows only published releases, newest first, with no internal fields. Notes/force/status can be changed (reaching phones at once); delete removes the file.

## Steps

1. Setup: the platform admin, a store owner and a waiter
2. Only the platform admin manages releases
3. An upload is checked before it is accepted
4. The finished upload becomes a release
5. A draft is invisible to phones and the website
6. Publishing, and who is told what
7. A forced update also turns old builds away at sign-in
8. Downloading the APK
9. The website's list
10. Managing releases
11. 9b. More than one app: each has its own versions, build numbers and 'required' rule
12. The files follow the storage chosen in the console: a bucket instead of the disk
13. Nothing is left lying around

## What to expect (these must happen)

- A phone on an older build is told about a newer release; a forced one makes it required for every older build (even ones that skipped it).
- An old build is refused at sign-in (426) only while a forced update is out.
- The uploaded APK downloads byte for byte; drafts and withdrawn releases don't.

## What must NOT happen

- A non-APK, an oversized file or a repeated build number must NOT become a release.
- A phone with an unknown build must NOT be told to update or blocked.
- A store owner or a waiter must NOT be able to manage releases.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (98)

**Step 2 — Only the platform admin manages releases**

- a store owner cannot see the release list — _403_
- a waiter cannot see the release list — _403_
- nobody signed in cannot see the release list — _401_
- …nor start an upload
- the platform admin can

**Step 3 — An upload is checked before it is accepted**

- a file that isn't an .apk is refused up front
- an empty/tiny file is refused
- a file over the size limit is refused (413) before anything is sent — _That file is too big. The most allowed is 20 MB._
- the server splits a 9 MB file into 3 pieces of 4 MB — _3 pieces_
- a piece number outside the file is refused
- a piece of the wrong length is refused (it must be exactly 4 MB)
- a piece for an upload that doesn't exist: 404
- piece 1 is accepted
- …and sending it AGAIN is harmless (a retry after a dropped connection)
- finishing with pieces missing is refused and says which are missing — _2 pieces of the file didn't arrive. Upload again to resume._
- the last (short) piece is accepted — out of order is fine (resume)
- and piece 2
- a version that isn't v-DDMMYY-NNN is refused

**Step 4 — The finished upload becomes a release**

- the release is created; its build number is read from the version — _201 build 1_
- saved as a draft, with the file's real size and SHA-256 — _9437171 bytes_
- the file is in the platform storage (this disk, by default), under app-releases/oma/ — _app-releases/oma/v-26.11.26-001-e090db329f0a.apk_
- …and the scratch folder for uploads in progress holds no finished file
- a version (build number) that already exists can't be uploaded again — _Version v-26.11.26-001 (build 1) already exists. Each build number can be used once._
- a file that isn't an APK is refused when it is finished — _That file isn't an APK (it isn't a zip archive)._
- a zip without an AndroidManifest.xml is refused too
- …and neither left a release behind

**Step 5 — A draft is invisible to phones and the website**

- no release is published yet: nothing to update to
- a draft can't be downloaded
- and is not on the website's list

**Step 6 — Publishing, and who is told what**

- version 2 is published as it is uploaded — _published_
- a phone on build 1 is told 002 is available — optional, not forced — _true force=false_
- with the website page to go to (this app's own: /apps/oma) — _https://site.example.test/apps/oma_
- and the file's size, fingerprint and download address — _59864 bytes_
- a phone already on build 2 is told nothing
- a phone on a NEWER build (a test build) is told nothing
- a phone that does not say which build it is on is never told to update (the server can't judge it)
- version 3 is FORCED: a phone on build 2 must update — _force=true_
- a phone on build 1 must too — and sees what changed in BOTH newer versions, newest first — _v-26.11.26-003,v-26.11.26-002_
- a phone already on the forced build is free to go
- a later OPTIONAL release doesn't cancel an earlier forced one: a phone that skipped 003 must still update — _force=true_
- a phone on 003 (past the forced one) gets only the optional 004

**Step 7 — A forced update also turns old builds away at sign-in**

- build 2 is refused at sign-in with 426 'update_required' and the page to update from — _426 update_required_
- …before any password is looked at (a wrong password gets the same answer)
- build 3 signs in normally
- a build that sends no number (older app) signs in normally
- the dashboard's sign-in is not affected

**Step 8 — Downloading the APK**

- the file downloads, byte for byte what was uploaded (no sign-in needed) — _59864 bytes_
- as an Android package, with a clear file name — _attachment; filename=rasoi-pulse-oma-v-26.11.26-002.apk_
- and can resume after a dropped connection (byte ranges)
- and is never kept by a cache (a withdrawn version stops at once) — _no-cache_
- a byte range gives exactly those bytes (206) — _206_
- the download counter counted the full download once, not the resumed part — _downloads 1_
- a made-up download address: 404

**Step 9 — The website's list**

- newest first, and only the PUBLISHED releases (all four are published by now) — _v-26.11.26-004,v-26.11.26-003,v-26.11.26-002,v-26.11.26-001_
- no internal fields (who uploaded, the stored file name) are shown
- each has a full download address, its SHA-256 and size

**Step 10 — Managing releases**

- notes and the force switch can be changed after publishing
- …and the change reaches phones at once (003 is now below a forced 004)
- a WITHDRAWN release disappears from the phones' view (003 is the newest again)
- …and can't be downloaded
- taking the force off 003 lets build 2 carry on (still offered the update)
- a bad status is refused; an unknown release is 404
- the console's list: newest first, the rule in force (none now) and the piece size — _forcedBelow null_
- with 003 forced again the list says: apps older than v-26.11.26-003 must update
- a release can be deleted
- …and its file goes from the storage too
- …and from the list

**Step 11 — 9b. More than one app: each has its own versions, build numbers and 'required' rule**

- the new form is v-YY.MM.DD-NNN; the old v-DDMMYY-NNN is still READ (what is published keeps working) but is no longer accepted for a new version
- an app's page address is /apps/<app>
- a NEW version in the old form is refused, with the new form named — _Use a version like v-26.11.27-003 (v-YY.MM.DD-NNN)._
- a file uploaded for one app can't be published as another — _This file was uploaded for Rasoi Pulse KDA, not Rasoi Pulse OMA._
- an unknown app is refused
- a Kitchen-app version can use build 1 although OMA already has a build 1 (every app counts for itself) — _1_
- …and the OMA list does not show it
- the console's list for KDA: its own two versions, newest first, its own 'required below' rule — _v-26.11.28-002,v-26.11.27-001_
- each app has its own page address: /apps/kda and /apps/oma — _https://site.example.test/apps/kda_
- a Kitchen-app phone on build 1 must update to ITS latest, and is sent to its own page — _v-26.11.28-002_
- (the OMA answer is its own)
- an unknown app in the check is refused
- the website's list is per app too
- /api/app-updates/apps lists every app with its newest version and page — _oma:v-26.11.26-003 kda:v-26.11.28-002 rda:undefined_
- a Kitchen-app file downloads under its own name
- an old Kitchen-app build is turned away at sign-in with ITS page, while OMA is judged only by OMA's releases — _426_

**Step 12 — The files follow the storage chosen in the console: a bucket instead of the disk**

- the platform storage is switched to a bucket
- the finished upload lands in the bucket, under app-releases/oma/ — _app-releases/oma/v-26.11.26-020-1a9e494a6e42.apk_
- byte for byte, with the Android package type
- nothing was kept on this server's disk
- the download comes from the bucket, byte for byte
- with the same name, type, range support and no-cache as from the disk
- a byte range is answered with 206 from the bucket (an interrupted download can resume)
- the download counter counts it once
- withdrawn: the API stops serving it at once (the bucket's own address is never given out)
- a file that has gone missing from the bucket is a clear 404, not a crash — _404_
- when the bucket refuses, finishing answers 502 and says where it failed
- …and no release is recorded
- after the fix, finishing the SAME upload works without sending anything again
- deleting a release deletes its file from the bucket

**Step 13 — Nothing is left lying around**

- unfinished uploads (the refused ones) stay as parts to be cleared after a day — finished ones are gone — _5 parts_

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-28 03:11 | pass | 98 | 0 | headless | 6.6 s |
| 2026-11-28 03:10 | fail | 95 | 3 | headless | 6.3 s |
| 2026-11-27 16:46 | pass | 98 | 0 | headless | 6.9 s |
| 2026-11-26 22:04 | pass | 98 | 0 | headless | 4.7 s |
| 2026-11-26 22:03 | error | 0 | 0 | headless | 0.7 s |
| 2026-11-26 20:08 | pass | 82 | 0 | headless | 4.7 s |
| 2026-11-26 19:25 | pass | 67 | 0 | headless | 6.0 s |
| 2026-11-26 19:00 | pass | 66 | 0 | headless | 4.3 s |
| 2026-11-26 18:54 | pass | 66 | 0 | headless | 4.1 s |
| 2026-11-26 18:54 | pass | 66 | 0 | headless | 4.1 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t93-app-releases-api.mjs`), not this page._
