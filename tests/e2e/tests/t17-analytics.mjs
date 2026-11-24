// T17 — Analytics: the owner reads the store's sales (whole store and per outlet), compares outlets, sees what sells and what to
// prepare, works out profit & loss from monthly bills, and downloads weekly / monthly / yearly reports. All in Chrome.
// The store is "Marketing Mart" (see bench/serve-bench.mjs): ~10 weeks of paid, cancelled and discounted orders in two outlets whose
// expected totals were worked out separately from the stored orders (h.ids.analytics), so every figure on screen is checked against them.
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import * as ui from "../bench/ui.mjs";
import { BENCH } from "../bench/watch.mjs";

export const meta = {
  id: "t17-analytics",
  title: "Analytics — sales, per-outlet graphs, compare outlets, best sellers + what to prepare, profit & loss, weekly/monthly/yearly exports, plan and role access",
  area: "analytics",
  fresh: true,
  summary: "In Chrome as the owner of Marketing Mart (Pro plan, two outlets, about ten weeks of orders). Analytics sits at the top of 'Customers & growth'. The Overview's sales, net sales, orders, items sold, cancellations and discounts for the last 30 days equal the totals worked out from the stored orders, with the change against the 30 days before; choosing one outlet, 'Last 7 days' or custom dates picked in the calendar changes them to the expected figures. Sales shows each outlet as its own line; Items & stock ranks the best sellers and gives, for tomorrow and for every weekday, how many of each item to prepare (the average of recent weeks plus a safety margin that can be changed); Customers lists who has drifted away and 'Message them' opens Marketing with that filter; Compare outlets puts the outlets side by side for the same dates. Profit & loss takes the monthly bills (typed once, remembered in the browser, optionally saved to the store) and shows food cost, expenses, net profit and break-even, per outlet too. Reports downloads Excel, CSV, PDF and JSON for a week, month, year or custom dates, for the whole store or one outlet, and the files hold the same numbers; GST and the daily cash close agree with each other. A manager sees the figures but not profit/exports, an accountant sees everything, a cashier sees nothing, and a store whose plan lacks Analytics sees a notice until the platform unlocks it for that store.",
  expect: [
    "The sidebar shows Analytics first in 'Customers & growth'; its tabs are Overview, Sales, Items & stock, Customers, Compare outlets, Operations, Profit & loss and Reports.",
    "Overview, last 30 days, whole store: sales, net sales (without GST), orders, items sold, cancelled orders, discounts and the average order each equal the totals worked out separately from the stored orders, with the change against the 30 days before; the day-by-day and hour-by-hour tables add up to the same order count.",
    "Each outlet alone shows exactly its own sales and orders; Last 7 days and the same dates picked in the calendar both give the 7-day totals; Today gives the (empty) today.",
    "Sales shows one line per outlet, and the order-types table adds up to the same orders and to the takeaway/delivery/dine-in sales of the store.",
    "Items & stock lists the best sellers in order with their quantities; for outlet Main, tomorrow's prep list and the weekday table give the suggested quantities worked out separately (average of the last 6 weeks + 15%, rounded up), and a bigger safety margin gives bigger numbers.",
    "Customers: 'Message them' for the 30-day group opens Marketing with that filter and the same number of people.",
    "Compare outlets: the two outlets side by side with their own sales and orders, each outlet's own best sellers, and for dates picked in the calendar the two outlets add up to the store's sales.",
    "Operations: the cancelled orders and their share of all placed orders, and the coupon discounts, equal the worked-out totals.",
    "Profit & loss: monthly bills typed per outlet and for the whole store give food cost, expenses and net profit that match the arithmetic for these 30 days; the same figures per outlet; a bill added by hand counts and can be removed; the food-cost % changes the result.",
    "The bills are remembered after a reload; 'Save to my store' keeps a copy that 'Use the version saved to my store' restores after the browser's memory is wiped.",
    "Reports: Excel has a sheet per section with the right totals (sales, orders, GST, profit & loss); CSV holds one table and sums to the outlet's sales; PDF is a real PDF; JSON has the range and the summary; this week / last week / this month / last month / this year / last year give the right dates.",
    "GST totals match (orders, taxable value, CGST, SGST, total GST); the daily cash close for a day picked in the calendar equals that day's invoice total in the GST table.",
    "A manager has Analytics without Profit & loss and Reports (their addresses are 404s); an accountant has all tabs; a cashier has no Analytics at all (404).",
    "A store on a plan without Analytics sees 'Analytics isn't in your plan'; unlocking it for that store opens it; locking it for Marketing Mart removes it even though the plan has it; 'From plan' restores it.",
  ],
  expectNot: [
    "Cancelled or unpaid orders must NOT count as sales.",
    "Choosing one outlet must NOT show the other outlet's sales.",
    "A manager must NOT see Profit & loss or Reports, even by typing the address.",
    "A cashier must NOT see Analytics.",
    "A store whose plan lacks Analytics must NOT show the pages.",
    "A bill removed from the list must NOT still count in the profit.",
    "The browser must NOT log JavaScript errors.",
  ],
};

const OWNER = ["o@mart.test", "Owner123!"];
const MANAGER = ["m@mart.test", "Manager123!"];
const ACCOUNTANT = ["a@mart.test", "Account123!"];
const CASHIER = ["s@mart.test", "Staff1234!"];
const DL_DIR = fileURLToPath(new URL("../.bench/downloads/", import.meta.url));

// ---- little helpers that know nothing about the app: dates in India's time, money as the screen writes it
const istToday = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const addDays = (k, n) => new Date(new Date(`${k}T00:00:00Z`).getTime() + n * 86400e3).toISOString().slice(0, 10);
const weekday = (k) => new Date(`${k}T00:00:00Z`).getUTCDay(); // 0 = Sunday
const monthsOf = (from, to) => { let t = 0; for (let k = from; k <= to; k = addDays(k, 1)) { const [y, m] = k.split("-").map(Number); t += 1 / new Date(Date.UTC(y, m, 0)).getUTCDate(); } return t; };
const inr = (paise) => `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(paise / 100))}`;
const num = (s) => Number(String(s).replace(/−/g, "-").replace(/[^\d.-]/g, ""));
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const pad2 = (n) => String(n).padStart(2, "0");
const monthName = (n) => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][n - 1];

