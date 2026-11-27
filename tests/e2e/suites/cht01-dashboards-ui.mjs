// CHT01 (the stacked area chart) in the two dashboards, in Chrome against the bench: the platform console's "Where sales come from" (violet) and the store
// dashboard's revenue widget (green) — real layers, legend, the reading bubble on hover, the right colour — and the catalogue's sample, which is unchanged
// (sky blue). The numbers are injected into the two dashboard answers, so every figure on screen can be checked exactly.
import { chromium } from "playwright";
const AD = "http://localhost:3171";
let pass = 0, fail = 0;
const problems = [];
let seen = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); if (problems.length > seen) { console.log(`      ^ browser error: ${problems.slice(seen).join(" | ")}`); seen = problems.length; } };
const say = (s) => console.log(`\n=== ${s}`);
const norm = (t) => t.replace(/\s+/g, " ").trim();

const browser = await chromium.launch();
const newPage = async (viewport = { width: 1360, height: 1100 }) => {
  const page = await (await browser.newContext({ viewport })).newPage();
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon|WebSocket/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  return page;
};
const signIn = async (page, email, pw) => {
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', email); await page.fill('input[type="password"]', pw);
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector("aside a", { timeout: 20000 });
};
/** the fill colour of each layer, read the way the browser resolved it (not the CSS text) */
const layerColours = (chart) => chart.evaluate((el) => [...el.querySelectorAll("linearGradient")].map((g) => getComputedStyle(g.querySelector("stop")).stopColor));
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };
const hover = async (page, chart, f) => { const area = chart.locator("[data-chart-area]"); await area.scrollIntoViewIfNeeded(); const b = await area.boundingBox(); await page.mouse.move(b.x + b.width * f, b.y + b.height / 2); };

