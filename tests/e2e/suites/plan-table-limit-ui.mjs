// Tables on a plan, in Chrome against the bench: the wide New plan pop-up (no scrolling, sections side by side, the tables limit in fives),
// the store page's own table limit, the store owner's Tables page when the plan's tables are all used, and the onboarding form's tables box.
// What it adds to the bench is removed at the end (the one plan it makes is archived: plans can't be deleted).
import { chromium } from "playwright";
const AD = "http://localhost:3171";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const problems = [];
let seenProblems = 0;
// (a browser error is reported next to the check it appeared during, so it can be traced)
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); if (problems.length > seenProblems) { console.log(`      ^ browser error during/before this check: ${problems.slice(seenProblems).join(" | ").slice(0, 160)}`); seenProblems = problems.length; } };
const login = async (email, password) => (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const su = await login("super@sandbox.test", "Super123!");
const ownerB = await login("o@beta.test", "Owner123!");
const call = async (cookie, method, path, body, headers = {}) => { const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie, ...headers }, body: body ? JSON.stringify(body) : undefined }); let json = {}; try { json = await r.json(); } catch {} return { status: r.status, json }; };
const norm = (t) => t.replace(/\s+/g, " ").trim();
const PLAN = `UI Table Plan ${String(Date.now()).slice(-5)}`; // (a new name every run: archived plans from earlier runs stay in the list)

const stores = (await call(su, "GET", "/api/platform/stores")).json;
const beta = (stores.stores ?? stores).find((s) => /Beta/.test(s.name));
const betaOutlet = String((o => o._id ?? o.id)(((await call(ownerB, "GET", "/api/outlets")).json.outlets).find((o) => o.slug === "only")));
const asB = { "x-rasoipulse-outlet": betaOutlet };
const betaTables = async () => (await call(ownerB, "GET", "/api/tables", null, asB)).json.tables;
const betaStore = async () => { const j = (await call(su, "GET", `/api/platform/stores/${beta.id}`)).json; return j.store ?? j; };
const made = [];
let planId = null;

const browser = await chromium.launch();
const newPage = async (viewport = { width: 1440, height: 900 }) => {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon|WebSocket/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  page.on("dialog", (d) => d.accept()); // (a "leave this page?" question)
  return page;
};
const signIn = async (page, email, pw, ready = "text=Sign out") => {
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', email); await page.fill('input[type="password"]', pw);
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector(ready, { timeout: 20000 });
};
const text = async (page) => norm(await page.locator("body").innerText());

