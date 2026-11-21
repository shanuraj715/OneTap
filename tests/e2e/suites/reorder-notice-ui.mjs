// "Order again" when a dish can't come back: the order page says so loudly and clearly, with room below it. Chrome against
// the bench store (Acme, /main). The dish is put back at the end.
import { chromium } from "playwright";
const SF = "http://localhost:3170";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];

const cookie = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "o@acme.test", password: "Owner123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const outlets = await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json();
const main = (outlets.outlets ?? outlets).find((o) => o.slug === "main");
const outletId = String(main._id ?? main.id);
const staff = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie, "x-onetap-outlet": outletId }, body: body ? JSON.stringify(body) : undefined });
  let json = {}; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
const menu = await (await fetch(`${API}/api/menu?outletId=${outletId}`)).json();
const plain = menu.items.filter((i) => i.isAvailable && (i.variants ?? []).length === 0 && !(i.modifierGroupIds ?? []).length && !i.stock?.enabled && !i.combo?.enabled).slice(0, 3);
const [gone, gone2, kept] = plain;

const asked = await (await fetch(`${API}/api/customer/otp/request`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outletId, destination: "9811330001", name: "Again Tester" }) })).json();
const v = await fetch(`${API}/api/customer/otp/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outletId, destination: "9811330001", code: asked.devCode ?? "123456", name: "Again Tester", gender: "female", age: 30 }) });
const [ck, cv] = v.headers.getSetCookie().find((c) => /^onetap_customer=/.test(c)).split(";")[0].split("=");
const lines = [gone, gone2, kept].map((d) => ({ itemId: d.id, modifierOptionIds: [], quantity: 1 }));
const placed = (await (await fetch(`${API}/api/orders`, { method: "POST", headers: { "content-type": "application/json", cookie: `${ck}=${cv}` }, body: JSON.stringify({ outletId, cart: { lines }, channel: "takeaway", gateway: "cod" }) })).json()).order;
await staff("PATCH", `/api/orders/${placed.id}/status`, { status: "cancelled" });
await staff("PATCH", `/api/menu/items/${gone.id}`, { isAvailable: false });
await staff("PATCH", `/api/menu/items/${gone2.id}`, { isAvailable: false });

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 700, height: 900 } });
  await ctx.addCookies([{ name: ck, value: cv, domain: "localhost", path: "/" }]);
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|favicon|status of 4\d\d/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  await page.goto(`${SF}/main/account`, { waitUntil: "load" });
  await page.locator(`[data-order="${placed.orderNumber}"]`).getByTestId("order-again").click();
  await page.waitForURL(/\/main\/order$/, { timeout: 20000 });
  const box = page.getByTestId("reorder-notice");
  await box.waitFor({ timeout: 20000 });
  ok(/2 dishes couldn't be added to your order/.test(await page.getByTestId("reorder-notice-title").innerText()), "the notice says how many dishes were left out", await page.getByTestId("reorder-notice-title").innerText());
  const items = await page.getByTestId("reorder-notice-list").locator("li").allInnerTexts();
  ok(items.length === 2 && items.some((t) => t.includes(gone.name) && /sold out right now/.test(t)) && items.some((t) => t.includes(gone2.name)), "…each dish on its own line with the reason", items.join(" | "));
  ok((await page.getByTestId("reorder-notice-list").locator("li strong").first().innerText()).length > 0, "…the dish name in bold");
  const look = await box.evaluate((e) => { const c = getComputedStyle(e); return { border: parseFloat(c.borderTopWidth), shadow: c.boxShadow !== "none", role: e.getAttribute("role") }; });
  ok(look.border >= 2 && look.shadow && look.role === "alert", "it is a bordered, raised alert (not a thin line of small text)", JSON.stringify(look));
  ok(await box.locator("svg").first().isVisible(), "…with a warning icon");
  const gap = await page.evaluate(() => {
    const n = document.querySelector('[data-testid="reorder-notice"]').getBoundingClientRect();
    const next = document.querySelector('[data-testid="reorder-notice"]').nextElementSibling?.getBoundingClientRect();
    return next ? Math.round(next.top - n.bottom) : null;
  });
  ok(gap !== null && gap >= 20, "there is clear space between the notice and the order below it", `${gap}px`);
  ok((await page.locator("body").innerText()).includes(kept.name), "the dish that could come back is in the order");
  await page.screenshot({ path: "reorder-notice.png" });
  await page.getByTestId("reorder-notice-close").click();
  ok(await box.count() === 0, "the notice can be dismissed");
  await ctx.close();
} finally {
  await staff("PATCH", `/api/menu/items/${gone.id}`, { isAvailable: true });
  await staff("PATCH", `/api/menu/items/${gone2.id}`, { isAvailable: true });
  await browser.close();
}
ok(problems.length === 0, "no errors in the browser", problems.slice(0, 3).join(" | "));
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
