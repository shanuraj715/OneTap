// Console → Stores → a store → Plan & limits, in Chrome against the bench (super admin: super@sandbox.test): the store remembers what it had set up on each plan.
//   - Picking a plan the store has NEVER had says "starts clean" and that what it has now is kept; Save says what was kept;
//   - picking a plan it HAD before says what it had then and puts those limits back in the boxes before saving; Save says "is back";
//   - picking the plan it is on now says nothing.
// What it adds to the bench is removed at the end (its two plans are archived: plans can't be deleted; the store goes back to its own plan).
import { chromium } from "playwright";
const AD = "http://localhost:3171";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const problems = [];
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);
const login = async () => (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "super@sandbox.test", password: "Super123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const su = await login();
const call = async (method, path, body) => { const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie: su }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json().catch(() => ({})) }; };
const norm = (t) => t.replace(/\s+/g, " ").trim();
const tag = String(Date.now()).slice(-5);
const CUSTOM = `Memory Custom ${tag}`, NORMAL = `Memory Plan ${tag}`;

const beta = (await call("GET", "/api/platform/stores")).json.stores.find((s) => /Beta/.test(s.name));
const was = (await call("GET", `/api/platform/stores/${beta.id}`)).json.store; // to put it back at the end
const made = [];
const NOTHING = { limits: {}, entitlements: { features: { unlock: [], lock: [] }, effects: { unlock: [], lock: [] }, qrCardFamilies: { unlock: [], lock: [] } } };

