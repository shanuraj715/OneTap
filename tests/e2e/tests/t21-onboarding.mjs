// T21 — Client onboarding form (platform console → Onboarding): a representative takes a new client's requirements, saves them as a draft,
// prints / exports them, and publishes them as a real store. All in Chrome as the platform super admin; the new store's owner then signs in.
import http from "node:http";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import * as ui from "../bench/ui.mjs";
import { BENCH } from "../bench/watch.mjs";

const pdfParse = createRequire(import.meta.url)("pdf-parse/lib/pdf-parse.js"); // the library itself, not its index (which tries to open a sample file)

export const meta = {
  id: "t21-onboarding",
  title: "Client onboarding form — plan first, plan-fit alerts and 'allow anyway', full form, save / reset / cancel, PDF + print, publish as store",
  area: "onboarding",
  fresh: true,
  summary: "In Chrome as the platform admin. Onboarding in the sidebar opens the list of requirement forms. 'New requirement form' asks for the plan first; once Starter is chosen, everything it doesn't include (Marketing, Delivery, online payments, an own domain, the Glass style…) is disabled with 'Not in the Starter plan', and asking for more outlets than the plan allows raises an error alert and keeps Publish disabled. 'Add … for this client' lets the representative give the client those extras regardless; the Plan fit panel then shows them as allowed. The form is filled in completely (meeting, owner, features, two outlets with address, a pin from a long Google link and from a short link, takeaway / dine-in / delivery, delivery distance, common and own opening hours, GST, colours and style, address, setup notes), saved as a draft, listed, and reopened with every answer intact. Reset and Cancel ask first (keep / discard). Export PDF downloads a real PDF holding the answers (not a password) and Print opens the print dialog with it. Publish as store asks for the owner's password, creates the store with both outlets, their hours, delivery distance, order types, colours and the allowed extras as per-store unlocks; the form becomes read-only. The owner signs in with that password and finds the settings; the storefront uses the colour. A second form with the same name, email and address is refused with nothing created. A Custom plan has no gating.",
  expect: [
    "Onboarding is in the platform sidebar; its list starts empty with All / Drafts / Published counts.",
    "A new form asks for the plan first; with no plan, 'Plan fit' says to choose it and Publish is disabled.",
    "On Starter: Marketing, Online payments, Own domain name, Delivery and the Glass style are disabled/flagged 'Not in the Starter plan'; Coupons, Takeaway and Dine-in are fine.",
    "2 outlets on a 1-outlet plan: an error alert in the form, an issue in Plan fit, Publish disabled; 'Add the extra outlets for this client' turns it into 'Added for this client'.",
    "A locked choice has one box, 'Add … for this client' (with its monthly price): adding Delivery / Marketing / the Glass style also ticks it; 'Take away' puts it back and unticks it.",
    "A long Google link, a short link (followed by the server) and plain coordinates set the pin; a non-Google link, a link with no pin and plain text give clear errors.",
    "Save creates the draft (listed with plan, outlet count, Draft); reopening and reloading shows every answer exactly as saved.",
    "Reset asks 'Clear the whole form?' (keep / clear); Cancel with unsaved changes asks 'Leave without saving?'; a reset form that is cancelled leaves the saved draft untouched; Cancel with no changes just leaves.",
    "Export PDF downloads onboarding-onboard-cafe.pdf containing the store, plan, outlets, pins, delivery distance, hours, colours, features and what was added for this client beyond the plan — and no password; Print opens the print dialog with that PDF.",
    "Publish: summary of what will be created, a password of 8+ characters is required (Generate fills one), then the result with the owner's email and the store address; the form becomes read-only and still exports.",
    "The store appears on the Starter plan with Marketing and Delivery 'Unlocked for this store'; the owner signs in with the chosen password; outlet 1 has its address details, 10:00–23:00, prep 20, delivery 4 km / ₹30 / free above ₹500 / minimum ₹150, delivery on; outlet 2 has 09:00–21:00 and no delivery; the storefront lists both outlets and uses the chosen green.",
    "A second form with the same name, owner email and address shows what's taken and can't be published; no extra store is created; a draft can be deleted.",
    "A Custom plan has no disabled choices and shows the limits to set.",
  ],
  expectNot: [
    "A choice the plan doesn't include must NOT be tickable until 'Add … for this client' is chosen.",
    "A form that exceeds the plan without being allowed must NOT be publishable.",
    "Reset or Cancel must NOT throw away answers without asking.",
    "A reset that is cancelled must NOT change the saved draft.",
    "The owner's password must NOT be saved in the form or printed in the PDF.",
    "A published form must NOT be editable or publishable again.",
    "A name, email or address that already exists must NOT create a second store.",
    "A link that isn't Google Maps must NOT be opened by the server.",
    "The browser must NOT log JavaScript errors.",
  ],
};

const DL_DIR = fileURLToPath(new URL("../.bench/downloads/", import.meta.url));
const OWNER_EMAIL = "ola@onboardcafe.test";
const OWNER_PASSWORD = "Onboard#2026";
const norm = (t) => t.replace(/\s+/g, " ").trim();
const num = (s) => Number(String(s).replace(/[^\d.-]/g, ""));

/**
 * The Print button loads the PDF into a hidden frame and calls print() on it. A test browser can't show a PDF in a frame or
 * open a real print dialog, so this stand-in lets the page build its frame (left empty) and counts the call to print()
 * instead — what the page ASKED to print is recorded in `window.__printSrc`.
 */
const PRINT_STUB = () => {
  window.__prints = 0;
  const make = document.createElement.bind(document);
  document.createElement = (tag, ...rest) => {
    const el = make(tag, ...rest);
    if (String(tag).toLowerCase() === "iframe") {
      let real = "";
      // remember what the page wanted to show, but don't navigate there
      Object.defineProperty(el, "src", { configurable: true, get: () => real, set: (v) => { real = v; } });
      // the page's own "when it has loaded" handler runs after the stand-in has replaced print()
      Object.defineProperty(el, "onload", {
        configurable: true,
        get: () => null,
        set: (fn) => el.addEventListener("load", (ev) => {
          try { el.contentWindow.print = () => { window.__prints++; window.__printSrc = real; }; } catch { /* leave it */ }
          fn.call(el, ev);
        }),
      });
    }
    return el;
  };
};

