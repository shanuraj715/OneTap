// The customer's side of the growth features, in Chrome on the bench storefront (Acme Momos, /main): "only N left",
// combo and hours on the cards, the stepper stopping at the stock, "goes well with" on the order page, a takeaway
// pre-order for later, rating the order, "Order again", and booking a table. What it changes is put back at the end.
import { chromium } from "playwright";
const SF = "http://localhost:3170";
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
const before = (await call("GET", `/api/outlets/${outletId}`)).json.outlet?.config;
const m0 = await menuNow();
const momos = m0.items.find((i) => i.name === "Veg Steamed Momos");
const lassi = m0.items.find((i) => i.name === "Sweet Lassi");
const coke = m0.items.find((i) => i.name === "Masala Coke");
const steamed = m0.categories.find((c) => c.name === "Steamed Momos");
const made = { items: [], categories: [], orders: [] };

// the dishes and settings this test needs
const ist = (Date.now() + 330 * 60_000) % 86_400_000 / 60_000;
const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(Math.floor(m % 60)).padStart(2, "0")}`;
await call("PATCH", `/api/menu/items/${momos.id}`, { stock: { tracked: true, left: 3, lowAt: 5 }, pairsWith: [coke.id] });
const meal = (await call("POST", "/api/menu/items", { categoryId: steamed.id, name: "Momo Meal", basePrice: 10000, combo: { items: [{ itemId: momos.id, quantity: 1 }, { itemId: lassi.id, quantity: 1 }] } })).json.item;
made.items.push(meal.id);
const bf = (await call("POST", "/api/menu/categories", { name: "Breakfast", availability: { windows: [{ days: [0, 1, 2, 3, 4, 5, 6], from: hhmm(ist + 120), to: hhmm(ist + 180) }] } })).json.category;
made.categories.push(bf.id);
const poha = (await call("POST", "/api/menu/items", { categoryId: bf.id, name: "Poha", basePrice: 5000 })).json.item;
made.items.push(poha.id);
await call("PATCH", `/api/outlets/${outletId}/config`, {
  operations: { scheduling: { enabled: true, maxDaysAhead: 2, minLeadMinutes: 30, slotMinutes: 15, maxPerSlot: 0 } },
  features: { reservations: { enabled: true } },
  reservations: { autoConfirm: false, maxGuestsPerSlot: 20, maxDaysAhead: 7, minNoticeMinutes: 60 },
  feedback: { enabled: true, googleReviewUrl: "https://g.page/r/acme-test/review", googleMinStars: 4 },
  upsell: { enabled: true, auto: false, title: "Goes well with your order" },
});

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on("console", (m) => { if (["error"].includes(m.type()) && !/Failed to load resource|favicon|status of 4\d\d/.test(m.text())) problems.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
const body = async () => (await page.locator("body").innerText()).replace(/\s+/g, " ");
const card = (name) => page.locator('[role="button"]', { hasText: name }).first();

try {
  /* ------------------------------------------------------------ the menu */
  console.log("== The menu: only N left, combos, dishes with hours");
  await page.goto(`${SF}/main`, { waitUntil: "load" });
  await page.getByText("Veg Steamed Momos").first().waitFor({ timeout: 20000 });
  ok(await card("Veg Steamed Momos").getByTestId("tag-low-stock").isVisible(), "a counted dish running low says 'Only 3 left'", await card("Veg Steamed Momos").getByTestId("tag-low-stock").innerText().catch(() => "—"));
  ok(/combo · save ₹20/i.test(await card("Momo Meal").innerText().catch(() => "")), "a combo says Combo and what it saves (₹60 + ₹60 separately, ₹100 as a combo)", (await card("Momo Meal").innerText().catch(() => "")).replace(/\s+/g, " "));
  const pohaText = (await page.locator("article", { hasText: "Poha" }).first().innerText().catch(() => "")).replace(/\s+/g, " ");
  ok(/Available \d/.test(pohaText) && !(await card("Poha").isVisible().catch(() => false)), "a breakfast dish outside its hours shows when it is served — and can't be opened", pohaText);

  console.log("== The dish pop-up stops at the stock");
  await card("Veg Steamed Momos").click();
  const dlg = page.getByTestId("item-modal");
  await dlg.waitFor();
  ok(await dlg.getByTestId("item-modal-low-stock").isVisible(), "the pop-up says 'Hurry — only 3 left today'");
  for (let i = 0; i < 5; i++) await dlg.getByRole("button", { name: "One more" }).click();
  ok(/Add · ₹180/.test(await dlg.innerText()), "pressing + five times stops at 3 (3 × ₹60 = ₹180)", (await dlg.getByRole("button", { name: /^Add ·/ }).innerText()).trim());
  await dlg.getByRole("button", { name: "One fewer" }).click();
  await dlg.getByRole("button", { name: "One fewer" }).click();
  await dlg.getByRole("button", { name: /^Add ·/ }).click();
  await sleep(900);
  await card("Momo Meal").click();
  await page.getByTestId("item-modal-combo").waitFor();
  ok(/1 × Veg Steamed Momos/.test(await page.getByTestId("item-modal-combo").innerText()) && /You save ₹20/.test(await page.getByTestId("item-modal-combo").innerText()), "a combo's pop-up lists what's in it and what you save");
  await page.getByTestId("item-modal").getByRole("button", { name: /^Add ·/ }).click();
  await sleep(900);

  /* ------------------------------------------------------------ order page */
  console.log("== The order page: sign in, a suggestion, a pre-order for later");
  await page.getByRole("link", { name: /View cart/ }).click();
  await page.waitForURL(/\/order/);
  await page.getByText("Sign in to order").first().waitFor({ timeout: 15000 });
  await page.getByRole("textbox", { name: "Your name" }).fill("Growth Tester");
  await page.getByRole("textbox", { name: "Mobile number" }).fill("9811122233");
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByText("Enter the code").first().waitFor({ timeout: 15000 });
  await page.getByLabel("Digit 1 of 6").click();
  await page.keyboard.type("123456", { delay: 60 });
  await page.getByRole("button", { name: "Verify code" }).click();
  if (await page.getByText("Just a couple more details").first().waitFor({ timeout: 4000 }).then(() => true).catch(() => false)) {
    await page.getByRole("group", { name: "Gender" }).getByRole("button", { name: "Female", exact: true }).click();
    await page.getByRole("spinbutton", { name: "Age" }).fill("31");
    await page.getByRole("button", { name: "Save and continue" }).click();
  }
  await page.getByTestId("place-order").waitFor({ timeout: 20000 });
  await page.getByTestId("fulfilment-takeaway").click().catch(() => undefined);
  await page.getByTestId("suggestions").waitFor({ timeout: 10000 });
  ok(/Masala Coke/.test(await page.getByTestId("suggestions").innerText()), "'Goes well with your order' suggests Masala Coke for the momos");
  await page.getByRole("button", { name: "Add Masala Coke" }).click();
  await sleep(1200);
  ok(/Masala Coke/.test(await page.locator("section").first().innerText()), "one tap adds it to the order");
  await page.getByTestId("pickup-time").waitFor();
  await page.getByTestId("when-later").click();
  await page.getByTestId("pickup-slot").first().waitFor();
  ok((await page.getByTestId("place-order").innerText()).includes("Choose a pickup time"), "choosing Later asks for a pickup time before the order can be placed");
  await page.getByTestId("pickup-slot").first().click();
  await sleep(700);
  ok(/Place pre-order/.test(await page.getByTestId("place-order").innerText()), "with a time picked, the button says 'Place pre-order'");
  const cash = page.locator("label", { hasText: "Cash / pay at counter" });
  if (await cash.first().isVisible().catch(() => false)) await cash.first().click();
  await page.getByTestId("place-order").click();
  await page.waitForSelector("text=/Order #\\d+ placed/", { timeout: 25000 });
  ok(/Takeaway · pre-order/.test(await body()) && /Pickup/.test(await body()), "the confirmation says it is a pre-order and when to pick it up", (await body()).slice(0, 300));
  const orderNo = (await page.locator("h2", { hasText: /placed/ }).innerText()).match(/#(\d+)/)[1];
  await page.screenshot({ path: "growth-preorder-done.png" });
  const order = (await call("GET", "/api/orders?limit=20")).json.orders.find((o) => o.orderNumber === orderNo);
  made.orders.push(order.id);
  ok(Boolean(order?.scheduledFor), "the restaurant gets it with the pickup time");
  ok((await menuNow()).items.find((i) => i.id === momos.id).stock.left === 1, "the stock went down by the momos ordered — 1 plate and the 1 inside the combo (3 → 1)", String((await menuNow()).items.find((i) => i.id === momos.id).stock.left));

  /* ------------------------------------------------------------ account: rate + order again */
  console.log("== Account: rate the order, then order it again");
  for (const s of ["accepted", "preparing", "ready", "completed"]) await call("PATCH", `/api/orders/${order.id}/status`, { status: s });
  await call("PATCH", `/api/menu/items/${momos.id}`, { stock: { tracked: true, left: 10, lowAt: 5 } });
  await page.goto(`${SF}/main/account`, { waitUntil: "load" });
  const art = page.locator(`article[data-order="${orderNo}"]`);
  await art.waitFor({ timeout: 15000 });
  await art.getByTestId("order-rate").click();
  await art.getByTestId("rate-5").click();
  await art.getByRole("button", { name: "Tasty" }).click();
  await art.getByLabel("Comment").fill("Loved the momos");
  await art.getByTestId("rate-send").click();
  await art.getByTestId("rate-thanks").waitFor({ timeout: 10000 });
  ok(await art.getByTestId("rate-google").isVisible(), "after 5 stars it thanks them and offers the Google review page");
  const fb = (await call("GET", "/api/feedback")).json;
  ok(fb.ratings?.some((r) => r.orderNumber === orderNo && r.rating === 5 && r.comment === "Loved the momos" && r.tags.includes("Tasty")), "the store sees the rating, the comment and the tag", JSON.stringify(fb.summary));
  await art.getByRole("button", { name: "Close" }).click();
  ok(await art.getByTestId("order-rating").isVisible(), "the order now shows 'You rated it'");
  await art.getByTestId("order-again").click();
  await page.waitForURL(/\/main\/order/, { timeout: 15000 });
  await page.getByTestId("place-order").waitFor({ timeout: 20000 });
  const again = await body();
  ok(/Veg Steamed Momos/.test(again) && /Momo Meal/.test(again) && /Masala Coke/.test(again), "'Order again' puts the same dishes back in the cart and opens the order page");

  /* ------------------------------------------------------------ book a table */
  console.log("== Book a table");
  await page.goto(`${SF}/main`, { waitUntil: "load" });
  const link = page.getByRole("link", { name: "Book a table" }).first();
  ok(await link.isVisible().catch(() => false) || (await link.getAttribute("href").catch(() => "")) === "/main/book", "the header has 'Book a table'");
  await page.goto(`${SF}/main/book`, { waitUntil: "load" });
  await page.getByTestId("booking").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Tomorrow" }).click();
  await page.getByTestId("booking-slot").first().waitFor();
  await page.getByTestId("booking-slot").nth(4).click();
  await page.getByLabel("Anything we should know? (optional)").fill("Window seat please");
  await page.getByTestId("booking-submit").click();
  await page.getByTestId("booking-done").waitFor({ timeout: 15000 });
  ok(/Booking request sent/.test(await body()) && /table for 2/.test(await body()), "the booking is sent — the restaurant will confirm it", (await body()).slice(0, 200));
  await page.goto(`${SF}/main/account`, { waitUntil: "load" });
  await page.getByTestId("account-bookings").waitFor({ timeout: 15000 });
  ok(/Waiting to be confirmed/.test(await page.getByTestId("account-bookings").innerText()), "the account page lists it, waiting to be confirmed");
  const day = (await call("GET", `/api/reservations?day=${new Date(Date.now() + 86_400_000 + 330 * 60_000).toISOString().slice(0, 10)}`)).json;
  const mine = day.reservations?.find((r) => r.customer.phone === "9811122233");
  ok(mine?.note === "Window seat please" && mine.partySize === 2, "the restaurant sees it with the guest's note", JSON.stringify(mine ?? {}).slice(0, 160));
  if (mine) await call("PATCH", `/api/reservations/${mine.id}`, { status: "cancelled", reason: "test clean-up" });
  await page.screenshot({ path: "growth-booking.png" });
} finally {
  for (const id of made.orders) await call("PATCH", `/api/orders/${id}/status/manual`, { status: "cancelled", reason: "test clean-up" });
  for (const id of made.items) await call("DELETE", `/api/menu/items/${id}`);
  for (const id of made.categories) await call("DELETE", `/api/menu/categories/${id}`);
  await call("PATCH", `/api/menu/items/${momos.id}`, { stock: null, pairsWith: [] });
  if (before) await call("PATCH", `/api/outlets/${outletId}/config`, { operations: { scheduling: before.operations.scheduling }, features: { reservations: before.features.reservations }, reservations: before.reservations, feedback: before.feedback, upsell: before.upsell });
  await browser.close();
}
ok(problems.length === 0, "no errors in the browser console", problems.slice(0, 3).join(" | "));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
