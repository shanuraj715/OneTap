// T96 — Every product has its own icon: website, admin panel, storefront (the shop owner's own, else the Rasoi Pulse one).
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t96-icons-map-ui",
  title: "Icons: the website has the Rasoi Pulse icon (navy), the admin panel a different one (red), and the storefront shows the shop owner's own icon (the Rasoi Pulse one until they upload theirs)",
  area: "branding",
  browser: true,
  fresh: false,
  summary: "Runs suites/icons-map-ui.mjs in Chrome against the bench (and starts the marketing website on :3173 if needed). Website: /icon.svg is the favicon, /favicon.ico a real .ico, /apple-icon.png a PNG, the page links the icon and the touch icon, and the header shows the new logo instead of the old drawn squares. Admin: /favicon.svg, /favicon.ico and /apple-touch-icon.png are served, the admin icon is a different file from the website's and is red, the page links all three, and the sign-in page shows the icon next to the name. Storefront: a store with no icon of its own shows the Rasoi Pulse icon as exactly ONE icon link (the file is served by the storefront); when the owner sets their own favicon the tab shows only that one (the default is gone); removing it brings the default back; the outlet-picker page never shows a stray icon.",
  expect: [
    "Website, admin panel and storefront each show their own icon in the browser tab.",
    "The storefront tab shows the owner's icon when they have uploaded one, otherwise the Rasoi Pulse icon.",
  ],
  expectNot: [
    "The admin icon must NOT be the same as the website's.",
    "A store with its own icon must NOT also carry the Rasoi Pulse icon (never two icon links).",
    "No errors in the browser.",
  ],
};

export const run = (d) => runSuite(d, "icons-map-ui.mjs", { timeoutMs: 8 * 60_000 });
