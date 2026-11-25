// The dashboard screens of the growth features, in Chrome against the bench store (Acme Momos, Main): Settings →
// Pre-orders & bookings / Ratings & suggestions / Delivery riders / Cart reminders, Orders (Out for delivery + rider,
// a pre-order's pickup time), Menu (stock, combo, hours), Coupons (buy X get Y free), Bookings and Ratings.
// What it changes on the bench is put back at the end.
import { chromium } from "playwright";
const AD = "http://localhost:3171";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cookie = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "o@acme.test", password: "Owner123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const outlets = await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json();
const main = (outlets.outlets ?? outlets).find((o) => o.slug === "main");
const outletId = String(main._id ?? main.id);
const call = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie, "x-rasoipulse-outlet": outletId }, body: body ? JSON.stringify(body) : undefined });
  let json = {}; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
const menuNow = async () => (await (await fetch(`${API}/api/menu?outletId=${outletId}`)).json());
const configNow = async () => (await call("GET", `/api/outlets/${outletId}`)).json.outlet?.config;
const momos = (await menuNow()).items.find((i) => i.name === "Veg Steamed Momos");
const lassi = (await menuNow()).items.find((i) => i.name === "Sweet Lassi");
const before = await configNow();
const made = { orders: [], items: [], riders: [], coupons: [], bookings: [] };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const page = await ctx.newPage();
page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon|WebSocket/.test(m.text())) problems.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
const body = async () => (await page.locator("body").innerText()).replace(/\s+/g, " ");

