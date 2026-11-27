// T116 — Order history: five orders a page with the joined pagination (PAG03), numbered pages, newest first, '…' for many pages, removing orders on the last page
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t116-account-pagination-ui",
  title: "Order history: five orders a page with the joined pagination (PAG03), numbered pages, newest first, '…' for many pages, removing orders on the last page",
  area: "orders",
  browser: true,
  fresh: false,
  summary: "Chrome against the bench storefront (Acme Momos) for made-up customers whose cash orders are placed through the API. The API: numbered pages (page 1 of 12 orders at 5 a page = 5 orders, 3 pages, 12 in all, newest first), a page past the end shows the last page, page 0 / nonsense falls back to the old date-based paging, a huge page size is capped at 30, each customer sees only their own. The page: 5 orders to begin with, a joined strip of page numbers (1 2 3) under the list with the current page marked (aria-current), 'Page 1 of 3 · 12 orders', the old 'Show older orders' button gone; pressing 2 or 3 shows the next orders and marks the page; turning a page brings the top of the list back into view. With 3 orders there is no pager. The page size can be set in the address (?pageSize=1, 1 to 30; anything else is ignored): with 12 pages it reads 1 2 3 4 … 12, then 1 … 3 4 5 … 12, then 1 … 9 10 11 12. Removing one order on the last page leaves the rest there and updates the count; removing the last one drops back to the new last page, never an empty one. On a phone the strip fits and nothing scrolls sideways.",
  expect: [
    "The history shows 5 orders a page, newest first, with page numbers in a joined strip.",
    "A long history shows '…' instead of every page number.",
    "Removing the last order on a page drops back to the previous page.",
  ],
  expectNot: [
    "The old 'Show older orders' button must NOT be there.",
    "No pager when everything fits on one page.",
    "No errors in the browser.",
  ],
};

export const run = (d) => runSuite(d, "account-pagination-ui.mjs", { timeoutMs: 6 * 60_000 });
