// Settings → Delivery riders: the manager gives a rider an app login (a PIN), resets it and switches it off — in Chrome against the bench store.
// What it adds to the bench is removed at the end. The sign-in itself (the rider app's API) is covered by rider-app-api.mjs.
import { chromium } from "playwright";
const AD = "http://localhost:3171";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];
const cookie = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "o@acme.test", password: "Owner123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const outlets = await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json();
const main = (outlets.outlets ?? outlets).find((o) => o.slug === "main");
const outletId = String(main._id ?? main.id);
const call = async (method, path, body, headers = {}) => { const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie, "x-rasoipulse-outlet": outletId, ...headers }, body: body ? JSON.stringify(body) : undefined }); let json = {}; try { json = await r.json(); } catch {} return { status: r.status, json }; };
// (each sign-in comes from its own made-up address, so the wrong PINs this test tries on purpose never add up against one address and pause it)
let ipn = Math.floor(Math.random() * 200);
const riderLogin = (phone, pin) => fetch(`${API}/api/rider/login`, { method: "POST", headers: { "content-type": "application/json", "x-app-id": "rda", "x-forwarded-for": `198.51.100.${(ipn = (ipn % 250) + 1)}` }, body: JSON.stringify({ phone, pin }) }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }));
const stamp = String(Date.now()).slice(-5);
const NAME = `Pin Rider ${stamp}`;
const NOPHONE = `No Phone ${stamp}`;
const PHONE = `97${stamp}${stamp.slice(0, 3)}`.slice(0, 10);
const made = [];

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
  await page.goto(AD + "/riders", { waitUntil: "load" });
  for (const [n, p] of [[NAME, PHONE], [NOPHONE, ""]]) {
    await page.getByLabel("New rider name").fill(n);
    await page.getByLabel("New rider phone").fill(p);
    await page.getByTestId("add-rider").click();
    await page.locator(`[data-testid="rider-row-${n}"]`).waitFor({ timeout: 8000 });
  }
  for (const r of (await call("GET", "/api/riders")).json.riders) if ([NAME, NOPHONE].includes(r.name)) made.push(r.id);
  const row = page.locator(`[data-testid="rider-row-${NAME}"]`);

  console.log("== Turning the app login on");
  ok(/rider app/i.test(await body()) && /No login/.test(await row.innerText()), "the riders table has a 'Rider app' column, and a new rider has 'No login'");
  await page.getByTestId(`rider-pin-${NAME}`).click();
  const dlg = page.getByTestId("pin-dialog");
  await dlg.waitFor({ timeout: 5000 });
  const suggested = await page.getByTestId("pin-input").inputValue();
  ok(/^\d{4}$/.test(suggested) && !/^(\d)\1+$/.test(suggested), "the dialog suggests a 4-digit PIN that isn't 0000 or 1111", suggested);
  ok(new RegExp(PHONE).test(await dlg.innerText()) && /not shown again/i.test(await dlg.innerText()), "it says the phone number is the login name, and that the PIN is not shown again");
  await page.getByTestId("pin-input").fill("12ab");
  ok((await page.getByTestId("pin-input").inputValue()) === "12" && await page.getByTestId("pin-save").isDisabled(), "only digits can be typed, and fewer than 4 can't be saved");
  await page.getByTestId("pin-input").fill("4821");
  await page.getByTestId("pin-save").click();
  await dlg.waitFor({ state: "hidden", timeout: 8000 });
  await page.waitForTimeout(500);
  ok(/Login on/.test(await row.innerText()) && /Reset PIN/.test(await row.innerText()), "the row now says 'Login on' and offers 'Reset PIN'");
  ok(!(await body()).includes("4821"), "the PIN is not shown anywhere on the page afterwards");
  const ok1 = await riderLogin(PHONE, "4821");
  ok(ok1.status === 200 && ok1.json.rider?.name === NAME, "the rider can sign in to the app with that phone number and PIN");

  console.log("== Resetting it");
  await page.getByTestId(`rider-pin-${NAME}`).click();
  await dlg.waitFor();
  ok(/New PIN for/.test(await dlg.innerText()) && /old PIN stops working/.test(await dlg.innerText()), "the dialog says the old PIN stops working");
  await page.getByTestId("pin-input").fill("7777");
  await page.getByTestId("pin-save").click();
  await dlg.waitFor({ state: "hidden", timeout: 8000 });
  const oldPin = await riderLogin(PHONE, "4821"), newPin = await riderLogin(PHONE, "7777");
  ok(oldPin.status === 401 && newPin.status === 200, "the old PIN stops working and the new one works", `old ${oldPin.status}, new ${newPin.status} ${newPin.json.error ?? ""}`);

  console.log("== Switching it off");
  page.once("dialog", (d) => d.accept());
  await page.getByTestId(`rider-pin-off-${NAME}`).click();
  await page.waitForTimeout(800);
  const afterOff = await riderLogin(PHONE, "7777");
  ok(/No login/.test(await row.innerText()) && afterOff.status === 401, "'Login off' switches it off: the row says 'No login' and the rider can't sign in", `${afterOff.status} ${afterOff.json.error ?? ""}`);

  console.log("== A rider with no phone number");
  await page.getByTestId(`rider-pin-${NOPHONE}`).click();
  await dlg.waitFor();
  await page.getByTestId("pin-save").click();
  await page.waitForTimeout(800);
  ok(/10-digit phone number/.test(await dlg.innerText()), "the dialog explains that a phone number is needed first (the server's sentence)");
  await page.getByRole("button", { name: "Cancel" }).click();
  await dlg.waitFor({ state: "hidden" });

  ok(problems.length === 0, "no errors or warnings in the browser console", problems.slice(0, 3).join(" | "));
} catch (e) {
  ok(false, "the test stopped with an error", String(e?.stack ?? e).split("\n").slice(0, 5).join(" | "));
}
for (const id of made) await call("DELETE", `/api/riders/${id}`);
await browser.close();
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
