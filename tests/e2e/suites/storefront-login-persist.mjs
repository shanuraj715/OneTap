// A customer who has signed in stays signed in: through a reload, a new tab, and — the case that used to throw people back to the login form
// (and cost another code) — a moment when the server can't answer "who am I?" (restarting, deploying, a rate-limit reply, no connection).
// Chrome against the bench's Acme store.
import { chromium } from "playwright";
const SF = "http://localhost:3170";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];
const login = async (email, password) => (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const owner = await login("o@acme.test", "Owner123!");
const outlets = await (await fetch(`${API}/api/outlets`, { headers: { cookie: owner } })).json();
const main = (outlets.outlets ?? outlets).find((o) => o.slug === "main");
const mainId = String(main._id ?? main.id);
const menu = await (await fetch(`${API}/api/menu?outletId=${mainId}`)).json();
const it = (menu.items ?? []).find((i) => i.isAvailable !== false && !(i.modifierGroupIds?.length));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon|ERR_FAILED|status of 5|status of 429/.test(m.text())) problems.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
const body = async (p = page) => (await p.locator("body").innerText()).replace(/\s+/g, " ");

try {
  console.log("== 1. Sign in once");
  await page.goto(`${SF}/main`, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate(([id, ln]) => localStorage.setItem(`rasoipulse.cart.${id}`, JSON.stringify([{ ...ln, quantity: 1, modifierOptionIds: [] }])), [mainId, { itemId: it.id, variantId: it.variants?.[0]?.id }]);
  await page.goto(`${SF}/main/order`, { waitUntil: "networkidle", timeout: 90000 });
  await page.getByText("Sign in to order").first().waitFor({ timeout: 20000 });
  const phone = `95${String(Date.now()).slice(-8)}`;
  await page.getByRole("textbox", { name: "Your name" }).fill("Persist Tester");
  await page.getByRole("textbox", { name: "Mobile number" }).fill(phone);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByText("Enter the code").first().waitFor({ timeout: 15000 });
  await page.getByLabel("Digit 1 of 6").click();
  await page.keyboard.type("123456", { delay: 60 });
  await page.getByRole("button", { name: "Verify code" }).click();
  if (await page.getByText("Just a couple more details").first().waitFor({ timeout: 5000 }).then(() => true).catch(() => false)) {
    await page.getByRole("group", { name: "Gender" }).getByRole("button", { name: "Male", exact: true }).click();
    await page.getByRole("spinbutton", { name: "Age" }).fill("30");
    await page.getByRole("button", { name: "Save and continue" }).click();
  }
  await page.getByText("How would you like it?").first().waitFor({ timeout: 25000 });
  const cookie = (await ctx.cookies()).find((x) => x.name === "rasoipulse_customer");
  const days = Math.round((cookie.expires - Date.now() / 1000) / 86400);
  ok(Boolean(cookie) && cookie.httpOnly && days >= 179, "the sign-in cookie lasts 180 days (HttpOnly)", `${days} days`);

  console.log("\n== 2. It stays");
  await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(1200);
  ok(/How would you like it\?/.test(await body()), "after a reload the customer is still signed in");
  const tab = await ctx.newPage(); await tab.goto(`${SF}/main/order`, { waitUntil: "networkidle" }); await tab.waitForTimeout(1200);
  ok(/How would you like it\?/.test(await body(tab)), "a new tab is signed in too");
  await tab.close();

  console.log("\n== 3. The server can't answer 'who am I?' for a few seconds");
  // the login form must NEVER show while the check is failing; the page waits, tries again, and comes back signed in
  for (const [label, fail503] of [["the server answers 502 (restarting / deploying)", { status: 502, contentType: "application/json", body: JSON.stringify({ error: "Bad gateway" }) }], ["the server says 429 (rate limited)", { status: 429, contentType: "application/json", body: JSON.stringify({ error: "Too many requests" }) }], ["the connection drops", "abort"]]) {
    let failures = 0;
    const p = await ctx.newPage();
    await p.route("**/api/customer/me", (route) => { if (failures < 2) { failures += 1; return fail503 === "abort" ? route.abort() : route.fulfill(fail503); } return route.continue(); });
    await p.goto(`${SF}/main/order`, { waitUntil: "domcontentloaded" });
    let sawLoginForm = false, sawOrder = false;
    const until = Date.now() + 15000;
    while (Date.now() < until && !sawOrder) {
      const t = await body(p);
      if (/Sign in to order/.test(t)) sawLoginForm = true;
      if (/How would you like it\?/.test(t)) sawOrder = true;
      await p.waitForTimeout(120);
    }
    ok(failures === 2 && !sawLoginForm && sawOrder, `${label}: the login form never appears, and the page is signed in once the server answers`, `failed ${failures} times, login form seen: ${sawLoginForm}, order seen: ${sawOrder}`);
    await p.close();
  }

  console.log("\n== 4. A clear 'nobody' still means signed out");
  {
    const p = await ctx.newPage();
    await p.route("**/api/customer/me", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ customer: null }) }));
    await p.goto(`${SF}/main/order`, { waitUntil: "networkidle" });
    await p.getByText("Sign in to order").first().waitFor({ timeout: 10000 }).catch(() => undefined);
    ok(/Sign in to order/.test(await body(p)), "when the server really says nobody is signed in, the login form shows (it is not hidden)");
    await p.close();
  }

  ok(problems.length === 0, "no errors or warnings in the browser console", problems.slice(0, 3).join(" | "));
} catch (e) {
  ok(false, "the test stopped with an error", String(e?.stack ?? e).split("\n").slice(0, 5).join(" | "));
}
await browser.close();
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