try {
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', "o@acme.test"); await page.fill('input[type="password"]', "Owner123!");
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector("text=Orders");

  /* ------------------------------------------------------------ sidebar */
  console.log("== The sidebar has Bookings and Ratings");
  const nav = await page.locator("nav").first().innerText();
  ok(/Bookings/.test(nav) && /Ratings/.test(nav), "the store's sidebar shows Bookings (under Store & orders) and Ratings (under Customers & growth)", nav.replace(/\s+/g, " ").slice(0, 200));

  /* ------------------------------------------------------------ settings */
  console.log("== Settings → Pre-orders & bookings");
  await page.goto(AD + "/settings", { waitUntil: "load" });
  await page.getByRole("tab", { name: /Pre-orders & bookings/ }).or(page.getByRole("button", { name: /Pre-orders & bookings/ })).first().click();
  await page.getByTestId("settings-preorders").waitFor();
  ok(await page.getByTestId("settings-bookings").isVisible(), "the tab has two cards: Pre-orders and Table bookings");
  await page.getByText("Take pre-orders for takeaway").click();
  await page.getByLabel("Days ahead", { exact: true }).fill("1");
  await page.getByText("Take table bookings online").click();
  await page.getByLabel("Guests at one time").fill("20");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("button", { name: "Saved" }).waitFor({ timeout: 10000 });
  let c = await configNow();
  ok(c.operations.scheduling.enabled === true && c.operations.scheduling.maxDaysAhead === 1, "switching pre-orders on (1 day ahead) and saving keeps it", JSON.stringify(c.operations.scheduling));
  ok(c.features.reservations.enabled === true && c.reservations.maxGuestsPerSlot === 20, "…and table bookings (20 guests at a time)", JSON.stringify({ on: c.features.reservations.enabled, g: c.reservations.maxGuestsPerSlot }));

  console.log("== Settings → Ratings & suggestions");
  await page.getByRole("tab", { name: /Ratings & suggestions/ }).or(page.getByRole("button", { name: /Ratings & suggestions/ })).first().click();
  await page.getByTestId("settings-ratings").waitFor();
  await page.getByLabel("Google review link", { exact: true }).fill("https://g.page/r/acme-test/review");
  await page.getByLabel("Suggestions heading").fill("Make it a meal");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("button", { name: "Saved" }).waitFor({ timeout: 10000 });
  c = await configNow();
  ok(c.feedback.googleReviewUrl === "https://g.page/r/acme-test/review" && c.upsell.title === "Make it a meal", "the Google review link and the suggestions heading are saved", JSON.stringify({ g: c.feedback.googleReviewUrl, t: c.upsell.title }));

  console.log("== Settings → Delivery riders");
  await page.goto(AD + "/riders", { waitUntil: "load" });
  await page.getByLabel("New rider name").fill("Ramesh");
  await page.getByLabel("New rider phone").fill("98765 43210");
  await page.getByTestId("add-rider").click();
  await page.locator('[data-testid="rider-row-Ramesh"]').waitFor({ timeout: 8000 });
  const riders = (await call("GET", "/api/riders")).json.riders;
  const ramesh = riders.find((r) => r.name === "Ramesh");
  if (ramesh) made.riders.push(ramesh.id);
  ok(Boolean(ramesh) && ramesh.phone === "98765 43210", "a rider is added from the Delivery riders tab", JSON.stringify(riders));
  ok(/Delivery riders/.test(await page.locator("nav").nth(1).innerText().catch(() => "")) || /Delivery riders/.test(await body()), "Delivery riders sits in the Settings tabs");

  /* ------------------------------------------------------------ orders */
  console.log("== Orders → a delivery order goes out with a rider");
  const placeStaff = async (extra) => (await call("POST", "/api/orders", { outletId, cart: { lines: [{ itemId: lassi.id, quantity: 1, modifierOptionIds: [] }] }, name: "UI Tester", ...extra })).json.order;
  const d = await placeStaff({ channel: "delivery", gateway: "mock", deliveryAddress: { text: "14 Janpath, New Delhi", lat: 28.6302, lng: 77.2189 } });
  made.orders.push(d.id);
  // a delivery order is prepaid; the test gateway marks it paid (an unpaid prepaid order is hidden from the Orders list)
  const intent = (await call("POST", "/api/payments/intent", { outletId, orderId: d.id })).json;
  await call("POST", "/api/payments/verify", { outletId, paymentId: intent.paymentId, payload: { payment_id: String(intent.clientParams?.payment_id), signature: String(intent.clientParams?.signature) } });
  for (const s of ["accepted", "preparing", "ready"]) await call("PATCH", `/api/orders/${d.id}/status`, { status: s });
  await page.goto(AD + "/orders", { waitUntil: "load" });
  const row = page.locator("tr", { hasText: `#${d.orderNumber}` }).first();
  await row.waitFor({ timeout: 15000 });
  const go = row.getByRole("button", { name: "Out for delivery" });
  ok(await go.isVisible(), "a Ready delivery order's next step is 'Out for delivery'");
  await go.click();
  const dlg = page.getByTestId("rider-dialog");
  await dlg.waitFor();
  await dlg.getByTestId("rider-option-Ramesh").waitFor({ timeout: 8000 }).catch(() => undefined);
  ok(/Ramesh/.test(await dlg.innerText()), "it asks who is taking it — Ramesh is on the list");
  await dlg.getByTestId("rider-option-Ramesh").click();
  await page.getByTestId("rider-submit").click();
  await dlg.waitFor({ state: "hidden", timeout: 8000 });
  await row.getByTestId("order-rider").waitFor({ timeout: 10000 });
  ok(/Out for delivery/.test(await row.innerText()) && /with Ramesh/.test(await row.innerText()), "the row now says Out for delivery — with Ramesh", (await row.innerText()).replace(/\s+/g, " ").slice(0, 160));
  ok(await row.getByRole("button", { name: "Delivered" }).isVisible(), "…and its next step is 'Delivered'");
  await page.screenshot({ path: "growth-orders-rider.png" });

  console.log("== Orders → a pre-order shows its pickup time");
  const slots = (await (await fetch(`${API}/api/orders/pickup-slots?outletId=${outletId}`)).json()).days.flatMap((x) => x.slots);
  const p = await placeStaff({ channel: "takeaway", scheduledFor: slots[2].at });
  made.orders.push(p.id);
  await page.reload({ waitUntil: "load" });
  const prow = page.locator("tr", { hasText: `#${p.orderNumber}` }).first();
  await prow.waitFor({ timeout: 15000 });
  ok(await prow.getByTestId("order-preorder").isVisible(), "a pre-order is tagged with its pickup time under its number", await prow.getByTestId("order-preorder").innerText().catch(() => "—"));

  /* ------------------------------------------------------------ menu */
  console.log("== Menu → stock on a dish, a combo, hours on a category");
  await page.goto(AD + "/menu", { waitUntil: "load" });
  await page.locator('[data-testid="cat-row"][data-category="Steamed Momos"] button', { hasText: "Steamed Momos" }).first().click();
  const irow = page.locator('[data-testid="item-row"][data-item="Veg Steamed Momos"]');
  await irow.waitFor();
  await irow.getByTitle("Edit").click();
  await page.getByTestId("item-stock").waitFor();
  ok(await page.getByTestId("item-combo").isVisible() && await page.getByTestId("item-pairs").isVisible() && await page.getByTestId("item-hours").isVisible(), "the dish form has Stock, Hours, Combo and Goes well with");
  await page.getByTestId("item-stock-on").check();
  await page.getByTestId("item-stock-left").fill("3");
  await page.getByRole("button", { name: "Save changes" }).click();
  await irow.getByTestId("item-stock-chip").waitFor({ timeout: 10000 });
  ok((await irow.getByTestId("item-stock-chip").innerText()).trim() === "3 left", "after saving, the dish row says '3 left'");
  ok((await menuNow()).items.find((i) => i.id === momos.id).stock?.left === 3, "…and the menu counts 3");

  await page.locator('[data-testid="cat-row"][data-category="Beverages"] button', { hasText: "Beverages" }).first().click();
  await page.getByRole("button", { name: /Add item/ }).first().click();
  await page.getByTestId("item-combo").waitFor();
  await page.getByRole("dialog", { name: "New item" }).locator("input").first().fill("UI Lassi Combo");
  await page.getByTestId("item-combo-on").check();
  await page.getByTestId("combo-part").first().selectOption({ label: "Sweet Lassi" });
  ok(/Separately/.test(await page.getByTestId("item-combo").innerText()), "choosing the dishes shows what they cost separately");
  await page.getByRole("button", { name: "Create item" }).click();
  await page.locator('[data-testid="item-row"][data-item="UI Lassi Combo"]').waitFor({ timeout: 10000 });
  const comboItem = (await menuNow()).items.find((i) => i.name === "UI Lassi Combo");
  if (comboItem) made.items.push(comboItem.id);
  ok(comboItem?.combo?.items?.[0]?.itemId === lassi.id, "a combo is created from the dish form", JSON.stringify(comboItem?.combo));

  await page.getByRole("button", { name: "Actions for Beverages" }).click();
  await page.getByText("Edit…", { exact: true }).click();
  const cdlg = page.getByRole("dialog", { name: "Edit category" });
  await cdlg.waitFor();
  ok(await cdlg.getByTestId("category-hours").isVisible(), "a category's Edit window has Hours");
  await cdlg.getByRole("button", { name: "Cancel" }).click().catch(() => page.keyboard.press("Escape"));

  /* ------------------------------------------------------------ coupons */
  console.log("== Coupons → buy 1 get 1 free");
  await page.goto(AD + "/coupons", { waitUntil: "load" });
  await page.getByRole("button", { name: "New coupon" }).first().click();
  await page.locator("label", { hasText: "Code" }).locator("input").first().fill("UIB1G1");
  await page.locator("label", { hasText: "Type" }).locator("select").first().selectOption({ label: "Buy X, get Y free" });
  ok(await page.getByLabel("Customer buys", { exact: true }).isVisible() && await page.getByLabel("Gets free", { exact: true }).isVisible() && await page.getByTestId("bogo-dishes").isVisible(), "choosing 'Buy X, get Y free' asks how many to buy, how many free, and which dishes");
  await page.getByRole("button", { name: "Create coupon" }).click();
  await page.locator("tr", { hasText: "UIB1G1" }).waitFor({ timeout: 10000 });
  ok(/Buy 1 get 1 free/.test(await page.locator("tr", { hasText: "UIB1G1" }).innerText()), "the coupon list says 'Buy 1 get 1 free'");
  const cp = (await call("GET", "/api/coupons")).json.coupons.find((x) => x.code === "UIB1G1");
  if (cp) made.coupons.push(cp.id);

  /* ------------------------------------------------------------ bookings */
  console.log("== Bookings → a booking taken over the phone");
  await page.goto(AD + "/reservations", { waitUntil: "load" });
  await page.getByTestId("new-booking").click();
  const form = page.getByTestId("new-booking-form");
  await form.waitFor();
  const tomorrow = new Date(Date.now() + 86_400_000 + 330 * 60_000).toISOString().slice(0, 10);
  await form.getByLabel("Booking day").fill(tomorrow);
  await sleep(800);
  const times = await form.getByLabel("Booking time").locator("option").allInnerTexts();
  await form.getByLabel("Booking time").selectOption({ index: Math.min(4, times.length - 1) });
  await form.getByLabel("Guest name").fill("Phone Guest");
  await form.getByLabel("Guest phone").fill("9123456780");
  await page.getByTestId("new-booking-submit").click();
  await form.waitFor({ state: "hidden", timeout: 10000 });
  await page.getByText("Phone Guest").first().waitFor({ timeout: 10000 });
  ok(/Phone Guest/.test(await body()) && /Confirmed/.test(await body()), "the booking shows on its day, confirmed (taken by the team)");
  ok(/booking/.test(await page.getByTestId("booking-counts").innerText()), "the day's counts show at the top", await page.getByTestId("booking-counts").innerText());
  await page.screenshot({ path: "growth-bookings.png" });

  /* ------------------------------------------------------------ ratings + reminders */
  console.log("== Ratings and Cart reminders pages");
  await page.goto(AD + "/feedback", { waitUntil: "load" });
  await page.getByTestId("feedback-average").waitFor();
  ok(/rating/.test(await page.getByTestId("feedback-average").innerText()), "the Ratings page shows the average and how many");
  await page.goto(AD + "/cart-reminders", { waitUntil: "load" });
  await page.getByTestId("reminder-preview").waitFor();
  ok(/Hi Aarav, you left 2× Veg Momos, 1× Masala Chai in your cart/.test(await page.getByTestId("reminder-preview").innerText()), "Cart reminders shows a preview of the message", await page.getByTestId("reminder-preview").innerText());
  ok(await page.getByTestId("reminder-stats").isVisible(), "…and what reminders achieved");
} finally {
  // put the bench back the way it was
  for (const id of made.orders) await call("PATCH", `/api/orders/${id}/status/manual`, { status: "cancelled", reason: "test clean-up" });
  for (const id of made.items) await call("DELETE", `/api/menu/items/${id}`);
  for (const id of made.riders) await call("DELETE", `/api/riders/${id}`);
  for (const id of made.coupons) await call("DELETE", `/api/coupons/${id}`);
  await call("PATCH", `/api/menu/items/${momos.id}`, { stock: null });
  if (before) await call("PATCH", `/api/outlets/${outletId}/config`, { operations: { scheduling: before.operations.scheduling }, features: { reservations: before.features.reservations }, reservations: before.reservations, feedback: before.feedback, upsell: before.upsell });
  await browser.close();
}
ok(problems.length === 0, "no errors in the browser console", problems.slice(0, 3).join(" | "));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
