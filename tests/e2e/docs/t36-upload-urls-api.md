# T36 — Pictures are stored without a domain and get the current domain when sent out — so a new domain or machine never breaks them

**Area:** storage · **Last result:** ✅ PASSED (28 passed, 0 failed · 2026-11-20 06:01 · headless · 3.7 s)

**Run it alone:** `node run.mjs --only t36` (add `--visible` to watch it)

## What this test does

Runs suites/upload-urls.mjs: its own in-memory API whose public address is https://img.example.test. A real upload's answer carries that domain, but an item or category saved with it keeps only '/uploads/<key>' in the database, and the menu comes back with the domain again. Pictures saved the old way (from localhost, from an old domain, or with no domain) come out on the current domain with no migration. Other people's addresses (a CDN link, a look-alike /uploads/ path on another site, a path under another prefix, a data: picture, an address mentioned inside a sentence) are left exactly as they were, both stored and sent. Saving back what the dashboard received — even a localhost address the editor still held — stores only the path. The same stored data comes out on whichever domain the API is configured with. The receipt preview's logo is an absolute address. The clean-up script (normalize-upload-urls) lists, then removes, the domain from what is already stored, leaves other sites' pictures alone, and finds nothing to do the second time.

## Steps

1. a new upload: the domain is added on the way out, only the path is kept
2. pictures saved the OLD way heal on the way out, no migration needed
3. other people's addresses are left exactly as they are
4. saving what the dashboard received keeps the database clean
5. a new domain needs no data changes
6. receipts: the logo gets a real address too
7. the clean-up script removes the domain from what is already stored

## What to expect (these must happen)

- An upload's response has the current deployment's domain; the database keeps only /uploads/<key> (items, category pictures); the menu response has the domain.
- Pictures saved with localhost, an old domain or no domain are returned on the current domain, with no data change.
- Saving an address back (with the full domain, or a localhost one) stores only the path.
- The same stored path comes out on any configured domain.
- The receipt preview's logo is an absolute address on this domain.
- The clean-up script's dry run changes nothing; --apply removes the domain from our pictures only; a second run does nothing.

## What must NOT happen

- A stored picture must NOT carry a domain (localhost or otherwise) once saved through the API.
- The menu must NOT contain a localhost picture address.
- A CDN link, a look-alike path on another site, a data: picture or an address inside a sentence must NOT be rewritten.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (28)

**Step 1 — a new upload: the domain is added on the way out, only the path is kept**

- the upload's answer carries THIS deployment's domain
- …and the file is served at that path
- the dashboard sent the full address — the database keeps only the path
- the key is kept too
- the menu the storefront reads has the domain again
- a category's picture is kept domain-free as well
- …and comes out with the domain

**Step 2 — pictures saved the OLD way heal on the way out, no migration needed**

- an address saved from localhost now points at this deployment
- an address saved with an OLD domain now points at this deployment
- a domain-free path gets the domain
- no localhost or old domain is left anywhere in the menu the storefront reads

**Step 3 — other people's addresses are left exactly as they are**

- a CDN link, a look-alike /uploads/ path, a path under another prefix and a data: picture are stored untouched
- …and sent out untouched
- an address mentioned inside a sentence is not rewritten either

**Step 4 — saving what the dashboard received keeps the database clean**

- an edit that sends the full address back still stores only the path
- …even when the editor still holds a localhost address
- nothing the menu returns mentions localhost

**Step 5 — a new domain needs no data changes**

- the same stored data comes out on whichever domain the API is configured with
- toPublicUrl adds the domain to ours and leaves others
- toStoredUrl removes whatever domain was there

**Step 6 — receipts: the logo gets a real address too**

- the receipt preview's logo is an absolute address on this domain

**Step 7 — the clean-up script removes the domain from what is already stored**

- (two items still carry a full address)
- the dry run lists the domains it would remove
- …and changes nothing
- applying it updates the documents
- both now keep only the path — _/uploads/6aff94f03bbf819449f62b93/6aff94_
- other people's addresses were not touched
- running it again finds nothing to do (safe to repeat)

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-20 06:01 | pass | 28 | 0 | headless | 3.7 s |
| 2026-11-20 04:59 | pass | 28 | 0 | headless | 4.8 s |
| 2026-11-20 00:26 | pass | 28 | 0 | headless | 4.9 s |
| 2026-11-19 19:31 | pass | 28 | 0 | headless | 4.8 s |
| 2026-11-19 17:51 | pass | 28 | 0 | headless | 4.8 s |
| 2026-11-19 17:46 | pass | 28 | 0 | headless | 3.8 s |
| 2026-11-19 17:35 | pass | 28 | 0 | headless | 4.8 s |
| 2026-11-19 17:35 | fail | 27 | 1 | headless | 5.3 s |
| 2026-11-19 17:33 | pass | 28 | 0 | headless | 5.2 s |
| 2026-11-19 17:32 | error | 22 | 0 | headless | 1 min 4 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t36-upload-urls-api.mjs`), not this page._