export async function run(d, h) {
  const A = h.ids.analytics;
  const today = istToday();
  if (A.last30.to !== today) throw new Error(`The test bench was filled on ${A.last30.to} but it is ${today} now — reset it (node bench/bench.mjs reset) so the sample orders are relative to today.`);
  mkdirSync(DL_DIR, { recursive: true });
  const [ty, tm] = today.split("-").map(Number);

  const figure = (title) => d.page.locator("figure.viz-fig").filter({ has: d.page.locator("h3.viz-title", { hasText: title }) }).first();
  const tile = (label) => d.page.locator(".viz-tile").filter({ has: d.page.locator(".viz-tile-label", { hasText: new RegExp(`^\\s*${label}\\s*$`) }) }).first();
  const tileText = async (label) => (await tile(label).innerText().catch(() => "")).replace(/\s+/g, " ").trim();
  const tileValue = async (label) => (await tile(label).locator(".viz-tile-value").first().innerText().catch(() => "")).replace(/\s+/g, " ").trim();
  /** wait until read() gives `want` (a string or RegExp); returns [matched, what it last read] */
  const settle = async (read, want, ms = 15000) => {
    let got = "";
    const ok = await ui.until(async () => { got = await read(); return want instanceof RegExp ? want.test(got) : got === want; }, ms);
    return [ok, got];
  };
  const tilesAre = async (want, ms) => {
    const bad = [];
    for (const [label, value] of Object.entries(want)) { const [ok, got] = await settle(() => tileValue(label), value, ms); if (!ok) bad.push(`${label}: wanted ${value}, saw "${got}"`); }
    return bad;
  };
  const rowsOf = async (loc) => (await loc.locator("tbody tr").evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.innerText.replace(/\s+/g, " ").trim()))));
  const openTable = async (title) => { const f = figure(title); await f.getByRole("button", { name: "Table", exact: true }).click(); await d.pause(300); return f; };
  const tabLink = (name) => d.page.locator("a").filter({ hasText: new RegExp(`^\\s*${name}\\s*$`) });
  const sidebarItems = async () => (await ui.sidebarGroups(d)).flatMap((g) => g.items);
  const goTab = async (name, wait = 500) => { await d.click(tabLink(name).last(), { after: wait }); }; // the tab, not the sidebar item of the same name (it comes later on the page)
  const notFound = () => d.page.locator("[data-not-found]");
  /** pick a day in the calendar that opens when the date showing `shown` is clicked: move `months` months (negative = back), then the day */
  const pickDay = async (shown, months, day) => {
    await d.click(d.page.getByText(shown, { exact: true }).first(), { after: 300 });
    for (let i = 0; i < Math.abs(months); i++) await d.click(d.page.getByRole("button", { name: months > 0 ? "Next month" : "Previous month" }), { after: 150 });
    await d.click(d.page.getByRole("button", { name: String(day), exact: true }).first(), { after: 300 });
    await d.click(d.page.getByRole("button", { name: "OK", exact: true }), { after: 600 }); // the calendar stays open until OK
  };
  const monthOf = (k) => Number(k.slice(0, 4)) * 12 + Number(k.slice(5, 7));
  const longDate = (k) => { const [y, m, dd] = k.split("-").map(Number); return `${dd} ${monthName(m)} ${y}`; };

  // ---------------------------------------------------------------------------------------------------------------- 1
  await d.step("The owner of Marketing Mart finds Analytics in the sidebar");
  await d.tab("dashboard", "Store dashboard · owner of Marketing Mart");
  await ui.signIn(d, OWNER);
  const groups = await ui.sidebarGroups(d);
  const growth = groups.find((g) => /Customers & growth/i.test(g.group));
  d.check("Analytics is the first item of 'Customers & growth'", growth?.items[0] === "Analytics", JSON.stringify(groups.map((g) => [g.group, g.items])));
  await d.click(d.page.locator("aside nav a", { hasText: /^\s*Analytics\s*$/ }).first(), { after: 900 });
  await d.page.waitForURL(/\/analytics\/overview/, { timeout: 15000 });
  const tabNames = (await d.page.locator("a").allInnerTexts()).map((t) => t.trim());
  d.check("the tabs are Overview, Sales, Items & stock, Customers, Compare outlets, Operations, Profit & loss, Reports", ["Overview", "Sales", "Items & stock", "Customers", "Compare outlets", "Operations", "Profit & loss", "Reports"].every((t) => tabNames.includes(t)), tabNames.join(" | "));

  // ---------------------------------------------------------------------------------------------------------------- 2
  await d.step("Overview: the last 30 days match the totals worked out from the stored orders");
  const want30 = { Sales: inr(A.last30.sales), "Net sales": inr(A.last30.net), Orders: String(A.last30.orders), "Items sold": String(A.last30.itemsSold), Cancelled: String(A.last30.cancelled), "Discounts given": inr(A.last30.discount), "Average order": inr(A.last30.sales / A.last30.orders) };
  const bad30 = await tilesAre(want30);
  d.check(`the figures equal the worked-out totals (${Object.entries(want30).map(([k, v]) => `${k} ${v}`).join(", ")})`, bad30.length === 0, bad30.join("; "));
  const drop = ((A.last30.sales - A.prev30.sales) / A.prev30.sales) * 100;
  // the page drops a trailing ".0" ("−1%", not "−1.0%"), so either spelling is right
  const dropDigits = Math.abs(drop).toFixed(1);
  const dropPattern = dropDigits.endsWith(".0") ? `${dropDigits.slice(0, -2)}(\\.0)?` : dropDigits.replace(".", "\\.");
  d.check(`Sales says how it moved against the 30 days before (${drop.toFixed(1)}%)`, new RegExp(`[−-]\\s?${dropPattern}%`).test(await tileText("Sales")), await tileText("Sales"));
  d.check("the range shown is the last 30 days", new RegExp(`${longDate(A.last30.from).replace(/^0/, "")} – ${longDate(A.last30.to)} · 30 days`).test(await d.page.locator("[data-range-text]").innerText()), await d.page.locator("[data-range-text]").innerText());
  d.never("cancelled orders are counted as sales (orders + cancelled would be 318)", (await tileValue("Orders")) === String(A.last30.placed));
  const days = await openTable("Sales over time");
  const dayRows = await rowsOf(days);
  d.check(`the day-by-day table has 30 days that add up to ${A.last30.orders} orders`, dayRows.length === 30 && dayRows.reduce((a, r) => a + num(r[1]), 0) === A.last30.orders, `${dayRows.length} rows, ${dayRows.reduce((a, r) => a + num(r[1]), 0)} orders`);
  const hours = await openTable("When people order");
  const hourRows = await rowsOf(hours);
  d.check(`the hour-by-hour table adds up to ${A.last30.orders} orders`, hourRows.reduce((a, r) => a + num(r[1]), 0) === A.last30.orders, `${hourRows.length} hours`);
  d.check("the 'Busiest times' heat map and the order-type and payment charts are there", (await d.page.getByRole("table", { name: /Busiest times/ }).count()) === 1 && (await figure("Order types").count()) === 1 && (await figure("How people pay").count()) === 1);
  await d.shot("overview");

  // ---------------------------------------------------------------------------------------------------------------- 3
  await d.step("Choosing an outlet, a shorter period or custom dates changes every figure");
  const outletOptions = (await (await ui.F(d, "Outlet")).locator("option").allInnerTexts()).map((t) => t.trim());
  const MAIN = outletOptions.find((t) => /Main/.test(t));
  const SECOND = outletOptions.find((t) => /Second/.test(t));
  d.check("the Outlet box offers the whole store and each outlet", Boolean(MAIN && SECOND && outletOptions.includes("Whole store")), outletOptions.join(" | "));
  await ui.pick(d, "Outlet", MAIN);
  let bad = await tilesAre({ Sales: inr(A.last30Main.sales), Orders: String(A.last30Main.orders), "Net sales": inr(A.last30Main.net) });
  d.check(`${MAIN} alone: ${inr(A.last30Main.sales)} and ${A.last30Main.orders} orders`, bad.length === 0, bad.join("; "));
  await ui.pick(d, "Outlet", SECOND);
  bad = await tilesAre({ Sales: inr(A.last30Second.sales), Orders: String(A.last30Second.orders) });
  d.check(`${SECOND} alone: ${inr(A.last30Second.sales)} and ${A.last30Second.orders} orders`, bad.length === 0, bad.join("; "));
  d.never("one outlet's page still shows the other outlet's sales or the whole store's", [inr(A.last30Main.sales), inr(A.last30.sales)].includes(await tileValue("Sales")));
  await ui.pick(d, "Outlet", "Whole store");
  await ui.pick(d, "Period", "Last 7 days");
  bad = await tilesAre({ Sales: inr(A.last7.sales), Orders: String(A.last7.orders), Cancelled: String(A.last7.cancelled) });
  d.check(`Last 7 days: ${inr(A.last7.sales)}, ${A.last7.orders} orders`, bad.length === 0, bad.join("; "));
  await ui.pick(d, "Period", "Custom dates…");
  await d.page.getByText(longDate(A.last7.from), { exact: true }).first().waitFor({ timeout: 10000 });
  d.check("'Custom dates…' shows two date pickers (From, To) that start from the range just used", (await d.page.getByText(longDate(A.last7.from), { exact: true }).count()) === 1 && (await d.page.getByText(longDate(A.last7.to), { exact: true }).count()) === 1);
  // move the start back to the 1st of the month before, in the calendar: the figures widen; then pick the original day again
  const firstOfPrev = (() => { const m = monthOf(A.last7.from) - 1; const y = Math.floor((m - 1) / 12); return `${y}-${pad2(m - y * 12)}-01`; })();
  await pickDay(longDate(A.last7.from), -1, 1);
  const ordersWide = await ui.until(async () => Number(await tileValue("Orders")) > A.last7.orders, 12000);
  d.check("picking an earlier start date in the calendar widens the figures", ordersWide, `${await tileValue("Orders")} orders from ${firstOfPrev}`);
  await pickDay(longDate(firstOfPrev), 1, Number(A.last7.from.slice(8)));
  bad = await tilesAre({ Sales: inr(A.last7.sales), Orders: String(A.last7.orders) });
  d.check(`custom dates ${A.last7.from} to ${A.last7.to}, picked in the calendar, give the same ${inr(A.last7.sales)} as 'Last 7 days'`, bad.length === 0, bad.join("; "));
  await ui.pick(d, "Period", "Today");
  bad = await tilesAre({ Sales: inr(A.today.sales), Orders: String(A.today.orders) });
  d.check(`Today (no paid orders yet in the sample) shows ${inr(A.today.sales)} and ${A.today.orders} orders, not an error`, bad.length === 0 && !/Something went wrong|error/i.test(await ui.text(d)), bad.join("; "));
  await ui.pick(d, "Period", "Last 30 days");

  // ---------------------------------------------------------------------------------------------------------------- 4
  await d.step("Sales: one line per outlet, and the order types add up");
  await goTab("Sales");
  const lineFig = figure("Sales by outlet");
  await lineFig.waitFor({ timeout: 15000 });
  const legend = (await lineFig.innerText()).replace(/\s+/g, " ");
  d.check("the chart has a line for each outlet (their names are in the legend)", /Main/.test(legend) && /Second/.test(legend), legend.slice(0, 160));
  const typeRows = await rowsOf(figure("Order types by outlet"));
  const orderSum = typeRows.reduce((a, r) => a + num(r[2]), 0);
  const typeSales = (name) => typeRows.filter((r) => r[1] === name).reduce((a, r) => a + num(r[3]), 0);
  d.check(`the order-types table adds up to ${A.last30.orders} orders`, orderSum === A.last30.orders, String(orderSum));
  d.check(`takeaway ₹${A.last30.byChannel.takeaway / 100}, delivery ₹${A.last30.byChannel.delivery / 100}, dine-in ₹${A.last30.byChannel["dine-in"] / 100} (store totals)`, near(typeSales("Takeaway"), A.last30.byChannel.takeaway / 100, 1.5) && near(typeSales("Delivery"), A.last30.byChannel.delivery / 100, 1.5) && near(typeSales("Dine-in"), A.last30.byChannel["dine-in"] / 100, 1.5), JSON.stringify({ t: typeSales("Takeaway"), d: typeSales("Delivery"), i: typeSales("Dine-in") }));
  const mainOrders = typeRows.filter((r) => /Main/.test(r[0])).reduce((a, r) => a + num(r[2]), 0);
  d.check(`${MAIN}'s rows add up to ${A.last30Main.orders} orders`, mainOrders === A.last30Main.orders, String(mainOrders));
  d.check("the best and quietest weekday are named", /best day/.test(await ui.text(d)) && /quietest/.test(await ui.text(d)));
  await d.shot("sales");

  // ---------------------------------------------------------------------------------------------------------------- 5
  await d.step("Items & stock: best sellers, and how much to prepare");
  await goTab("Items & stock");
  await figure("Best sellers").waitFor({ timeout: 15000 });
  await ui.until(async () => /sold/.test(await figure("Best sellers").innerText()), 10000);
  const best = (await figure("Best sellers").innerText()).replace(/\s+/g, " ");
  const order = A.last30.topItems.slice(0, 3).map((t) => best.indexOf(t.name));
  d.check(`the best sellers run ${A.last30.topItems.slice(0, 3).map((t) => `${t.name} ${t.qty}`).join(", ")}`, order.every((x) => x >= 0) && order[0] < order[1] && order[1] < order[2] && A.last30.topItems.slice(0, 3).every((t) => new RegExp(`${t.name}[^\\d]*${t.qty} sold`).test(best)), best.slice(0, 260));
  const all = await rowsOf(d.page.getByRole("table", { name: "All items sold" }));
  d.check(`'Every item' lists each item with its quantity (${A.last30.topItems[0].name} = ${A.last30.topItems[0].qty})`, all.some((r) => r[1] === A.last30.topItems[0].name && num(r[2]) === A.last30.topItems[0].qty), JSON.stringify(all.slice(0, 2)));
  await ui.pick(d, "Outlet", MAIN);
  await d.page.locator("[data-tomorrow]").waitFor({ timeout: 15000 });
  const tomorrowWd = weekday(addDays(today, 1)); // 0 = Sunday
  const WD_NAME = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  d.check(`the prep list is for tomorrow, ${WD_NAME[tomorrowWd]}`, new RegExp(`Tomorrow \\(${WD_NAME[tomorrowWd]}\\)`).test(await d.page.locator("[data-tomorrow]").innerText()), await d.page.locator("[data-tomorrow]").innerText());
  const prepRows = await rowsOf(d.page.getByRole("table", { name: `Prep list for ${WD_NAME[tomorrowWd]}` }));
  const wantPrep = Object.entries(A.stockMain).filter(([, arr]) => arr[tomorrowWd] > 0);
  const prepOk = wantPrep.every(([name, arr]) => prepRows.some((r) => r[0] === name && num(r[1]) === arr[tomorrowWd]));
  d.check(`tomorrow's list matches the worked-out numbers (${wantPrep.map(([n, a]) => `${n} ${a[tomorrowWd]}`).join(", ")})`, prepOk, JSON.stringify(prepRows));
  const weekRows = await rowsOf(d.page.getByRole("table", { name: "Prep numbers for every weekday" }));
  const monFirst = [1, 2, 3, 4, 5, 6, 0];
  const weekOk = Object.entries(A.stockMain).every(([name, arr]) => { const row = weekRows.find((r) => r[0] === name); return row && monFirst.every((wd, i) => (row[i + 1] === "–" ? 0 : num(row[i + 1])) === arr[wd]); });
  d.check("every item's seven weekday numbers match the worked-out suggestions (average of the last 6 weeks + 15%, rounded up)", weekOk, JSON.stringify(weekRows.slice(0, 2)));
  const satBefore = num(weekRows.find((r) => r[0] === "Paneer Steamed Momos")?.[6] ?? "0");
  await ui.fill(d, "Safety margin (%)", 60);
  await ui.until(async () => num((await rowsOf(d.page.getByRole("table", { name: "Prep numbers for every weekday" }))).find((r) => r[0] === "Paneer Steamed Momos")?.[6] ?? "0") > satBefore, 12000);
  const satAfter = num((await rowsOf(d.page.getByRole("table", { name: "Prep numbers for every weekday" }))).find((r) => r[0] === "Paneer Steamed Momos")?.[6] ?? "0");
  d.check(`a bigger safety margin gives a bigger number (Paneer Steamed Momos on Saturday: ${satBefore} → ${satAfter})`, satAfter > satBefore);
  await d.shot("items");
  await ui.pick(d, "Outlet", "Whole store");

  // ---------------------------------------------------------------------------------------------------------------- 6
  await d.step("Customers: who has drifted away, and 'Message them' opens Marketing");
  await goTab("Customers");
  await d.page.locator("[data-lapsed]").waitFor({ timeout: 15000 });
  const lapsedText = (await d.page.locator("[data-lapsed]").innerText()).replace(/\s+/g, " ");
  const lapsed30 = Number(lapsedText.match(/(\d+) customers? (?:haven't|hasn't) ordered for over 30 days/)?.[1] ?? -1);
  d.check("the 30-, 60- and 90-day groups are listed", /over 30 days/.test(lapsedText) && /over 60 days/.test(lapsedText) && /over 90 days/.test(lapsedText) && lapsed30 > 0, lapsedText);
  await d.click(d.page.getByRole("link", { name: "Message them" }).first(), { after: 900 });
  await d.page.waitForURL(/\/marketing\/new\?lapsed=30/, { timeout: 15000 });
  const people = await ui.audienceCount(d);
  d.check(`Marketing opens with "hasn't ordered for 30 days" already chosen: the same ${lapsed30} people`, people === lapsed30, `${people} vs ${lapsed30}`);
  await d.shot("message-them");

  // ---------------------------------------------------------------------------------------------------------------- 7
  await d.step("Compare outlets: side by side for the same dates");
  await d.goto(`${BENCH.admin}/analytics/compare`, 700);
  const side = figure("Side by side");
  await side.waitFor({ timeout: 15000 });
  await ui.until(async () => (await side.innerText()).includes(inr(A.last30Main.sales)), 12000);
  const sideRows = await rowsOf(side);
  const rowOf = (name) => sideRows.find((r) => r[0] === name) ?? [];
  d.check(`Sales: ${MAIN} ${inr(A.last30Main.sales)}, ${SECOND} ${inr(A.last30Second.sales)}`, rowOf("Sales")[1]?.startsWith(inr(A.last30Main.sales)) && rowOf("Sales")[2]?.startsWith(inr(A.last30Second.sales)), JSON.stringify(rowOf("Sales")));
  d.check(`Orders: ${A.last30Main.orders} and ${A.last30Second.orders}`, rowOf("Orders")[1]?.startsWith(String(A.last30Main.orders)) && rowOf("Orders")[2]?.startsWith(String(A.last30Second.orders)), JSON.stringify(rowOf("Orders")));
  const pctSecond = Math.round(((A.last30Second.sales - A.last30Main.sales) / A.last30Main.sales) * 100);
  d.check(`the second outlet's sales are compared with the first (${pctSecond}%)`, new RegExp(`[−-]${Math.abs(pctSecond)}%`).test(rowOf("Sales")[2] ?? ""), rowOf("Sales")[2]);
  const topOf = (w) => `${w.topItems[0].name} — ${w.topItems[0].qty}`;
  const compareText = await ui.text(d);
  d.check(`each outlet has its own best sellers (${topOf(A.last30Main)} and ${topOf(A.last30Second)})`, compareText.includes(topOf(A.last30Main)) && compareText.includes(topOf(A.last30Second)), compareText.slice(-300));
  d.check("there is a day-by-day line for each outlet", (await figure("Sales day by day").count()) === 1);
  await ui.pick(d, "Period", "Custom dates…");
  await d.page.getByText(longDate(A.last30.from), { exact: true }).first().waitFor({ timeout: 10000 });
  await pickDay(longDate(A.last30.from), monthOf(A.last7.from) - monthOf(A.last30.from), Number(A.last7.from.slice(8)));
  const money = (cell) => num((cell ?? "").match(/₹[\d,]+/)?.[0] ?? "NaN"); // a cell reads "₹19,290 −42% vs the first outlet"
  const sumSales = (rows) => { const r = rows.find((x) => x[0] === "Sales") ?? []; return money(r[1]) + money(r[2]); };
  const sevenOk = await ui.until(async () => near(sumSales(await rowsOf(figure("Side by side"))), A.last7.sales / 100, 1.2), 12000);
  d.check(`for ${A.last7.from} to ${A.last7.to}, picked in the calendar, the two outlets add up to the store's ${inr(A.last7.sales)}`, sevenOk, `${sumSales(await rowsOf(figure("Side by side")))}`);
  await d.shot("compare");
  await ui.pick(d, "Period", "Last 30 days");

  // ---------------------------------------------------------------------------------------------------------------- 8
  await d.step("Operations: cancellations and discounts");
  await goTab("Operations");
  await tile("Cancelled orders").waitFor({ timeout: 15000 });
  d.check(`${A.last30.cancelled} orders were cancelled, ${((A.last30.cancelled / A.last30.placed) * 100).toFixed(1)}% of ${A.last30.placed}`, (await tileValue("Cancelled orders")) === String(A.last30.cancelled) && (await tileText("Cancelled orders")).includes(`${((A.last30.cancelled / A.last30.placed) * 100).toFixed(1)}% of ${A.last30.placed} orders`), await tileText("Cancelled orders"));
  const discounts = (await figure("Discounts in total").innerText()).replace(/\s+/g, " ");
  d.check(`coupon discounts are ${inr(A.last30.discount)}`, discounts.includes(`Coupon discounts ${inr(A.last30.discount)}`), discounts);
  d.check("kitchen speed and the coupon table are shown", (await figure("Kitchen speed").count()) === 1 && /SAVE20/.test(await ui.text(d)));
  await d.shot("operations");

  // ---------------------------------------------------------------------------------------------------------------- 9
  await d.step("Profit & loss: type the monthly bills once, get the profit");
  await goTab("Profit & loss", 900);
  const outletTab = (re) => d.page.getByRole("tab", { name: re });
  await outletTab(/Main/).waitFor({ timeout: 15000 });
  const bills = { main: { Rent: 5000, "Staff salaries": 8000 }, second: { Rent: 3000, "Staff salaries": 4000 }, shared: { "Marketing & ads": 2500 } };
  const typeBills = async (obj) => { for (const [label, v] of Object.entries(obj)) await ui.fillBox(d, `${label} per month`, v); };
  await d.click(outletTab(/Main/), { after: 300 });
  await typeBills(bills.main);
  await d.click(outletTab(/Second/), { after: 300 });
  await typeBills(bills.second);
  await d.click(outletTab(/Shared by every outlet/), { after: 300 });
  await typeBills(bills.shared);
  d.check("the 'Shared by every outlet' list adds up to ₹2,500 a month", /₹2,500/.test(await d.page.locator("[data-scope-total]").innerText()), await d.page.locator("[data-scope-total]").innerText());
  const months = monthsOf(A.last30.from, A.last30.to);
  const monthly = 5000 + 8000 + 3000 + 4000 + 2500;
  const netR = A.last30.net / 100;
  const expectProfit = (foodPct, monthlyTotal) => netR * (1 - foodPct / 100) - monthlyTotal * months;
  const readProfit = async () => { const t = (await d.page.locator("[data-net-profit]").innerText().catch(() => "")).trim(); return num(t); };
  const profitIs = async (want) => (await ui.until(async () => near(await readProfit(), want, 1.6), 10000));
  const want1 = expectProfit(35, monthly);
  d.check(`net profit = ${netR.toFixed(0)} net sales − 35% food − ${monthly} a month × ${months.toFixed(3)} months = ₹${Math.round(want1)}`, await profitIs(want1), `saw ${await readProfit()}`);
  d.check("it is called a profit (not a loss)", (await d.page.locator("[data-net-profit]").getAttribute("data-sign")) === "profit");
  const totals = (await figure("Where the money goes").innerText()).replace(/\s+/g, " ");
  d.check("the table lists every bill by name with its share for these days", /Rent/.test(totals) && /Staff salaries/.test(totals) && /Marketing & ads/.test(totals), totals.slice(0, 200));
  const byOutlet = await rowsOf(d.page.getByRole("table", { name: "Profit by outlet" }));
  const shareMain = A.last30Main.net / A.last30.net;
  const mainProfit = (A.last30Main.net / 100) * 0.65 - (13000 + 2500 * shareMain) * months;
  const secondProfit = (A.last30Second.net / 100) * 0.65 - (7000 + 2500 * (1 - shareMain)) * months;
  d.check(`profit by outlet: ${MAIN} ≈ ₹${Math.round(mainProfit)}, ${SECOND} ≈ ₹${Math.round(secondProfit)} (own bills + a share of the shared ones by sales)`, near(num(byOutlet.find((r) => /Main/.test(r[0]))?.[4] ?? "NaN"), mainProfit, 2) && near(num(byOutlet.find((r) => /Second/.test(r[0]))?.[4] ?? "NaN"), secondProfit, 2), JSON.stringify(byOutlet));
  // a bill nobody listed
  await d.click(outletTab(/Second/), { after: 300 });
  await ui.fill(d, "Add another bill", "Loan instalment");
  await d.click(d.page.getByRole("button", { name: "Add", exact: true }), { after: 400 });
  await ui.fillBox(d, "Loan instalment per month", 1000);
  d.check("a bill added by hand counts (₹1,000 a month more)", await profitIs(expectProfit(35, monthly + 1000)), `saw ${await readProfit()}`);
  await d.click(d.page.getByRole("button", { name: "Remove Loan instalment" }), { after: 400 });
  d.never("the removed bill still counts in the profit", !(await profitIs(want1)), `saw ${await readProfit()}`);
  await ui.fill(d, "Food cost (% of sales)", 30);
  d.check("food cost 30% instead of 35% raises the profit to match", await profitIs(expectProfit(30, monthly)), `saw ${await readProfit()}`);
  await ui.fill(d, "Food cost (% of sales)", 35);
  await profitIs(want1);
  await d.shot("profit");

  await d.step("The bills are remembered; 'Save to my store' keeps a copy for other devices");
  await d.page.reload({ waitUntil: "load" });
  await outletTab(/Main/).waitFor({ timeout: 15000 });
  await d.pause(600);
  d.check("after a reload the rent typed for the first outlet is still there", (await d.page.getByLabel("Rent per month").first().inputValue()) === "5000", await d.page.getByLabel("Rent per month").first().inputValue());
  d.check("…and so is the profit", await profitIs(want1), `saw ${await readProfit()}`);
  await d.click(d.page.getByRole("button", { name: "Save to my store" }), { after: 900 });
  d.check("'Save to my store' says it was saved", await ui.until(async () => /Saved to your store/.test(await d.page.locator("[data-finance-note]").innerText()), 8000), await d.page.locator("[data-finance-note]").innerText());
  await d.page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("rasoipulse.analytics.finance.")) localStorage.removeItem(k); });
  await d.page.reload({ waitUntil: "load" });
  await outletTab(/Main/).waitFor({ timeout: 15000 });
  await d.pause(800);
  d.check("with the browser's memory wiped (a new device) the saved bills load by themselves", await ui.until(async () => (await d.page.getByLabel("Rent per month").first().inputValue()) === "5000", 8000) && /Loaded the numbers saved to your store/.test(await d.page.locator("[data-finance-note]").innerText()), await d.page.locator("[data-finance-note]").innerText());
  d.check("…and the profit is the same again", await profitIs(want1), `saw ${await readProfit()}`);
  await ui.fillBox(d, "Rent per month", 9999);
  d.check("changing a bill changes the profit", await profitIs(expectProfit(35, monthly + (9999 - 5000))), `saw ${await readProfit()}`);
  await d.click(d.page.getByRole("button", { name: "Use the version saved to my store" }), { after: 900 });
  d.check("'Use the version saved to my store' puts the saved bill back", await ui.until(async () => (await d.page.getByLabel("Rent per month").first().inputValue()) === "5000", 8000) && (await profitIs(want1)), `saw ${await readProfit()}`);

  // --------------------------------------------------------------------------------------------------------------- 10
  await d.step("Reports: this week / last week / this month / last month / this year / last year");
  await goTab("Reports", 900);
  await d.page.getByRole("radio", { name: "Excel" }).waitFor({ timeout: 15000 });
  const monday = (k) => addDays(k, -((weekday(k) + 6) % 7));
  const lastDom = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const pad = (n) => String(n).padStart(2, "0");
  const pm = tm === 1 ? 12 : tm - 1, py = tm === 1 ? ty - 1 : ty;
  const ranges = {
    "This week (Mon–Sun)": [monday(today), addDays(monday(today), 6)],
    "Last week": [addDays(monday(today), -7), addDays(monday(today), -1)],
    "This month": [`${ty}-${pad(tm)}-01`, `${ty}-${pad(tm)}-${pad(lastDom(ty, tm))}`],
    "Last month": [`${py}-${pad(pm)}-01`, `${py}-${pad(pm)}-${pad(lastDom(py, pm))}`],
    "This year": [`${ty}-01-01`, `${ty}-12-31`],
    "Last year": [`${ty - 1}-01-01`, `${ty - 1}-12-31`],
  };
  const reportPeriod = d.page.getByLabel("Report period");
  const wrongRanges = [];
  for (const [label, [from, to]] of Object.entries(ranges)) {
    await d.choose(reportPeriod, { label }, { after: 200 });
    const got = (await d.page.locator("[data-report-range]").innerText()).trim();
    if (got !== `${from} to ${to}`) wrongRanges.push(`${label}: ${got} (wanted ${from} to ${to})`);
  }
  d.check("each weekly, monthly and yearly choice covers exactly the right dates", wrongRanges.length === 0, wrongRanges.join("; "));

  // a download in Chrome: click the button, wait for the browser's download, keep the file
  const download = async ({ format, label, period, outlet, sections, table, tickPnl }) => {
    await d.click(d.page.getByRole("radio", { name: format }), { after: 200 });
    await d.choose(reportPeriod, { label: period }, { after: 200 });
    await d.choose(d.page.getByLabel("Report outlets"), { label: outlet ?? "Whole store" }, { after: 200 });
    if (table) await d.choose(d.page.getByLabel("CSV table"), { label: table }, { after: 200 });
    for (const [caption, on] of Object.entries(sections ?? {})) await ui.tick(d, caption, on);
    if (tickPnl) await ui.tick(d, "Profit & loss", true);
    const [file] = await Promise.all([d.page.waitForEvent("download", { timeout: 30000 }), d.click(d.page.getByRole("button", { name: /^Download (Excel|CSV|PDF|JSON)/ }), { after: 400 })]);
    const path = `${DL_DIR}${Date.now()}-${file.suggestedFilename()}`;
    await file.saveAs(path);
    await ui.until(async () => (await d.page.locator("[data-downloaded]").count()) > 0, 8000);
    return { path, name: file.suggestedFilename(), label };
  };

  await d.step("Reports: Excel — a sheet per section with the right totals");
  const xl = await download({ format: "Excel", period: "Last 30 days", sections: { "Sales by hour": false }, tickPnl: true });
  d.check("the file is named like a report and ends .xlsx", /\.xlsx$/.test(xl.name), xl.name);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xl.path);
  const sheetNames = wb.worksheets.map((w) => w.name);
  d.check("there is a sheet for each chosen section", ["Summary", "Sales by day", "Items sold", "Order types", "Payment methods", "GST", "Outlets compared", "Top customers", "Profit & loss"].every((n) => sheetNames.includes(n)), sheetNames.join(" | "));
  d.never("a section that was not chosen (Sales by hour, Every order) is in the file", sheetNames.includes("Sales by hour") || sheetNames.includes("Every order"));
  const cells = (name) => { const ws = wb.getWorksheet(name); const rows = []; ws.eachRow((r) => rows.push(r.values.slice(1))); return rows; };
  const summary = cells("Summary");
  const sv = (label) => Number(summary.find((r) => r[0] === label)?.[1]);
  d.check(`Summary: sales ${A.last30.sales / 100}, net ${(A.last30.net / 100).toFixed(2)}, GST ${A.last30.tax / 100}, orders ${A.last30.orders}, cancelled ${A.last30.cancelled}`, near(sv("Sales (incl. GST)"), A.last30.sales / 100, 0.01) && near(sv("Net sales (excl. GST)"), A.last30.net / 100, 0.01) && near(sv("GST collected"), A.last30.tax / 100, 0.01) && sv("Orders") === A.last30.orders && sv("Cancelled orders") === A.last30.cancelled, JSON.stringify(summary.slice(0, 5)));
  const daily = cells("Sales by day").slice(1);
  d.check(`'Sales by day' has 30 days adding up to ₹${A.last30.sales / 100}`, daily.length === 30 && near(daily.reduce((a, r) => a + Number(r[2]), 0), A.last30.sales / 100, 0.05), `${daily.length} rows`);
  const gstRows = cells("GST").slice(1);
  const gstDaysOnly = gstRows.filter((r) => /^\d{4}-/.test(r[0]));
  const gstTotalRow = gstRows.find((r) => r[0] === "Total") ?? [];
  d.check(`the GST sheet's days add up to ₹${A.last30.tax / 100} GST, and its Total row says ₹${A.last30.tax / 100} too`, gstDaysOnly.length >= 28 && gstDaysOnly.length <= 30 && near(gstDaysOnly.reduce((a, r) => a + Number(r[5]), 0), A.last30.tax / 100, 0.05) && near(Number(gstTotalRow[5]), A.last30.tax / 100, 0.01), `${gstDaysOnly.length} days, total row ${JSON.stringify(gstTotalRow)}`);
  const pnlRows = cells("Profit & loss");
  const pnlNet = Number(pnlRows.find((r) => r[0] === "NET PROFIT")?.[1]);
  d.check(`the Profit & loss sheet uses the bills typed earlier: net profit ≈ ₹${Math.round(want1)}`, near(pnlNet, want1, 2), `sheet says ${pnlNet}`);

  await d.step("Reports: one outlet as CSV, and PDF and JSON");
  const csv = await download({ format: "CSV", period: "Last 30 days", outlet: MAIN, table: "Sales by day" });
  const csvText = readFileSync(csv.path, "utf8");
  const csvLines = csvText.replace(/^﻿/, "").trim().split("\r\n");
  d.check("the CSV has a header and one row per day, with the BOM Excel needs", csvText.charCodeAt(0) === 0xfeff && /^Day,Orders,Sales/.test(csvLines[0]) && csvLines.length === 31, csvLines[0]);
  d.check(`${MAIN}'s CSV adds up to ₹${A.last30Main.sales / 100} and ${A.last30Main.orders} orders (not the whole store's)`, near(csvLines.slice(1).reduce((a, l) => a + Number(l.split(",")[2]), 0), A.last30Main.sales / 100, 0.05) && csvLines.slice(1).reduce((a, l) => a + Number(l.split(",")[1]), 0) === A.last30Main.orders);
  d.never("the outlet's CSV contains the whole store's sales", csvLines.slice(1).reduce((a, l) => a + Number(l.split(",")[2]), 0) > A.last30Main.sales / 100 + 1);
  const pdf = await download({ format: "PDF", period: "This week (Mon–Sun)", outlet: "Whole store", sections: {} });
  const pdfBytes = readFileSync(pdf.path);
  d.check("the weekly PDF is a real PDF file", pdfBytes.subarray(0, 5).toString() === "%PDF-" && pdfBytes.subarray(-8).toString().includes("%%EOF") && statSync(pdf.path).size > 1500, `${statSync(pdf.path).size} bytes`);
  const json = await download({ format: "JSON", period: "This year", outlet: "Whole store" });
  const parsed = JSON.parse(readFileSync(json.path, "utf8"));
  d.check(`the yearly JSON says ${ty}-01-01 to ${ty}-12-31 for the whole store`, parsed.range?.from === `${ty}-01-01` && parsed.range?.to === `${ty}-12-31` && /Whole store/.test(parsed.scope), JSON.stringify([parsed.range, parsed.scope]));
  const yearSales = Number(parsed.sections?.summary?.rows?.find((r) => r.measure === "Sales (incl. GST)")?.value);
  d.check("…and its summary holds at least the last 30 days' sales (the whole year includes them)", yearSales >= A.last30.sales / 100 - 0.01, String(yearSales));

  // --------------------------------------------------------------------------------------------------------------- 11
  await d.step("GST and the daily cash close agree");
  await d.goto(`${BENCH.admin}/analytics/reports`, 700);
  const gst = d.page.locator("[data-gst-total]");
  await gst.waitFor({ timeout: 15000 });
  await ui.until(async () => (await gst.innerText()).replace(/\s+/g, " ").includes(inr(A.last30.tax)), 12000);
  const gstTotal = (await gst.innerText()).replace(/\s+/g, " ");
  d.check(`the GST total row: ${A.last30.orders} orders, taxable ${inr(A.last30.taxable)}, CGST ${inr(A.last30.cgst)}, SGST ${inr(A.last30.sgst)}, GST ${inr(A.last30.tax)}`, [String(A.last30.orders), inr(A.last30.taxable), inr(A.last30.cgst), inr(A.last30.sgst), inr(A.last30.tax)].every((s) => gstTotal.includes(s)), gstTotal);
  const yday = addDays(today, -1);
  const gstDays = await rowsOf(d.page.getByRole("table", { name: "GST by day" }));
  const ydayInvoice = num(gstDays.find((r) => r[0] === yday)?.[6] ?? "NaN");
  // yesterday: the calendar opens on today's month; go back a month only when yesterday was in the month before
  const back = yday.slice(0, 7) === today.slice(0, 7) ? 0 : -1;
  await pickDay(longDate(today), back, Number(yday.slice(8)));
  const collected = d.page.locator("[data-collected]");
  await ui.until(async () => num(await collected.innerText()) > 0, 10000);
  d.check(`the cash close for ${yday}, picked in the calendar, equals that day's invoice total in the GST table (₹${ydayInvoice})`, near(num(await collected.innerText()), ydayInvoice, 1.5), `${await collected.innerText()} vs ${ydayInvoice}`);
  await d.shot("reports");

  // --------------------------------------------------------------------------------------------------------------- 12
  await d.step("Who can see what: manager, accountant, cashier");
  await ui.signIn(d, MANAGER);
  d.check("the manager has Analytics in the sidebar", (await sidebarItems()).includes("Analytics"));
  await d.goto(`${BENCH.admin}/analytics/overview`, 700);
  await tile("Sales").waitFor({ timeout: 15000 });
  const mgrTabs = (await d.page.locator("a").allInnerTexts()).map((t) => t.trim());
  d.check("…with Overview, Sales, Items & stock, Customers, Compare outlets and Operations", ["Overview", "Sales", "Items & stock", "Customers", "Compare outlets", "Operations"].every((t) => mgrTabs.includes(t)));
  d.never("the manager is offered Profit & loss or Reports", mgrTabs.includes("Profit & loss") || mgrTabs.includes("Reports"), mgrTabs.join(" | "));
  d.check(`…and sees the same sales (${inr(A.last30.sales)})`, (await tilesAre({ Sales: inr(A.last30.sales) })).length === 0);
  for (const path of ["profit", "reports"]) {
    await d.goto(`${BENCH.admin}/analytics/${path}`, 600);
    await notFound().waitFor({ timeout: 10000 });
    d.check(`/analytics/${path} is a 404 for the manager`, /Page not found/.test(await ui.text(d)));
    d.never(`the manager sees the ${path} screen`, (await d.page.getByLabel("Rent per month").count()) > 0 || (await d.page.getByRole("button", { name: /^Download/ }).count()) > 0);
  }
  await ui.signIn(d, ACCOUNTANT);
  await d.goto(`${BENCH.admin}/analytics/overview`, 700);
  await tile("Sales").waitFor({ timeout: 15000 });
  const accTabs = (await d.page.locator("a").allInnerTexts()).map((t) => t.trim());
  d.check("the accountant has every tab, including Profit & loss and Reports", ["Overview", "Sales", "Items & stock", "Customers", "Compare outlets", "Operations", "Profit & loss", "Reports"].every((t) => accTabs.includes(t)), accTabs.join(" | "));
  await goTab("Reports", 800);
  d.check("…and can download (the Download button and the GST table are there)", (await d.page.getByRole("button", { name: /^Download/ }).count()) === 1 && (await d.page.locator("[data-gst-total]").count()) === 1);
  await ui.signIn(d, CASHIER);
  d.never("the cashier has Analytics in the sidebar", (await sidebarItems()).includes("Analytics"), (await sidebarItems()).join(", "));
  await d.goto(`${BENCH.admin}/analytics/overview`, 600);
  await notFound().waitFor({ timeout: 10000 });
  d.check("/analytics/overview is a 404 for the cashier", /Page not found/.test(await ui.text(d)));

  // --------------------------------------------------------------------------------------------------------------- 13
  await d.step("Plans: a store without Analytics sees a notice; the platform can unlock or lock it for one store");
  await ui.signIn(d, ["o@beta.test", "Owner123!"]);
  d.never("a store on the Starter plan has Analytics in its sidebar", (await sidebarItems()).includes("Analytics"));
  await d.goto(`${BENCH.admin}/analytics/overview`, 800);
  await d.page.getByText("Analytics isn't in your plan").waitFor({ timeout: 15000 });
  d.check("opening the address says 'Analytics isn't in your plan'", true);
  d.never("the Starter store sees sales figures", (await d.page.locator(".viz-tile").count()) > 0);
  await ui.signIn(d, "super");
  await ui.openPlatform(d, "/plans");
  await d.click(d.page.locator("section").filter({ has: d.page.getByText("Pro", { exact: true }) }).getByRole("button", { name: "Edit" }).first(), { after: 700 });
  d.check("the plan form has an 'Analytics & reports' switch, ticked on Pro", await d.page.getByRole("checkbox", { name: /^\s*Analytics & reports/ }).first().isChecked().catch(() => false));
  await d.press("Escape", 300);
  await ui.setStoreFeature(d, "Beta Bites", "Analytics & reports", "Unlocked for this store");
  await ui.signIn(d, ["o@beta.test", "Owner123!"]);
  d.check("unlocked for Beta Bites: Analytics appears in its sidebar", await ui.until(async () => (await sidebarItems()).includes("Analytics"), 8000));
  await d.goto(`${BENCH.admin}/analytics/overview`, 800);
  await tile("Sales").waitFor({ timeout: 15000 });
  d.check("…and its (empty) Overview opens, with no plan notice", !/isn't in your plan/.test(await ui.text(d)) && (await tileValue("Sales")) === "₹0", await tileValue("Sales"));
  await ui.signIn(d, "super");
  await ui.setStoreFeature(d, "Beta Bites", "Analytics & reports", "From plan");
  await ui.setStoreFeature(d, "Marketing Mart", "Analytics & reports", "Locked for this store");
  await ui.signIn(d, OWNER);
  await d.page.getByRole("link", { name: "Orders", exact: true }).first().waitFor({ timeout: 15000 });
  await d.pause(1500);
  d.never("Marketing Mart keeps Analytics after the platform locked it for the store", (await sidebarItems()).includes("Analytics"));
  await d.goto(`${BENCH.admin}/analytics/overview`, 800);
  d.check("its address now says 'Analytics isn't in your plan'", await ui.until(async () => /Analytics isn't in your plan/.test(await ui.text(d)), 8000));
  await ui.signIn(d, "super");
  await ui.setStoreFeature(d, "Marketing Mart", "Analytics & reports", "From plan");
  await ui.signIn(d, OWNER);
  d.check("back to 'from plan' (Pro has it): Analytics is back", await ui.until(async () => (await sidebarItems()).includes("Analytics"), 8000));

  d.never("the browser logged JavaScript errors", d.problems.length > 0, d.problems.join(" | "));
}
