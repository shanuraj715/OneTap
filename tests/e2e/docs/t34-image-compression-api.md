# T34 — Pictures are compressed and optimised on the server when uploaded — size, shape, rotation, privacy, limits and settings

**Area:** storage · **Last result:** ✅ PASSED (32 passed, 0 failed · 2026-11-19 19:30 · headless · 10.3 s)

**Run it alone:** `node run.mjs --only t34` (add `--visible` to watch it)

## What this test does

Runs suites/image-compression.mjs: its own in-memory API. Real image files are generated and uploaded through POST /api/storage/upload, then the stored file is fetched back and inspected. A 24-megapixel JPEG at quality 95 (~19 MB) becomes a ~300 KB WebP of 1600 px on its long side; a photo the phone saved sideways comes out upright; hidden metadata (author, camera, location) is stripped; a small picture is never enlarged; a logo keeps its transparent background; very grainy detail that quality alone can't shrink under the 400 KB target is made smaller (not below 640 px) until it fits; a 225-megapixel 'pixel bomb' is shrunk safely in well under 10 s and the server stays healthy; a picture over 268 megapixels, a non-image, an empty body and a file over 30 MB are refused; people not signed in or without menu rights can't upload; five 19 MB photos at once all succeed; and the platform's compression settings (size, quality, format, target KB) are what the next upload follows — only the platform owner can change them, within the allowed ranges.

## Steps

1. a very high-quality photo is made small
2. phone photos: rotation and private metadata
3. small pictures and transparent logos
4. detail that quality alone can't shrink: the picture itself is made smaller to fit
5. things that must be refused, or survived
6. several big pictures at once
7. the platform's compression settings are what is applied

## What to expect (these must happen)

- A very high-quality photo is stored as a small WebP (long side 1600 px, under the 400 KB target) that can be fetched from the returned address; the answer reports its real size and the original's.
- Phone photos saved sideways come out upright; hidden metadata is removed from the stored file.
- Small pictures are not enlarged; a transparent logo stays transparent; the kind of picture decides its folder.
- If lowering quality can't reach the size target, the picture is reduced in size (never below 640 px, shape kept) until it does.
- A pixel bomb is handled quickly and safely; over-the-ceiling pictures, non-images, empty and over-30-MB uploads get clear refusals (413 / 415 / 400 / 413).
- Five big uploads at once all succeed and the server stays healthy.
- The platform's compression settings are applied to the next upload; only the platform owner can change them, within the allowed ranges.

## What must NOT happen

- A stored picture must NOT keep the uploader's hidden metadata (author, camera, location).
- A picture must NOT be stored larger than the target while there is room to make it smaller.
- A tiny file that expands into hundreds of megapixels must NOT stall or crash the server.
- Someone not signed in, or without menu rights, must NOT be able to upload.
- The uploader must NOT be able to choose the stored file's name or folder outside the store's own.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (32)

**Step 1 — a very high-quality photo is made small**

- a 24-megapixel JPEG at quality 95 (about 19 MB) is accepted — _201 19861 KB_
- the stored file is WebP and can be fetched from its address — _200 image/webp_
- it is now 307 KB — under the 400 KB target and at least 20 times smaller than the original — _19861 KB → 307 KB_
- scaled down to 1600 px on the long side, keeping the shape — _1600x1067_
- the answer reports the real final size, bytes and the original's bytes — _{"w":1600,"h":1067,"bytes":314802}_
- it is stored inside this store's own folder, with a name the uploader doesn't control

**Step 2 — phone photos: rotation and private metadata**

- a photo the phone saved sideways (orientation tag 6) comes out upright (400 wide, 800 tall) — _400x800_
- (the test picture really carries hidden text in its metadata)
- the hidden metadata (author, camera, location…) is gone from the stored file

**Step 3 — small pictures and transparent logos**

- a small picture is never blown up — _300x200_
- a logo with a see-through background stays see-through (corner transparent, centre solid) — _image/webp, alpha corner 0 / centre 255_
- the kind of picture (logo) decides the folder

**Step 4 — detail that quality alone can't shrink: the picture itself is made smaller to fit**

- very grainy detail still ends up under the 400 KB target — _12369 KB → 284 KB_
- …by reducing its size (not below 640 px), not by turning it into mush — _1218x913, q?_
- …and the shape is kept — _1.334 vs 1.333_

**Step 5 — things that must be refused, or survived**

- a "pixel bomb" (225 megapixels, only 672 KB on disk) is shrunk safely and quickly — _201 in 374 ms_
- the server is still healthy afterwards
- a picture over the 268-megapixel ceiling is refused with a clear message
- a file that isn't a picture is refused (415) — _415 That file isn't an image we can read. Try JPEG, PNG, WebP, AVIF or HEIC._
- an empty upload is a 400 — _400_
- a file over 30 MB is refused before any work is done (413) — _413_
- someone not signed in can't upload
- a role without menu rights (kitchen) can't upload — _403_

**Step 6 — several big pictures at once**

- five 19 MB photos uploaded at the same moment all succeed — _201,201,201,201,201_
- …in a reasonable time — _837 ms_
- …each stored under its own name
- the server is still healthy afterwards

**Step 7 — the platform's compression settings are what is applied**

- the platform owner can change the compression settings — _200 {"provider":"local","updatedAt":"2026-11-19T14:00:38.729Z","limits":{"maxPerItem_
- the next upload follows them: JPEG, 800 px, under 100 KB — _image/jpeg 800x533 3 KB_
- a store owner can't change them — _403_
- settings outside the allowed ranges (300 px minimum, quality 30–100) are refused — _400_
- putting the defaults back works

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-19 19:30 | pass | 32 | 0 | headless | 10.3 s |
| 2026-11-19 17:51 | pass | 32 | 0 | headless | 10.1 s |
| 2026-11-19 17:45 | pass | 32 | 0 | headless | 9.8 s |
| 2026-11-19 16:31 | pass | 32 | 0 | headless | 10.2 s |
| 2026-11-19 16:30 | pass | 32 | 0 | headless | 10.2 s |
| 2026-11-19 16:29 | error | 17 | 0 | headless | 7.9 s |
| 2026-11-19 16:29 | error | 17 | 0 | headless | 7.9 s |
| 2026-11-19 16:29 | error | 17 | 0 | headless | 7.5 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t34-image-compression-api.mjs`), not this page._
