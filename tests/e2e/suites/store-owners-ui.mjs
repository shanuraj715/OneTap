// Console → Stores → a store → Owners tab, in Chrome against the bench (super admin: super@sandbox.test):
//   - "Add an owner": Name, Email and Password boxes start on the SAME line (the Password hint sits under its box and pushes nobody), the
//     "Add owner" button is level with the boxes, and the boxes have real width;
//   - on a narrow window the fields stack, nothing overflows sideways and no two fields overlap;
//   - an owner's row keeps its actions (Reset password, Deactivate, Remove) together on the right, and Reset password opens a box with Set and Cancel.
import { chromium } from "playwright";
const AD = "http://localhost:3171";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const problems = [];
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);
const login = async () => (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "super@sandbox.test", password: "Super123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const sup = await login();
const store = (await (await fetch(`${API}/api/platform/stores`, { headers: { cookie: sup } })).json()).stores?.[0];

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon|WebSocket/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', "super@sandbox.test");
  await page.fill('input[type="password"]', "Super123!");
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector("aside a");
  await page.goto(`${AD}/platform/stores/${store.id}`, { waitUntil: "load" });
  await page.getByRole("tab", { name: /Owners/ }).click();
  const form = page.getByTestId("add-owner-form");
  await form.waitFor({ timeout: 15000 });
  const box = async (loc) => (await loc.boundingBox());
  const boxes = async () => ({ name: await box(form.locator("input").nth(0)), email: await box(form.locator("input").nth(1)), pass: await box(form.locator('input[type="password"]')), btn: await box(form.getByRole("button", { name: /Add owner/ })) });

  say("1. Wide window: one level row");
  let b = await boxes();
  ok(Math.abs(b.name.y - b.email.y) < 1.5 && Math.abs(b.name.y - b.pass.y) < 1.5, "Name, Email and Password boxes share the same top edge", `${b.name.y.toFixed(0)} / ${b.email.y.toFixed(0)} / ${b.pass.y.toFixed(0)}`);
  ok(Math.abs(b.name.height - b.pass.height) < 1.5, "…and the same height", `${b.name.height.toFixed(0)} / ${b.pass.height.toFixed(0)}`);
  ok(b.btn.y >= b.name.y - 2 && b.btn.y + b.btn.height <= b.name.y + b.name.height + 2, "the 'Add owner' button sits level with the boxes (inside their top and bottom edges)", `button ${b.btn.y.toFixed(0)}–${(b.btn.y + b.btn.height).toFixed(0)}, boxes ${b.name.y.toFixed(0)}–${(b.name.y + b.name.height).toFixed(0)}`);
  ok(b.name.x + b.name.width <= b.email.x + 1 && b.email.x + b.email.width <= b.pass.x + 1 && b.pass.x + b.pass.width <= b.btn.x + 1, "they are side by side in order, none over another");
  ok(b.name.width >= 160 && b.email.width >= 160 && b.pass.width >= 160, "each box has real width", `${b.name.width.toFixed(0)} px`);
  ok((await form.innerText()).includes("for a new login"), "the Password hint is still there");

  say("2. Narrow window: stacked, nothing sticks out");
  await page.setViewportSize({ width: 520, height: 1000 });
  await page.waitForTimeout(300);
  b = await boxes();
  const noOverlap = (p, q) => p.y + p.height <= q.y + 1 || q.y + q.height <= p.y + 1 || p.x + p.width <= q.x + 1 || q.x + q.width <= p.x + 1;
  ok(noOverlap(b.name, b.email) && noOverlap(b.email, b.pass) && noOverlap(b.pass, b.btn) && noOverlap(b.name, b.pass), "no two fields overlap");
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "the page does not scroll sideways");
  ok(b.name.x >= 0 && b.name.x + b.name.width <= 520 && b.btn.x + b.btn.width <= 520, "every field is inside the window");
  await page.setViewportSize({ width: 1360, height: 1000 });
  await page.waitForTimeout(700); // the console re-lays itself out (sidebar, columns) after a resize

  say("3. An owner's row");
  const row = page.getByTestId("owner-row").first();
  await row.waitFor();
  const rb = await row.boundingBox();
  const acts = [row.getByRole("button", { name: "Reset password" }), row.getByRole("button", { name: /Deactivate|Activate/ }), row.getByRole("button", { name: "Remove" })];
  const ab = [];
  for (const a of acts) ab.push(await a.boundingBox());
  ok(ab.every((x) => x && x.x >= rb.x && x.x + x.width <= rb.x + rb.width + 1), "Reset password, Deactivate and Remove are inside the owner's row", `${ab.length} buttons`);
  ok(ab.every((x) => Math.abs(x.y - ab[0].y) < 2) && ab[0].x > rb.x + rb.width / 2, "…on one line, on the right", `y ${ab.map((x) => x.y.toFixed(0)).join("/")}, first button at x ${ab[0].x.toFixed(0)}, row ${rb.x.toFixed(0)}–${(rb.x + rb.width).toFixed(0)}`);
  await acts[0].click();
  await row.getByPlaceholder(/New password/).waitFor();
  ok((await row.getByRole("button", { name: "Set" }).isDisabled()) && (await row.getByRole("button", { name: "Cancel" }).isVisible()), "'Reset password' opens a password box with Set (waiting for 8+ characters) and Cancel");
  await row.getByRole("button", { name: "Cancel" }).click();
  ok(await row.getByRole("button", { name: "Reset password" }).isVisible(), "Cancel closes it again");
  await page.screenshot({ path: "store-owners.png" });
  ok(problems.length === 0, "no errors in the browser", problems.slice(0, 2).join(" | "));
} finally {
  await browser.close();
}
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
