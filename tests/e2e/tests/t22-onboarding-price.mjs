// T22 — The onboarding form's price estimate, the Price list behind it, the always-available Custom plan, and the plan dialog's layout.
// All in Chrome as the platform super admin. Two plans are made first (Basic ₹999, Business ₹2,499, set up like Basic and Pro).
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import * as ui from "../bench/ui.mjs";
import { BENCH } from "../bench/watch.mjs";

const pdfParse = createRequire(import.meta.url)("pdf-parse/lib/pdf-parse.js");
const DL_DIR = fileURLToPath(new URL("../.bench/downloads/", import.meta.url));

export const meta = {
  id: "t22-onboarding-price",
  title: "Onboarding price estimate — price list, plan + extras, Custom starts above the dearest plan, discount / GST / yearly, the Custom plan, plan dialog",
  area: "onboarding",
  fresh: true,
  summary: "In Chrome. With no priced plans yet the Custom estimate says what to do first. Two plans are created: Basic (one outlet, 5 people, four features, ₹999 a month) and Business (three outlets, 20 people, every feature, ₹2,499). The Price list page shows the starting prices (each extra outlet ₹250, person ₹15, GST 18%, a price per feature) and that they add up: Basic → Business adds nine features (₹775), two outlets (₹500) and fifteen people (₹225) = ₹1,500 — exactly the plans' difference. On the onboarding form, Basic alone is ₹999 (+GST ₹180 = ₹1,179 a month; ₹12,731 for a year paid up front); ticking Marketing and Delivery, a second outlet and a team of seven adds ₹100 + ₹100 + ₹250 + 3 × ₹15, a 10% discount and GST are applied, and the form says only Business fits as it is. The Custom plan (listed even though nobody created it) starts from the dearest plan, ₹2,499, and adds ₹250 per outlet and ₹15 per person beyond Business's limits, so it is always dearer than every standard plan, and warns when a standard plan would do. Editing the price list changes the estimate. Prices never appear on the PDF. Publishing a Custom form creates the real Custom plan and puts the store on it with the limits asked for. The 'New plan' dialog has its limits stacked and aligned, its Save button always in view, and dropdown arrows with room to spare.",
  expect: [
    "Before any plan has a price, Custom's estimate says to give Basic and Pro a monthly price.",
    "The Price list shows the starting prices and, with Basic ₹999 and Business ₹2,499, 'They agree' for Basic → Business (₹1,500 = ₹1,500).",
    "Basic alone: ₹999, GST ₹180, ₹1,179 a month; yearly (10% off) ₹12,731 with GST.",
    "Basic + Marketing + Delivery + 1 extra outlet + 3 extra people = ₹1,494; 10% discount −₹149; GST ₹242; ₹1,587 a month; only Business fits as it is.",
    "Custom: Business's ₹2,499 + 2 more outlets (₹500) + 5 more people (₹75) = ₹3,074 — dearer than Business; each extra outlet adds exactly ₹250 and each extra person ₹15.",
    "A Custom need that a standard plan would cover shows a note saying so.",
    "Changing the price list (extra outlet ₹400, Marketing ₹130) changes the estimate; 'Back to the starting prices' asks first.",
    "A plan with no monthly price says so in the estimate.",
    "The PDF has no prices.",
    "Publishing on Custom creates the real Custom plan; the store is on it with 2 outlets / 3 people and Marketing unlocked.",
    "The New plan dialog: limits stacked and left-aligned, Save always visible, dropdown arrow with space on its right.",
  ],
  expectNot: [
    "Custom must NOT cost less than, or the same as, the dearest standard plan.",
    "An unpriced plan or missing price list must NOT show a made-up number.",
    "Prices must NOT appear on the PDF.",
    "The browser must NOT log JavaScript errors.",
  ],
};

const OWNER_EMAIL = "pricing@custom-cafe.test";
const norm = (t) => t.replace(/\s+/g, " ").trim();
const num = (s) => Number(String(s).replace(/[^\d.-]/g, ""));