try {
  /* -------------------------------------------------------------------- 1. the platform console */
  say("1. The platform dashboard: 'Where sales come from' (violet)");
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let platformMode = "sales";
  const sup = await newPage();
  await sup.route("**/api/platform/dashboard**", async (route) => {
    const res = await route.fetch();
    const j = await res.json();
    const t = new Date();
    const rows = Array.from({ length: 12 }, (_, i) => { const d = new Date(t.getFullYear(), t.getMonth() - (11 - i), 1); return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: MONTHS[d.getMonth()], year: d.getFullYear(), month: d.getMonth() + 1 }; });
    const unit = 100_000; // ₹1,000 in paise
    const split = (i) => (platformMode === "none" ? { "dine-in": 0, takeaway: 0, delivery: 0, other: 0 } : { "dine-in": (i + 1) * unit, takeaway: (i + 1) * unit * 0.5, delivery: (i + 1) * unit * 0.25, other: i === 11 ? 10 * unit : 0 });
    j.sales.monthly = rows.map((r, i) => { const s = split(i); const revenue = Object.values(s).reduce((a, b) => a + b, 0); return { ...r, orders: 10 + i, revenue, changePct: null }; });
    j.sales.monthlyChannels = rows.map((r, i) => ({ ...r, ...split(i) }));
    j.sales.month = { ...j.sales.month, revenueChangePct: 12.5 };
    await route.fulfill({ response: res, json: j });
  });
  await signIn(sup, "super@sandbox.test", "Super123!");
  const card = sup.locator(".dash-cht01");
  await card.waitFor({ timeout: 20000 });
  ok(/Where sales come from/.test(await card.innerText()), "the chart card is on the platform dashboard, titled 'Where sales come from'");
  ok((await sup.locator(".rasoipulse-analytics-chart").count()) === 1, "only one CHT01 card there");
  const total = Array.from({ length: 12 }, (_, i) => (i + 1) * 1.75 * 1000).reduce((a, b) => a + b, 0) + 10_000;
  ok(norm(await card.innerText()).includes(`₹${total.toLocaleString("en-IN")}`), "its big number is the twelve months' sales in rupees", `₹${total.toLocaleString("en-IN")}`);
  ok(/\+12\.5%\s*this month/.test(norm(await card.innerText())), "…with the change this month, in the green pill");
  const legend = norm(await card.locator("[data-legend]").innerText());
  ok(/Dine-in/.test(legend) && /Takeaway/.test(legend) && /Delivery/.test(legend) && /Other/.test(legend), "the legend names each order type (Other too, because there is some)", legend);
  ok((await card.locator("g[data-layer]").count()) === 4, "four layers are drawn");
  const cols = await layerColours(card);
  ok(cols.length === 4 && cols[0] === rgb("#5b21b6") && cols[3] === rgb("#c4b5fd"), "the layers are violet (darkest at the bottom, lightest on top) — not the sample's sky blue", cols.join(" | "));
  ok(!cols.includes(rgb("#0369a1")) && !cols.includes(rgb("#0284c7")), "…and none of the original blues");
  const axis = norm(await card.locator('[aria-hidden="true"]').first().innerText());
  ok(/₹/.test(axis) && /₹0/.test(axis), "the left axis is in rupees, down to ₹0", axis);
  const months = norm(await card.locator('[aria-hidden="true"]').nth(2).innerText());
  ok(MONTHS.some((m) => months.includes(m)), "the bottom axis names months", months);

  await hover(sup, card, 0.999);
  const tip = card.locator("[data-tooltip]");
  await tip.waitFor({ timeout: 4000 });
  const tipText = norm(await tip.innerText());
  ok(tipText.includes("Dine-in") && tipText.includes("₹12,000") && tipText.includes("₹6,000") && tipText.includes("₹3,000") && tipText.includes("₹10,000"), "hovering the last month reads each layer: dine-in ₹12,000, takeaway ₹6,000, delivery ₹3,000, other ₹10,000", tipText);
  ok(/Total ₹31,000/.test(tipText), "…and the total ₹31,000 (the layers added up)");
  await hover(sup, card, 0);
  ok(/₹1,000/.test(norm(await tip.innerText())) && /Total ₹1,750/.test(norm(await tip.innerText())), "hovering the first month reads ₹1,000 + ₹500 + ₹250 = ₹1,750", norm(await tip.innerText()));
  await sup.mouse.move(5, 5);
  await tip.waitFor({ state: "detached", timeout: 3000 }).catch(() => undefined);
  ok((await card.locator("[data-tooltip]").count()) === 0, "moving the pointer away hides the reading");
  ok(/Sales by month/.test(await sup.locator("body").innerText()), "the platform's own charts (Sales by month …) are still there, untouched");
  ok((await sup.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)), "the dashboard still fits the screen's width");

  say("1b. A phone-width screen");
  await sup.setViewportSize({ width: 390, height: 900 });
  await sup.waitForTimeout(500);
  ok(await sup.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "on a phone the page does not scroll sideways", String(await sup.evaluate(() => document.documentElement.scrollWidth)));
  const box = await card.boundingBox();
  ok(box.width <= 390, "…and the chart card fits inside the screen", String(Math.round(box.width)));

  say("1c. No sales split yet");
  platformMode = "none";
  await sup.setViewportSize({ width: 1360, height: 1100 });
  await sup.reload({ waitUntil: "load" });
  await sup.waitForSelector("text=Sales through your stores", { timeout: 20000 });
  await sup.waitForTimeout(600);
  ok((await sup.locator(".dash-cht01").count()) === 0, "when no month has any split sales the card is not shown (no empty chart)");

  /* -------------------------------------------------------------------- 2. the store dashboard */
  say("2. The store dashboard: the revenue widget (green)");
  let storeMode = "split";
  const own = await newPage();
  await own.route("**/api/dashboard/stats**", async (route) => {
    const res = await route.fetch();
    const j = await res.json();
    if (j.revenueTrend?.length) {
      j.revenueTrend = j.revenueTrend.map((r, i) => {
        const revenue = storeMode === "none" ? 0 : (i + 1) * 10_000;
        return { ...r, revenue, orders: storeMode === "none" ? 0 : i + 1, channels: storeMode === "none" ? {} : { "dine-in": revenue * 0.5, takeaway: revenue * 0.3, delivery: revenue * 0.2 } };
      });
    }
    await route.fulfill({ response: res, json: j });
  });
  await signIn(own, "o@acme.test", "Owner123!");
  await own.getByTestId("dashboard-grid").waitFor({ timeout: 20000 });
  const widget = own.locator('[data-widget="revenue-trend"]');
  await widget.waitFor({ timeout: 15000 });
  const chart = widget.locator(".rasoipulse-analytics-chart");
  await chart.waitFor({ timeout: 8000 });
  ok((await chart.count()) === 1, "the revenue widget now holds the stacked chart");
  ok((await chart.locator("g[data-layer]").count()) === 3, "three layers: dine-in, takeaway, delivery (no 'Other', there is none)");
  const gl = norm(await chart.locator("[data-legend]").innerText());
  ok(/Dine-in/.test(gl) && /Takeaway/.test(gl) && /Delivery/.test(gl) && !/Other/.test(gl), "the legend names them", gl);
  const gc = await layerColours(chart);
  ok(gc[0] === rgb("#047857") && gc[2] === rgb("#a7f3d0"), "the layers are green (emerald), a different colour from the platform's violet and the sample's blue", gc.join(" | "));
  ok(!(await chart.evaluate((el) => !!el.style.border)) , "the widget keeps its own card: the chart inside has no second frame");
  const titleless = !/Sessions/.test(await chart.innerText());
  ok(titleless, "no sample text ('Sessions') leaks into the real chart");
  await hover(own, chart, 0.999);
  const tip2 = chart.locator("[data-tooltip]");
  await tip2.waitFor({ timeout: 4000 });
  const t2 = norm(await tip2.innerText());
  ok(/Dine-in ₹700/.test(t2) && /Takeaway ₹420/.test(t2) && /Delivery ₹280/.test(t2) && /Total ₹1,400/.test(t2), "hovering today reads dine-in ₹700, takeaway ₹420, delivery ₹280, total ₹1,400", t2);
  const ax = norm(await chart.locator('[aria-hidden="true"]').first().innerText());
  ok(/₹/.test(ax), "the left axis is in rupees", ax);
  ok((await own.locator('[data-widget="revenue-today"]').count()) === 1 && (await own.locator('[data-widget="orders-today"]').count()) === 1, "the other widgets are untouched");

  say("2b. Nothing to stack yet");
  storeMode = "none";
  await own.reload({ waitUntil: "load" });
  await own.getByTestId("dashboard-grid").waitFor({ timeout: 20000 });
  await own.waitForTimeout(600);
  const w2 = own.locator('[data-widget="revenue-trend"]');
  ok((await w2.count()) === 1 && (await w2.locator(".rasoipulse-analytics-chart").count()) === 0 && (await w2.locator("svg").count()) > 0, "with no sales the widget falls back to the plain line chart (no empty stacked chart)");

  /* -------------------------------------------------------------------- 3. the catalogue sample */
  say("3. The components catalogue: the sample is unchanged");
  const cat = await newPage();
  await signIn(cat, "o@acme.test", "Owner123!"); // the catalogue is a store page
  await cat.goto(AD + "/components", { waitUntil: "load" });
  await cat.getByText("Analytics & Data", { exact: false }).first().click();
  const sample = cat.locator(".rasoipulse-analytics-chart").first();
  await sample.waitFor({ timeout: 15000 });
  ok(/Sessions/.test(await sample.innerText()) && /13,277/.test(await sample.innerText()) && /\+35%/.test(await sample.innerText()), "CHT01's sample still reads 'Sessions 13,277 +35%'");
  const sc = await layerColours(sample);
  ok(sc.length === 3 && sc[0] === rgb("#0369a1") && sc[2] === rgb("#7dd3fc"), "…in its original sky blue", sc.join(" | "));
  ok(/25,000/.test(await sample.innerText()) && /Apr 30/.test(await sample.innerText()), "…with its original axis labels (25,000 … Apr 30)");
  ok((await sample.locator("[data-legend]").count()) === 1, "the sample now also has a legend (Direct, Search, Social)");
} catch (e) {
  ok(false, "the suite stopped with an error", String(e?.stack ?? e).split("\n").slice(0, 4).join(" | "));
} finally {
  await browser.close();
  console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
