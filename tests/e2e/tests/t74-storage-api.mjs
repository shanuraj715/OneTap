// T74 — Storage.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t74-storage-api",
  title: "Storage — try any storage without switching it on, count what is stored where, and move the files between this server's disk and S3-compatible buckets",
  area: "platform",
  browser: false,
  fresh: false,
  summary: "Runs suites/storage-api.mjs on its own in-memory API with a stand-in S3 service. The S3 signature is checked against AWS's own worked example (listing with a query). Test connection: typed-in bucket details are tried — save, read back, open from the public address, delete — without saving or switching anything on; wrong keys fail at the first step with the service's own message; a missing bucket is named; missing details are asked for by name; a bucket that takes uploads but isn't public passes the keys and fails the public step with a plain explanation; this server's disk can be tried too; a blank secret means the saved one. Usage scan: files and bytes on the disk and in the bucket (listed over several pages), per store, per outlet ('Store-wide files' for logos), per kind; pictures a store uses but that exist nowhere are reported with the store; files nothing refers to (older than a day) are counted; files not yet in the bucket are counted. Move: onto the same storage is refused; preview counts files and stored addresses to update and changes nothing; a move runs in the background and one is refused while another runs; every file is copied identically with the right content type; menu pictures (domain-free and old-domain forms), logos and any other field are rewritten, a picture from another site and files that don't exist are left alone; keys unchanged; moving again copies nothing; 'delete the old copies' removes only verified files; one store only; back to the disk; a file the bucket refuses is listed, not deleted from the source and not re-linked, and a rerun finishes just it; cancel; a move whose server died is marked interrupted; 'use this for new uploads' saves the destination; bucket to bucket.",
  expect: [
    "A storage can be tried with typed-in details without saving it.",
    "Everything is counted per place, store and outlet and compared with what stores use.",
    "Files are copied, verified and the stored addresses follow; failures stay where they were.",
  ],
  expectNot: [
    "Trying a storage must NOT save or switch it on.",
    "A file that failed to copy, or was not verified, must NOT be deleted from the source or re-linked.",
    "A picture from another website must NOT be rewritten.",
  ],
};

export const run = (d) => runSuite(d, "storage-api.mjs");
