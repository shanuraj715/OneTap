// The console's "Refresh interval" card on App Management: how often each mobile app (OMA, KDA, RDA) asks the server for new data. Driven in Chrome
// against the bench; what the apps are told is read back through the same header the apps read (`x-refresh-seconds` on any answer to a request
// that carries x-app-id). Default 8 seconds, one number per app.
import { chromium } from "playwright";
const AD = "http://localhost:3171";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* retry */ } await sleep(250); } return false; };

const login = async (email, password) => (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const sup = await login("super@sandbox.test", "Super123!");
const setApi = async (app, refreshSeconds) => (await fetch(`${API}/api/platform/app-releases/settings/${app}`, { method: "PUT", headers: { "content-type": "application/json", cookie: sup }, body: JSON.stringify({ refreshSeconds }) })).status;
/** what a phone running `app` is told right now (the cache is cleared on save; reads after the TTL see other processes' saves too) */
const told = async (app) => (await fetch(`${API}/api/app-updates/check?app=oma&versionCode=1`, { headers: { "x-app-id": app } })).headers.get("x-refresh-seconds");
const resetAll = async () => { for (const a of ["oma", "kda", "rda"]) await setApi(a, 8); };

await resetAll();
let browser;
try {
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|favicon|status of 4\d\d|status of 5\d\d/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', "super@sandbox.test"); await page.fill('input[type="password"]', "Super123!");
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector("text=Stores");
  await page.getByRole("link", { name: "App Management" }).first().click();
  await page.getByRole("heading", { name: "App Management" }).waitFor({ timeout: 15000 });
  const card = page.getByTestId("app-refresh");
  const field = page.getByTestId("refresh-seconds");
  const save = page.getByTestId("refresh-save");
  const tab = (id) => page.getByTestId(`app-tab-${id}`);

  say("1. Every app starts at 8 seconds");
  await card.waitFor();
  ok(/OMA asks the server for new data every\s+8 seconds/.test(await card.innerText()) && /the default/.test(await page.getByTestId("app-refresh-now").innerText()), "the order app's card says 8 seconds, the default");
  ok((await field.inputValue()) === "8", "the box holds 8");
  ok(await save.isDisabled(), "Save is off while nothing has changed");
  ok((await page.getByTestId("refresh-default").count()) === 0, "and there is no 'Use the default' button while it already is the default");
  ok(/table board and the list of orders/.test(await card.innerText()), "the card says what the order app's refresh covers");
  await tab("rda").click();
  await page.getByText(/RDA asks the server/).waitFor();
  ok(/the list of deliveries \(new delivery requests\)/.test(await card.innerText()), "the delivery app's card says it covers new delivery requests");
  ok((await field.inputValue()) === "8" && /RDA asks the server for new data every\s+8 seconds/.test(await card.innerText()), "and starts at 8 seconds as well");
  await tab("kda").click();
  await page.getByText(/KDA asks the server/).waitFor();
  ok(/kitchen board/.test(await card.innerText()), "the kitchen app's card is about the kitchen board");

  say("2. The delivery app set to 15: it is saved and the server announces 15 to that app only");
  await tab("rda").click();
  await page.getByText(/RDA asks the server/).waitFor();
  await field.fill("15");
  ok(await save.isEnabled(), "typing a new number turns Save on");
  ok((await page.getByTestId("refresh-default").count()) === 1, "and offers 'Use the default (8)'");
  await save.click();
  await page.getByTestId("refresh-saved").waitFor();
  ok(/RDA now asks every 15 seconds/.test(await page.getByTestId("refresh-saved").innerText()), "a note says RDA now asks every 15 seconds");
  ok(await until(async () => /every\s+15 seconds/.test(await page.getByTestId("app-refresh-now").innerText())), "the card now reads 15 seconds");
  ok(!/the default/.test(await page.getByTestId("app-refresh-now").innerText()), "and no longer says it is the default");
  ok(await save.isDisabled(), "Save goes off again (nothing left to save)");
  ok((await told("rda")) === "15", "a phone running the delivery app is now told 15");
  ok((await told("oma")) === "8" && (await told("kda")) === "8", "the order app and the kitchen app are still told 8");

  say("3. It is remembered, per app");
  await page.reload({ waitUntil: "load" });
  await page.getByRole("heading", { name: "App Management" }).waitFor({ timeout: 15000 });
  await card.waitFor();
  ok((await field.inputValue()) === "8", "after a reload the first tab (OMA) still shows 8");
  await tab("rda").click();
  await page.getByText(/RDA asks the server/).waitFor();
  ok((await field.inputValue()) === "15", "the delivery app's tab shows 15");

  say("4. Wrong numbers are stopped before they are sent, with a message");
  const problem = () => page.getByTestId("refresh-problem");
  for (const [v, re] of [["2", /At least 3 seconds/], ["601", /At most 600 seconds/], ["7.5", /whole number/]]) {
    await field.fill(v);
    ok(re.test(await problem().innerText()) && (await save.isDisabled()), `${v} is refused in the box (${v === "7.5" ? "not a whole number" : "outside 3 to 600"}) and Save stays off`, await problem().innerText().catch(() => ""));
  }
  await field.fill("");
  ok((await save.isDisabled()) && (await problem().count()) === 0, "an empty box turns Save off without a scary message");
  ok((await told("rda")) === "15", "none of those reached the server");
  // the server itself also refuses (a wrong number sent by something other than this page)
  ok((await setApi("rda", 2)) === 400 && (await setApi("rda", 601)) === 400 && (await told("rda")) === "15", "and the server refuses them too (400) without changing anything");

  say("5. The edges are allowed: 3 and 600");
  await field.fill("3");
  await save.click();
  await page.getByTestId("refresh-saved").waitFor();
  ok((await told("rda")) === "3", "3 seconds (the smallest) is accepted");
  await field.fill("600");
  await save.click();
  await until(async () => (await told("rda")) === "600");
  ok((await told("rda")) === "600", "600 seconds (the largest) is accepted");

  say("6. Enter saves, and 'Use the default' brings back 8");
  await field.fill("20");
  await field.press("Enter");
  ok(await until(async () => (await told("rda")) === "20"), "pressing Enter in the box saves it (20)");
  await page.getByTestId("refresh-default").click();
  ok((await field.inputValue()) === "8", "'Use the default (8)' puts 8 in the box");
  ok((await told("rda")) === "20", "…but nothing is saved until Save is pressed");
  await save.click();
  ok(await until(async () => (await told("rda")) === "8"), "Save then sets it back to 8");
  ok(await until(async () => /the default/.test(await page.getByTestId("app-refresh-now").innerText())), "and the card says it is the default again");

  say("7. Each app keeps its own number");
  await field.fill("25");
  await save.click();
  await until(async () => (await told("rda")) === "25");
  await tab("oma").click();
  await page.getByText(/OMA asks the server/).waitFor();
  await field.fill("12");
  await save.click();
  await until(async () => (await told("oma")) === "12");
  ok((await told("oma")) === "12" && (await told("rda")) === "25" && (await told("kda")) === "8", "OMA 12, RDA 25, KDA 8: three separate numbers");

  say("8. A phone-sized screen");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, "nothing sticks out sideways on a 390 px screen");
  ok(await field.isVisible() && await save.isVisible(), "the box and Save are both reachable");
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "results/shots/t105-app-refresh-interval-phone.png" }).catch(() => undefined);
} finally {
  await resetAll().catch(() => undefined);
  await browser?.close();
}
ok(problems.length === 0, "no errors in the browser", problems.slice(0, 3).join(" | "));
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
