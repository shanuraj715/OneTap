// The console's Platform settings → Cache lifetime, in Chrome against the bench (super admin: super@sandbox.test):
//   - there are NO preset buttons ("30 s", "1 min", "5 min", "15 min", "1 hour", "Off"): the lifetime is one input, in seconds;
//   - the words next to it follow what is typed (900 → "15 minutes", 5400 → "1 hour 30 minutes", 0 → "off", 100000 → "—" and Save is off);
//   - what is saved (here 900) is what the box shows after a reload, in seconds AND in words;
//   - the same API setting (PUT /cache/settings) is what the Rasoi Pulse Admin app writes, so a value set here shows in the app's box.
import { chromium } from "playwright";
const AD = "http://localhost:3171";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const problems = [];
let seen = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); if (problems.length > seen) { console.log(`      ^ browser error: ${problems[seen]}`); seen = problems.length; } };
const say = (s) => console.log(`\n=== ${s}`);
const norm = (t) => t.replace(/\s+/g, " ").trim();

const login = async (email, password) => (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.get("set-cookie").split(";")[0];
const su = await login("super@sandbox.test", "Super123!");
const sa = async (method, path, body) => { const r = await fetch(`${API}/api/platform${path}`, { method, headers: { cookie: su, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json().catch(() => ({})) }; };
const before = (await sa("GET", "/cache")).json.cache?.ttlSeconds;

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon|WebSocket/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));

  say("1. A value set elsewhere (900 s, as the app would) shows in the box and in words");
  ok((await sa("PUT", "/cache/settings", { ttlSeconds: 900 })).status === 200, "set 900 seconds through the API");
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', "super@sandbox.test");
  await page.fill('input[type="password"]', "Super123!");
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector("aside a");
  await page.goto(AD + "/platform/settings", { waitUntil: "load" });
  const box = page.getByTestId("cache-lifetime-input");
  await box.waitFor({ timeout: 15000 });
  ok((await box.inputValue()) === "900", "the input shows 900", await box.inputValue());
  // the page has other cards with their own Save: the one that belongs to the cache box is the first one after it
  const saveBtn = box.locator("xpath=following::button[normalize-space(.)='Save' or normalize-space(.)='Saving…'][1]");
  const words = () => page.getByTestId("cache-lifetime-text").innerText().then(norm);
  ok((await words()) === "= 15 minutes", "…and the words say '= 15 minutes'", await words());

  say("2. No preset buttons");
  for (const label of ["30 s", "1 min", "5 min", "15 min", "1 hour", "Off"]) {
    ok((await page.getByRole("button", { name: label, exact: true }).count()) === 0, `there is no '${label}' button`);
  }
  ok((await saveBtn.count()) === 1 && (await saveBtn.isVisible()), "the cache box has its Save button");

  say("3. The words follow what is typed");
  const cases = [["30", "= 30 seconds"], ["60", "= 1 minute"], ["90", "= 1 minute 30 seconds"], ["300", "= 5 minutes"], ["5400", "= 1 hour 30 minutes"], ["3600", "= 1 hour"], ["7200", "= 2 hours"], ["86400", "= 24 hours"], ["0", "= off"]];
  for (const [typed, expected] of cases) {
    await box.fill(typed);
    ok((await words()) === expected, `${typed} → '${expected}'`, await words());
  }
  await box.fill("100000");
  ok((await words()) === "= —" && (await saveBtn.isDisabled()), "100000 (more than a day) shows '—' and Save is off");
  await box.fill("");
  ok(await saveBtn.isDisabled(), "an empty box can't be saved");

  say("4. Saving");
  await box.fill("900");
  ok(await saveBtn.isDisabled(), "the value that is already saved leaves Save off");
  await box.fill("1800");
  await saveBtn.click();
  await page.getByText(/Saved — it applies from the next visitor/).waitFor({ timeout: 8000 });
  ok((await sa("GET", "/cache")).json.cache?.ttlSeconds === 1800, "1800 is what the server now holds");
  await page.reload({ waitUntil: "load" });
  await box.waitFor({ timeout: 15000 });
  ok((await box.inputValue()) === "1800" && (await words()) === "= 30 minutes", "after a reload the box says 1800 and '= 30 minutes'", `${await box.inputValue()} ${await words()}`);

  ok(problems.length === 0, "no errors in the browser", problems.slice(0, 2).join(" | "));
} finally {
  if (Number.isInteger(before)) await sa("PUT", "/cache/settings", { ttlSeconds: before });
  await browser.close();
}
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