try {
  const start = await betaStore();
  ok(start.max.tables === 5 && start.usage.tables <= 3, "the bench's Beta store is on a 5-table plan and has at most 3 tables to begin with", `max ${start.max.tables}, has ${start.usage.tables}`);

  /* ------------------------------------------------------------------------------------------ A. the plan pop-up */
  console.log("== A. Plans: tables on the cards, and the wide New plan pop-up");
  const sp = await newPage({ width: 1440, height: 900 });
  await signIn(sp, "super@sandbox.test", "Super123!");
  await sp.goto(AD + "/platform/plans", { waitUntil: "load" });
  await sp.getByRole("button", { name: /new plan/i }).waitFor({ timeout: 15000 });
  await sp.getByTestId("plan-edit-Starter").waitFor({ timeout: 15000 });
  const plansText = await text(sp);
  ok(/3 people · 1 outlet \(multi-outlet off\) · 5 tables/.test(plansText), "the Starter card says '… · 5 tables'", plansText.match(/3 people[^A-Z]{0,60}/)?.[0]);
  ok(/Unlimited tables/.test(plansText), "a plan with no table limit says 'Unlimited tables'");

  await sp.getByRole("button", { name: /new plan/i }).click();
  const form = sp.getByTestId("plan-form");
  await form.waitFor();
  await sp.waitForTimeout(500); // (the pop-up grows in)
  const geo = () => sp.evaluate(() => {
    const f = document.querySelector('[data-testid="plan-form"]');
    const dlg = f.closest("[role=dialog]");
    const r = (e) => e.getBoundingClientRect();
    const head = (t) => [...f.querySelectorAll("div")].find((e) => e.children.length === 0 && e.textContent.trim() === t);
    const at = (e) => (e ? { x: Math.round(r(e).left), y: Math.round(r(e).top) } : null);
    return {
      width: Math.round(r(dlg).width), scrolls: f.scrollHeight > f.clientHeight + 1, scrollH: f.scrollHeight, clientH: f.clientHeight,
      features: at(head("Features")), looks: at(head("Visual effects")), website: at(head("On the website")),
      people: at(f.querySelector('[data-testid="plan-limit-people"]')), tables: at(f.querySelector('[data-testid="plan-limit-tables"]')),
    };
  });
  const g1 = await geo();
  ok(g1.width >= 1200, "the pop-up is wide (at least 1,200 px on a 1,440 px screen — it used to be 720)", `${g1.width}px`);
  ok(!g1.scrolls, "…and a normal screen shows the whole plan without scrolling", `content ${g1.scrollH}px in ${g1.clientH}px`);
  ok(g1.features && g1.looks && g1.website && Math.abs(g1.features.y - g1.looks.y) <= 3 && Math.abs(g1.looks.y - g1.website.y) <= 3 && g1.features.x < g1.looks.x && g1.looks.x < g1.website.x, "Features, Visual effects and On the website stand side by side, level at the top", JSON.stringify([g1.features, g1.looks, g1.website]));
  ok(g1.people && g1.tables && Math.abs(g1.people.y - g1.tables.y) <= 2 && g1.people.x < g1.tables.x, "the limits are on one row: people, then tables", JSON.stringify([g1.people, g1.tables]));
  await form.getByText("Show this plan on the website's Pricing").click();
  await sp.waitForTimeout(200);
  const g2 = await geo();
  ok(!g2.scrolls, "with the website's price fields opened too, it still fits without scrolling", `content ${g2.scrollH}px in ${g2.clientH}px`);
  await form.getByText("Show this plan on the website's Pricing").click();

  console.log("== A2. The tables limit goes up in fives");
  const tbl = sp.getByTestId("plan-limit-tables");
  const typeInto = async (v, key = "Tab") => { await tbl.click(); await sp.keyboard.press("ControlOrMeta+a"); await sp.keyboard.type(String(v)); await sp.keyboard.press(key); await sp.waitForTimeout(80); return tbl.inputValue(); };
  ok((await tbl.inputValue()) === "5", "a new plan starts with 5 tables");
  const rounded = {};
  for (const v of [12, 4, 54, 0, 20, 7]) rounded[v] = await typeInto(v);
  ok(rounded[12] === "15" && rounded[4] === "5" && rounded[54] === "55" && rounded[0] === "5" && rounded[20] === "20" && rounded[7] === "10", "typing 12, 4, 54, 0, 20, 7 gives 15, 5, 55, 5, 20, 10 (rounded UP to the next five, never below 5)", JSON.stringify(rounded));
  const before = (await call(su, "GET", "/api/platform/plans")).json.plans.length;
  const afterEnter = await typeInto(12, "Enter");
  ok(afterEnter === "15" && (await form.isVisible()) && (await call(su, "GET", "/api/platform/plans")).json.plans.length === before, "pressing Enter in the box rounds it (12 → 15) and does NOT save the plan");
  // (the second "Unlimited" box is the one beside Tables; a box is pressed through the label around it, as a person would)
  const unl = form.getByRole("checkbox", { name: /^\s*Unlimited/ }).nth(1);
  await unl.locator("xpath=ancestor::label[1]").click();
  ok((await unl.isChecked()) && (await tbl.isDisabled()), "ticking Unlimited beside Tables switches the number off");
  await unl.locator("xpath=ancestor::label[1]").click();
  ok(!(await tbl.isDisabled()) && (await tbl.inputValue()) === "5", "…and un-ticking it brings back a number (5)");

  console.log("== A3. 'Include every feature' (this crashed before: it used a function the pop-up didn't have)");
  await form.getByText("Include every feature", { exact: false }).first().click();
  await sp.waitForTimeout(150);
  const featureBoxes = form.getByRole("checkbox", { name: /Takeaway ordering|Kitchen display|Own domain name/ });
  const states = await featureBoxes.evaluateAll((els) => els.map((e) => ({ on: e.checked, off: e.disabled })));
  ok(states.length === 3 && states.every((s) => s.on && s.off), "ticking it ticks every feature and locks the list (no crash)", JSON.stringify(states));
  await form.getByText("Include every feature", { exact: false }).first().click();
  ok((await featureBoxes.evaluateAll((els) => els.every((e) => !e.disabled))), "…and un-ticking it frees the list again");

  console.log("== A4. Custom plans have no limits of their own");
  await form.getByText("Custom plan —", { exact: false }).click();
  await sp.waitForTimeout(150);
  ok((await sp.getByTestId("plan-limit-tables").count()) === 0 && /people, outlets and tables/.test(norm(await form.innerText())), "ticking Custom hides the limits and the note says people, outlets and tables are set on each store");
  await form.getByText("Custom plan —", { exact: false }).click();

  console.log("== A5. Save, and edit");
  await form.locator("input").first().fill(PLAN);
  await typeInto(15);
  await sp.getByRole("button", { name: "Save plan" }).click();
  await form.waitFor({ state: "hidden", timeout: 8000 });
  const saved = (await call(su, "GET", "/api/platform/plans")).json.plans.find((p) => p.name === PLAN);
  planId = saved?.id;
  ok(saved?.limits.maxTables === 15, "the plan is saved with 15 tables", String(saved?.limits?.maxTables));
  ok(new RegExp(PLAN).test(await text(sp)) && /15 tables/.test(await text(sp)), "its card says '15 tables'");
  await sp.getByTestId(`plan-edit-${PLAN}`).click();
  await form.waitFor();
  await sp.waitForTimeout(400);
  ok((await sp.getByTestId("plan-limit-tables").inputValue()) === "15", "editing it shows 15 tables");
  await typeInto(25);
  await sp.getByRole("button", { name: "Save plan" }).click();
  await form.waitFor({ state: "hidden", timeout: 8000 });
  ok((await call(su, "GET", "/api/platform/plans")).json.plans.find((p) => p.name === PLAN).limits.maxTables === 25, "…and 25 is saved");

  /* ------------------------------------------------------------------------------------------ B. the store's own limit */
  console.log("== B. Console → the store → Plan & limits");
  await sp.goto(`${AD}/platform/stores/${beta.id}`, { waitUntil: "load" });
  await sp.getByRole("tab", { name: "Plan & limits" }).click();
  await sp.getByText("Limits for this store").waitFor({ timeout: 15000 });
  ok(/Tables\s*\d+ \/ 5/.test(await text(sp)), "the store's header shows 'Tables n / 5'");
  const tablesSelect = sp.locator("label", { hasText: "Tables (all outlets)" }).locator("select");
  ok((await tablesSelect.inputValue()) === "plan" && /From plan — 5/.test(await tablesSelect.innerText()), "the Tables limit says 'From plan — 5' to begin with");
  await tablesSelect.selectOption("custom");
  const own = sp.getByTestId("store-limit-tables");
  ok((await own.inputValue()) === "5", "choosing 'Custom number' starts from the plan's 5");
  await own.click(); await sp.keyboard.press("ControlOrMeta+a"); await sp.keyboard.type("12"); await sp.keyboard.press("Tab");
  ok((await own.inputValue()) === "15", "typing 12 gives 15 (rounded up to the next five)");
  await sp.getByRole("button", { name: /^\s*Save\s*$/ }).click();
  await sp.waitForTimeout(1200);
  const s1 = await betaStore();
  ok(s1.max.tables === 15 && s1.overrides.limits.maxTables === 15, "saved: this store now has 15 tables (the plan still says 5)", `${s1.max.tables} / ${s1.overrides.limits.maxTables}`);
  ok(/Tables\s*\d+ \/ 15/.test(await text(sp)), "the header now says 'Tables n / 15'");
  await tablesSelect.selectOption("plan");
  await sp.getByRole("button", { name: /^\s*Save\s*$/ }).click();
  await sp.waitForTimeout(1200);
  const s2 = await betaStore();
  ok(s2.max.tables === 5 && s2.overrides.limits.maxTables === undefined, "'From plan' takes the store back to the plan's 5");

  /* ------------------------------------------------------------------------------------------ C. the owner's Tables page */
  console.log("== C. The owner's Tables page when the plan's tables are all used");
  const op = await newPage({ width: 1360, height: 900 });
  await signIn(op, "o@beta.test", "Owner123!", "text=Orders");
  const have0 = (await betaTables()).length;
  for (let i = have0; i < 3; i++) { const r = await call(ownerB, "POST", "/api/tables", { number: `UI${i + 1}`, seats: 2 }, asB); if (r.status === 201) made.push(r.json.table.id); }
  await op.goto(AD + "/tables", { waitUntil: "load" });
  await op.getByText("Add a table").waitFor({ timeout: 15000 });
  await op.getByText(/of 5 tables used/).waitFor({ timeout: 15000 });
  ok(/3 of 5 tables used/.test(await text(op)), "with 3 tables the page says '3 of 5 tables used (all outlets together)'");
  ok((await op.getByTestId("table-limit-note").count()) === 0 && !(await op.getByRole("button", { name: "Add table" }).isDisabled()), "…no warning, and Add table works");
  const addForm = op.locator("form").filter({ has: op.getByRole("button", { name: "Add table" }) });
  await addForm.locator("input").first().fill("UI-4");
  await op.getByRole("button", { name: "Add table" }).click();
  await op.getByText("4 of 5 tables used").waitFor({ timeout: 8000 });
  ok(true, "adding the 4th table updates the count at once ('4 of 5 tables used')");
  const five = await call(ownerB, "POST", "/api/tables", { number: "UI-5", seats: 2 }, asB);
  if (five.status === 201) made.push(five.json.table.id);
  (await betaTables()).filter((t) => /^UI-4$/.test(t.number)).forEach((t) => made.push(t.id));
  await op.reload({ waitUntil: "load" });
  await op.getByText("Add a table").waitFor({ timeout: 15000 });
  const note = op.getByTestId("table-limit-note");
  await note.waitFor({ timeout: 8000 });
  ok(/Your plan allows 5 tables and all are in use/.test(await note.innerText()) && /5 at a time/.test(await note.innerText()), "with 5 of 5 used, a warning says so, and that tables are added 5 at a time");
  const addBtn = op.getByRole("button", { name: "Add table" });
  ok(await addBtn.isDisabled(), "…and the Add table button is switched off");
  ok(/5 of 5 tables used/.test(await text(op)), "…the page says '5 of 5 tables used'");
  const refused = await call(ownerB, "POST", "/api/tables", { number: "UI-6", seats: 2 }, asB);
  ok(refused.status === 409 && /allows 5 tables/.test(refused.json.error), "the server refuses a 6th table too (409)", `${refused.status} ${refused.json.error}`);
  const toRemove = (await betaTables()).find((t) => /^UI/.test(t.number));
  await call(ownerB, "DELETE", `/api/tables/${toRemove.id}`, null, asB);
  await op.reload({ waitUntil: "load" });
  await op.getByText("Add a table").waitFor({ timeout: 15000 });
  ok((await op.getByTestId("table-limit-note").count()) === 0 && !(await op.getByRole("button", { name: "Add table" }).isDisabled()), "after a table is removed the warning goes and Add table works again");
  await addForm.locator("input").first().fill("UI-LAST");
  await op.getByRole("button", { name: "Add table" }).click();
  await op.getByTestId("table-limit-note").waitFor({ timeout: 8000 });
  ok(true, "adding the last free table brings the warning up straight away, without reloading the page");

  /* ------------------------------------------------------------------------------------------ D. the onboarding form */
  console.log("== D. Onboarding form: tables");
  await sp.goto(AD + "/platform/onboarding/new", { waitUntil: "load" });
  const planSel = sp.getByLabel("Plan", { exact: true });
  await planSel.waitFor({ timeout: 15000 });
  await planSel.selectOption({ label: "Starter" });
  const field = sp.locator("[data-tables-field]");
  await field.scrollIntoViewIfNeeded();
  const value = () => field.locator("input").inputValue();
  ok((await value()) === "0", "the Tables box starts at 0 (not needed / not decided)");
  await field.getByRole("button", { name: "One more five tables" }).click();
  ok((await value()) === "5" && (await sp.locator("[data-extra-tables]").count()) === 0, "the + button moves by five (0 → 5), and 5 fits Starter: no warning");
  await field.getByRole("button", { name: "One more five tables" }).click();
  const extra = sp.locator("[data-extra-tables]");
  await extra.waitFor({ timeout: 5000 });
  ok((await value()) === "10" && /allows 5 tables and this form has 10/.test(norm(await extra.innerText())), "10 tables on Starter: a red warning says what the plan allows and what the form has", norm(await extra.innerText()).slice(0, 120));
  const issue = sp.locator('[data-fit-issue="tables"]');
  ok((await issue.count()) === 1 && (await issue.getAttribute("data-forced")) === "no", "the Plan fit panel lists it as a problem to fix");
  await extra.getByLabel("Add extra tables for this client").check();
  await sp.waitForTimeout(150);
  ok(/Added for this client/.test(norm(await extra.innerText())) && (await issue.getAttribute("data-forced")) === "yes", "'Add the extra tables for this client' turns it into a note (amber) and clears the problem");
  const typed = field.locator("input");
  await typed.click(); await sp.keyboard.press("ControlOrMeta+a"); await sp.keyboard.type("12"); await sp.keyboard.press("Tab");
  ok((await value()) === "15" && /15 will be allowed/.test(norm(await extra.innerText())), "typing 12 gives 15, and the note says 15 will be allowed");
  for (let i = 0; i < 3; i++) await field.getByRole("button", { name: "One fewer five tables" }).click();
  ok((await value()) === "0" && (await sp.locator("[data-extra-tables]").count()) === 0, "stepping back down to 0 removes the warning");
  await typed.click(); await sp.keyboard.press("ControlOrMeta+a"); await sp.keyboard.type("25"); await sp.keyboard.press("Tab");
  await planSel.selectOption({ label: "Pro" });
  await sp.waitForTimeout(200);
  ok((await sp.locator("[data-extra-tables]").count()) === 0, "25 tables on a plan with no table limit (Pro here): no warning");
  await planSel.selectOption({ label: "Custom" });
  await sp.waitForTimeout(200);
  const customTables = sp.getByLabel("Total tables for this client");
  ok((await customTables.count()) === 1 && (await customTables.inputValue()) === "5", "on the Custom plan there is a 'Tables for this client' box, starting at 5 (the smallest size)");

  /* ------------------------------------------------------------------------------------------ E. the price list */
  console.log("== E. Price list");
  await sp.goto(AD + "/platform/onboarding/pricing", { waitUntil: "load" });
  const per5 = sp.getByLabel("Every five extra tables price");
  await per5.waitFor({ timeout: 15000 });
  ok((await per5.inputValue()) === "100", "the price list has 'Every 5 extra tables (₹)', starting at 100");
  ok(/Tables are only sold in fives|Every 5 extra tables/.test(await text(sp)), "…beside the outlet and person prices");

  ok(problems.length === 0, "no errors or warnings in the browser", problems.slice(0, 3).join(" | "));
} finally {
  // what this test added to the bench is taken away again
  for (const t of await betaTables().catch(() => [])) if (/^UI/.test(t.number)) await call(ownerB, "DELETE", `/api/tables/${t.id}`, null, asB).catch(() => {});
  if (planId) await call(su, "PATCH", `/api/platform/plans/${planId}`, { archived: true }).catch(() => {});
  await call(su, "PATCH", `/api/platform/stores/${beta.id}/plan`, { planId: beta.plan?.id ?? undefined, overrides: { limits: {}, entitlements: { features: { unlock: [], lock: [] }, effects: { unlock: [], lock: [] }, qrCardFamilies: { unlock: [], lock: [] } } } }).catch(() => {});
  await browser.close();
}
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
