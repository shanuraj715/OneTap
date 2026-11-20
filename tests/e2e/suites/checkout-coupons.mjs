// The coupon box on the checkout page follows the store's "Coupons" feature: when the platform console locks it for
// a store (or its plan doesn't include it) the box is NOT drawn; unlocked, it is. Chrome against the bench's Acme store.
import { chromium } from "playwright";
const SF = "http://localhost:3170";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];
const login = async (email, password) => (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const sup = await login("super@sandbox.test", "Super123!");
const stores = (await (await fetch(`${API}/api/platform/stores`, { headers: { cookie: sup } })).json()).stores;
const acme = stores.find((s) => s.slug === "acme");
const store = (await (await fetch(`${API}/api/platform/stores/${acme.id}`, { headers: { cookie: sup } })).json());
const overridesBefore = (store.store ?? store).overrides;
const owner = await login("o@acme.test", "Owner123!");
const outlets = await (await fetch(`${API}/api/outlets`, { headers: { cookie: owner } })).json();
const main = (outlets.outlets ?? outlets).find((o) => o.slug === "main");
const mainId = String(main._id ?? main.id);

/** lock / unlock the Coupons feature for the store, the way the platform console does (Stores → the store → Features) */
const setCoupons = async (mode) => {
  const features = { unlock: mode === "unlock" ? ["coupons"] : [], lock: mode === "lock" ? ["coupons"] : [] };
  const r = await fetch(`${API}/api/platform/stores/${acme.id}/plan`, { method: "PATCH", headers: { "content-type": "application/json", cookie: sup }, body: JSON.stringify({ overrides: { ...overridesBefore, entitlements: { ...overridesBefore.entitlements, features } } }) });
  if (!r.ok) { console.error("SETUP FAILED", r.status, (await r.text()).slice(0, 300)); process.exit(1); }
  await fetch(`${API}/api/platform/cache/expire`, { method: "POST", headers: { "content-type": "application/json", cookie: sup }, body: JSON.stringify({ scope: "all" }) });
};
const plainLine = async () => {
  const m = await (await fetch(`${API}/api/menu?outletId=${mainId}`)).json();
  const it = (m.items ?? []).find((i) => i.isAvailable !== false && !(i.modifierGroupIds?.length));
  return { itemId: it.id, variantId: it.variants?.[0]?.id };
};

const browser = await chromium.launch();
let phoneSeq = 0;
/** the checkout of /main with one dish in the cart, signed in as a fresh customer */
const checkout = async (viewport = { width: 1280, height: 900 }) => {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  const line = await plainLine();
  await page.goto(`${SF}/main`, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate(([id, ln]) => localStorage.setItem(`onetap.cart.${id}`, JSON.stringify([{ ...ln, quantity: 1, modifierOptionIds: [] }])), [mainId, line]);
  await page.goto(`${SF}/main/order`, { waitUntil: "networkidle", timeout: 90000 });
  await page.getByText("Sign in to order").first().waitFor({ timeout: 20000 });
  const phone = `97${String(Date.now()).slice(-6)}${String(++phoneSeq).padStart(2, "0")}`.slice(0, 10);
  await page.getByRole("textbox", { name: "Your name" }).fill("Coupon Tester");
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
  await page.waitForTimeout(500);
  return { ctx, page };
};
const couponBox = (page) => page.getByPlaceholder("SAVE20");
const couponTitle = (page) => page.getByText("Coupon", { exact: true });

try {
  console.log("== Coupons ON for the store (the bench's Acme store is on Pro)");
  await setCoupons("unlock");
  {
    const { ctx, page } = await checkout();
    ok((await couponTitle(page).count()) === 1 && (await couponBox(page).isVisible()), "checkout shows the 'Coupon' section with its code box");
    ok(await page.getByRole("button", { name: "Apply" }).isVisible(), "…and its Apply button");
    await couponBox(page).fill("nosuchcode");
    await page.getByRole("button", { name: "Apply" }).click();
    await page.waitForTimeout(800);
    ok(/isn't recognised|can't be used/i.test(await page.locator("body").innerText()), "a wrong code is answered with the usual message (the box still works)");
    await ctx.close();
  }

  console.log("== the platform LOCKS Coupons for this store");
  await setCoupons("lock");
  {
    const { ctx, page } = await checkout();
    ok((await couponTitle(page).count()) === 0 && (await couponBox(page).count()) === 0, "checkout has NO coupon section and NO code box");
    ok((await page.getByRole("button", { name: "Apply" }).count()) === 0, "…and no Apply button");
    const body = await page.locator("body").innerText();
    ok(/How would you like it\?/.test(body) && /Total/.test(body) && (await page.getByRole("button", { name: /place order/i }).first().isEnabled()), "the rest of checkout is untouched (order type, total, Place order)");
    // the server refuses codes too, in case someone sends one anyway
    const r = await fetch(`${API}/api/coupons/apply`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outletId: mainId, code: "SAVE20", cart: { lines: [await plainLine().then((l) => ({ ...l, quantity: 1, modifierOptionIds: [] }))] }, channel: "takeaway" }) });
    const j = await r.json().catch(() => ({}));
    ok(j.ok !== true && /aren't available at this store/i.test(j.reason ?? ""), "and the server itself still refuses a code for this store", JSON.stringify(j).slice(0, 120));
    await ctx.close();
  }

  console.log("== a phone, locked");
  {
    const { ctx, page } = await checkout({ width: 390, height: 844 });
    ok((await couponBox(page).count()) === 0, "no coupon box on a phone either");
    await ctx.close();
  }

  console.log("== UNLOCKED again");
  await setCoupons("unlock");
  {
    const { ctx, page } = await checkout();
    ok(await couponBox(page).isVisible(), "the coupon box comes straight back");
    await ctx.close();
  }
} catch (e) {
  ok(false, "the test ran to the end", String(e?.message ?? e).split("\n").slice(0, 3).join(" | ").slice(0, 400));
} finally {
  await fetch(`${API}/api/platform/stores/${acme.id}/plan`, { method: "PATCH", headers: { "content-type": "application/json", cookie: sup }, body: JSON.stringify({ overrides: overridesBefore }) }).catch(() => {});
  await fetch(`${API}/api/platform/cache/expire`, { method: "POST", headers: { "content-type": "application/json", cookie: sup }, body: JSON.stringify({ scope: "all" }) }).catch(() => {});
  await browser.close();
}
console.log("console problems:", problems.length ? problems : "none");
ok(problems.length === 0, "the browser logged no errors or warnings");
console.log(`SUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
