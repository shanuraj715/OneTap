// T76 — Storage: optimize pictures.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t76-storage-optimize-api",
  title: "Storage — find the pictures bigger than the size limit and compress the chosen ones; every stored address follows",
  area: "platform",
  browser: false,
  fresh: false,
  summary: "Runs suites/storage-optimize-api.mjs on its own in-memory API. Real noisy pictures (a 920 KB JPEG, a 1.6 MB PNG, a tiny WebP, an already-squeezed 10 KB JPEG, 400 KB of random bytes) go through the real compressor. Scan: lists only pictures the stores USE that are over the saved 'Target max size' (not small ones, not unused files, not chat attachments), biggest first, with store / outlet / kind / where / a working address; totals and 'will free at least'; looking changes nothing; with no size limit it says so and nothing can be started; only listed pictures can be chosen. Optimize: runs in the background, saves each as a NEW file (new name, WebP, within the saved dimensions), points the dish picture's address + key + width + height and a logo saved with an old domain at it, leaves another site's picture alone, deletes the big originals (or keeps them when asked), and the new picture really opens as image/webp. A file that isn't a picture is reported with the reason and left untouched. A store owner's edit made while it runs is never overwritten (conditional apply). Only one run at a time and never together with a move; cancel; a job whose server died is marked interrupted. A picture that can't get smaller is left alone, remembered, and not offered again until the compression settings change. With a bucket in use, pictures there are optimized there.",
  expect: [
    "Pictures over the limit are listed with their store, outlet and kind; small, unused and chat files are not.",
    "Optimizing makes smaller new files, switches every stored address/key/size to them and deletes the originals only when asked.",
    "Failures and 'can't get smaller' pictures are left exactly as they were.",
  ],
  expectNot: [
    "Scanning must NOT change any file or stored address.",
    "A store owner's change made while it runs must NOT be overwritten.",
    "A picture from another website, a chat attachment or an unused file must NOT be touched.",
    "It must NOT run together with a move, nor twice at once.",
  ],
};

export const run = (d) => runSuite(d, "storage-optimize-api.mjs");
