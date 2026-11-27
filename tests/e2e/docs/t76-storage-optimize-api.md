# T76 — Storage — find the pictures bigger than the size limit and compress the chosen ones; every stored address follows

**Area:** platform · **Last result:** ✅ PASSED (73 passed, 0 failed · 2026-11-21 16:14 · headless · 7.1 s)

**Run it alone:** `node run.mjs --only t76` (add `--visible` to watch it)

## What this test does

Runs suites/storage-optimize-api.mjs on its own in-memory API. Real noisy pictures (a 920 KB JPEG, a 1.6 MB PNG, a tiny WebP, an already-squeezed 10 KB JPEG, 400 KB of random bytes) go through the real compressor. Scan: lists only pictures the stores USE that are over the saved 'Target max size' (not small ones, not unused files, not chat attachments), biggest first, with store / outlet / kind / where / a working address; totals and 'will free at least'; looking changes nothing; with no size limit it says so and nothing can be started; only listed pictures can be chosen. Optimize: runs in the background, saves each as a NEW file (new name, WebP, within the saved dimensions), points the dish picture's address + key + width + height and a logo saved with an old domain at it, leaves another site's picture alone, deletes the big originals (or keeps them when asked), and the new picture really opens as image/webp. A file that isn't a picture is reported with the reason and left untouched. A store owner's edit made while it runs is never overwritten (conditional apply). Only one run at a time and never together with a move; cancel; a job whose server died is marked interrupted. A picture that can't get smaller is left alone, remembered, and not offered again until the compression settings change. With a bucket in use, pictures there are optimized there.

## Steps

1. nothing to show before a scan, and only the platform's super admin can use it
2. the scan lists the pictures the stores use that are over the size limit — and changes nothing
3. no size limit set → nothing counts as too big; and only listed pictures can be chosen
4. optimizing: compressed with the saved settings, the addresses follow, the big originals go
5. 'keep the originals' keeps them
6. a file that isn't a picture is reported and left exactly as it was
7. a store owner's edit made while this runs is never overwritten
8. one run at a time, and it never runs together with a move
9. a picture that can't get smaller is left alone and not offered again
10. with a bucket (Cloudflare R2 / S3) in use, pictures there are optimized there

## What to expect (these must happen)

- Pictures over the limit are listed with their store, outlet and kind; small, unused and chat files are not.
- Optimizing makes smaller new files, switches every stored address/key/size to them and deletes the originals only when asked.
- Failures and 'can't get smaller' pictures are left exactly as they were.

## What must NOT happen

- Scanning must NOT change any file or stored address.
- A store owner's change made while it runs must NOT be overwritten.
- A picture from another website, a chat attachment or an unused file must NOT be touched.
- It must NOT run together with a move, nor twice at once.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (73)

**Step 1 — nothing to show before a scan, and only the platform's super admin can use it**

- before any scan there is no list
- optimizing without a scan is refused: 'scan first' — _409_
- a store owner can't use GET /storage/optimize — _403_
- a store owner can't use GET /storage/optimize/scan — _403_
- a store owner can't use POST /storage/optimize/scan — _403_
- a store owner can't use POST /storage/optimize — _403_
- nor can someone who isn't signed in — _401_

**Step 2 — the scan lists the pictures the stores use that are over the size limit — and changes nothing**

