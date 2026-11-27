// The platform console's Cache page — grouped as "Admin Panel Cache" and "Store Cache" (open it → stores → a store → its outlets) — and how every
// "Expire" says what it will drop before it does anything. In Chrome against the bench (Acme Momos and Beta Bites).
import { chromium } from "playwright";
const AD = "http://localhost:3171";
const SF = "http://localhost:3170";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 15000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* retry */ } await sleep(250); } return false; };
const login = async (email, password) => (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const sup = await login("super@sandbox.test", "Super123!");
const entries = async () => (await (await fetch(`${API}/api/platform/cache/entries`, { headers: { cookie: sup } })).json());
const stores = (await (await fetch(`${API}/api/platform/stores`, { headers: { cookie: sup } })).json()).stores;
const acme = stores.find((s) => s.name === "Acme Momos");
const beta = stores.find((s) => s.name === "Beta Bites");
const outlets = await (await fetch(`${API}/api/outlets?brandId=${acme.id}`, { headers: { cookie: sup, "x-rasoipulse-brand": String(acme.id) } })).json();
const acmeOutlet = String(((outlets.outlets ?? outlets)[0])._id ?? ((outlets.outlets ?? outlets)[0]).id);
const betaOutlets = await (await fetch(`${API}/api/outlets?brandId=${beta.id}`, { headers: { cookie: sup, "x-rasoipulse-brand": String(beta.id) } })).json();
const betaOutlet = String(((betaOutlets.outlets ?? betaOutlets)[0])._id ?? ((betaOutlets.outlets ?? betaOutlets)[0]).id);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|favicon|status of 4\d\d/.test(m.text())) problems.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
const say = (t) => console.log(`\n=== ${t}`);
const num = (t) => Number((String(t).match(/\d[\d,]*/) ?? ["0"])[0].replace(/,/g, "")); // the FIRST number in a text ("4 items · 19 KB" → 4)
try {
  // make both stores remember something (their menus) and the console remember its own numbers
  await fetch(`${API}/api/menu?outletId=${acmeOutlet}`);
  await fetch(`${API}/api/menu?outletId=${betaOutlet}`);
  await fetch(`${API}/api/orders/pickup-slots?outletId=${acmeOutlet}`);
  await fetch(`${API}/api/platform/dashboard`, { headers: { cookie: sup } });

  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', "super@sandbox.test"); await page.fill('input[type="password"]', "Super123!");
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector("text=Stores");
  await page.goto(AD + "/platform/cache", { waitUntil: "load" });
  await page.getByTestId("cache-summary").waitFor({ timeout: 20000 });

  say("1. Two groups, the stores folded away");
  ok(await page.getByText("Admin Panel Cache", { exact: true }).first().isVisible(), "there is an 'Admin Panel Cache' group");
  ok(await page.getByText("Store Cache", { exact: true }).first().isVisible(), "…and a 'Store Cache' group");
  ok((await page.getByTestId("cache-store-group").count()) === 0 && (await page.getByTestId("cache-store-row").count()) === 0, "the stores are folded away until Store Cache is opened (the page is not a wall of tables)");
  ok((await page.getByTestId("cache-store-toggle").getAttribute("aria-expanded")) === "false", "…the Store Cache header says it is collapsed (aria-expanded=false)");
  ok(await page.getByTestId("cache-store-toggle").innerText().then((t) => /2 stores/.test(t) || /stores/.test(t)), "…and says how many stores and items are inside", (await page.getByTestId("cache-store-toggle").innerText()).replace(/\s+/g, " "));
  const l0 = await entries();
  const adminRows = l0.entries.filter((e) => !e.store);
  ok(adminRows.length > 0 && (await page.getByTestId("cache-admin-entries").getByTestId("cache-entry-row").count()) === adminRows.length, "Admin Panel Cache lists exactly the items that belong to no store", `${adminRows.length} items`);
  ok(await page.getByTestId("cache-expire-admin").isVisible() && await page.getByTestId("cache-expire-all").isVisible(), "…with its own Expire button, and one 'Expire everything' at the top");

  say("2. Store Cache → stores → a store → its outlets");
  await page.getByTestId("cache-store-toggle").click();
  const rowOf = (name) => page.locator('[data-testid="cache-store-row"]', { hasText: name });
  await rowOf("Acme Momos").waitFor({ timeout: 10000 });
  ok(await rowOf("Acme Momos").isVisible() && await rowOf("Beta Bites").isVisible(), "opening it lists the stores that have something remembered");
  ok((await page.getByTestId("cache-outlet-list").count()) === 0, "…none of them is open yet (no outlets shown until a store is picked)");
  await rowOf("Acme Momos").getByTestId("cache-store-open").click();
  await page.getByTestId("cache-outlet-list").waitFor();
  const acmeRows = (await entries()).entries.filter((e) => e.store?.id === acme.id);
  const acmeOutlets = [...new Set(acmeRows.filter((e) => e.outlet).map((e) => e.outlet.name))];
  ok((await page.getByTestId("cache-outlet-list").count()) === 1 && (await rowOf("Beta Bites").getByTestId("cache-outlet-list").count()) === 0, "picking a store opens ITS outlets only (Beta Bites stays closed)");
  ok((await page.getByTestId("cache-outlet-group").count()) === acmeOutlets.length && acmeOutlets.length > 0, "one group per outlet that has something remembered", acmeOutlets.join(", "));
  const og = page.getByTestId("cache-outlet-group").first();
  ok(/Menu/.test(await og.innerText()), "an outlet's group lists its own items (its Menu among them)");
  const wholeCount = acmeRows.filter((e) => !e.outlet).length;
  ok((await page.getByTestId("cache-whole-store").count()) === (wholeCount > 0 ? 1 : 0), "items that are not an outlet's (look, plan, addresses) are shown apart as 'The whole store'", `${wholeCount} items`);

  say("3. Every Expire says first what it will drop");
  const outletName = await og.getAttribute("data-outlet");
  const outletRows = acmeRows.filter((e) => e.outlet?.name === outletName);
  await og.getByTestId("cache-expire-outlet").click();
  const dlg = page.getByTestId("expire-dialog");
  await dlg.waitFor();
  ok(/Expire this outlet's cache/.test(await dlg.innerText()) && (await dlg.innerText()).includes(outletName), "the outlet's dialog names the outlet", outletName);
  ok(num(await page.getByTestId("expire-dialog-count").innerText()) === outletRows.length, "…the number of items in it is exactly the number listed for that outlet", await page.getByTestId("expire-dialog-count").innerText());
  ok(/Menu/.test(await page.getByTestId("expire-dialog-list").innerText()), "…it lists what they are, in words (Menu …)");
  ok(/What will expire/.test(await dlg.innerText()) && /What stays/.test(await dlg.innerText()) && /What happens next/.test(await dlg.innerText()), "…and has the three parts: what will expire, what stays, what happens next");
  ok(/store's look, plan and web addresses/.test(await dlg.innerText()), "…it says the store's look, plan and addresses stay");
  await page.getByRole("button", { name: "Cancel" }).click();
  await dlg.waitFor({ state: "detached" });
  ok((await entries()).entries.filter((e) => e.outlet?.name === outletName && e.store?.id === acme.id).length === outletRows.length, "Cancel expires nothing");

  await og.getByTestId("cache-expire-outlet").click();
  await dlg.waitFor();
  await page.getByTestId("expire-dialog-confirm").click();
  await page.getByTestId("cache-expired").waitFor({ timeout: 10000 });
  const toast = await page.getByTestId("cache-expired").innerText();
  ok(num(toast.replace(/\(.*?\)/, "")) === outletRows.length || new RegExp(`${outletRows.length} items? cleared`).test(toast), "confirming says how many were cleared — the same number the dialog showed", toast);
  const l1 = await entries();
  ok(!l1.entries.some((e) => e.outlet?.name === outletName && e.store?.id === acme.id), "that outlet's items are gone from the server");
  ok(l1.entries.filter((e) => e.store?.id === acme.id && !e.outlet).length === wholeCount, "…the store's own items stayed");
  ok(l1.entries.filter((e) => e.store?.id === beta.id).length > 0, "…and Beta Bites kept what it had");

  say("4. A whole store, the admin panel, everything");
  await fetch(`${API}/api/menu?outletId=${acmeOutlet}`);
  await fetch(`${API}/api/menu?outletId=${betaOutlet}`);
  await page.getByRole("button", { name: "Refresh" }).click().catch(() => {});
  await until(async () => (await rowOf("Acme Momos").count()) > 0);
  const l2 = await entries();
  const acme2 = l2.entries.filter((e) => e.store?.id === acme.id);
  const betaBefore = l2.entries.filter((e) => e.store?.id === beta.id).length;
  await rowOf("Acme Momos").getByTestId("cache-expire-store").click();
  await dlg.waitFor();
  ok(/Expire this store's cache/.test(await dlg.innerText()) && num(await page.getByTestId("expire-dialog-count").innerText()) === acme2.length, "the store's dialog counts ALL of the store's items (its outlets' and its own)", `${acme2.length} items`);
  await page.getByTestId("expire-dialog-confirm").click();
  await page.getByTestId("cache-expired").waitFor({ timeout: 10000 });
  const l3 = await entries();
  ok(!l3.entries.some((e) => e.store?.id === acme.id), "confirming clears Acme Momos");
  ok(l3.entries.filter((e) => e.store?.id === beta.id).length === betaBefore, "…and not one item of Beta Bites", `${betaBefore} kept`);

  await fetch(`${API}/api/platform/dashboard`, { headers: { cookie: sup } });
  await page.getByRole("button", { name: "Refresh" }).click().catch(() => {});
  await until(async () => (await page.getByTestId("cache-admin-entries").count()) > 0);
  const adminNow = (await entries()).entries.filter((e) => !e.store).length;
  await page.getByTestId("cache-expire-admin").click();
  await dlg.waitFor();
  ok(/Expire the admin panel's cache/.test(await dlg.innerText()) && num(await page.getByTestId("expire-dialog-count").innerText()) === adminNow, "the admin panel's dialog counts exactly the items that belong to no store", await page.getByTestId("expire-dialog-count").innerText());
  ok(/No store, outlet or menu is touched/.test(await dlg.innerText()), "…and says no store is touched");
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.getByTestId("cache-expire-all").click();
  await dlg.waitFor();
  const everything = (await entries()).entries.length;
  ok(/Expire everything/.test(await dlg.innerText()) && num(await page.getByTestId("expire-dialog-count").innerText()) === everything, "'Expire everything' counts everything that is listed", `${everything} items`);
  ok(/People stay signed in/.test(await dlg.innerText()), "…and says people stay signed in");
  await page.getByRole("button", { name: "Cancel" }).click();

  say("5. The other places");
  await page.goto(AD + "/platform/settings", { waitUntil: "load" });
  await page.getByTestId("cache-lifetime-input").waitFor({ timeout: 15000 });
  ok((await page.getByRole("button", { name: /Expire everything|Expire this store/ }).count()) === 0, "Platform settings → Cache has no Expire buttons any more (one place to expire: the Cache page)");
  ok(await page.getByRole("button", { name: "Open the Cache page" }).isVisible(), "…it points to the Cache page instead");
  await page.goto(`${AD}/platform/stores/${acme.id ?? acme._id}`, { waitUntil: "load" });
  await page.getByRole("tab", { name: "Cache" }).or(page.getByRole("button", { name: "Cache", exact: true })).first().click();
  await page.getByTestId("store-cache-expire").waitFor({ timeout: 10000 });
  await page.getByTestId("store-cache-expire").click();
  ok(await page.getByTestId("expire-dialog").isVisible(), "the store's own page asks too (it shows the same 'what will expire' window before clearing)");
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.screenshot({ path: "cache-console.png" });
} finally {
  await browser.close();
}
void SF;
ok(problems.length === 0, "no errors in the browser", problems.slice(0, 3).join(" | "));
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
