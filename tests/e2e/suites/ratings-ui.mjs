// Ratings, in Chrome on the bench: the customer rates an order AND each dish (from the Account page and from the order page), with stars in the STORE's
// colour (not yellow); then the store reads them by review, by customer, by outlet and by dish. The store's colour is changed to teal for the run and put back.
import { chromium } from "playwright";
const AD = "http://localhost:3171";
const SF = "http://localhost:3170";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const problems = [];
let seen = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); if (problems.length > seen) { console.log(`      ^ browser error: ${problems.slice(seen).join(" | ")}`); seen = problems.length; } };
const say = (s) => console.log(`\n=== ${s}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (t) => t.replace(/\s+/g, " ").trim();

const raw = async (method, path, { body, headers = {} } = {}) => { const r = await fetch(API + path, { method, headers: { "content-type": "application/json", ...headers }, body: body ? JSON.stringify(body) : undefined }); let json = {}; try { json = await r.json(); } catch {} return { status: r.status, json, headers: r.headers }; };
const ownerCookie = (await raw("POST", "/api/auth/login", { body: { email: "o@acme.test", password: "Owner123!" } })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const outlets = (await raw("GET", "/api/outlets", { headers: { cookie: ownerCookie } })).json.outlets;
const main = outlets.find((o) => o.slug === "main");
const outletId = String(main._id);
const own = (method, path, body) => raw(method, path, { body, headers: { cookie: ownerCookie, "x-rasoipulse-outlet": outletId } });
const savedTheme = main.config.theme;
const savedFeedback = main.config.feedback;
const TEAL = "#0D9488";
const YELLOW = "rgb(245, 165, 36)";

// a customer, signed in through the API (the browser gets the same session cookie)
const phone = "9811900011";
await raw("POST", "/api/customer/otp/request", { body: { outletId, destination: phone, name: "Rina Test" } });
const verified = await raw("POST", "/api/customer/otp/verify", { body: { outletId, destination: phone, code: "123456", name: "Rina Test", gender: "female", age: 30 } });
const [cName, cValue] = verified.headers.get("set-cookie").split(";")[0].split("=");
const customer = { cookie: `${cName}=${cValue}` };
const menu = (await (await fetch(`${API}/api/menu?outletId=${outletId}`)).json());
const lassi = menu.items.find((i) => i.name === "Sweet Lassi");
const coke = menu.items.find((i) => i.name === "Masala Coke");
const place = async () => {
  const r = await raw("POST", "/api/orders", { body: { outletId, channel: "takeaway", cart: { lines: [{ itemId: lassi.id, quantity: 2, modifierOptionIds: [] }, { itemId: coke.id, quantity: 1, modifierOptionIds: [] }] }, gateway: "cod" }, headers: { cookie: customer.cookie } });
  const id = r.json.order?.id ?? r.json.id ?? r.json.orders?.[0]?.id;
  for (const s of ["accepted", "preparing", "ready", "completed"]) await own("PATCH", `/api/orders/${id}/status`, { status: s });
  return { id, number: r.json.order?.orderNumber ?? r.json.orderNumber };
};
await own("PATCH", `/api/outlets/${outletId}/config`, { feedback: { enabled: true, googleReviewUrl: "", googleMinStars: 4 }, theme: { light: { colorPrimary: TEAL } } });
const o1 = await place(), o2 = await place(), o3 = await place();

const browser = await chromium.launch();
const newCtx = async (viewport = { width: 1280, height: 1000 }) => browser.newContext({ viewport });
const watch = (page) => { page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon|WebSocket|status of 4\d\d/.test(m.text())) problems.push(m.text().slice(0, 200)); }); page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`)); };
/** the colour the browser painted the bottom of the first filled star with, and the theme colour it should be */
const filledColour = (scope) => scope.evaluate((el) => {
  const g = el.querySelector("g[data-filled]");
  if (!g) return null;
  const stops = el.querySelectorAll("linearGradient stop");
  const probe = document.createElement("i"); probe.style.color = "var(--color-primary)"; document.body.appendChild(probe);
  const theme = getComputedStyle(probe).color; probe.remove();
  return { stop: getComputedStyle(stops[1]).stopColor, theme, count: el.querySelectorAll("g[data-filled]").length };
});

