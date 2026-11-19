// T31 — The storefront shows the STORE's name in its header, footer and main heading; an outlet's own name appears only in the outlet dropdown.
// Acme Momos has two outlets whose own names are "Acme Momos — Connaught Place" and "Acme Momos — Noida Sector 18".
import { BENCH } from "../bench/watch.mjs";
import * as ui from "../bench/ui.mjs";

export const meta = {
  id: "t31-store-name-header",
  title: "Storefront — the header and the big heading say the store's name; the outlet's name is only in the outlet dropdown",
  area: "storefront",
  fresh: false,
  summary: "In Chrome on the Acme Momos storefront (two outlets, each with its own name — 'Acme Momos — Connaught Place' and 'Acme Momos — Noida Sector 18'): the header, the big heading, the footer and the browser-tab title of the Account page all say 'Acme Momos'; neither outlet's own name appears there. The outlet dropdown under the header still lists both outlets by their own names, and switching to the second outlet keeps the store's name in the header and heading. The same on Marketing Mart (outlets 'Marketing Mart — Main' / '— Second'), and a single-outlet store (Beta Bites) is unchanged.",
  expect: [
    "On each outlet's page the header and the main heading read 'Acme Momos' (the store), not the outlet's own name.",
    "The footer's name is the store's too.",
    "The outlet dropdown lists both outlets by their own names ('Acme Momos — Connaught Place', 'Acme Momos — Noida Sector 18').",
    "The Account page's tab title is 'Your account — Acme Momos'.",
    "Marketing Mart shows 'Marketing Mart' in its header and heading; Beta Bites (one outlet) still shows 'Beta Bites'.",
  ],
  expectNot: [
    "An outlet's own name (Connaught Place, Noida Sector 18, Main, Second) must NOT appear in the header or the main heading.",
    "The browser must NOT log JavaScript errors.",
  ],
};

export async function run(d) {
  await d.tab("customer", "Customer · storefront");

  const header = () => d.page.locator("header").first().innerText();
  const heading = () => d.page.locator("h1").first().innerText();
  const footer = () => d.page.locator("footer").last().innerText();
  const norm = (t) => t.replace(/\s+/g, " ").trim();

  await d.step("Acme Momos, the Connaught Place outlet", 400);
  await d.goto(BENCH.storefront + "/main", 700);
  let h = norm(await header()), big = norm(await heading()), f = norm(await footer());
  d.check("the header says 'Acme Momos'", /Acme Momos/.test(h), h.slice(0, 80));
  d.never("the header names the outlet", /Connaught Place|Noida/.test(h));
  d.check("the main heading is exactly 'Acme Momos'", big === "Acme Momos", big);
  d.check("the footer's name is the store's", /Acme Momos/.test(f) && !/Acme Momos — /.test(f), f.slice(0, 90));
  await d.shot("store-name-header");

  await d.step("The outlet dropdown is where the outlet's own name lives", 400);
  const dropdown = d.page.getByRole("button", { name: /Connaught Place/ }).first();
  d.check("the outlet dropdown shows this outlet by its own name", await dropdown.isVisible().catch(() => false));
  await d.click(dropdown, { after: 500 });
  const open = norm(await d.page.locator("body").innerText());
  d.check("opened, it lists both outlets by their own names", /Acme Momos — Connaught Place/.test(open) && /Acme Momos — Noida Sector 18/.test(open));
  await d.page.keyboard.press("Escape");

  await d.step("The second outlet shows the same store name", 400);
  await d.goto(BENCH.storefront + "/second", 700);
  h = norm(await header()); big = norm(await heading());
  d.check("the header still says 'Acme Momos'", /Acme Momos/.test(h) && !/Noida|Sector 18/.test(h), h.slice(0, 80));
  d.check("so does the main heading", big === "Acme Momos", big);

  await d.step("The Account page and its tab title", 400);
  await d.goto(BENCH.storefront + "/main/account", 700);
  d.check("the tab title is 'Your account — Acme Momos'", (await d.page.title()) === "Your account — Acme Momos", await d.page.title());
  d.check("the header there says 'Acme Momos' too", /Acme Momos/.test(norm(await header())));

  await d.step("Other stores", 400);
  await d.goto("http://mart.localhost:3170/main", 700);
  h = norm(await header()); big = norm(await heading());
  d.check("Marketing Mart: header and heading say 'Marketing Mart', not '— Main'", /Marketing Mart/.test(h) && !/Main/.test(h) && big === "Marketing Mart", `${h.slice(0, 60)} | ${big}`);
  await d.goto(BENCH.betaStorefront + "/only", 700);
  h = norm(await header()); big = norm(await heading());
  d.check("Beta Bites (one outlet): unchanged — 'Beta Bites'", /Beta Bites/.test(h) && big === "Beta Bites", `${h.slice(0, 60)} | ${big}`);
}
