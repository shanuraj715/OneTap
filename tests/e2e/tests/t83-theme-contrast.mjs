// T83 — Every style effect stays readable in light and dark, on a laptop and a phone.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t83-theme-contrast",
  title: "Style effects (Glass, Neumorphism, Clay, Aurora, Cyberpunk, Dark Premium) in light and dark: no text or icon on the storefront loses contrast compared with 'None'",
  area: "storefront",
  browser: true,
  fresh: false,
  summary: "Runs suites/effects-contrast.mjs in Chrome against the bench store. For each effect (with its own suggested palette), in light and dark, with two brand colours (the reports' magenta, white text on buttons, on a laptop 1280px and a phone 390px; and a bright yellow, dark text on buttons, on the laptop), the storefront is scanned in many states: the home page top to bottom (header, order-type switch, filters, category chips, every card, View all, footer), the outlet list, the phone menu and category sheet, an open item pop-up, the cart bar, the checkout page, the account page, a store page and the table page. Every text and icon is listed with its real colour; then all text and icons are made invisible and the page is photographed, so the pixels really behind each one (blur, gradients, photos) give its contrast. Each element is compared with the same element under 'None' at its clearest scroll position: it is a problem when it falls below 3:1 where None does not, or below 4.5:1 where None is above it (and at least 1 point worse). Not measured: elements in the deliberate fade at the end of the scrolling category strip, elements covered by something, and the veg / egg / non-veg marks (a standard symbol that deliberately ignores the theme).",
  expect: [
    "In every effect, light and dark, on laptop and phone, no text or icon that is readable under 'None' becomes unreadable (below 3:1) or loses its 4.5:1.",
    "The selected Takeaway / Delivery tab, the current category chip, selected options and the active filter keep a readable label in every effect.",
  ],
  expectNot: [
    "White text must NOT sit on a light effect surface (or dark on dark) because an effect replaced the background the label was designed for.",
  ],
};

export const run = (d) => runSuite(d, "effects-contrast.mjs", { timeoutMs: 25 * 60_000 });