- it uses the size limit saved in Image compression (250 KB) — _256000_
- exactly the 4 used pictures over the limit are listed — _4 listed_
- pictures under the limit are not listed
- a big file that nothing uses is not listed (it isn't shown to anyone)
- a chat attachment is not listed (those are kept exactly as they were sent)
- the biggest come first
- …starting with the 1.6 MB logo — _1621604_
- each picture says its store, outlet, kind and where it is — _{"b":"Acme","o":"Main","k":"menu-items","w":"local"}_
- a logo belongs to the store, not to an outlet — _Store-wide/logos_
- each has an address the grid can show
- …and it really opens — _200_
- totals: how many are over and how big they are together — _4 / 3873206_
- 'will free at least' = what each loses to get down to the limit — _2849206_
- pictures in use: 6 (the other two files aren't used by anyone / are chat files) — _6_
- the settings it will use are shown
- looking changed nothing: not a file, not a stored address
- the page can ask for the last scan again without scanning

**Step 3 — no size limit set → nothing counts as too big; and only listed pictures can be chosen**

- with no 'Target max size' the scan says so and lists nothing
- …and nothing can be started — _409_
- a picture the scan didn't list (small, unused, or just a name made up) can't be optimized — _400_
- choosing nothing is refused — _400_
- …and the files are still there

**Step 4 — optimizing: compressed with the saved settings, the addresses follow, the big originals go**

- starting answers at once and works in the background
- the job finishes by itself: 2 optimized, none failed
- the pictures went from ~2.5 MB to a fraction of it — _2542605 → 345938_
- 5 stored values were updated (address, key, width, height of the dish picture + the logo) and the 2 big originals deleted — _5 / 2_
- the dish picture is a NEW file (new name, so no cache shows the old one) in the same folder, as WebP
- its stored address is the new one, still without a domain
- its width/height now describe the new picture (800 × 600) — _800×600_
- a picture from another website is left alone
- the logo's address (saved long ago with another domain) is now the new file, in the stored form — _/uploads/6b0175fb1973ee4e47046b3c/store/logos/7ee8ac34-ba14-421e-9224-20bccb664f77.webp_
- the big originals are gone from the disk
- the new file is a real 800 px WebP under the limit — _142288 B webp 800_
- so is the logo — _203650 B_
- …and it opens from its new address as image/webp — _200 image/webp_
- a picture that wasn't chosen was not touched
- after it, those two are no longer on the list — _2_
- the page can show the finished job

**Step 5 — 'keep the originals' keeps them**

- optimized, nothing deleted
- the store uses the new, small file
- the original is still on the disk (it keeps using the space)
- …and since nothing uses it any more it isn't offered again

**Step 6 — a file that isn't a picture is reported and left exactly as it was**

- the job says it finished with problems
- the problem names the file and says why
- the file and the address are untouched

**Step 7 — a store owner's edit made while this runs is never overwritten**

- the plan is: address, key, width, height of that one picture — _4_
- that document is left alone — their change stays, nothing half-written — _{"changed":0,"skipped":1}_
- with nothing changed in between, it is applied — _{"changed":4,"skipped":0}_

**Step 8 — one run at a time, and it never runs together with a move**

- while one runs, another can't be started — _409_
- cancel asks the running job to stop — _true_
- cancelling something that isn't running says so
- while files are being moved, optimizing is refused — _409_
- …and while pictures are being optimized, a move is refused — _409_
- a job whose server died is marked interrupted, not 'running' for ever — _interrupted_

**Step 9 — a picture that can't get smaller is left alone and not offered again**

- with a tighter limit the already-squeezed picture is over it — _limit 8192, file 10343_
- re-compressing it would make it BIGGER, so it is counted as 'already as small as possible'
- the file and the addresses are untouched
- the next scan doesn't list it again (it says how many it skipped) — _settled 1_
- …until the compression settings change: then it may get smaller, so it is offered again

**Step 10 — with a bucket (Cloudflare R2 / S3) in use, pictures there are optimized there**

- the picture in the bucket is listed as being in the cloud, with its bucket address — _cloud_
- the scan says which storage it looked at — _S3-compatible storage · media_
- pictures still on this server's disk are listed too, as being on the disk
- optimized in the bucket and the big original deleted from it
- the bucket now holds the new file and not the old one
- the address is the new bucket address
- it is a small WebP with the right content type — _142288 B image/webp_

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-27 16:46 | pass | 73 | 0 | headless | 12.7 s |
| 2026-11-21 16:14 | pass | 73 | 0 | headless | 7.1 s |
| 2026-11-21 16:06 | pass | 73 | 0 | headless | 6.8 s |
| 2026-11-21 16:05 | pass | 73 | 0 | headless | 6.9 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t76-storage-optimize-api.mjs`), not this page._
