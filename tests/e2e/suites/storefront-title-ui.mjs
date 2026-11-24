// The storefront's browser-tab title is the STORE's name — the same name as the heading on the page — and follows a rename at once.
// It used to be one fixed word for every store. Chrome against the bench store (Acme, /main); the store is renamed by the platform
// admin (the only one who can) and given its old name back at the end.
import { chromium } from "playwright";
const SF = "http://localhost:3170";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 15000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* retry */ } await sleep(200); } return false; };
const login = async (email, password) => (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

const owner = await login("o@acme.test", "Owner123!");
const sup = await login("super@sandbox.test", "Super123!");
const outlets = ((await (await fetch(`${API}/api/outlets`, { headers: { cookie: owner } })).json()).outlets ?? []);
const main = outlets.find((o) => o.slug === "main");
const outletId = String(main._id ?? main.id);
const brandId = String(main.brandId);
const own = async (path) => (await fetch(API + path, { headers: { cookie: owner, "x-rasoipulse-outlet": outletId } })).json();
const rename = async (name) => (await fetch(`${API}/api/platform/stores/${brandId}`, { method: "PATCH", headers: { "content-type": "application/json", cookie: sup }, body: JSON.stringify({ name }) })).status;
const original = (await (await fetch(`${API}/api/platform/stores`, { headers: { cookie: sup } })).json()).stores.find((s) => String(s.id ?? s._id) === brandId)?.name;
const NAME1 = "Title Test Cafe";
const NAME2 = "Renamed Again Co";
const FIXED = /^(TablePe|ThaliOS|OneTap|Rasoi Pulse)$/;

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|favicon|status of 4\d\d/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  const titleIs = async (p, want) => until(async () => (await p.title()) === want, 10000);

  // a store page of its own (for the "other pages still work" check)
  const pg = await (await fetch(`${API}/api/pages`, { method: "POST", headers: { "content-type": "application/json", cookie: owner, "x-rasoipulse-outlet": outletId }, body: JSON.stringify({ slug: "about-title", title: "About us", status: "published", showInFooter: true, showInHeader: false, blocks: [{ id: "b1", type: "text", markdown: "About this store." }] }) })).json();

  console.log("== The tab shows the store's name");
  ok(await rename(NAME1) === 200, "the platform admin renames the store", `${original} → ${NAME1}`);
  await page.goto(`${SF}/main`, { waitUntil: "load" });
  await page.getByText("Veg Steamed Momos").first().waitFor({ timeout: 20000 });
  ok(await titleIs(page, NAME1), "the home page's tab title is the store's name", await page.title());
  const heading = (await page.locator("h1").first().innerText()).trim();
  ok(heading === NAME1 && (await page.title()) === heading, "…exactly the same words as the big heading on the page", `"${heading}"`);
  ok(!FIXED.test(await page.title()), "…and no longer the one fixed product name every store used to show");
  const desc = await page.locator('meta[name="description"]').getAttribute("content");
  ok(Boolean(desc) && !/multi-tenant/i.test(desc), "the page description talks about the store, not about the platform", desc);

  console.log("== A rename shows at once");
  ok(await rename(NAME2) === 200, "the store is renamed again");
  await page.reload({ waitUntil: "load" });
  await page.getByText("Veg Steamed Momos").first().waitFor({ timeout: 20000 });
  ok(await titleIs(page, NAME2), "the next visit already has the new name in the tab (nothing is remembered from before)", await page.title());
  ok((await page.locator("h1").first().innerText()).trim() === NAME2, "…and in the heading");

  console.log("== Every outlet of the store");
  for (const o of outlets.filter((x) => x.slug !== "main")) {
    await page.goto(`${SF}/${o.slug}`, { waitUntil: "load" });
    ok(await titleIs(page, NAME2), `the other outlet (/${o.slug}) has the same store title`, await page.title());
  }

  console.log("== The other pages still name the store");
  await page.goto(`${SF}/main/account`, { waitUntil: "load" });
  ok(await titleIs(page, `Your account — ${NAME2}`), "the Account page: 'Your account — <store>'", await page.title());
  await page.goto(`${SF}/main/about-title`, { waitUntil: "load" });
  ok(await titleIs(page, `About us — ${NAME2}`), "a page of the store: '<page> — <store>'", await page.title());

  console.log("== A table's QR page");
  const qr = await own("/api/tables/qr-urls");
  const t1 = (qr.tables ?? []).find((t) => t.number === "T1") ?? (qr.tables ?? [])[0];
  const scanPath = new URL(t1.url).pathname + new URL(t1.url).search;
  await page.goto(SF + scanPath, { waitUntil: "load" });
  ok(await titleIs(page, `Table ${t1.number} — ${NAME2}`), "the table page's title is 'Table <number> — <store>'", await page.title());
  await page.goto(`${SF}${new URL(t1.url).pathname}?k=wrong-code`, { waitUntil: "load" });
  ok(await titleIs(page, "This code didn't work"), "a wrong or old code gets a plain title (and shows nothing about the store)", await page.title());

  console.log("== The outlet picker");
  if (outlets.length > 1) {
    const fresh = await browser.newContext({ viewport: { width: 1280, height: 900 } }); // no remembered outlet
    const p2 = await fresh.newPage();
    await p2.goto(`${SF}/`, { waitUntil: "load" });
    ok(await titleIs(p2, NAME2), "a store with several outlets: the picker's tab title is the store's name too", await p2.title());
    ok(!FIXED.test(await p2.title()), "…not the fixed product name");
    await fresh.close();
  } else console.log("   (the bench store has one outlet — the picker isn't shown)");

  if (pg?.page?.id) await fetch(`${API}/api/pages/${pg.page.id}`, { method: "DELETE", headers: { cookie: owner, "x-rasoipulse-outlet": outletId } });
} finally {
  if (original) await rename(original);
  await browser.close();
}
ok(problems.length === 0, "no errors in the browser", problems.slice(0, 3).join(" | "));
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
