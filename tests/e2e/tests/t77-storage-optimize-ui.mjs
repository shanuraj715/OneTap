// T77 — The Storage page: Optimize pictures.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t77-storage-optimize-ui",
  title: "The Storage page — find the pictures bigger than the size limit in a grid, select them and optimize",
  area: "platform",
  browser: true,
  fresh: false,
  summary: "Runs suites/storage-optimize-ui.mjs in Chrome as the platform super admin on the bench, with a throwaway store ('Optimize Test Co': three ~1.5 MB pictures and fifty small ones made with sharp while the compression was loose; the platform's compression settings are put back and the store deleted at the end). The card sits below 'Image compression'; nothing is listed until 'Find big pictures'; the summary names the saved limit (150 KB); choosing the store shows exactly its 3 big pictures as same-size cards with size, store, outlet and kind, loaded thumbnails and no buttons (view-only); 'Select all' says how many, selects them, a single picture can be taken out, the Optimize button names the count and waits while nothing is selected; pressing it asks first (originals deleted, can't be undone), runs in the background with a progress readout, ends with '3 optimized, 3 originals deleted' and 'went from … to … smaller'; the list refreshes by itself; the dishes now use new WebP files under 150 KB which open, and the big originals no longer do. With a 5 KB limit the grid draws 48 at a time with 'Show more (n left)', and 'Select all' covers all of the store's pictures; on a phone it doesn't scroll sideways and shows two across; with no size limit it says where to put one.",
  expect: [
    "Big pictures are shown in a view-only grid and can be selected all at once or one by one.",
    "Optimize asks first, shows progress, and the dishes end up using smaller files.",
    "The grid pages (48 at a time) and works on a phone.",
  ],
  expectNot: [
    "Looking must NOT change any picture.",
    "The grid must NOT offer edit/delete buttons on the pictures.",
    "The page must NOT scroll sideways on a phone.",
  ],
};

export const run = (d) => runSuite(d, "storage-optimize-ui.mjs");