export async function run(d, h) {
  mkdirSync(DL_DIR, { recursive: true });
  const page = () => ui.text(d);
  const est = () => d.page.locator("[data-estimate]");
  const estText = async () => norm(await est().innerText());
  const lines = async () => (await d.page.locator("[data-estimate-line]").allInnerTexts()).map(norm);
  const money = async (attr) => num(await d.page.locator(`[data-estimate-${attr}]`).innerText());
  const card = (n) => d.page.locator("[data-outlet-card]").nth(n);
  const newForm = async () => { await d.goto(`${BENCH.admin}/platform/onboarding/new`, 900); await d.page.getByLabel("Plan", { exact: true }).waitFor({ timeout: 15000 }); };
  const box = (scope, name) => scope.getByRole("checkbox", { name: new RegExp(`^\\s*${name}`) });
  const waitEstimate = async (rx, ms = 8000) => ui.until(async () => rx.test(await estText()), ms);

  await d.tab("platform", "Platform console · super admin");
  await ui.signIn(d, "super");

  // ------------------------------------------------------------------------------------------------------------- 1
  await d.step("Before any plan has a price, there is nothing to estimate");
  await newForm();
  await ui.pick(d, "Plan", "Custom");
  d.check("the Custom plan is offered although nobody has created it", /Custom/.test(await d.page.getByLabel("Plan", { exact: true }).evaluate((e) => e.options[e.selectedIndex].text)));
  d.check("its estimate says to give Basic and Pro a monthly price first — no number", await waitEstimate(/give your Basic and Pro plans a monthly price/) && (await d.page.locator("[data-estimate-line]").count()) === 0, await estText());
  await ui.pick(d, "Plan", "Starter");
  d.check("a standard plan with no monthly price says so: 'has no monthly price yet', ₹0", await waitEstimate(/Starter plan has no monthly price yet/) && (await money("subtotal")) === 0, await estText());

  // ------------------------------------------------------------------------------------------------------------- 2
  await d.step("Two plans with prices: Basic ₹999 and Business ₹2,499");
  await ui.createPlan(d, { name: "Basic", description: "One outlet, the essentials", people: 5, multiOutlet: false, features: ["Takeaway ordering", "Dine-in QR ordering", "Coupons", "Printing"], monthly: 999, yearly: 10 });
  await ui.createPlan(d, { name: "Business", description: "Every feature, up to three outlets", people: 20, multiOutlet: true, outlets: 3, features: "all", monthly: 2499, yearly: 10 });
  await ui.openPlatform(d, "/plans");
  d.check("both plans are listed", /Basic/.test(await page()) && /Business/.test(await page()));

  // ------------------------------------------------------------------------------------------------------------- 3
  await d.step("The Price list: starting prices, and do they add up?");
  await d.goto(`${BENCH.admin}/platform/onboarding`, 800);
  await d.click(d.page.getByRole("button", { name: "Price list" }), { after: 900 });
  await d.page.waitForURL(/\/platform\/onboarding\/pricing/, { timeout: 10000 });
  const price = async (label) => Number(await d.page.getByLabel(label, { exact: true }).inputValue());
  d.check("the starting prices: Delivery ₹100, Dine-in ₹200, Marketing ₹100, Online payments ₹50, WhatsApp chat ₹150", (await price("Delivery price")) === 100 && (await price("Dine-in QR ordering price")) === 200 && (await price("Marketing price")) === 100 && (await price("Online payments price")) === 50 && (await price("WhatsApp chat price")) === 150);
  d.check("each extra outlet ₹250, each extra person ₹15, GST 18%", (await price("Each extra outlet price")) === 250 && (await price("Each extra person price")) === 15 && (await price("GST percent")) === 18);
  d.check("'Your plans' lists Basic ₹999 and Business ₹2,499 (Custom: priced by this list)", /Basic\s*₹999 \/ month/.test(norm(await d.page.getByRole("table", { name: "Plan prices" }).innerText())) && /Business\s*₹2,499 \/ month/.test(norm(await d.page.getByRole("table", { name: "Plan prices" }).innerText())));
  const steps = norm(await d.page.locator("[data-price-steps]").innerText());
  d.check("'Do the prices add up?': Basic → Business adds 9 features, 2 outlets, 15 people — this list charges ₹1,500, the plans differ by ₹1,500: 'They agree.'", /Basic → Business/.test(steps) && /9 features, 2 outlets, 15 people/.test(steps) && /charges ₹1,500/.test(steps) && /differ by ₹1,500/.test(steps) && /They agree/.test(steps) && (await d.page.locator("[data-step-gap]").first().getAttribute("data-step-gap")) === "0", steps);
  await d.shot("price-list");

  // ------------------------------------------------------------------------------------------------------------- 4
  await d.step("A standard plan: its own price, then GST and the year");
  await newForm();
  await ui.pick(d, "Plan", "Basic");
  await waitEstimate(/Basic plan/);
  d.check("Basic alone is one line: 'Basic plan ₹999'", (await lines()).length === 1 && /Basic plan ₹999/.test((await lines())[0]), (await lines()).join(" | "));
  d.check("a month ₹999, GST (18%) ₹180, pays ₹1,179 a month", (await money("subtotal")) === 999 && (await money("gst")) === 180 && (await money("total")) === 1179, await estText());
  d.check("paying for the year (10% off): ₹12,731 with GST, about ₹899 a month, saving ₹1,199", /₹12,731/.test(await d.page.locator("[data-estimate-yearly]").innerText()) && /₹899/.test(await d.page.locator("[data-estimate-yearly]").innerText()) && /₹1,199/.test(await d.page.locator("[data-estimate-yearly]").innerText()), await d.page.locator("[data-estimate-yearly]").innerText());
  d.check("both Basic and Business are said to fit as they are", /Basic \(₹999\), Business \(₹2,499\)/.test(await d.page.locator("[data-estimate-fits]").innerText()), await d.page.locator("[data-estimate-fits]").innerText());

  // ------------------------------------------------------------------------------------------------------------- 5
  await d.step("Asking for more than Basic: each extra is priced, then a discount");
  await ui.tick(d, "Add Marketing for this client", true);
  d.check("Marketing (added for this client) adds ₹100 → ₹1,099", await waitEstimate(/Marketing ₹100/) && (await money("subtotal")) === 1099, (await lines()).join(" | "));
  await ui.fill(d, "Total outlets", "2");
  await ui.tick(d, "Add extra outlets for this client", true);
  d.check("a second outlet adds ₹250 ('1 extra outlet × ₹250') → ₹1,349", await waitEstimate(/1 extra outlet × ₹250 ₹250/) && (await money("subtotal")) === 1349, (await lines()).join(" | "));
  await ui.tick(d, "Add Delivery for this client", true);
  d.check("Delivery adds ₹100 → ₹1,449", await waitEstimate(/Delivery ₹100/) && (await money("subtotal")) === 1449, (await lines()).join(" | "));
  await ui.fill(d, "Team members besides the owner", "7");
  d.check("a team of 7 + the owner is 8 people, 3 over Basic's 5: '3 extra people × ₹15' ₹45 → ₹1,494", await waitEstimate(/3 extra people × ₹15 ₹45/) && (await money("subtotal")) === 1494, (await lines()).join(" | "));
  d.check("the lines in order: Basic ₹999, Marketing ₹100, Delivery ₹100, outlet ₹250, people ₹45", (await lines()).map((l) => num(l.match(/₹([\d,]+)$/)?.[1])).join(",") === "999,100,100,250,45", (await lines()).join(" | "));
  await ui.fill(d, "Discount for this client (%)", "10");
  d.check("10% discount: −₹149 → ₹1,345, GST ₹242, pays ₹1,587 a month", await waitEstimate(/Discount \(10%\)/) && (await money("discount")) === 149 && (await money("gst")) === 242 && (await money("total")) === 1587, await estText());
  d.check("the yearly price follows: ₹17,141 with GST (saving ₹1,614)", /₹17,141/.test(await d.page.locator("[data-estimate-yearly]").innerText()) && /₹1,614/.test(await d.page.locator("[data-estimate-yearly]").innerText()), await d.page.locator("[data-estimate-yearly]").innerText());
  d.check("only Business fits these needs as they are (₹2,499) — Basic plus extras is cheaper than upgrading", /Business \(₹2,499\)/.test(await d.page.locator("[data-estimate-fits]").innerText()) && !/Basic \(/.test(await d.page.locator("[data-estimate-fits]").innerText()) && (await money("subtotal")) < 2499);
  await d.shot("estimate");

  // ------------------------------------------------------------------------------------------------------------- 6
  await d.step("The discount is saved with the form; the PDF has no prices");
  await ui.fill(d, "Store name", "Pricing Cafe");
  await ui.fill(d, "Owner's name", "Pia Pricing");
  await ui.fill(d, "Owner's phone", "9876500055");
  await ui.fill(d, "Owner's email (their sign-in)", OWNER_EMAIL);
  await ui.fill(d, "Outlet name", "Pricing Cafe One", card(0));
  await ui.fill(d, "Outlet name", "Pricing Cafe Two", card(1));
  await d.page.getByLabel("Outlet 1 address").fill("1 Test Road, Delhi");
  await d.page.getByLabel("Outlet 2 address").fill("2 Test Road, Delhi");
  await d.click(d.page.getByRole("button", { name: "Save", exact: true }), { after: 1500 });
  d.check("saved", /Saved\./.test(await page()) && /\/platform\/onboarding\/[0-9a-f]{24}$/.test(d.page.url()));
  await d.page.reload({ waitUntil: "load" });
  await d.page.getByLabel("Plan", { exact: true }).waitFor({ timeout: 15000 });
  await waitEstimate(/Discount \(10%\)/, 12000);
  d.check("after reloading, the 10% discount and the ₹1,587 are still there", (await d.page.getByLabel("Discount for this client").inputValue()) === "10" && (await money("total")) === 1587);
  const [file] = await Promise.all([d.page.waitForEvent("download", { timeout: 30000 }), d.click(d.page.getByRole("button", { name: "Export PDF" }), { after: 500 })]);
  const pdfPath = `${DL_DIR}${Date.now()}-${file.suggestedFilename()}`;
  await file.saveAs(pdfPath);
  const pdf = (await pdfParse(readFileSync(pdfPath))).text.replace(/\s+/g, " ");
  d.never("the PDF shows the estimate (estimated price, 'Pays a month', ₹1,587, or the discount)", /estimated price|pays a month/i.test(pdf) || /1,587|1,494|1,345/.test(pdf));
  d.check("it is still the full form (the store name and the outlets are in it)", /Pricing Cafe/.test(pdf) && /Pricing Cafe One/.test(pdf));

  // ------------------------------------------------------------------------------------------------------------- 7
  await d.step("The Custom plan: starts from the dearest plan and goes up in steps");
  await newForm();
  await ui.pick(d, "Plan", "Custom");
  await waitEstimate(/Business plan — every feature, up to 3 outlets and 20 people/);
  d.check("a small need on Custom is just the dearest plan: 'Business plan — every feature, up to 3 outlets and 20 people ₹2,499'", (await lines()).length === 1 && /Business plan/.test((await lines())[0]) && (await money("subtotal")) === 2499, (await lines()).join(" | "));
  d.check("and says a standard plan would do: 'These needs fit the Basic plan (₹999)… Custom is for clients who need more'", /fit the Basic plan \(₹999 a month\)/.test(await estText()) && /Custom is for clients who need more/.test(await estText()), await d.page.locator("[data-estimate-notes]").innerText().catch(() => "no note"));
  d.check("no limits to set beyond Business: the form shows the Custom limits boxes (outlets, people)", (await d.page.getByLabel("Outlets for this client").count()) === 1 && (await d.page.getByLabel("People for this client").count()) === 1);
  await ui.fill(d, "Total outlets", "5");
  await ui.fill(d, "Team members besides the owner", "24");
  await waitEstimate(/2 more outlets \(5 in all\)/);
  d.check("5 outlets and 25 people: Business ₹2,499 + 2 more outlets × ₹250 (₹500) + 5 more people × ₹15 (₹75)", (await lines()).length === 3 && /2 more outlets \(5 in all\) × ₹250 ₹500/.test((await lines())[1]) && /5 more people \(25 in all\) × ₹15 ₹75/.test((await lines())[2]), (await lines()).join(" | "));
  d.check("total ₹3,074 a month — dearer than Business's ₹2,499 and Basic's ₹999", (await money("subtotal")) === 3074 && (await money("subtotal")) > 2499, await estText());
  d.never("the Custom estimate is not above the dearest standard plan", (await money("subtotal")) <= 2499);
  d.check("no standard plan fits: 'No standard plan fits this on its own.'", /No standard plan fits this on its own/.test(await d.page.locator("[data-estimate-fits]").innerText()));
  // one more outlet, one more person: exactly +250 and +15
  await ui.fill(d, "Total outlets", "6");
  await waitEstimate(/3 more outlets \(6 in all\)/);
  const sixOutlets = await money("subtotal");
  await ui.fill(d, "Team members besides the owner", "25");
  await waitEstimate(/6 more people \(26 in all\)/);
  const withPerson = await money("subtotal");
  d.check("each extra outlet adds exactly ₹250 (3,074 → 3,324) and each extra person exactly ₹15 (→ 3,339)", sixOutlets === 3324 && withPerson === 3339, `${sixOutlets} then ${withPerson}`);
  await ui.fill(d, "Outlets for this client", "8");
  await waitEstimate(/5 more outlets \(8 in all\)/);
  d.check("setting the outlets the client was promised (8) prices them even before the cards exist: 5 more outlets × ₹250", (await money("subtotal")) === 2499 + 5 * 250 + 6 * 15, await estText());
  await d.click(d.page.getByRole("button", { name: "Cancel" }), { after: 500 });
  await d.click(d.page.getByRole("dialog", { name: "Discard changes" }).getByRole("button", { name: "Discard and leave" }), { after: 600 });

  // ------------------------------------------------------------------------------------------------------------- 8
  await d.step("Change the price list: the estimate follows; Back to the starting prices asks first");
  await d.goto(`${BENCH.admin}/platform/onboarding/pricing`, 900);
  await ui.fillBox(d, "Each extra outlet price", 400);
  await ui.fillBox(d, "Marketing price", 130);
  d.check("the page says 'Unsaved changes'", /Unsaved changes/.test(await page()));
  await d.click(d.page.getByRole("button", { name: "Save the price list" }), { after: 1200 });
  d.check("saved: the page says 'Saved'", await ui.until(async () => (await d.page.locator("[data-saved]").count()) > 0, 6000));
  d.check("'Do the prices add up?' now says the plans are ₹330 cheaper than this list (2 outlets × ₹150 more, plus Marketing ₹30 more)", /cheaper than this list says/.test(await d.page.locator("[data-price-steps]").innerText()) && /₹330/.test(await d.page.locator("[data-price-steps]").innerText()), await d.page.locator("[data-price-steps]").innerText());
  await d.page.reload({ waitUntil: "load" });
  await d.page.getByLabel("Each extra outlet price", { exact: true }).waitFor({ timeout: 15000 });
  d.check("after a reload the new prices are still there", (await price("Each extra outlet price")) === 400 && (await price("Marketing price")) === 130);
  await newForm();
  await ui.pick(d, "Plan", "Basic");
  await ui.tick(d, "Add Marketing for this client", true);
  await ui.fill(d, "Total outlets", "2");
  await ui.tick(d, "Add extra outlets for this client", true);
  await waitEstimate(/1 extra outlet × ₹400 ₹400/);
  d.check("on the form: Marketing is now ₹130 and an extra outlet ₹400 (Basic ₹999 + 130 + 400 = ₹1,529)", (await lines()).some((l) => /Marketing ₹130/.test(l)) && (await money("subtotal")) === 1529, (await lines()).join(" | "));
  await d.click(d.page.getByRole("button", { name: "Cancel" }), { after: 500 });
  await d.click(d.page.getByRole("dialog", { name: "Discard changes" }).getByRole("button", { name: "Discard and leave" }), { after: 600 });
  await d.goto(`${BENCH.admin}/platform/onboarding/pricing`, 900);
  await d.click(d.page.getByRole("button", { name: "Back to the starting prices" }), { after: 500 });
  const dlg = d.page.getByRole("dialog", { name: "Back to the starting prices" });
  d.check("'Back to the starting prices' asks first", /Go back to the starting prices\?/.test(await dlg.innerText()));
  await d.click(dlg.getByRole("button", { name: "Keep my prices" }), { after: 400 });
  d.check("'Keep my prices' changes nothing (extra outlet still ₹400)", (await price("Each extra outlet price")) === 400);
  await d.click(d.page.getByRole("button", { name: "Back to the starting prices" }), { after: 400 });
  await d.click(d.page.getByRole("dialog", { name: "Back to the starting prices" }).getByRole("button", { name: "Use the starting prices" }), { after: 500 });
  d.check("'Use the starting prices' puts ₹250 and ₹100 back (unsaved until Save)", (await price("Each extra outlet price")) === 250 && (await price("Marketing price")) === 100 && /Unsaved changes/.test(await page()));
  await d.click(d.page.getByRole("button", { name: "Save the price list" }), { after: 1200 });
  d.check("saved again: the plans and the list agree once more ('They agree.')", await ui.until(async () => /They agree/.test(await d.page.locator("[data-price-steps]").innerText()), 6000));

  // ------------------------------------------------------------------------------------------------------------- 9
  await d.step("Publishing a Custom form creates the real Custom plan and puts the store on it");
  await ui.openPlatform(d, "/plans");
  const customCards = () => d.page.locator("section").filter({ has: d.page.getByRole("heading", { name: "Custom", exact: true }) });
  d.check("no Custom plan has been created yet (it is only created the first time it is needed)", (await customCards().count()) === 0);
  await newForm();
  await ui.pick(d, "Plan", "Custom");
  await ui.fill(d, "Store name", "Custom Cafe");
  await ui.fill(d, "Owner's name", "Cora Custom");
  await ui.fill(d, "Owner's phone", "9876500066");
  await ui.fill(d, "Owner's email (their sign-in)", OWNER_EMAIL);
  await ui.fill(d, "Total outlets", "2");
  await ui.fill(d, "Outlet name", "Custom Cafe One", card(0));
  await ui.fill(d, "Outlet name", "Custom Cafe Two", card(1));
  await d.page.getByLabel("Outlet 1 address").fill("1 Custom Road, Delhi");
  await d.page.getByLabel("Outlet 2 address").fill("2 Custom Road, Delhi");
  await ui.fill(d, "Team members besides the owner", "2");
  await ui.tick(d, "Marketing", true);
  d.check("on Custom nothing is disabled or flagged 'Not in the plan'", !(await box(d.page, "Marketing").first().isDisabled()) && (await d.page.getByText(/Not in the Custom plan/).count()) === 0 && (await d.page.locator("[data-fit-issue]").count()) === 0);
  d.check("the estimate: Business ₹2,499 (3 outlets and 20 people cover it) — it says a standard plan would do", (await money("subtotal")) === 2499 && /Custom is for clients who need more/.test(await estText()));
  await d.click(d.page.getByRole("button", { name: "Publish as store" }), { after: 1800 });
  const pub = d.page.getByRole("dialog", { name: "Publish as store" });
  await pub.waitFor({ timeout: 15000 });
  await pub.getByLabel("Owner's password").fill("Custom#2026");
  await d.click(pub.getByRole("button", { name: "Create the store" }), { after: 500 });
  await d.page.getByRole("dialog", { name: "Store published" }).waitFor({ timeout: 40000 });
  d.check("the store was created", /Custom Cafe is live/.test(await d.page.getByRole("dialog", { name: "Store published" }).innerText()));
  await d.click(d.page.getByRole("dialog", { name: "Store published" }).getByRole("button", { name: "Close" }), { after: 700 });
  await ui.openPlatform(d, "/plans");
  d.check("the Custom plan now exists, as a real plan, with this store on it", (await customCards().count()) === 1 && /1 store/.test(norm(await customCards().first().innerText())), norm(await customCards().first().innerText()).slice(0, 200));
  await ui.openPlatform(d, "/stores");
  const row = d.page.locator("a", { hasText: "Custom Cafe" }).first();
  await row.waitFor({ timeout: 15000 });
  const rowText = norm(await row.innerText());
  d.check("in Stores: Custom Cafe is on the Custom plan with 2 of 2 outlets and 1 of 3 people", /Custom/.test(rowText) && /Outlets\s*2 \/ 2/.test(rowText) && /People\s*1 \/ 3/.test(rowText), rowText);
  await ui.openStore(d, "Custom Cafe", "Features");
  const marketing = await d.page.getByText("Marketing", { exact: true }).first().locator("xpath=ancestor::div[.//select][1]").locator("select").evaluate((s) => s.options[s.selectedIndex].text);
  d.check("Marketing, which was ticked, is unlocked for the store", /Unlocked/.test(marketing), marketing);

  // ------------------------------------------------------------------------------------------------------------- 10
  await d.step("The New plan dialog: tidy limits, Save always in reach, room for the dropdown arrow");
  await ui.openPlatform(d, "/plans");
  await d.click(d.page.getByRole("button", { name: "New plan" }), { after: 800 });
  const modal = d.page.getByRole("dialog", { name: "New plan" });
  const people = modal.getByLabel("People (owners included)");
  const multi = modal.getByRole("checkbox", { name: /^\s*Multi-outlet/ });
  const pb = await people.boundingBox();
  const mb = await multi.boundingBox();
  d.check("the 'Multi-outlet' box sits directly under the people limit, on the same left edge", Math.abs(pb.x - mb.x) < 24 && mb.y > pb.y + pb.height - 4, `people x=${Math.round(pb.x)} y=${Math.round(pb.y)} · multi x=${Math.round(mb.x)} y=${Math.round(mb.y)}`);
  const unl = await modal.getByRole("checkbox", { name: /^\s*Unlimited/ }).first().boundingBox();
  d.check("'Unlimited' is on the same line as the people number", Math.abs(unl.y - pb.y) < 14, `${Math.round(unl.y)} vs ${Math.round(pb.y)}`);
  await multi.check();
  const outlets = await modal.locator("label", { has: d.page.locator("span", { hasText: /^Outlets$/ }) }).locator("input[type=number]").boundingBox();
  d.check("ticking Multi-outlet shows the 'Outlets' limit below it, aligned with the others", Math.abs(outlets.x - pb.x) < 4 && outlets.y > mb.y, `${Math.round(outlets.x)} vs ${Math.round(pb.x)}`);
  const save = modal.getByRole("button", { name: "Save plan" });
  const sb = await save.boundingBox();
  const vh = await d.page.evaluate(() => window.innerHeight);
  d.check("'Save plan' is in view without scrolling the dialog (it stays at the bottom)", sb && sb.y + sb.height <= vh + 1 && sb.y >= 0, `button at y=${Math.round(sb?.y)}–${Math.round((sb?.y ?? 0) + (sb?.height ?? 0))} of ${vh}`);
  await d.press("Escape", 400);
  await newForm();
  const sel = await d.page.getByLabel("Plan", { exact: true }).evaluate((s) => { const c = getComputedStyle(s); return { pr: parseFloat(c.paddingRight), pl: parseFloat(c.paddingLeft), bg: c.backgroundImage.slice(0, 12), app: c.appearance }; });
  d.check("a dropdown (the Plan box) has room for its arrow: more padding on the right than the left, its own arrow drawn", sel.pr >= 28 && sel.pr > sel.pl && /url\(/.test(sel.bg) && sel.app === "none", JSON.stringify(sel));

  d.never("the browser logged JavaScript errors", d.problems.length > 0, d.problems.join(" | "));
}
