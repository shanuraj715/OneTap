# T74 — Storage — try any storage without switching it on, count what is stored where, and move the files between this server's disk and S3-compatible buckets

**Area:** platform · **Last result:** ✅ PASSED (65 passed, 0 failed · 2026-11-21 15:38 · headless · 12.7 s)

**Run it alone:** `node run.mjs --only t74` (add `--visible` to watch it)

## What this test does

Runs suites/storage-api.mjs on its own in-memory API with a stand-in S3 service. The S3 signature is checked against AWS's own worked example (listing with a query). Test connection: typed-in bucket details are tried — save, read back, open from the public address, delete — without saving or switching anything on; wrong keys fail at the first step with the service's own message; a missing bucket is named; missing details are asked for by name; a bucket that takes uploads but isn't public passes the keys and fails the public step with a plain explanation; this server's disk can be tried too; a blank secret means the saved one. Usage scan: files and bytes on the disk and in the bucket (listed over several pages), per store, per outlet ('Store-wide files' for logos), per kind; pictures a store uses but that exist nowhere are reported with the store; files nothing refers to (older than a day) are counted; files not yet in the bucket are counted. Move: onto the same storage is refused; preview counts files and stored addresses to update and changes nothing; a move runs in the background and one is refused while another runs; every file is copied identically with the right content type; menu pictures (domain-free and old-domain forms), logos and any other field are rewritten, a picture from another site and files that don't exist are left alone; keys unchanged; moving again copies nothing; 'delete the old copies' removes only verified files; one store only; back to the disk; a file the bucket refuses is listed, not deleted from the source and not re-linked, and a rerun finishes just it; cancel; a move whose server died is marked interrupted; 'use this for new uploads' saves the destination; bucket to bucket.

## Steps

1. the S3 signature is the one AWS documents
2. try a storage without switching it on
3. what is stored where
4. moving the files from this server's disk to the bucket
5. moving them back, one store at a time, and what goes wrong

## What to expect (these must happen)

- A storage can be tried with typed-in details without saving it.
- Everything is counted per place, store and outlet and compared with what stores use.
- Files are copied, verified and the stored addresses follow; failures stay where they were.

## What must NOT happen

- Trying a storage must NOT save or switch it on.
- A file that failed to copy, or was not verified, must NOT be deleted from the source or re-linked.
- A picture from another website must NOT be rewritten.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (65)

**Step 1 — the S3 signature is the one AWS documents**

- a bucket listing (with a query) is signed exactly like AWS's own worked example
- …and goes to the right address — _https://examplebucket.s3.amazonaws.com/?max-keys=2&prefix=J_

**Step 2 — try a storage without switching it on**

- to start with, pictures are on this server's disk and nothing is saved
- typed-in bucket details are tried (and work)
- every step is reported: save, read back, open from the public address, delete — _write:true read:true public:true delete:true_
- …including that a customer's browser could open it — _http://127.0.0.1:60866/media/platform/_probe/f63efe1a-074f-4751-8f7a-d22e3fca9039.txt_
- the test file is deleted again — nothing is left in the bucket
- trying it did NOT switch anything on or save anything
- wrong keys: the first step fails and says what the service answered — _S3 PUT failed (403): The access key you provided does not exist._
- …and nothing else is tried after it
- a bucket that doesn't exist is named in the answer — _S3 PUT failed (404): The specified bucket does not exist_
- missing details are asked for by name — _Fill in Region, Access key ID, Secret access key first._
- a bucket that takes uploads but isn't public passes the keys test and fails the public one — _ok=true public=false_
- …with a plain explanation
- this server's disk can be tried the same way
- a blank secret means 'the saved one' when that storage is the one saved
- with no details it tries what is saved and in use — _S3-compatible storage · media_

**Step 3 — what is stored where**

- the scan covers this server's disk and the storage in use — _local,cloud_
- …counting the files and bytes on the disk exactly — _5 files 69 B_
- …and in the bucket (listed over several pages) — _1 S3-compatible storage · media_
- the whole app: every file in every place — _6_
- per store: Acme has 4 files on the disk and 1 in the bucket — _{"local":{"files":4,"bytes":60},"cloud":{"files":1,"bytes":20}}_
- per outlet: Main holds its pictures, 'Store-wide files' holds the logo — _Main:3 Store-wide files:1_
- Beta has 1
- per kind of file: menu pictures and logos
- a picture a store uses but that is NOWHERE is reported (and which store)
- a file nothing refers to (older than a day) is counted as unused; a fresh one isn't — _{"files":1,"bytes":14}_
- files on the disk that are not in the bucket yet are counted (what a move would copy) — _{"files":5,"bytes":69}_
- the last scan can be read back without scanning again

**Step 4 — moving the files from this server's disk to the bucket**

- moving a storage onto itself is refused — _That is the same storage — choose a different destination._
- a destination with missing details is refused by name — _The destination: fill in Region, Access key ID, Secret access key first._
- the preview says how many files would move — _{"files":5,"bytes":69,"toCopy":5,"toCopyBytes":69,"alreadyThere":0}_
- …and how many stored picture addresses would be rewritten (4: A's two pictures, A's logo, B's picture) — _4_
- the preview changed nothing
- starting a move answers at once (it runs in the background) — _202 running_
- a second move can't start while one is running — _409_
- the move finishes — _done done_
- every file was copied, with the byte count
- each file in the bucket is identical to the original
- …and has the right content type
- the menu pictures now point at the bucket (the old domain-free and old-domain forms alike)
- a picture from another website is left alone
- the stored keys are unchanged
- a logo (any field of any collection) is rewritten too
- Beta's picture moves; the one whose file doesn't exist is left as it was (nothing to point at)
- four addresses were updated and the originals are still on the disk (nothing deleted)
- moving again copies nothing (all 5 are already there) — _{"done":5,"copied":0,"skipped":5,"failed":0,"bytesCopied":0,"linksUpdated":0,"deleted":0}_
- 'delete the old copies' removes the verified files from the disk — _{"done":5,"copied":0,"skipped":5,"failed":0,"bytesCopied":0,"linksUpdated":0,"deleted":5}_
- …and the bucket still has all of them

**Step 5 — moving them back, one store at a time, and what goes wrong**

- one store only: just Beta's file comes back to the disk — _{"done":1,"copied":1,"skipped":0,"failed":0,"bytesCopied":9,"linksUpdated":1,"deleted":0}_
- …and the record says which store
- Beta's address is domain-free again; Acme's still points at the bucket
- a file the bucket refuses is listed with why, and the move says 'done with errors'
- …it is NOT deleted from the disk, even though deleting was asked for
- …and its address is not rewritten (it still works from the disk)
- the other files were linked (and their old copies deleted) regardless of that one failure
- starting it again finishes just that file (the rest is skipped)
- a running move can be cancelled
- it stops before the end and says 'cancelled' — _cancelled 11_
- a move whose server died is marked interrupted, not 'running' for ever — _interrupted_
- 'make it the storage for new uploads' saves the destination as the platform's — _s3 saved=true_
- …with its details (the secret stays hidden)
- from the storage in use to ANOTHER bucket (S3 → S3)
- the addresses follow the files to the other bucket
- the page can show the latest move and the earlier ones — _5_

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-21 15:38 | pass | 65 | 0 | headless | 12.7 s |
| 2026-11-21 15:36 | pass | 65 | 0 | headless | 12.2 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t74-storage-api.mjs`), not this page._
