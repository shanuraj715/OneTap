// The console's "Team & roles" page and what a team member sees, in Chrome against the bench (super admin: super@sandbox.test):
//   - the super admin makes a role (Onboarding only), adds a person with it (a password is made for them and shown once);
//   - that person signs in on another browser: the sidebar has ONLY Onboarding, /platform goes there, every other page says "Your role doesn't include this page",
//     and the pages they CAN open never ask the server for something they may not have (no 403 on the way);
//   - changing the role changes their sidebar on the next page load; switching them off signs them out;
//   - a "Stores — view" role sees stores but can't change one: no Create store, no Open dashboard, no ⋮ menu, every field switched off;
//   - the sidebar says "App Management" (it used to be "App updates"); the Activity tab lists what was done. What it makes is removed at the end.
import { chromium } from "playwright";
const AD = "http://localhost:3171";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const problems = [];
let seen = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); if (problems.length > seen) { console.log(`      ^ browser error: ${problems.slice(seen).join(" | ").slice(0, 200)}`); seen = problems.length; } };
const say = (s) => console.log(`\n=== ${s}`);
const norm = (t) => t.replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* retry */ } await sleep(200); } return false; };
const stamp = String(Date.now()).slice(-6);

const login = async (email, password) => (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const su = await login("super@sandbox.test", "Super123!");
const sa = async (method, path, body) => { const r = await fetch(`${API}/api/platform${path}`, { method, headers: { cookie: su, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); let json = {}; try { json = await r.json(); } catch { /* empty */ } return { status: r.status, json }; };
const store = (await sa("GET", "/stores")).json.stores?.[0];

const browser = await chromium.launch();
const open = async (width = 1360) => {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  const forbidden = [];
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon|WebSocket/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  page.on("response", (r) => { if (r.status() === 403 && r.url().includes("/api/")) forbidden.push(`${r.request().method()} ${new URL(r.url()).pathname}`); });
  return { ctx, page, forbidden };
};
const signIn = async (page, email, password) => {
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
};
const sidebar = async (page) => (await page.locator("aside a").allInnerTexts()).map(norm).filter(Boolean);

const made = { roles: [], members: [] };
try {
  const A = await open();
  const page = A.page;
  await signIn(page, "super@sandbox.test", "Super123!");
  await page.waitForSelector("aside a");

  say("1. The super admin's sidebar");
  const nav = await sidebar(page);
  ok(nav.includes("App Management") && !nav.includes("App updates"), "the sidebar says 'App Management' (it used to say 'App updates')", nav.join(" | "));
  ok(nav.includes("Team & roles"), "…and has 'Team & roles'");
  await page.getByRole("link", { name: "Team & roles" }).first().click();
  await page.getByRole("heading", { name: "Team & roles" }).waitFor({ timeout: 15000 });
  ok(page.url().endsWith("/platform/team"), "it opens /platform/team");

  say("2. A role: Sales, with only Onboarding");
  await page.getByRole("tab", { name: /Roles/ }).click();
  await page.getByTestId("team-new-role").click();
  await page.getByTestId("role-dialog").waitFor();
  const dlg = norm(await page.getByRole("dialog").innerText());
  ok(/Stores — view/.test(dlg) && /SALES/i.test(dlg) && /Onboarding/.test(dlg) && /Website enquiries/.test(dlg) && /App Management/.test(dlg) && /Delete a whole store/.test(dlg), "the role window lists every feature, grouped, each with a line saying what it lets a person do");
  ok(!/Team & roles/.test(dlg.replace("Team & roles is never part of a role", "")), "…Team & roles is not one of them (it stays the super admin's alone)");
  ok(await page.getByTestId("role-save").isDisabled(), "'Make the role' waits for a name");
  await page.getByTestId("role-name").fill("Sales " + stamp);
  await page.locator('[data-feature="onboarding:manage"] input[type="checkbox"]').check();
  await page.getByTestId("role-save").click();
  await page.getByTestId(`role-row-Sales ${stamp}`).waitFor({ timeout: 8000 });
  const roleRow = norm(await page.getByTestId(`role-row-Sales ${stamp}`).innerText());
  ok(/Onboarding/.test(roleRow) && !/Stores|Plans|Server/.test(roleRow), "the role is in the list, holding Onboarding only", roleRow);
  const roles = (await sa("GET", "/roles")).json.roles;
  const sales = roles.find((r) => r.name === `Sales ${stamp}`);
  made.roles.push(sales?.id);
  ok(sales && JSON.stringify(sales.features) === JSON.stringify(["onboarding:manage"]), "saved with exactly that one feature");

  say("3. A person with that role");
  await page.getByRole("tab", { name: /People/ }).click();
  await page.getByTestId("team-new-member").click();
  await page.getByTestId("member-dialog").waitFor();
  const email = `sam.${stamp}@rasoipulse.test`;
  await page.getByTestId("member-name").fill("Sam Sales");
  await page.getByTestId("member-email").fill(email);
  await page.getByTestId("member-role").selectOption({ label: `Sales ${stamp}` });
  const password = await page.getByTestId("member-password").inputValue();
  ok(password.length >= 10 && /[A-Za-z]/.test(password) && /\d/.test(password), "a strong password is made for them (10+ characters, letters and a number)", password.replace(/./g, "•"));
  await page.getByTestId("member-save").click();
  await page.getByTestId("member-password-shown").waitFor({ timeout: 8000 });
  ok((await page.getByTestId("member-password-shown").innerText()).trim() === password, "it is shown once so it can be told to them");
  await page.getByRole("button", { name: "Done" }).click();
  const row = page.getByTestId(`member-row-${email}`);
  await row.waitFor();
  ok(/Sales/.test(norm(await row.innerText())) && /Active/.test(norm(await row.innerText())), "Sam is in the list: Active, role Sales");
  made.members.push((await sa("GET", "/team")).json.members.find((m) => m.email === email)?.id);

  say("4. Sam signs in (another browser)");
  const B = await open();
  await signIn(B.page, email, password);
  await B.page.waitForSelector("aside a", { timeout: 20000 });
  const samNav = await sidebar(B.page);
  ok(JSON.stringify(samNav) === JSON.stringify(["Onboarding"]), "Sam's sidebar has ONE item: Onboarding", samNav.join(" | "));
  ok(B.page.url().includes("/platform/onboarding"), "/platform takes him straight to it (no dashboard for his role)", B.page.url());
  await B.page.getByRole("heading", { name: /Onboarding|requirement/i }).first().waitFor({ timeout: 15000 });
  await sleep(1500);
  ok(B.forbidden.length === 0, "the page asked the server for nothing he may not have (no 403 on the way)", B.forbidden.join(", "));
  for (const path of ["/platform/stores", "/platform/plans", "/platform/team", "/platform/security", "/platform/app-management", "/platform/website"]) {
    await B.page.goto(AD + path, { waitUntil: "load" });
    await B.page.getByTestId("no-access").waitFor({ timeout: 10000 });
  }
  ok(/doesn.t include this page/.test(await B.page.getByTestId("no-access").innerText()), "every other page says 'Your role doesn't include this page' (stores, plans, team, security, app management, website)");
  const samApi = await B.page.evaluate(async () => (await Promise.all(["/api/platform/stores", "/api/platform/roles", "/api/platform/onboarding"].map((p) => fetch(`http://localhost:3097${p}`, { credentials: "include" }).then((r) => r.status)))).join());
  ok(samApi === "403,403,200", "and the server agrees: stores 403, roles 403, onboarding 200", samApi);
  await B.page.goto(AD + "/platform/onboarding", { waitUntil: "load" });
  await B.page.getByRole("button", { name: /New requirement form|New form|Start/i }).first().waitFor({ timeout: 15000 });
  ok(true, "he can start a new onboarding form");

  say("5. Changing the role changes what he sees");
  await page.getByRole("tab", { name: /Roles/ }).click();
  await page.getByTestId(`role-row-Sales ${stamp}`).getByTestId("role-edit").click();
  await page.getByTestId("role-dialog").waitFor();
  await page.locator('[data-feature="leads:manage"] input[type="checkbox"]').check();
  await page.getByTestId("role-save").click();
  await page.getByTestId(`role-row-Sales ${stamp}`).getByText("Website enquiries (leads)").waitFor({ timeout: 8000 });
  await B.page.goto(AD + "/platform", { waitUntil: "load" });
  await B.page.waitForSelector("aside a");
  ok(await until(async () => (await sidebar(B.page)).join("|") === "Onboarding|Leads"), "after the next page load his sidebar has Onboarding and Leads", (await sidebar(B.page)).join(" | "));
  await B.page.getByRole("link", { name: "Leads" }).first().click();
  await B.page.getByRole("heading", { name: /Leads|Enquiries/i }).first().waitFor({ timeout: 15000 });
  ok(true, "…and the Leads page opens for him");

  say("6. A person is switched off");
  await page.getByRole("tab", { name: /People/ }).click();
  await row.getByTestId(`member-menu-${email}`).click();
  await page.getByTestId("member-menu-toggle").click();
  await row.getByText("Switched off").waitFor({ timeout: 8000 });
  await B.page.goto(AD + "/", { waitUntil: "load" });
  ok(await until(async () => (await B.page.locator('input[type="password"]').count()) === 1, 10000), "his next page load shows the sign-in form: he is signed out at once");
  await row.getByTestId(`member-menu-${email}`).click();
  await page.getByTestId("member-menu-toggle").click();
  await row.getByText("Active").waitFor({ timeout: 8000 });

  say("7. A role that can only LOOK at stores");
  await page.getByRole("tab", { name: /Roles/ }).click();
  await page.getByTestId("team-new-role").click();
  await page.getByTestId("role-name").fill("Support " + stamp);
  await page.locator('[data-feature="stores:read"] input[type="checkbox"]').check();
  await page.getByTestId("role-save").click();
  await page.getByTestId(`role-row-Support ${stamp}`).waitFor();
  const support = (await sa("GET", "/roles")).json.roles.find((r) => r.name === `Support ${stamp}`);
  made.roles.push(support?.id);
  const sueMail = `sue.${stamp}@rasoipulse.test`;
  const sue = (await sa("POST", "/team", { name: "Sue Support", email: sueMail, password: `Support${stamp}Pass`, roleId: support.id })).json.member;
  made.members.push(sue?.id);
  const C = await open();
  await signIn(C.page, sueMail, `Support${stamp}Pass`);
  await C.page.waitForSelector("aside a", { timeout: 20000 });
  ok(JSON.stringify(await sidebar(C.page)) === JSON.stringify(["Stores"]), "Sue's sidebar has one item: Stores", (await sidebar(C.page)).join(" | "));
  await C.page.getByRole("heading", { name: "Stores" }).first().waitFor();
  ok((await C.page.getByRole("button", { name: /Create store/ }).count()) === 0, "the Stores page has no 'Create store' button");
  await C.page.locator(`a[href^="/platform/stores/"]`).first().click().catch(async () => { await C.page.goto(AD + `/platform/stores/${store.id}`, { waitUntil: "load" }); });
  await C.page.getByText(/You can look at this store, not change it/).waitFor({ timeout: 15000 });
  ok((await C.page.getByRole("button", { name: /Open (store )?dashboard/ }).count()) === 0 && (await C.page.getByTestId("store-actions").getByRole("button", { name: /Actions|More|⋮/i }).count()) === 0, "…no 'Open dashboard', no ⋮ menu for disable / delete");
  ok(await C.page.getByTestId("console-store-name-save").isDisabled() && await C.page.locator("fieldset[disabled]").count() >= 2, "every field and button below is switched off (a disabled group)");
  const sueApi = await C.page.evaluate(async (id) => (await Promise.all([["PATCH", `/api/platform/stores/${id}`], ["POST", `/api/platform/stores/${id}/disable`], ["DELETE", `/api/platform/stores/${id}`]].map(([m, p]) => fetch(`http://localhost:3097${p}`, { method: m, credentials: "include", headers: { "content-type": "application/json" }, body: m === "DELETE" ? undefined : "{}" }).then((r) => r.status)))).join(), store.id);
  ok(sueApi === "403,403,403", "…and the server refuses a change, a switch-off and a delete from her (403)", sueApi);

  say("8. The activity log");
  await page.getByRole("tab", { name: /Activity/ }).click();
  await page.getByTestId("activity-row").first().waitFor({ timeout: 8000 });
  const act = norm(await page.locator("body").innerText());
  ok(/made the role/.test(act) && /added/.test(act) && /changed the role/.test(act) && new RegExp(`Sales ${stamp}`).test(act), "the Activity tab says who made the roles and the people, and who changed what");
  ok(!act.includes(password), "…and never a password");

  ok(problems.length === 0, "no errors in the browser", problems.slice(0, 2).join(" | "));
} finally {
  for (const id of made.members.filter(Boolean)) await sa("DELETE", `/team/${id}`);
  for (const id of made.roles.filter(Boolean)) await sa("DELETE", `/roles/${id}`);
  await browser.close();
}
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