try {
  say("1. The Account page: Rate this order");
  const ctx = await newCtx();
  await ctx.addCookies([{ name: cName, value: cValue, url: SF }]);
  const page = await ctx.newPage(); watch(page);
  await page.goto(`${SF}/main/account`, { waitUntil: "load" });
  const art = page.locator(`article[data-order="${o1.number}"]`);
  await art.waitFor({ timeout: 20000 });
  ok(await art.getByTestId("order-rate").isVisible(), "a completed order says 'Rate this order'");
  const btnColour = await art.getByTestId("order-rate").evaluate((el) => { const stop = el.querySelectorAll("linearGradient stop")[1]; return stop ? getComputedStyle(stop).stopColor : ""; });
  ok(btnColour && btnColour !== YELLOW, "…with a star that is not yellow", btnColour);
  await art.getByTestId("order-rate").click();
  const box = art.getByTestId("rate-box");
  await box.waitFor();
  ok((await box.locator('button[role="radio"]').count()) === 5, "the box opens with the five order stars only", String(await box.locator('button[role="radio"]').count()));
  ok(!(await box.getByTestId("rate-dishes").isVisible().catch(() => false)), "the dish section waits until the order has stars (nothing is forced)");
  await box.getByTestId("rate-5").click();
  await page.mouse.move(5, 5);
  ok(norm(await box.getByTestId("rate-word").innerText()) === "Excellent", "5 stars says 'Excellent'");
  const col = await filledColour(box.getByTestId("rate-5").locator("xpath=ancestor::span[@role='radiogroup']"));
  ok(col && col.count === 5 && col.stop === col.theme && col.stop !== YELLOW, "all five stars are filled in the STORE's colour (teal, from --color-primary), not yellow", JSON.stringify(col));
  ok(await box.getByTestId("rate-dishes").isVisible() && (await box.locator('button[role="radio"]').count()) === 5 + 2 * 5, "now 'Rate each dish' appears: five stars for each of the two dishes");
  const dishNames = await box.locator('[data-testid^="rate-dish-"]').evaluateAll((els) => els.map((e) => e.innerText.split("\n")[0]));
  ok(dishNames.length === 2 && dishNames.some((n) => /Sweet Lassi/.test(n) && /×2/.test(n)) && dishNames.some((n) => /Masala Coke/.test(n)), "…each with its quantity", dishNames.join(" | "));
  await box.getByRole("button", { name: "Tasty" }).click();
  await box.getByLabel("Comment").fill("Lovely, quick pickup");
  await box.getByTestId(`dishstar-${lassi.id}-5`).click();
  await box.getByRole("button", { name: "Add a note" }).click();
  await box.getByTestId(`rate-note-${lassi.id}`).fill("Thick and cold");
  await box.getByTestId(`dishstar-${coke.id}-3`).click();
  await box.getByTestId(`dishstar-${coke.id}-3`).click(); // the same star again takes the rating back
  ok((await box.getByTestId(`dishstar-${coke.id}-3`).getAttribute("aria-checked")) === "false", "touching the same star again takes a dish rating back");
  await box.getByTestId(`dishstar-${coke.id}-2`).click();
  await box.getByTestId("rate-send").click();
  await art.getByTestId("rate-thanks").waitFor({ timeout: 10000 });
  ok(true, "Send rating thanks them");
  const f1 = (await own("GET", "/api/feedback?days=30")).json.ratings.find((r) => r.orderNumber === o1.number);
  ok(f1?.rating === 5 && f1.comment === "Lovely, quick pickup" && f1.itemRatings.length === 2 && f1.itemRatings.find((i) => i.name === "Sweet Lassi")?.comment === "Thick and cold" && f1.itemRatings.find((i) => i.name === "Masala Coke")?.rating === 2, "the store has the order's 5★ and review, the lassi 5★ with its note and the coke 2★", JSON.stringify(f1?.itemRatings));
  await art.getByRole("button", { name: "Close" }).click();
  const given = art.getByTestId("given-rating");
  ok(await given.isVisible() && norm(await given.innerText()).includes("Sweet Lassi 5★") && norm(await given.innerText()).includes("Masala Coke 2★"), "the order now shows what was given: its stars and a chip for each dish", norm(await given.innerText()));

  say("2. The order page: rate, then change");
  await page.goto(`${SF}/main/order/${o2.id}`, { waitUntil: "load" });
  await page.getByTestId("tracker-rating").waitFor({ timeout: 20000 });
  await page.getByTestId("order-rate").click();
  await page.getByTestId("rate-box").waitFor();
  await page.getByTestId("rate-4").click();
  await page.getByTestId("rate-send").click();
  await page.getByTestId("rate-thanks").waitFor({ timeout: 10000 });
  const f2 = (await own("GET", "/api/feedback?days=30")).json.ratings.find((r) => r.orderNumber === o2.number);
  ok(f2?.rating === 4 && f2.itemRatings.length === 0, "an order can be rated from its own page, with no dish ratings at all (4★)", JSON.stringify(f2?.itemRatings));
  await page.getByRole("button", { name: "Close" }).click();
  ok(await page.getByTestId("order-rating").isVisible(), "the order page then says 'You rated it'");
  await page.getByRole("button", { name: "Change" }).click();
  await page.getByTestId("rate-box").waitFor();
  ok((await page.getByTestId("rate-4").getAttribute("aria-checked")) === "true", "'Change' opens with the earlier rating filled in");
  await page.getByTestId(`dishstar-${coke.id}-4`).click();
  await page.getByTestId("rate-send").click();
  await page.getByTestId("rate-thanks").waitFor({ timeout: 10000 });
  const f2b = (await own("GET", "/api/feedback?days=30")).json.ratings.find((r) => r.orderNumber === o2.number);
  ok(f2b.itemRatings.length === 1 && f2b.itemRatings[0].name === "Masala Coke" && f2b.itemRatings[0].rating === 4, "changing it adds a dish rating to the same rating", JSON.stringify(f2b.itemRatings));
  await page.goto(`${SF}/main/order/${o1.id}`, { waitUntil: "load" });
  await page.getByTestId("order-rating").waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: "Change" }).click();
  ok((await page.getByTestId(`dishstar-${lassi.id}-5`).getAttribute("aria-checked")) === "true" && (await page.getByTestId(`rate-note-${lassi.id}`).inputValue()) === "Thick and cold", "an earlier dish rating and its note come back in the box");

  say("3. The same rating for a third order, by keyboard");
  await page.goto(`${SF}/main/order/${o3.id}`, { waitUntil: "load" });
  await page.getByTestId("order-rate").click();
  await page.getByTestId("rate-1").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  ok((await page.getByTestId("rate-3").getAttribute("aria-checked")) === "true", "the arrow keys move the rating (1 → 3)");
  ok((await page.getByTestId("rate-1").evaluate((el) => !!el.getAttribute("aria-label")?.includes("Poor"))), "each star has a plain label (Poor … Excellent) for screen readers");

  say("4. The store: Ratings");
  const adm = await newCtx(); const owner = await adm.newPage(); watch(owner);
  await owner.goto(AD + "/", { waitUntil: "load" });
  await owner.fill('input[type="email"]', "o@acme.test"); await owner.fill('input[type="password"]', "Owner123!");
  await owner.getByRole("button", { name: /sign in|log in/i }).first().click();
  await owner.waitForSelector("aside a", { timeout: 20000 });
  await owner.goto(AD + "/feedback", { waitUntil: "load" });
  await owner.getByRole("tab", { name: /By customer/ }).waitFor({ timeout: 20000 });
  const tabs = await owner.getByRole("tab").allInnerTexts();
  ok(["Reviews", "By customer", "By outlet", "By dish"].every((t) => tabs.some((x) => x.includes(t))), "four tabs: Reviews, By customer, By outlet, By dish", tabs.join(" | "));
  const row = owner.locator('[data-testid="feedback-row"]', { hasText: new RegExp(`Order #${o1.number} ·`) }).first();
  await row.waitFor({ timeout: 10000 });
  ok((await row.getByTestId("feedback-dishes").innerText()).includes("Sweet Lassi") && (await row.innerText()).includes("Thick and cold"), "Reviews: each review lists the dishes that were rated, with their notes");
  const sCol = await filledColour(owner.getByTestId("feedback-average"));
  ok(sCol && sCol.stop === "rgb(13, 148, 136)" && sCol.stop !== YELLOW, "the average's stars are the store's teal in the admin panel (not the console's own red, not yellow)", JSON.stringify(sCol));
  const rowCol = await row.evaluate((el) => { const stops = el.querySelectorAll("linearGradient stop"); return stops.length ? getComputedStyle(stops[1]).stopColor : ""; });
  ok(rowCol === "rgb(13, 148, 136)", "…they use the store's own colour (teal #0D9488 set for this run)", rowCol);

  await owner.getByRole("tab", { name: /By customer/ }).click();
  const crow = owner.locator('[data-testid="customer-row"][data-name="Rina Test"]');
  await crow.waitFor({ timeout: 10000 });
  ok((await crow.getByTestId("customer-count").innerText()) === "2 ratings", "By customer: Rina rated 2 orders (the third was only started, never sent)", await crow.getByTestId("customer-count").innerText());
  ok((await crow.getByTestId("customer-average").innerText()) === "4.5", "…her average is 4.5 (5 and 4)", await crow.getByTestId("customer-average").innerText());
  await owner.getByTestId("ratings-customer-search").fill("zzz-nobody");
  await owner.getByText("Nobody matches").waitFor({ timeout: 8000 });
  ok(true, "searching for nobody says 'Nobody matches'");
  await owner.getByTestId("ratings-customer-search").fill("9811900011");
  await crow.waitFor({ timeout: 8000 });
  ok(true, "searching by her phone number finds her");
  await owner.getByTestId("ratings-customer-search").fill("");

  await owner.getByRole("tab", { name: /By outlet/ }).click();
  await owner.getByTestId("outlets-total").waitFor({ timeout: 10000 });
  const card = owner.locator(`[data-testid="outlet-card"][data-outlet="${outletId}"]`);
  await card.waitFor();
  ok(/^\d\.\d$/.test(await card.getByTestId("outlet-average").innerText()) && /rating/.test(await card.getByTestId("outlet-count").innerText()), "By outlet: each outlet has its average and its number of ratings");
  ok((await owner.locator('[data-testid="outlet-card"]').count()) === outlets.length, "…one card for every outlet", String(outlets.length));

  await owner.getByRole("tab", { name: /By dish/ }).click();
  const drow = owner.locator('[data-testid="dish-row"][data-key="sweet lassi"]');
  await drow.waitFor({ timeout: 10000 });
  ok((await drow.getByTestId("dish-average").innerText()) === "5.0" && (await drow.getByTestId("dish-count").innerText()).startsWith("1 rating"), "By dish: Sweet Lassi 5.0 from 1 rating");
  const crowD = owner.locator('[data-testid="dish-row"][data-key="masala coke"]');
  ok((await crowD.getByTestId("dish-average").innerText()) === "3.0" && (await crowD.getByTestId("dish-count").innerText()).startsWith("2 ratings"), "…Masala Coke 3.0 from 2 ratings (2 and 4)");
  await drow.getByTestId("dish-reviews-toggle").click();
  await drow.getByTestId("dish-review").first().waitFor({ timeout: 8000 });
  ok((await drow.getByTestId("dish-reviews").innerText()).includes("Thick and cold") && (await drow.getByTestId("dish-reviews").innerText()).includes("Rina Test"), "'Read reviews' shows the note and who wrote it");
  await owner.getByTestId("ratings-dish-sort").selectOption("worst");
  await owner.waitForTimeout(700);
  ok(((await owner.locator('[data-testid="dish-row"]').first().getAttribute("data-key")) === "masala coke"), "sorted worst first: Masala Coke comes first");
  await owner.getByTestId("ratings-dish-search").fill("lassi");
  await owner.waitForTimeout(700);
  ok((await owner.locator('[data-testid="dish-row"]').count()) === 1, "searching 'lassi' leaves one dish");
  await owner.getByTestId("ratings-dish-search").fill("");

  say("5. Phone width");
  const ph = await (await newCtx({ width: 390, height: 850 })).newPage(); watch(ph);
  await ph.context().addCookies([{ name: cName, value: cValue, url: SF }]);
  await ph.goto(`${SF}/main/account`, { waitUntil: "load" });
  const art2 = ph.locator(`article[data-order="${o3.number}"]`);
  await art2.waitFor({ timeout: 20000 });
  await art2.getByTestId("order-rate").click();
  await art2.getByTestId("rate-5").click();
  ok(await ph.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "the rating box fits a phone's width (no sideways scroll)");
} catch (e) {
  ok(false, "the suite stopped with an error", String(e?.stack ?? e).split("\n").slice(0, 4).join(" | "));
} finally {
  await own("PATCH", `/api/outlets/${outletId}/config`, { feedback: savedFeedback ?? { enabled: false }, theme: { light: { colorPrimary: savedTheme?.light?.colorPrimary ?? "#C6362F" } } }).catch(() => undefined);
  await browser.close();
  console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
