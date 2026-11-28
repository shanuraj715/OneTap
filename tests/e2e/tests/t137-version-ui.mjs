// T137 — The version in the storefront footer, the website footer and the admin panel's sidebar (and over the wire)
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t137-version-ui",
  title: "Web version on screen: the storefront footer, the website footer and the admin panel's left sidebar (open and folded; store dashboard and platform console) all show the version in version.json",
  area: "platform",
  browser: true,
  fresh: false,
  summary: "Chrome against the bench. The version is read from version.json and looked for on screen: the store dashboard's and the platform console's sidebar footer ('Rasoi Pulse <version>', below the Sign out button, small and with a hover title when the sidebar is folded), the storefront's footer on both bench outlets ('Rasoi Pulse · <version>', under the store's own footer, exactly once), the website's footer on the home and Apps pages, and the bench API's X-RasoiPulse-Version header. Phone widths do not scroll sideways.",
  expect: [
    "The admin sidebar footer, the storefront footer and the website footer each show the version in version.json.",
    "The folded sidebar still shows it, small, with the full words on hover.",
    "The API's X-RasoiPulse-Version header equals the same version.",
  ],
  expectNot: [
    "No page may show 'undefined' or an empty version.",
    "A phone-width page must NOT scroll sideways because of it.",
  ],
};

export const run = (d) => runSuite(d, "version-ui.mjs", { timeoutMs: 8 * 60_000 });
