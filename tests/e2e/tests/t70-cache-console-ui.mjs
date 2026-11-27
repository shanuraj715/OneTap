// T70 — Cache page: Admin Panel Cache / Store Cache (stores → outlets), and Expire that says what it drops.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t70-cache-console-ui",
  title: "Cache page — Admin Panel Cache and Store Cache (stores → a store → its outlets), and every Expire says what it will drop first",
  area: "platform",
  browser: true,
  fresh: false,
  summary: "Runs suites/cache-console-ui.mjs in Chrome as the platform super admin on the bench. Platform → Cache has two groups: 'Admin Panel Cache' (the items that belong to no store — listed, with its own Expire button) and 'Store Cache', folded away until opened; opened, it lists the stores that have something remembered, none of them open; picking a store opens ITS outlets only (one group per outlet, its own items listed in words, Menu among them) and a 'The whole store' group for the store's look, plan and addresses. Every Expire (this outlet, this store, the admin panel, everything) opens a window saying what will expire (the real list, grouped, with the count — equal to the number the server then reports), what stays and what happens next; Cancel expires nothing; confirming clears exactly that and reports the same number. An outlet's expiry leaves the store's own items and every other store alone; a store's expiry leaves other stores alone. Platform settings → Cache no longer has Expire buttons (it points to the Cache page); the store's own Cache tab asks with the same window.",
  expect: [
    "The cache is grouped Admin Panel Cache / Store Cache → stores → a store → its outlets, folded until opened.",
    "Every Expire shows what it will drop (count and kinds), what stays and what happens next, before anything is dropped.",
    "The number in the window is the number cleared; a narrower expiry leaves everything outside it alone.",
  ],
  expectNot: [
    "Expiring one outlet must NOT drop the store's own items or another store's.",
    "Expiring one store must NOT clear another's cache.",
    "Cancel must NOT expire anything.",
    "No errors in the browser.",
  ],
};

export const run = (d) => runSuite(d, "cache-console-ui.mjs");
