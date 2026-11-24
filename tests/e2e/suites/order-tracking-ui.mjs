// Following an order from the storefront, in Chrome on the bench (Acme Momos, /main): the order page that moves by itself as
// the kitchen works, the link from the "order placed" screen and from the Account page, a cancelled order, someone else's
// link, and a phone. What it changes is put back at the end.
import { chromium } from "playwright";
const SF = "http://localhost:3170";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* retry */ } await sleep(250); } return false; };

const cookie = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "o@acme.test", password: "Owner123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const outlets = await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json();
const main = (outlets.outlets ?? outlets).find((o) => o.slug === "main");
const outletId = String(main._id ?? main.id);
const staff = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie, "x-rasoipulse-outlet": outletId }, body: body ? JSON.stringify(body) : undefined });
  let json = {}; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
const menu = await (await fetch(`${API}/api/menu?outletId=${outletId}`)).json();
// a plain dish (no sizes, no add-ons), so it goes straight into the cart
const dish = menu.items.find((i) => i.isAvailable && (i.variants ?? []).length === 0 && !(i.modifierGroupIds ?? []).length && !i.stock?.enabled && !i.combo?.enabled && !i.prepStation && i.images?.length !== undefined);

/** a customer signed in the way the storefront does it (the bench accepts the code 123456) */
async function customer(phone, name) {
  const asked = await (await fetch(`${API}/api/customer/otp/request`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outletId, destination: phone, name }) })).json();
  const v = await fetch(`${API}/api/customer/otp/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outletId, destination: phone, code: asked.devCode ?? "123456", name, gender: "female", age: 30 }) });
  const set = v.headers.getSetCookie().find((c) => /^rasoipulse_customer=/.test(c));
  const [k, val] = set.split(";")[0].split("=");
  return { name, cookie: { name: k, value: val, domain: "localhost", path: "/" } };
}
const placeFor = async (who, status) => {
  const r = await fetch(`${API}/api/orders`, { method: "POST", headers: { "content-type": "application/json", cookie: `${who.cookie.name}=${who.cookie.value}` }, body: JSON.stringify({ outletId, cart: { lines: [{ itemId: dish.id, modifierOptionIds: [], quantity: 1 }] }, channel: "takeaway", gateway: "cod" }) });
  const j = await r.json();
  if (!j.order) throw new Error("couldn't place the order: " + JSON.stringify(j).slice(0, 200));
  return j.order;
};
const move = (id, status) => staff("PATCH", `/api/orders/${id}/status`, { status });

const meera = await customer("9811220001", "Meera Tracker");
const other = await customer("9811220002", "Someone Else");
const slaBefore = (await staff("GET", `/api/outlets/${outletId}`)).json.outlet.config.operations.sla;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addCookies([meera.cookie]);
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|favicon|status of 4\d\d/.test(m.text())) problems.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
const pill = () => page.getByTestId("tracker-status");

try {
  console.log("== The order page moves by itself");
  const o = await placeFor(meera);
  await page.goto(`${SF}/main/order/${o.id}`, { waitUntil: "load" });
  await pill().waitFor({ timeout: 20000 });
  ok(/Order #/.test(await page.locator("h1").first().innerText()) && (await pill().innerText()).trim() === "Placed", "a placed order says Placed", (await pill().innerText()).trim());
  ok(/waiting for the restaurant to accept/i.test(await page.getByTestId("tracker-line").innerText()), "…and what that means in a sentence", await page.getByTestId("tracker-line").innerText());
  ok(await page.getByRole("list", { name: "Order progress" }).isVisible(), "a step-by-step bar shows where it is");
  ok(await page.getByTestId("tracker-updated").isVisible(), "'Updated just now · refreshes by itself' is shown while it is going");
  await move(o.id, "accepted");
  ok(await until(async () => (await pill().innerText()).trim() === "Accepted", 14000), "when staff accept it the page changes to Accepted by itself (no reload)");
  await move(o.id, "preparing");
  await page.getByTestId("tracker-refresh").click();
  ok(await until(async () => (await pill().innerText()).trim() === "Preparing", 8000), "'Check now' looks straight away: Preparing");
  await move(o.id, "ready");
  ok(await until(async () => (await pill().innerText()).trim() === "Ready", 14000), "Ready — by itself again");
  ok(/collect/i.test(await page.getByTestId("tracker-line").innerText()), "a takeaway order says it can be collected", await page.getByTestId("tracker-line").innerText());
  const hist = (await page.getByTestId("tracker-history").innerText()).replace(/\s+/g, " ");
  ok(/Order placed/.test(hist) && /Accepted/.test(hist) && /Preparing/.test(hist) && /Ready/.test(hist), "'What happened' lists each step with its time", hist);
  ok((await page.getByTestId("tracker-page").innerText()).includes(dish.name), "the items and total are on the page");
  await page.screenshot({ path: "order-tracker.png" });
  await move(o.id, "completed");
  ok(await until(async () => (await pill().innerText()).trim() === "Completed", 14000), "Completed");
  ok(await until(async () => (await page.getByTestId("tracker-updated").count()) === 0, 4000), "…and it stops refreshing once the order is finished");

  console.log("== A cancelled order");
  const c = await placeFor(meera);
  await move(c.id, "cancelled");
  await page.goto(`${SF}/main/order/${c.id}`, { waitUntil: "load" });
  await pill().waitFor({ timeout: 20000 });
  ok((await pill().innerText()).trim() === "Cancelled" && await page.getByTestId("tracker-cancelled").isVisible(), "says Cancelled, and what it means for the money", (await page.getByTestId("tracker-cancelled").innerText().catch(() => "")).replace(/\s+/g, " "));
  ok(await page.getByTestId("tracker-updated").count() === 0 && await page.getByRole("list", { name: "Order progress" }).count() === 0, "no progress bar and no refreshing for it");

  console.log("== From the 'order placed' screen and the Account page");
  const live = await placeFor(meera);
  await page.goto(`${SF}/main/account`, { waitUntil: "load" });
  const follow = page.locator(`[data-order="${live.orderNumber}"]`).getByTestId("order-follow");
  await follow.waitFor({ timeout: 20000 });
  ok(await follow.isVisible(), "an order still going has 'Follow this order →' on the Account page");
  await follow.click();
  await page.waitForURL(new RegExp(`/main/order/${live.id}$`), { timeout: 15000 });
  ok(await pill().waitFor({ timeout: 15000 }).then(() => true), "…which opens that order's page");
  await move(live.id, "cancelled");
  // the real "Order placed" screen, reached by ordering on the storefront
  await page.goto(`${SF}/main`, { waitUntil: "load" });
  await page.getByText(dish.name).first().waitFor({ timeout: 20000 });
  await page.locator('[role="button"]', { hasText: dish.name }).first().click();
  await page.getByTestId("item-modal").getByRole("button", { name: /^Add ·/ }).click();
  await sleep(900);
  await page.getByRole("link", { name: /View cart/ }).click();
  await page.waitForURL(/\/order/);
  await page.getByTestId("place-order").waitFor({ timeout: 20000 });
  await page.getByTestId("place-order").click();
  const track = page.getByTestId("done-follow");
  await track.waitFor({ timeout: 25000 });
  ok(/Follow your order/.test(await track.innerText()), "the 'Order placed' screen has a 'Follow your order' button");
  const href = await track.getAttribute("href");
  ok(/^\/main\/order\/[0-9a-f]{24}$/.test(href ?? ""), "…that goes to this order's own page", href ?? "");
  await track.click();
  await page.waitForURL(new RegExp(`${href}$`), { timeout: 15000 });
  ok(await pill().waitFor({ timeout: 15000 }).then(() => true), "…and it opens");
  const mine = href.split("/").pop();

  console.log("== Not your order");
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx2.addCookies([other.cookie]);
  const p2 = await ctx2.newPage();
  await p2.goto(`${SF}${href}`, { waitUntil: "load" });
  await p2.getByTestId("tracker-error").waitFor({ timeout: 20000 });
  ok(/can't find that order/i.test(await p2.getByTestId("tracker-error").innerText()) && !(await p2.locator("body").innerText()).includes(dish.name), "another customer opening the link sees 'We can't find that order' and nothing of it");
  await ctx2.close();
  const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p3 = await ctx3.newPage();
  await p3.goto(`${SF}${href}`, { waitUntil: "load" });
  ok(await p3.getByText("Sign in to follow your order").first().waitFor({ timeout: 20000 }).then(() => true).catch(() => false), "someone not signed in is asked to sign in");
  await ctx3.close();

  console.log("== On a phone");
  const ctx4 = await browser.newContext({ viewport: { width: 375, height: 760 }, isMobile: true, hasTouch: true });
  await ctx4.addCookies([meera.cookie]);
  const p4 = await ctx4.newPage();
  await p4.goto(`${SF}/main/order/${mine}`, { waitUntil: "load" });
  await p4.getByTestId("tracker-page").waitFor({ timeout: 20000 });
  ok(await p4.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), "the page doesn't scroll sideways on a phone");
  await p4.screenshot({ path: "order-tracker-phone.png" });
  await ctx4.close();
  await move(mine, "cancelled").catch(() => {});
} finally {
  await browser.close();
  for (const o of (await staff("GET", "/api/orders?limit=50")).json.orders ?? []) if (["placed", "accepted", "preparing", "ready"].includes(o.status) && /Meera Tracker/.test(o.customer?.name ?? "")) await move(o.id, "cancelled");
  void slaBefore;
}
ok(problems.length === 0, "no errors in the browser", problems.slice(0, 3).join(" | "));
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