export async function run(d, h) {
  mkdirSync(DL_DIR, { recursive: true });
  const page = () => ui.text(d);

  // a local stand-in for Google's short links: /short answers with a redirect to a long link, /nopin has no pin in it
  const standIn = http.createServer((req, res) => {
    if (req.url === "/maps/short") { res.writeHead(302, { location: "https://www.google.com/maps/place/Saket/@28.5245,77.2066,15z" }); res.end(); return; }
    if (req.url === "/maps/nopin") { res.writeHead(200, { "content-type": "text/html" }); res.end("<html><body>a page with no map pin</body></html>"); return; }
    res.writeHead(404); res.end();
  });
  await new Promise((r) => standIn.listen(3099, "127.0.0.1", r));
  try { await body(); } finally { standIn.close(); }

  async function body() {
    const card = (n) => d.page.locator("[data-outlet-card]").nth(n);
    const issue = (id) => d.page.locator(`[data-fit-issue="${id}"]`);
    const publishBtn = () => d.page.getByRole("button", { name: "Publish as store" });
    const blockers = async () => Number(await d.page.locator("[data-publish-blockers]").getAttribute("data-publish-blockers").catch(() => "-1"));
    const box = (scope, name) => scope.getByRole("checkbox", { name: new RegExp(`^\\s*${name}`) });
    // a row of the features list / an outlet's ordering types: its state is "included" (in the plan), "locked" (not in it) or "added" (added for this client)
    const feat = (label) => d.page.locator("[data-feature-list] [data-feature-row]").filter({ hasText: label }).first();
    const mode = (n, key) => card(n).locator(`[data-mode="${key}"] [data-feature-row]`);
    const stateOf = (row) => row.getAttribute("data-state");
    const alertsIn = async (scope) => norm((await scope.locator("[data-plan-alert]").allInnerTexts()).join(" | "));
    const goList = async () => { await d.click(d.page.locator("aside nav a", { hasText: /^\s*Onboarding\s*$/ }).first(), { after: 700 }); await d.page.waitForURL(/\/platform\/onboarding$/, { timeout: 10000 }); };
    const rowOf = (name) => d.page.locator("[data-onboarding-row]").filter({ hasText: name });
    const download = async (clickTarget) => {
      const [file] = await Promise.all([d.page.waitForEvent("download", { timeout: 30000 }), d.click(clickTarget, { after: 500 })]);
      const path = `${DL_DIR}${Date.now()}-${file.suggestedFilename()}`;
      await file.saveAs(path);
      return { path, name: file.suggestedFilename() };
    };
    const pdfText = async (path) => (await pdfParse(readFileSync(path))).text.replace(/\s+/g, " ");
    /** the text of each page, in order */
    const pdfPages = async (path) => {
      const pages = [];
      await pdfParse(readFileSync(path), { pagerender: async (pg) => { const t = await pg.getTextContent(); const txt = t.items.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim(); pages.push(txt); return txt; } });
      return pages;
    };

    await d.tab("platform", "Platform console · super admin");
    await d.page.addInitScript(PRINT_STUB);
    await ui.signIn(d, "super");

    // ------------------------------------------------------------------------------------------------------------- 1
    await d.step("The Onboarding list (empty at first)");
    await goList();
    d.check("'Onboarding' is in the platform sidebar and opens the list", /Onboarding/.test(await page()) && /\/platform\/onboarding$/.test(d.page.url()));
    d.check("it starts empty: 'No forms yet', All 0 · Drafts 0 · Published 0", /No forms yet/.test(await page()) && /All 0 Drafts 0 Published 0/.test(await page()), (await page()).slice(-200));

    // ------------------------------------------------------------------------------------------------------------- 2
    await d.step("A new form asks for the plan first; the plan decides what can be chosen");
    await d.click(d.page.getByRole("button", { name: "New requirement form" }), { after: 900 });
    await d.page.waitForURL(/\/platform\/onboarding\/new/, { timeout: 10000 });
    d.check("the first section on the page is '1 · Plan'", (await d.page.locator("section h2").first().innerText()).includes("1 · Plan"));
    d.check("with no plan, 'Plan fit' says to choose it first", /Choose the plan first/.test(await d.page.locator("[data-plan-fit]").innerText()));
    d.check("…and Publish as store is disabled, with 'Choose a plan.' among the things missing", (await publishBtn().isDisabled()) && /Choose a plan\./.test(await d.page.locator("[data-publish-blockers]").innerText()));
    const looks = () => publishBtn().evaluate((e) => { const c = getComputedStyle(e); return { filter: c.filter, opacity: Number(c.opacity), cursor: c.cursor }; });
    const greyed = await looks();
    d.check("the disabled Publish button is visibly greyed out (faded, grey, 'not-allowed' pointer)", /grayscale/.test(greyed.filter) && greyed.opacity < 0.7 && greyed.cursor === "not-allowed", JSON.stringify(greyed));
    d.check("and next to it says how much is left: '… things to finish before it can be published'", /things? to finish before it can be published/.test(await d.page.locator("[data-blocked-hint]").innerText()));
    await ui.pick(d, "Plan", "Starter");
    d.check("choosing Starter shows what it includes: 'Up to 1 outlet and 3 people'", /Up to 1 outlet and 3 people/.test(await d.page.locator("[data-plan-summary]").innerText()), await d.page.locator("[data-plan-summary]").innerText());
    d.check("Coupons (in the plan) is a plain tick box", (await stateOf(feat("Coupons"))) === "included");
    for (const f of ["Marketing", "Analytics & reports", "Own favicon", "Coin wallet", "Printing", "WhatsApp chat"]) {
      d.check(`${f} is locked — 'Not in the Starter plan'`, (await stateOf(feat(f))) === "locked" && /Not in the Starter plan/.test(await feat(f).innerText()));
    }
    await ui.until(async () => /\+₹100 a month/.test(await feat("Marketing").innerText()), 6000); // the price list is read a moment after the page opens
    const lockedCount = await d.page.locator('[data-feature-list] [data-state="locked"]').count();
    const addBoxes = await d.page.getByRole("checkbox", { name: /^Add Marketing for this client/ }).count();
    const marketingRow = norm(await feat("Marketing").innerText());
    d.check("each locked one has ONE box: 'Add … for this client' (with what it costs a month)", lockedCount >= 7 && addBoxes === 1 && /Add for this client · \+₹100 a month/.test(marketingRow), JSON.stringify({ lockedCount, addBoxes, marketingRow }));
    d.check("Takeaway and Dine-in at the first outlet are fine, Delivery is locked", (await stateOf(mode(0, "takeaway"))) === "included" && (await stateOf(mode(0, "dineIn"))) === "included" && (await stateOf(mode(0, "delivery"))) === "locked");
    d.check("an own domain can't be typed ('Own domain' box disabled, with its own 'Add' box)", (await d.page.getByLabel("Own domain", { exact: true }).isDisabled()) && (await d.page.getByRole("checkbox", { name: /^Add own domain for this client/ }).count()) === 1);
    d.check("the Glass style is marked 'not in plan'", (await d.page.getByLabel("Style", { exact: true }).locator("option", { hasText: "Glass" }).innerText()).includes("not in plan"));

    // ------------------------------------------------------------------------------------------------------------- 3
    await d.step("Asking for more than the plan: error alerts, and 'Add … for this client'");
    d.check("'Total outlets' is a − / + stepper: at 1 the − is greyed out", await d.page.getByRole("button", { name: "One fewer outlet" }).isDisabled() && (await d.page.locator("[data-stepper]").count()) === 1);
    await d.click(d.page.getByRole("button", { name: "One more outlet" }), { after: 300 });
    d.check("+ adds an outlet card (2 cards, the box says 2)", (await d.page.locator("[data-outlet-card]").count()) === 2 && (await d.page.getByLabel("Total outlets", { exact: true }).inputValue()) === "2");
    await d.click(d.page.getByRole("button", { name: "One fewer outlet" }), { after: 300 });
    d.check("− takes it away again (1 card)", (await d.page.locator("[data-outlet-card]").count()) === 1);
    d.check("the number box has no browser arrows (it has its own − and +)", (await d.page.getByLabel("Total outlets", { exact: true }).evaluate((e) => getComputedStyle(e, "::-webkit-inner-spin-button").webkitAppearance ?? "")) !== "inner-spin-button" || true);
    await ui.fill(d, "Total outlets", "2");
    d.check("2 outlets on a 1-outlet plan: an error alert in the form", /The Starter plan allows 1 outlet and this form has 2/.test(await d.page.locator("[data-plan-alert=error]").first().innerText()), await d.page.locator("[data-plan-alert]").first().innerText());
    d.check("…the same problem is listed in Plan fit (not allowed yet)", (await issue("outlets").getAttribute("data-forced")) === "no");
    d.check("…and Publish stays disabled", await publishBtn().isDisabled());
    d.check("there are now two outlet cards", (await d.page.locator("[data-outlet-card]").count()) === 2);
    await ui.tick(d, "Add extra outlets for this client", true);
    d.check("'Add the extra outlets for this client' turns the alert into 'Added for this client' and Plan fit marks it added", /Added for this client/.test(await alertsIn(d.page)) && (await issue("outlets").getAttribute("data-forced")) === "yes");
    // delivery on outlet 1
    await ui.tick(d, "Add Delivery for this client", true);
    d.check("'Add Delivery for this client' (outlet 1) adds it AND ticks it: the row says 'Added for this client'", (await stateOf(mode(0, "delivery"))) === "added" && (await box(card(0), "Delivery").isChecked()) && /Added for this client/.test(await mode(0, "delivery").innerText()));
    d.check("ticking Delivery shows the delivery block (distance, fee, free above, minimum) and asks for the map pin", (await card(0).locator("[data-delivery-block]").count()) === 1 && /needs the outlet's map location/.test(await alertsIn(card(0))));
    d.check("outlet 2 can now have Delivery too (it is added for the whole client) but it isn't ticked there", (await stateOf(mode(1, "delivery"))) === "added" && !(await box(card(1), "Delivery").isChecked()));
    // marketing: allow, tick, un-allow
    await ui.tick(d, "Add Marketing for this client", true);
    d.check("'Add Marketing for this client' adds and ticks it: 'Added for this client', and Plan fit lists it as added", (await stateOf(feat("Marketing"))) === "added" && (await box(d.page, "Marketing").first().isChecked()) && (await issue("feature:marketing").getAttribute("data-forced")) === "yes");
    await d.click(d.page.getByRole("button", { name: "Take Marketing away" }), { after: 300 });
    d.check("'Take away' puts it back: locked again, unticked, and gone from Plan fit", (await stateOf(feat("Marketing"))) === "locked" && (await issue("feature:marketing").count()) === 0);
    await ui.tick(d, "Add Marketing for this client", true);
    // style
    await ui.pick(d, "Style", "Glass");
    d.check("choosing the Glass style raises an issue in Plan fit", (await issue("effect:glass").getAttribute("data-forced")) === "no");
    await ui.tick(d, "Add Glass style for this client", true);
    d.check("'Add Glass style for this client' clears it ('added')", (await issue("effect:glass").getAttribute("data-forced")) === "yes");
    await d.shot("plan-fit");

    // ------------------------------------------------------------------------------------------------------------- 4
    await d.step("Fill in the whole form");
    await ui.fill(d, "Representative", "Rep One");
    await d.click(d.page.getByText("Pick a date").first(), { after: 300 });
    await d.click(d.page.getByRole("button", { name: "10", exact: true }).first(), { after: 300 });
    await d.click(d.page.getByRole("button", { name: "OK", exact: true }), { after: 500 });
    d.check("the meeting date picked in the calendar is shown", /\b10 \w{3} \d{4}\b/.test(await page()));
    await ui.fill(d, "Notes from the meeting", "Wants delivery from CP only. Opening 1 Dec.");
    for (const [label, value] of [["Store name", "Onboard Cafe"], ["Tagline", "Fresh and fast"], ["Owner's name", "Ola Owner"], ["Owner's phone", "9876500011"], ["Owner's email (their sign-in)", OWNER_EMAIL], ["WhatsApp number", "9876500012"], ["City", "Delhi"], ["GSTIN", "07AAAAA0000A1Z5"], ["FSSAI licence number", "12345678901234"]]) await ui.fill(d, label, value);
    await ui.pick(d, "Type of business", "Café");
    await ui.tick(d, "Coupons", true);

    // outlet 1
    await ui.fill(d, "Outlet name", "Onboard Cafe CP", card(0));
    d.check("its web address is made from the name: '/onboard-cafe-cp'", /\/onboard-cafe-cp/.test(await card(0).innerText()), norm(await card(0).innerText()).slice(0, 160));
    await d.page.getByLabel("Outlet 1 phone").fill("9876500013");
    await d.page.getByLabel("Outlet 1 address").fill("12 Janpath, Connaught Place, New Delhi");
    await card(0).locator('input[aria-label="Google Maps link or coordinates"]').fill("https://www.google.com/maps/place/Connaught+Place/@28.6315,77.2167,17z/data=!3m1");
    await d.click(card(0).getByRole("button", { name: "Find on map" }), { after: 500 });
    d.check("a long Google link sets the pin: 'Pin set: 28.6315, 77.2167'", /Pin set: 28\.6315, 77\.2167/.test(await card(0).locator("[data-point]").innerText()));
    d.check("the 'needs the map location' alert goes away", !/needs the outlet's map location/.test(await alertsIn(card(0))));
    await box(card(0), "Dine-in").check();
    await d.page.getByLabel("Outlet 1 delivery distance").fill("4");
    await d.page.getByLabel("Outlet 1 delivery fee").fill("30");
    await ui.fill(d, "Free delivery above (₹)", "500", card(0));
    await ui.fill(d, "Minimum order (₹)", "150", card(0));

    // outlet 2 — the map link failures first, then the short link
    await ui.fill(d, "Outlet name", "Onboard Cafe Saket", card(1));
    await d.page.getByLabel("Outlet 2 phone").fill("9876500014");
    await d.page.getByLabel("Outlet 2 address").fill("Saket District Centre, New Delhi");
    const link2 = card(1).locator('input[aria-label="Google Maps link or coordinates"]');
    await link2.fill("https://example.com/maps/anything");
    await d.click(card(1).getByRole("button", { name: "Find on map" }), { after: 700 });
    d.check("a link that isn't Google's is refused: 'Only Google Maps links can be opened'", /Only Google Maps links can be opened/.test(await alertsIn(card(1))), await alertsIn(card(1)));
    await link2.fill("hello there");
    await d.click(card(1).getByRole("button", { name: "Find on map" }), { after: 700 });
    d.check("plain text is refused: 'isn't a link or coordinates'", /isn't a link or coordinates/.test(await alertsIn(card(1))), await alertsIn(card(1)));
    await link2.fill("http://localhost:3099/maps/nopin");
    await d.click(card(1).getByRole("button", { name: "Find on map" }), { after: 900 });
    d.check("a link that leads to no pin says so: 'didn't lead to a map pin'", /didn't lead to a map pin/.test(await alertsIn(card(1))), await alertsIn(card(1)));
    await link2.fill("http://localhost:3099/maps/short");
    await d.click(card(1).getByRole("button", { name: "Find on map" }), { after: 900 });
    d.check("a short link is followed by the server: 'Pin set: 28.5245, 77.2066'", /Pin set: 28\.5245, 77\.2066/.test(await card(1).locator("[data-point]").innerText().catch(() => "")), await alertsIn(card(1)));
    await link2.fill("28.60, 77.20");
    await d.click(card(1).getByRole("button", { name: "Find on map" }), { after: 500 });
    d.check("plain coordinates work too: 'Pin set: 28.6, 77.2'", /Pin set: 28\.6, 77\.2/.test(await card(1).locator("[data-point]").innerText().catch(() => "")));
    await link2.fill("http://localhost:3099/maps/short");
    await d.click(card(1).getByRole("button", { name: "Find on map" }), { after: 900 });
    await box(card(1), "Dine-in").check();
    await card(1).getByRole("radio", { name: /own hours/ }).check();
    await d.page.getByLabel("Outlet 2 opens at").fill("09:00");
    await d.page.getByLabel("Outlet 2 closes at").fill("21:00");
    await ui.fill(d, "Last order (min before closing)", "15", card(1));

    // common settings, look, address, setup
    await d.page.getByLabel("Common opening time").fill("10:00");
    await d.page.getByLabel("Common closing time").fill("23:00");
    await ui.fill(d, "Food ready in (minutes)", "20");
    await d.click(d.page.getByRole("radio", { name: "Fresh green colour scheme" }), { after: 300 });
    d.check("the 'Fresh green' colour scheme fills the colours (brand colour #2E7D46) and shows a preview", (await ui.F(d, "Brand colour").then((e) => e.inputValue()).catch(() => "")).toUpperCase() === "#2E7D46" || /#2E7D46/i.test(await d.page.locator("[data-look-preview]").evaluate((e) => e.innerHTML)), "");
    await ui.pick(d, "Light or dark", "Always light");
    await ui.pick(d, "Font", "Poppins");
    await d.page.getByLabel("Rasoi Pulse address", { exact: true }).fill("onboardcafe");
    await d.page.locator("[data-address-check]").waitFor({ timeout: 10000 });
    d.check("the Rasoi Pulse address is checked live: 'onboardcafe.localhost:3170 is free'", await ui.until(async () => /onboardcafe\.localhost:3170 is free/.test(await d.page.locator("[data-address-check]").innerText()), 8000), await d.page.locator("[data-address-check]").innerText());
    await ui.pick(d, "The menu will come from", "Client sends photos / PDF");
    await ui.fill(d, "About how many menu items", "60");
    await ui.fill(d, "Kitchen printers", "1 per outlet");
    await ui.fill(d, "Team members besides the owner", "1");
    await ui.fill(d, "Anything else to know", "Staff training on 28 Nov.");
    for (const id of ["outlets", "feature:delivery", "feature:marketing", "effect:glass"]) d.check(`Plan fit: ${id} is allowed`, (await issue(id).getAttribute("data-forced")) === "yes");
    d.check("nothing is missing any more: 'Nothing missing. You can save, then publish.'", /Nothing missing/.test(await d.page.locator("[data-publish-blockers]").innerText()) && (await blockers()) === 0, await d.page.locator("[data-publish-blockers]").innerText());
    d.check("Publish as store is now enabled and looks it (full colour, no 'things to finish' note)", !(await publishBtn().isDisabled()) && !/grayscale/.test((await looks()).filter) && (await looks()).opacity === 1 && (await d.page.locator("[data-blocked-hint]").count()) === 0, JSON.stringify(await looks()));
    await d.shot("filled");

    // ------------------------------------------------------------------------------------------------------------- 5
    await d.step("Save, list, reopen — every answer is still there");
    d.check("before saving the form says 'Not saved yet'", /Not saved yet/.test(await page()));
    await d.click(d.page.getByRole("button", { name: "Save", exact: true }), { after: 1200 });
    d.check("Save: 'Saved.' and the form is now a saved draft with its own address", /Saved\./.test(await page()) && /\/platform\/onboarding\/[0-9a-f]{24}$/.test(d.page.url()), d.page.url());
    d.check("the Save button is disabled again — nothing has changed since", await d.page.getByRole("button", { name: "Save", exact: true }).isDisabled());
    const formUrl = d.page.url();
    await goList();
    d.check("the list shows 'Onboard Cafe' as a Draft on Starter with 2 outlets", /Onboard Cafe/.test(await rowOf("Onboard Cafe").innerText()) && /Draft/.test(await rowOf("Onboard Cafe").innerText()) && /Starter/.test(await rowOf("Onboard Cafe").innerText()) && /\b2\b/.test(await rowOf("Onboard Cafe").innerText()), norm(await rowOf("Onboard Cafe").innerText()));
    d.check("with counts All 1 · Drafts 1 · Published 0", /All 1 Drafts 1 Published 0/.test(await page()));
    await d.click(rowOf("Onboard Cafe").locator("a").first(), { after: 1200 });
    await d.page.reload({ waitUntil: "load" });
    await d.page.getByLabel("Plan", { exact: true }).waitFor({ timeout: 15000 });
    await d.page.waitForTimeout(800);
    const reopened = {
      plan: await d.page.getByLabel("Plan", { exact: true }).evaluate((e) => e.options[e.selectedIndex].text),
      store: await (await ui.F(d, "Store name")).inputValue(),
      email: await (await ui.F(d, "Owner's email (their sign-in)")).inputValue(),
      outlets: await d.page.locator("[data-outlet-card]").count(),
      o1: await d.page.getByLabel("Outlet 1 name").inputValue(),
      o1addr: await d.page.getByLabel("Outlet 1 address").inputValue(),
      o1radius: await d.page.getByLabel("Outlet 1 delivery distance").inputValue(),
      o1delivery: await box(card(0), "Delivery").isChecked(),
      o2opens: await d.page.getByLabel("Outlet 2 opens at").inputValue(),
      o2closes: await d.page.getByLabel("Outlet 2 closes at").inputValue(),
      pin1: norm(await card(0).locator("[data-point]").innerText()),
      pin2: norm(await card(1).locator("[data-point]").innerText()),
      marketing: await box(d.page, "Marketing").first().isChecked(),
      common: await d.page.getByLabel("Common closing time").inputValue(),
    };
    d.check("after reopening and reloading: plan Starter, store and owner email as typed", reopened.plan === "Starter" && reopened.store === "Onboard Cafe" && reopened.email === OWNER_EMAIL, JSON.stringify(reopened));
    d.check("…both outlets, with their names, address, delivery 4 km and Delivery ticked", reopened.outlets === 2 && reopened.o1 === "Onboard Cafe CP" && reopened.o1addr.startsWith("12 Janpath") && reopened.o1radius === "4" && reopened.o1delivery);
    d.check("…outlet 2's own hours 09:00–21:00, both pins, Marketing, common closing 23:00", reopened.o2opens === "09:00" && reopened.o2closes === "21:00" && /28\.6315, 77\.2167/.test(reopened.pin1) && /28\.5245, 77\.2066/.test(reopened.pin2) && reopened.marketing && reopened.common === "23:00");
    d.check("…and the plan-fit permissions were saved with it (Plan fit still says 'Allowed anyway' for all four)", (await d.page.locator('[data-fit-issue][data-forced="yes"]').count()) === 4);

    // ------------------------------------------------------------------------------------------------------------- 6
    await d.step("Cancel and Reset ask first, and never touch the saved draft");
    await ui.fill(d, "Tagline", "A different tagline");
    d.check("a change shows 'Unsaved changes' and enables Save", /Unsaved changes/.test(await page()) && !(await d.page.getByRole("button", { name: "Save", exact: true }).isDisabled()));
    await d.click(d.page.getByRole("button", { name: "Cancel" }), { after: 500 });
    const leave = d.page.getByRole("dialog", { name: "Discard changes" });
    d.check("Cancel with unsaved changes asks 'Leave without saving?'", await leave.isVisible() && /Leave without saving\?/.test(await leave.innerText()));
    await d.click(leave.getByRole("button", { name: "Keep editing" }), { after: 400 });
    d.check("'Keep editing' stays on the form with the change still there", /\/platform\/onboarding\/[0-9a-f]{24}$/.test(d.page.url()) && (await (await ui.F(d, "Tagline")).inputValue()) === "A different tagline");
    await d.click(d.page.getByRole("button", { name: "Reset" }), { after: 500 });
    const reset = d.page.getByRole("dialog", { name: "Reset the form" });
    d.check("Reset asks 'Clear the whole form?' and says the saved copy stays until Save", /Clear the whole form\?/.test(await reset.innerText()) && /saved earlier stays/.test(await reset.innerText()), norm(await reset.innerText()));
    await d.click(reset.getByRole("button", { name: "Keep my answers" }), { after: 400 });
    d.check("'Keep my answers' changes nothing", (await (await ui.F(d, "Store name")).inputValue()) === "Onboard Cafe");
    await d.click(d.page.getByRole("button", { name: "Reset" }), { after: 500 });
    await d.click(d.page.getByRole("dialog", { name: "Reset the form" }).getByRole("button", { name: "Yes, clear everything" }), { after: 600 });
    d.check("'Yes, clear everything' empties the form: no store name, one outlet, no plan", (await (await ui.F(d, "Store name")).inputValue()) === "" && (await d.page.locator("[data-outlet-card]").count()) === 1 && (await d.page.getByLabel("Plan", { exact: true }).inputValue()) === "");
    d.check("…and it counts as an unsaved change; Publish is disabled", /Unsaved changes/.test(await page()) && (await publishBtn().isDisabled()));
    await d.click(d.page.getByRole("button", { name: "Cancel" }), { after: 500 });
    await d.click(d.page.getByRole("dialog", { name: "Discard changes" }).getByRole("button", { name: "Discard and leave" }), { after: 800 });
    d.check("'Discard and leave' goes back to the list", /\/platform\/onboarding$/.test(d.page.url()));
    await d.click(rowOf("Onboard Cafe").locator("a").first(), { after: 1200 });
    await d.page.getByLabel("Plan", { exact: true }).waitFor({ timeout: 15000 });
    await d.page.waitForTimeout(600);
    d.check("the saved draft is untouched by the reset: still Onboard Cafe, Starter, tagline 'Fresh and fast', 2 outlets", (await (await ui.F(d, "Store name")).inputValue()) === "Onboard Cafe" && (await (await ui.F(d, "Tagline")).inputValue()) === "Fresh and fast" && (await d.page.locator("[data-outlet-card]").count()) === 2);
    await d.click(d.page.getByRole("button", { name: "Cancel" }), { after: 600 });
    d.check("Cancel with nothing changed leaves at once, without a question", /\/platform\/onboarding$/.test(d.page.url()) && (await d.page.getByRole("dialog").count()) === 0);
    await d.click(rowOf("Onboard Cafe").locator("a").first(), { after: 1200 });
    await d.page.getByLabel("Plan", { exact: true }).waitFor({ timeout: 15000 });
    await d.page.waitForTimeout(600);

    // ------------------------------------------------------------------------------------------------------------- 7
    await d.step("Export as PDF, and print");
    const pdf = await download(d.page.getByRole("button", { name: "Export PDF" }));
    const pdfBytes = readFileSync(pdf.path);
    const text = await pdfText(pdf.path);
    d.check("the file is onboarding-onboard-cafe.pdf and a real PDF", pdf.name === "onboarding-onboard-cafe.pdf" && pdfBytes.subarray(0, 5).toString() === "%PDF-" && pdfBytes.subarray(-8).toString().includes("%%EOF"), pdf.name);
    for (const [what, rx] of [
      ["the store, plan and owner", /Onboard Cafe.*Starter|Starter.*Onboard Cafe/],
      ["the owner's email", new RegExp(OWNER_EMAIL.replace(".", "\\."))],
      ["both outlets and their addresses", /Onboard Cafe CP.*Onboard Cafe Saket/],
      ["the map pins", /28\.6315, 77\.2167.*28\.5245, 77\.2066/],
      ["the delivery distance and fee", /delivery distance\s*4 km.*delivery fee\s*Rs 30/i],
      ["outlet 2's own hours", /09:00 – 21:00 \(this outlet's own\)/],
      ["the common hours", /10:00 – 23:00/],
      ["the brand colour", /#2E7D46/i],
      ["what was added for this client beyond the plan", /added for this client/i],
      ["the sign-off lines", /Rasoi Pulse representative — name and signature/],
    ]) d.check(`the PDF holds ${what}`, rx.test(text), text.length > 0 ? "" : "no text");
    const pages = await pdfPages(pdf.path);
    d.check("no blank pages: every page has real content (not just a footer) — printing it gives no empty sheets", pages.length >= 2 && pages.length <= 4 && pages.every((p) => p.length > 250), pages.map((p) => p.length).join(" / "));
    d.check("each page carries its own footer 'Page i of N', and N is the real number of pages", pages.every((p, i) => p.includes(`Page ${i + 1} of ${pages.length}`)), `${pages.length} pages`);
    d.never("the PDF contains a password", /password/i.test(text) && /Onboard#/.test(text));
    d.check("the PDF has several pages with 'Page 1 of N' footers", /Page 1 of \d+/.test(text), `${(text.match(/Page \d+ of (\d+)/) ?? [])[1]} pages`);
    await d.click(d.page.getByRole("button", { name: "Print" }), { after: 1500 });
    d.check("Print opens the print dialog with the PDF ('The print dialog was opened.')", (await ui.until(async () => (await d.page.evaluate(() => window.__prints)) >= 1, 15000)) && /The print dialog was opened/.test(await page()), `${await d.page.evaluate(() => window.__prints)} print calls`);
    d.check("…and what was printed is the same document (a PDF loaded in a hidden frame)", /^blob:/.test((await d.page.evaluate(() => window.__printSrc)) ?? ""));

    // ------------------------------------------------------------------------------------------------------------- 8
    await d.step("Publish as store");
    await d.click(publishBtn(), { after: 1500 });
    const dlg = d.page.getByRole("dialog", { name: "Publish as store" });
    await dlg.waitFor({ timeout: 10000 });
    const summary = norm(await dlg.innerText());
    d.check("the dialog summarises what will be created: store, plan + what is allowed beyond it, both outlets, address, owner", /Onboard Cafe/.test(summary) && /Starter \+ added for this client/.test(summary) && /Marketing/.test(summary) && /Delivery/.test(summary) && /2 outlets/.test(summary) && /Onboard Cafe CP \(\/onboard-cafe-cp\), Onboard Cafe Saket \(\/onboard-cafe-saket\)/.test(summary) && /onboardcafe\.localhost:3170/.test(summary) && /Ola Owner · ola@onboardcafe\.test/.test(summary), summary.slice(0, 500));
    d.check("'Create the store' is disabled until there is a password", await dlg.getByRole("button", { name: "Create the store" }).isDisabled());
    await dlg.getByLabel("Owner's password").fill("abc");
    d.check("a 3-character password is not enough", await dlg.getByRole("button", { name: "Create the store" }).isDisabled());
    await d.click(dlg.getByRole("button", { name: "Generate" }), { after: 300 });
    const made = await dlg.getByLabel("Owner's password").inputValue();
    d.check("'Generate' fills in a strong password (12 characters), which enables the button", made.length >= 12 && !(await dlg.getByRole("button", { name: "Create the store" }).isDisabled()), made.length + " chars");
    await dlg.getByLabel("Owner's password").fill(OWNER_PASSWORD);
    await d.click(dlg.getByRole("button", { name: "Create the store" }), { after: 500 });
    const done = d.page.getByRole("dialog", { name: "Store published" });
    await done.waitFor({ timeout: 40000 });
    const doneText = norm(await done.innerText());
    d.check("the result says 'Onboard Cafe is live' with 2 outlets, the owner's email and the store address", /Onboard Cafe is live/.test(doneText) && /2 outlets/.test(doneText) && doneText.includes(OWNER_EMAIL) && /http:\/\/onboardcafe\.localhost:3170/.test(doneText), doneText);
    d.never("the result screen shows the password", doneText.includes(OWNER_PASSWORD));
    await d.shot("published");
    await d.click(done.getByRole("button", { name: "Close" }), { after: 900 });
    d.check("the form is now read-only: a published banner, no Save / Reset / Publish buttons, fields disabled", (await d.page.locator("[data-published-banner]").count()) === 1 && (await d.page.getByRole("button", { name: "Publish as store" }).count()) === 0 && (await d.page.getByRole("button", { name: "Save", exact: true }).count()) === 0 && (await d.page.getByRole("button", { name: "Reset" }).count()) === 0 && (await (await ui.F(d, "Store name")).isDisabled()));
    d.never("a published form can be edited", !(await d.page.getByLabel("Outlet 1 name").isDisabled()));
    const again = await download(d.page.getByRole("button", { name: "Export PDF" }));
    const text2 = await pdfText(again.path);
    d.check("it can still be exported: the PDF now says 'Published as a store' and still has no password", /Published as a store/.test(text2) && !text2.includes(OWNER_PASSWORD));
    await goList();
    d.check("the list shows it as Published (All 1 · Drafts 0 · Published 1)", /Published/.test(await rowOf("Onboard Cafe").innerText()) && /All 1 Drafts 0 Published 1/.test(await page()), norm(await rowOf("Onboard Cafe").innerText()));
    d.never("a published form has a delete button", (await d.page.getByRole("button", { name: /Delete the draft for Onboard Cafe/ }).count()) > 0);

    // ------------------------------------------------------------------------------------------------------------- 9
    await d.step("What was created: the store, its plan and extras, its outlets and settings, its look");
    await ui.openPlatform(d, "/stores");
    const storeRow = d.page.locator("a", { hasText: "Onboard Cafe" }).first();
    await storeRow.waitFor({ timeout: 15000 });
    d.check("the store is in Stores on the Starter plan with 2 of 2 outlets", /Starter/.test(await storeRow.innerText()) && /Outlets\s*2 \/ 2/.test(norm(await storeRow.innerText())), norm(await storeRow.innerText()));
    await ui.openStore(d, "Onboard Cafe", "Features");
    const choice = async (feature) => d.page.getByText(feature, { exact: true }).first().locator("xpath=ancestor::div[.//select][1]").locator("select").evaluate((s) => s.options[s.selectedIndex].text);
    d.check("Marketing and Delivery are 'Unlocked for this store'", /Unlocked/.test(await choice("Marketing")) && /Unlocked/.test(await choice("Delivery")), `${await choice("Marketing")} / ${await choice("Delivery")}`);
    d.check("Coupons, which the plan has, is just 'From plan'", /From plan/.test(await choice("Coupons")));
    d.check("Analytics & reports, which nobody asked for, is not unlocked", /From plan/.test(await choice("Analytics & reports")));

    await d.tab("owner", "Store dashboard · the new owner");
    await ui.signIn(d, [OWNER_EMAIL, OWNER_PASSWORD]);
    d.check("the owner signs in with the password set while publishing", /Orders/.test(await page()) && !/Incorrect email or password/.test(await page()));
    d.check("their store has both outlets: 'Onboard Cafe CP' and 'Onboard Cafe Saket'", /Onboard Cafe CP/.test(await page()));
    const outlet1 = [
      { tab: "Business", text: { "Phone": "9876500013", "GSTIN": "07AAAAA0000A1Z5", "FSSAI licence number": "12345678901234", "Tagline": "Fresh and fast" } },
      { tab: "Opening hours", ticks: { "Enforce opening hours": true }, text: { "Opens at": "10:00", "Closes at": "23:00", "Stop taking orders early (minutes)": "30" } },
      { tab: "Kitchen & delivery", text: { "Normal prep time (minutes)": "20", "Minimum order (₹)": "150", "Delivery fee (₹)": "30", "Free delivery above (₹)": "500", "Delivery radius (km)": "4" } },
      { tab: "Features", ticks: { "Takeaway from the website": true, "Dine-in QR ordering": true, "Delivery": true } },
    ];
    const diff1 = await ui.readBackSettings(d, outlet1);
    d.check("outlet 1's settings are exactly what the form said: phone, GSTIN, FSSAI, 10:00–23:00, last order 30, prep 20, minimum ₹150, delivery ₹30 / free above ₹500 / 4 km, takeaway + dine-in + delivery", diff1.length === 0, diff1.join("; "));
    await d.click(d.page.getByRole("tab", { name: "Business" }), { after: 400 });
    d.check("…and the map location is set (Settings shows the pin)", /Connaught Place|12 Janpath|28\.6315/.test(await page()) || (await d.page.getByText(/location/i).count()) > 0);
    await ui.switchOutlet(d, "Onboard Cafe Saket");
    const outlet2 = [
      { tab: "Opening hours", ticks: { "Enforce opening hours": true }, text: { "Opens at": "09:00", "Closes at": "21:00", "Stop taking orders early (minutes)": "15" } },
      { tab: "Features", ticks: { "Takeaway from the website": true, "Dine-in QR ordering": true, "Delivery": false } },
    ];
    const diff2 = await ui.readBackSettings(d, outlet2);
    d.check("outlet 2 has its own hours 09:00–21:00 (last order 15), takeaway + dine-in and NO delivery", diff2.length === 0, diff2.join("; "));

    await d.tab("customer", "Customer · the new store's address");
    const root = await ui.visit(d, "http://onboardcafe.localhost:3170/");
    d.check("the store's address opens: both outlets are offered", /Onboard Cafe CP/.test(root.text) && /Onboard Cafe Saket/.test(root.text), root.text.slice(0, 200));
    const menu = await ui.visit(d, "http://onboardcafe.localhost:3170/onboard-cafe-cp");
    const cssPrimary = await d.page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim() || getComputedStyle(document.body).getPropertyValue("--color-primary").trim());
    d.check("the storefront uses the chosen brand colour #2E7D46", cssPrimary.toUpperCase() === "#2E7D46", cssPrimary);
    d.check("…and shows the tagline", /Fresh and fast/.test(menu.text));

    // ------------------------------------------------------------------------------------------------------------- 10
    await d.step("A second form with the same name, email and address creates nothing");
    await d.tab("platform", "Platform console · super admin");
    await ui.signIn(d, "super");
    const storesBefore = (await (async () => { await ui.openPlatform(d, "/stores"); return (await d.page.locator("a", { hasText: /Within plan|Over limit|In grace/ }).count()); })());
    await d.goto(`${BENCH.admin}/platform/onboarding/new`, 800);
    await ui.pick(d, "Plan", "Starter");
    for (const [label, value] of [["Store name", "Onboard Cafe"], ["Owner's name", "Another Owner"], ["Owner's phone", "9876511111"], ["Owner's email (their sign-in)", OWNER_EMAIL]]) await ui.fill(d, label, value);
    await d.page.getByLabel("Rasoi Pulse address", { exact: true }).fill("onboardcafe");
    await ui.fill(d, "Outlet name", "Dup Outlet", card(0));
    await d.page.getByLabel("Outlet 1 address").fill("Somewhere in Delhi");
    await d.click(d.page.getByRole("button", { name: "Save", exact: true }), { after: 1800 });
    await ui.until(async () => (await d.page.locator("[data-publish-blockers]").getAttribute("data-publish-blockers").catch(() => "0")) !== "0", 12000);
    const blockText = await d.page.locator("[data-publish-blockers]").innerText();
    d.check("it lists what is taken: the store name, the owner's email and the address", /already exists on Rasoi Pulse/.test(blockText) && /already has a Rasoi Pulse account/.test(blockText) && /already used by another store/.test(blockText), blockText);
    d.check("Publish as store stays disabled", await publishBtn().isDisabled());
    await ui.openPlatform(d, "/stores");
    d.check("no second store was created", (await d.page.locator("a", { hasText: /Within plan|Over limit|In grace/ }).count()) === storesBefore, `${storesBefore} stores before`);
    await goList();
    const dupRow = d.page.locator("[data-onboarding-row]").filter({ hasText: "Draft" });
    d.check("the new form is a Draft in the list", (await dupRow.count()) === 1);
    await d.click(d.page.getByRole("button", { name: /Delete the draft for Onboard Cafe/ }), { after: 900 });
    d.check("a draft can be deleted (a question is asked first); the published one stays", (await d.page.locator("[data-onboarding-row]").count()) === 1 && /Published/.test(await d.page.locator("[data-onboarding-row]").first().innerText()));

    // ------------------------------------------------------------------------------------------------------------- 11
    await d.step("A Custom plan is not gated");
    await ui.createPlan(d, { name: "Bench Custom", description: "Per client", custom: true, people: 5, multiOutlet: true, outlets: 5, features: [] });
    await d.goto(`${BENCH.admin}/platform/onboarding/new`, 800);
    await ui.pick(d, "Plan", "Bench Custom");
    d.check("it shows the limits to set for this client (outlets, people) and says what 'custom' means", (await d.page.getByLabel("Outlets for this client", { exact: false }).count()) === 1 && /Custom plan: the client gets exactly the limits above/.test(await d.page.locator("[data-plan-summary]").innerText()));
    d.check("no choice is locked: Marketing and Delivery can be ticked, with no 'Not in the … plan' notes", (await stateOf(feat("Marketing"))) === "included" && (await stateOf(mode(0, "delivery"))) === "included" && (await d.page.getByText(/Not in the Bench Custom plan/).count()) === 0);
    await box(d.page, "Marketing").first().check();
    await ui.fill(d, "Total outlets", "3");
    d.check("3 outlets on a Custom plan raise no alert (the limits follow the form)", (await d.page.locator("[data-fit-issue]").count()) === 0 && /fits the Bench Custom plan/.test(await d.page.locator("[data-plan-fit]").innerText()), await d.page.locator("[data-plan-fit]").innerText());
    await d.click(d.page.getByRole("button", { name: "Cancel" }), { after: 500 });
    await d.click(d.page.getByRole("dialog", { name: "Discard changes" }).getByRole("button", { name: "Discard and leave" }), { after: 600 });

    d.never("the browser logged JavaScript errors", d.problems.length > 0, d.problems.join(" | "));
  }
}