const browser = await chromium.launch();
try {
  const mkPlan = async (body) => { const p = (await call("POST", "/api/platform/plans", body)).json.plan; made.push(p.id); return p; };
  const custom = await mkPlan({ name: CUSTOM, custom: true });
  const normal = await mkPlan({ name: NORMAL, limits: { maxUsers: 4, multiOutlet: true, maxOutlets: 2, maxTables: 10 }, entitlements: { features: ["takeaway", "dineInQr"] } });
  // the store is on its Custom plan, with limits and a feature set by hand
  const set = await call("PATCH", `/api/platform/stores/${beta.id}/plan`, { planId: custom.id, overrides: { limits: { maxUsers: 12, multiOutlet: true, maxOutlets: 7, maxTables: 40 }, entitlements: { features: { unlock: ["marketing"], lock: [] } } } });
  ok(set.status === 200 && set.json.store.limits.maxOutlets === 7, "set-up: the store is on a Custom plan with 7 outlets, 12 people and marketing", `HTTP ${set.status}`);

  const ctx = await browser.newContext({ viewport: { width: 1360, height: 1100 } });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon|WebSocket/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', "super@sandbox.test");
  await page.fill('input[type="password"]', "Super123!");
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector("aside a");
  await page.goto(`${AD}/platform/stores/${beta.id}`, { waitUntil: "load" });
  await page.getByRole("tab", { name: /Plan & limits/ }).click();
  const planSelect = page.locator("select").filter({ has: page.locator(`option:text-is("${CUSTOM}")`) }).first();
  await planSelect.waitFor({ timeout: 15000 });
  const clean = page.getByTestId("plan-starts-clean-note"), back = page.getByTestId("plan-restored-note"), saved = page.getByTestId("plan-saved-note");
  const numbers = async () => page.locator('input[type="number"]').evaluateAll((els) => els.map((e) => e.value));
  const saveBtn = page.getByRole("button", { name: /^\s*Save/ });

  say("1. The plan it is on: nothing said");
  ok((await planSelect.inputValue()) === custom.id, "the Plan box shows the Custom plan");
  ok((await clean.count()) === 0 && (await back.count()) === 0 && (await saved.count()) === 0, "no note about remembered settings yet");

  say("2. A plan it never had: starts clean, and what it has now is kept");
  await planSelect.selectOption(normal.id);
  await clean.waitFor({ timeout: 5000 });
  let t = norm(await clean.innerText());
  ok(/starts clean/.test(t) && t.includes(NORMAL), "the note says the new plan starts clean", t.slice(0, 160));
  ok(/7 outlets/.test(t) && /12 people/.test(t) && /marketing/.test(t) && t.includes(CUSTOM), "…and what the store has on its Custom plan (7 outlets, 12 people, marketing) is kept and comes back", t.slice(0, 260));
  ok((await back.count()) === 0, "the 'had it before' note is NOT shown");
  await saveBtn.click();
  await saved.waitFor({ timeout: 8000 });
  t = norm(await saved.innerText());
  ok(new RegExp(`Moved to ${NORMAL}`).test(t) && /starts clean/.test(t) && /kept/.test(t), "Save says it moved, started clean and kept the old settings", t);
  let st = (await call("GET", `/api/platform/stores/${beta.id}`)).json.store;
  ok(st.plan.id === normal.id && st.limits.maxOutlets === 2 && st.limits.maxUsers === 4 && !st.entitlements.features.includes("marketing"), "the store is on the new plan with ITS limits (2 outlets, 4 people) — the 7 did not carry over", `${st.limits.maxOutlets}/${st.limits.maxUsers}`);

  say("3. Back to a plan it had: the old settings come back, shown before saving");
  await planSelect.selectOption(custom.id);
  await back.waitFor({ timeout: 5000 });
  t = norm(await back.innerText());
  ok(new RegExp(`had ${CUSTOM} before`).test(t), "the note says the store had this plan before", t.slice(0, 120));
  ok(/7 outlets/.test(t) && /12 people/.test(t) && /marketing/.test(t) && /Save to keep it/.test(t), "…lists what it had (7 outlets, 12 people, marketing) and says Save keeps it", t.slice(0, 260));
  ok((await clean.count()) === 0, "the 'starts clean' note is NOT shown");
  ok(!/keeps what it has today/.test(norm(await page.locator("body").innerText())), "…and the Custom-plan note does NOT say it 'keeps what it has today' (the old settings are what comes back)");
  const nums = await numbers();
  ok(nums.includes("7") && nums.includes("12") && nums.includes("40"), "the limit boxes already hold 7, 12 and 40 (before saving)", nums.join(", "));
  await page.screenshot({ path: "plan-memory-restored.png" });
  await saveBtn.click();
  await saved.waitFor({ timeout: 8000 });
  await page.screenshot({ path: "plan-memory-saved.png" });
  t = norm(await saved.innerText());
  ok(new RegExp(`Moved to ${CUSTOM}`).test(t) && /is back/.test(t) && /7 outlets/.test(t), "Save says the old settings are back", t);
  st = (await call("GET", `/api/platform/stores/${beta.id}`)).json.store;
  ok(st.plan.id === custom.id && st.limits.maxOutlets === 7 && st.limits.maxUsers === 12 && st.limits.maxTables === 40 && st.entitlements.features.includes("marketing"), "the store really has them again (7 outlets, 12 people, 40 tables, marketing)", JSON.stringify(st.limits));

  say("4. The plan it is already on: nothing said");
  await page.reload({ waitUntil: "load" });
  await page.getByRole("tab", { name: /Plan & limits/ }).click();
  await planSelect.waitFor();
  await planSelect.selectOption(normal.id);
  await planSelect.selectOption(custom.id);
  ok((await clean.count()) === 0 && (await back.count()) === 0, "picking the plan it is on (after looking at another) shows no note");
  ok(problems.length === 0, "no errors in the browser", problems.slice(0, 2).join(" | "));
  await page.screenshot({ path: "plan-memory.png" });
} finally {
  // put the store back on its own plan; archive the two plans this test made
  await call("PATCH", `/api/platform/stores/${beta.id}/plan`, { planId: was.plan?.id ?? null, overrides: was.overrides ?? NOTHING }).catch(() => {});
  for (const id of made) await call("PATCH", `/api/platform/plans/${id}`, { archived: true }).catch(() => {});
  await browser.close();
}
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
