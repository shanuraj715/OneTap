// T75 — The Storage page.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t75-storage-tools-ui",
  title: "The Storage page — Test connection under the list, files per store and outlet, move files with progress",
  area: "platform",
  browser: true,
  fresh: false,
  summary: "Runs suites/storage-tools-ui.mjs in Chrome as the platform super admin on the bench, with a stand-in bucket and a throwaway store ('Storage Test Co', deleted at the end). The Test connection button sits directly under the list of storages and above the settings fields; it tries the selected storage with the typed-in details (this server's disk, or an S3 bucket) and shows each step with a tick, a warning (a bucket that isn't public) or a cross (wrong keys, with the service's own words) — nothing is saved. 'Scan storage' shows the total, the disk, the store row and its outlet; choosing a source, a destination (tried first), one store and 'Check what would move' shows the files and addresses; 'Move files' runs with a progress readout, the bucket then holds exactly that store's files and the dish's pictures come from the bucket and open; a file the bucket refuses is listed and a second run finishes only it. Everything is moved back and the throwaway store deleted.",
  expect: [
    "Test connection is under the list, shows each step honestly and saves nothing.",
    "Usage is shown per store and outlet.",
    "A move is previewed first, runs with progress, and its files and links end up at the destination.",
  ],
  expectNot: [
    "'Move files' must NOT be possible before the preview.",
    "Testing must NOT change the saved storage.",
    "No errors in the browser.",
  ],
};

export const run = (d) => runSuite(d, "storage-tools-ui.mjs");
