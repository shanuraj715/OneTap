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
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
const page = await ctx.newPage();
page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon|WebSocket/.test(m.text())) problems.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
/** a rider's actions are one ⋮ menu: open it, then press the item with this test id */
const choose = async (name, item) => { await page.getByTestId(`rider-menu-${name}`).click(); await page.getByTestId(item).click(); };
const body = async () => (await page.locator("body").innerText()).replace(/\s+/g, " ");

try {
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', "o@acme.test"); await page.fill('input[type="password"]', "Owner123!");
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector("text=Orders");
  await page.goto(AD + "/riders", { waitUntil: "load" });
  console.log("== The 'Add a rider' form lines up");
  await page.getByTestId("add-rider-form").waitFor({ timeout: 15000 });
  const lay = await page.evaluate(() => {
    const r = (e) => e.getBoundingClientRect();
    const form = document.querySelector('[data-testid="add-rider-form"]');
    const boxes = [...form.querySelectorAll("input")].map(r), btn = r(form.querySelector('[data-testid="add-rider"]'));
    return { boxBottoms: boxes.map((b) => Math.round(b.bottom)), boxHeights: boxes.map((b) => Math.round(b.height)), btnBottom: Math.round(btn.bottom), btnHeight: Math.round(btn.height), btnTop: Math.round(btn.top), boxTop: Math.round(boxes[0].top) };
  });
  ok(lay.boxBottoms.every((b) => Math.abs(b - lay.btnBottom) <= 1), "the Add rider button's bottom edge is level with the bottom of the Name and Phone boxes", JSON.stringify(lay));
  ok(Math.abs(lay.btnHeight - lay.boxHeights[0]) <= 2 && lay.boxHeights[0] === lay.boxHeights[1], "…and the button is as tall as the boxes", `${lay.btnHeight} vs ${lay.boxHeights}`);
  for (const [n, p] of [[NAME, PHONE], [NOPHONE, ""]]) {
    await page.getByLabel("New rider name").fill(n);
    await page.getByLabel("New rider phone").fill(p);
    await page.getByTestId("add-rider").click();
    await page.locator(`[data-testid="rider-row-${n}"]`).waitFor({ timeout: 8000 });
  }
  const ids = {};
  for (const r of (await call("GET", "/api/riders")).json.riders) if ([NAME, NOPHONE].includes(r.name)) { made.push(r.id); ids[r.name] = r.id; }
  const row = page.locator(`[data-testid="rider-row-${NAME}"]`);

  console.log("== Turning the app login on");
  ok(/rider app/i.test(await body()) && /No login/.test(await row.innerText()), "the riders table has a 'Rider app' column, and a new rider has 'No login'");
  const cell = await row.locator("td").last();
  ok((await cell.locator("button").count()) === 1 && !/Reset PIN|Switch off|App login/.test(await cell.innerText()), "a rider's actions are ONE ⋮ button, not a row of buttons");
  await page.getByTestId(`rider-menu-${NAME}`).click();
  const menuText = await page.getByRole("menu").innerText();
  ok(/Set up app login/.test(menuText) && /Take off the duty list/.test(menuText) && /Edit name and phone/.test(menuText) && /Remove rider/.test(menuText) && !/Show PIN/.test(menuText), "its menu offers app login, duty list, edit and remove — and no 'Show PIN' while there is no login", menuText.replace(/\s+/g, " ").slice(0, 160));
  ok(await page.getByTestId(`rider-remove-${NAME}`).evaluate((e) => getComputedStyle(e).color) !== (await page.getByTestId(`rider-edit-${NAME}`).evaluate((e) => getComputedStyle(e).color)), "'Remove rider' is coloured as a dangerous action");
  await page.keyboard.press("Escape");
  await page.getByRole("menu").waitFor({ state: "hidden" });
  await choose(NAME, `rider-pin-${NAME}`);
  const dlg = page.getByTestId("pin-dialog");
  await dlg.waitFor({ timeout: 5000 });
  // the dialog's layout: everything sits inside the panel with real padding (it once touched the edges)
  const box = await page.getByRole("dialog").boundingBox();
  const inner = await page.evaluate(() => {
    const panel = document.querySelector('[role="dialog"]').getBoundingClientRect();
    const edges = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { left: r.left - panel.left, right: panel.right - r.right, top: r.top - panel.top, bottom: panel.bottom - r.bottom }; };
    const buttons = [...document.querySelectorAll('[data-testid="pin-dialog"] button')].map((b) => b.getBoundingClientRect());
    return { title: edges('[data-testid="pin-dialog"] h2'), input: edges('[data-testid="pin-input"]'), buttonsRight: Math.min(...buttons.map((r) => panel.right - r.right)), buttonsBottom: Math.min(...buttons.map((r) => panel.bottom - r.bottom)) };
  });
  ok(inner.title.left >= 16 && inner.title.top >= 16 && inner.input.left >= 16 && inner.input.right >= 16, "the title and the PIN box sit inside the panel with at least 16 px around them", JSON.stringify({ title: inner.title, input: inner.input }));
  ok(inner.buttonsRight >= 16 && inner.buttonsBottom >= 16, "the buttons are at least 16 px from the panel's right and bottom edges", `right ${Math.round(inner.buttonsRight)}, bottom ${Math.round(inner.buttonsBottom)}`);
  ok(box.width <= 470 && inner.input.left + inner.input.right < box.width - 100, "the PIN box uses the width of the panel", `panel ${Math.round(box.width)} px`);
  const suggested = await page.getByTestId("pin-input").inputValue();
  ok(/^\d{4}$/.test(suggested) && !/^(\d)\1+$/.test(suggested), "the dialog suggests a 4-digit PIN that isn't 0000 or 1111", suggested);
  ok(new RegExp(PHONE).test(await dlg.innerText()) && /look it up again later/i.test(await dlg.innerText()) && !/not shown again/i.test(await dlg.innerText()), "it says the phone number is the login name, and that the PIN can be looked up again later (Show PIN)");
  const typeOf = () => page.getByTestId("pin-input").getAttribute("type");
  ok((await typeOf()) === "text" && /Hide PIN/.test(await page.getByTestId("pin-toggle").innerText()), "the PIN starts visible (the manager must tell it to the rider), with a 'Hide PIN' switch");
  await page.getByTestId("pin-toggle").click();
  ok((await typeOf()) === "password" && /Show PIN/.test(await page.getByTestId("pin-toggle").innerText()) && (await page.getByTestId("pin-input").inputValue()) === suggested, "'Hide PIN' hides the digits without changing them, and the switch now says 'Show PIN'");
  await page.getByTestId("pin-toggle").click();
  ok((await typeOf()) === "text", "'Show PIN' shows them again");
  await page.getByTestId("pin-input").fill("12ab");
  ok((await page.getByTestId("pin-input").inputValue()) === "12" && await page.getByTestId("pin-save").isDisabled(), "only digits can be typed, and fewer than 4 can't be saved");
  await page.getByTestId("pin-input").fill("4821");
  await page.getByTestId("pin-save").click();
  await dlg.waitFor({ state: "hidden", timeout: 8000 });
  await page.waitForTimeout(500);
  ok(/Login on/.test(await row.innerText()), "the row now says 'Login on'");
  await page.getByTestId(`rider-menu-${NAME}`).click();
  const menuOn = await page.getByRole("menu").innerText();
  ok(/Show PIN/.test(menuOn) && /Reset PIN/.test(menuOn) && /Switch off app login/.test(menuOn) && !/Set up app login/.test(menuOn), "its menu now offers Show PIN, Reset PIN and Switch off app login");
  await page.keyboard.press("Escape");
  ok(!(await body()).includes("4821"), "the PIN is not left on the page after the dialog closes");
  const ok1 = await riderLogin(PHONE, "4821");
  ok(ok1.status === 200 && ok1.json.rider?.name === NAME, "the rider can sign in to the app with that phone number and PIN");

  console.log("== Show PIN");
  await choose(NAME, `rider-showpin-${NAME}`);
  const sdlg = page.getByTestId("show-pin-dialog");
  await sdlg.waitFor({ timeout: 8000 });
  const val = page.getByTestId("show-pin-value");
  await val.waitFor();
  ok(/^•{4}$/.test((await val.innerText()).trim()) && !(await sdlg.innerText()).includes("4821"), "the PIN starts hidden: four dots, no digits anywhere in the dialog");
  ok(new RegExp(PHONE).test(await sdlg.innerText()), "it names the phone number the rider signs in with");
  await page.getByTestId("show-pin-toggle").click();
  ok((await val.innerText()).trim() === "4821", "'Show' reveals the PIN the manager set (4821)");
  ok(/Hide/.test(await page.getByTestId("show-pin-toggle").innerText()) && (await page.getByTestId("show-pin-toggle").getAttribute("aria-pressed")) === "true", "…and the button becomes 'Hide'");
  await page.getByTestId("show-pin-copy").click();
  await page.waitForTimeout(300);
  ok((await page.evaluate(() => navigator.clipboard.readText())) === "4821" && /Copied/.test(await page.getByTestId("show-pin-copy").innerText()), "'Copy' puts the PIN on the clipboard and says 'Copied'");
  await page.getByTestId("show-pin-toggle").click();
  ok(/^•{4}$/.test((await val.innerText()).trim()), "'Hide' covers it again");
  const net = [];
  page.on("response", (r) => { if (/\/api\/riders\/.+\/pin/.test(r.url()) && r.request().method() === "GET") net.push(r.headers()["cache-control"] ?? ""); });
  await page.getByRole("button", { name: "Close" }).click();
  await sdlg.waitFor({ state: "hidden" });
  await choose(NAME, `rider-showpin-${NAME}`);
  await sdlg.waitFor();
  await val.waitFor();
  ok(/^•{4}$/.test((await val.innerText()).trim()), "opened again, it is hidden again (nothing is remembered between looks)");
  ok(net.length >= 1 && net.every((h) => /no-store/.test(h)), "the answer carries Cache-Control: no-store", net.join("|"));
  await page.getByRole("button", { name: "Close" }).click();
  await sdlg.waitFor({ state: "hidden" });

  console.log("== Resetting it");
  await choose(NAME, `rider-pin-${NAME}`);
  await dlg.waitFor();
  ok(/New PIN for/.test(await dlg.innerText()) && /old PIN stops working/.test(await dlg.innerText()), "the dialog says the old PIN stops working");
  await page.getByTestId("pin-input").fill("7777");
  await page.getByTestId("pin-save").click();
  await dlg.waitFor({ state: "hidden", timeout: 8000 });
  const oldPin = await riderLogin(PHONE, "4821"), newPin = await riderLogin(PHONE, "7777");
  ok(oldPin.status === 401 && newPin.status === 200, "the old PIN stops working and the new one works", `old ${oldPin.status}, new ${newPin.status} ${newPin.json.error ?? ""}`);
  await choose(NAME, `rider-showpin-${NAME}`);
  await sdlg.waitFor();
  await page.getByTestId("show-pin-toggle").click();
  ok((await page.getByTestId("show-pin-value").innerText()).trim() === "7777", "Show PIN now shows the new PIN (7777), not the old one");
  await page.getByRole("button", { name: "Close" }).click();
  await sdlg.waitFor({ state: "hidden" });

  console.log("== Switching it off");
  page.once("dialog", (d) => d.accept());
  await choose(NAME, `rider-pin-off-${NAME}`);
  await page.waitForTimeout(800);
  const afterOff = await riderLogin(PHONE, "7777");
  ok(/No login/.test(await row.innerText()) && afterOff.status === 401, "'Switch off app login' switches it off: the row says 'No login' and the rider can't sign in", `${afterOff.status} ${afterOff.json.error ?? ""}`);
  const gone = await call("GET", `/api/riders/${ids[NAME]}/pin`);
  ok(gone.status === 200 && gone.json.pin === null && gone.json.reason === "no_login", "the stored PIN is gone with the login: asking for it answers 'no login', never a PIN", JSON.stringify(gone.json));
  await page.getByTestId(`rider-menu-${NAME}`).click();
  ok(!/Show PIN/.test(await page.getByRole("menu").innerText()) && /Set up app login/.test(await page.getByRole("menu").innerText()), "and the menu no longer offers Show PIN");
  await page.keyboard.press("Escape");

  console.log("== A rider with no phone number");
  await choose(NOPHONE, `rider-pin-${NOPHONE}`);
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
