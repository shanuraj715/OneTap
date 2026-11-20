// The STORE's name (not an outlet's): in the store dashboard (Settings → Business identity) it is shown but can never be edited by the
// store — a note says to contact the TablePe admin — and only the platform admin can rename it, in the console (Stores → the store).
// Also: renaming an OUTLET (Settings → Outlets) changes the outlet's name everywhere, including the display name Settings used to edit.
import { chromium } from "playwright";
const AD = "http://localhost:3171";
const SF = "http://localhost:3170";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];

const login = async (email, password) => (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const ownerCookie = await login("o@acme.test", "Owner123!");
const superCookie = await login("super@sandbox.test", "Super123!");
const call = async (cookie, method, path, body, outletId) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie, ...(outletId ? { "x-onetap-outlet": outletId } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let json = {}; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
const outletsNow = async () => (await call(ownerCookie, "GET", "/api/outlets")).json.outlets;
const before = await outletsNow();
const main = before.find((o) => o.slug === "main");
const second = before.find((o) => o.slug === "second");
const brandId = main.brandId;
const STORE = main.brandName;
const secondName = second.name, secondDisplay = second.config.identity.name;
const storeNameNow = async () => (await outletsNow()).find((o) => o.slug === "main").brandName;

const browser = await chromium.launch();
const newPage = async (viewport = { width: 1360, height: 900 }) => {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  return { ctx, page };
};
const signIn = async (page, email, pw, waitFor) => {
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', email); await page.fill('input[type="password"]', pw);
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector(waitFor, { timeout: 20000 });
};

const NEW_NAME = "Acme Momos Renamed";
try {
  /* ------------------------------------------------------------ 1. the owner's Settings */
  console.log("== the store owner's Settings → Business identity");
  ok(typeof STORE === "string" && STORE.length > 0, "the dashboard gets the store's name with the outlets", STORE);
  {
    const { ctx, page } = await newPage();
    await signIn(page, "o@acme.test", "Owner123!", "text=Orders");
    await page.goto(AD + "/settings", { waitUntil: "load" });
    await page.waitForSelector("text=Business identity");
    const box = page.getByTestId("store-name");
    await box.waitFor();
    ok((await box.inputValue()) === STORE, "the first box is the STORE name, showing the store's name", await box.inputValue());
    ok((await page.getByText("Store name", { exact: true }).count()) >= 1 && (await page.getByText("Restaurant name").count()) === 0, "it is called 'Store name' — there is no 'Restaurant name' box any more");
    ok(await box.isDisabled(), "the box is disabled (greyed out)");
    ok((await box.getAttribute("readonly")) !== null, "…and read-only");
    ok(/Contact the TablePe admin to update the store name\./.test(await page.locator("body").innerText()), "a note under it says to contact the admin to update the store name");
    // a browser can't edit a disabled box (Playwright refuses too) — and what is typed on the page body must not reach it either
    const refused = await box.fill("Hacked name", { timeout: 1500 }).then(() => false, () => true);
    ok(refused && (await box.inputValue()) === STORE, "typing in it is refused and the name is unchanged", await box.inputValue());
    // saving the page with another change leaves the store's name alone
    const tagline = page.locator("label", { has: page.locator("span", { hasText: /^Tagline/ }) }).locator("input");
    const taglineBefore = await tagline.inputValue();
    await tagline.fill(taglineBefore + " ");
    await tagline.fill(taglineBefore);
    await page.getByRole("button", { name: /Save changes/ }).first().click().catch(() => {});
    await page.waitForTimeout(600);
    ok((await storeNameNow()) === STORE, "saving Settings does not change the store's name");
    ok((await page.getByText("Business identity").count()) === 1 && (await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1, "the card still lays out cleanly");
    await page.screenshot({ path: "store-name-owner.png" });
    await ctx.close();
  }
  // no route lets the store rename itself
  const ownerTry = await call(ownerCookie, "PATCH", `/api/platform/stores/${brandId}`, { name: "Owner Renamed" });
  ok(ownerTry.status === 403 || ownerTry.status === 401, "the platform rename route refuses a store owner", `HTTP ${ownerTry.status}`);
  await call(ownerCookie, "PATCH", `/api/outlets/${main._id}/config`, { brandName: "Sneaky", name: "Sneaky" }, main._id);
  ok((await storeNameNow()) === STORE, "an owner can't slip the store name into a settings save either");

  /* ------------------------------------------------------------ 2. the platform admin renames it */
  console.log("== the platform admin renames the store in the console");
  {
    const { ctx, page } = await newPage();
    await signIn(page, "super@sandbox.test", "Super123!", "text=Stores");
    await page.goto(`${AD}/platform/stores/${brandId}`, { waitUntil: "load" });
    const input = page.getByTestId("console-store-name");
    await input.waitFor();
    const save = page.getByTestId("console-store-name-save");
    ok((await input.inputValue()) === STORE, "the console store page has a 'Store name' box with the current name", await input.inputValue());
    ok(await save.isDisabled(), "Rename store is off until the name is changed");
    await input.fill("   ");
    ok(await save.isDisabled(), "…and stays off for a blank name");
    ok((await input.getAttribute("maxlength")) === "80", "the name is limited to 80 characters");
    await input.fill(`  ${NEW_NAME}  `);
    ok(await save.isEnabled(), "changing it turns Rename store on");
    await save.click();
    await page.getByText("Store name changed.").waitFor({ timeout: 8000 });
    ok(true, "pressing it shows 'Store name changed.'");
    ok((await storeNameNow()) === NEW_NAME, "the store has the new name, with the spaces trimmed", await storeNameNow());
    ok((await page.locator("h1").first().innerText()).includes(NEW_NAME), "the page heading shows the new name");
    const empty = await call(superCookie, "PATCH", `/api/platform/stores/${brandId}`, { name: "" });
    const long = await call(superCookie, "PATCH", `/api/platform/stores/${brandId}`, { name: "x".repeat(81) });
    ok(empty.status === 400 && long.status === 400, "the server refuses an empty name and one over 80 characters", `${empty.status} / ${long.status}`);
    ok((await storeNameNow()) === NEW_NAME, "…and the name is unchanged by those");
    await ctx.close();
  }
  // everywhere it shows
  {
    const { ctx, page } = await newPage();
    await page.goto(SF + "/main", { waitUntil: "networkidle" });
    ok((await page.locator("h1").first().innerText()).includes(NEW_NAME), "the storefront heading shows the new store name straight away");
    ok((await page.locator("header").first().innerText()).includes(NEW_NAME), "…and so does the header");
    await ctx.close();
  }
  {
    const { ctx, page } = await newPage();
    await signIn(page, "o@acme.test", "Owner123!", "text=Orders");
    await page.goto(AD + "/settings", { waitUntil: "load" });
    const box = page.getByTestId("store-name");
    await box.waitFor();
    ok((await box.inputValue()) === NEW_NAME && (await box.isDisabled()), "the owner's Settings shows the new name, still disabled", await box.inputValue());
    await ctx.close();
  }
  // the platform admin looking at the store's dashboard gets a pointer to the console
  {
    const { ctx, page } = await newPage();
    await signIn(page, "super@sandbox.test", "Super123!", "text=Stores");
    await page.goto(`${AD}/platform/stores/${brandId}`, { waitUntil: "load" });
    await page.getByRole("button", { name: /Open store dashboard/ }).click();
    await page.waitForTimeout(1200);
    await page.goto(AD + "/settings", { waitUntil: "load" });
    await page.waitForSelector("text=Business identity");
    ok(/Change it in the platform console/.test(await page.locator("body").innerText()), "the admin viewing the store's Settings is told where to rename it (the console)");
    await ctx.close();
  }

  /* ------------------------------------------------------------ 3. an outlet's own name */
  console.log("== renaming an outlet (Settings → Outlets)");
  {
    const { ctx, page } = await newPage();
    await signIn(page, "o@acme.test", "Owner123!", "text=Orders");
    await page.goto(AD + "/outlets", { waitUntil: "load" });
    await page.waitForSelector(`text=${secondName}`);
    await page.getByRole("button", { name: `Edit ${secondName}`, exact: true }).click();
    const nameBox = page.getByRole("dialog").getByRole("textbox").first();
    await nameBox.fill("T50 Renamed Outlet");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForTimeout(900);
    const after = (await outletsNow()).find((o) => o.slug === "second");
    ok(after.name === "T50 Renamed Outlet", "the outlet has its new name", after.name);
    ok(after.config.identity.name === "T50 Renamed Outlet", "its display name (what customers, receipts and messages show) follows", after.config.identity.name);
    ok((await storeNameNow()) === NEW_NAME, "the STORE's name is not touched by renaming an outlet");
    const sf = await newPage();
    await sf.page.goto(SF + "/second", { waitUntil: "networkidle" });
    ok((await sf.page.locator(".ot-ob-pill").first().innerText()).includes("T50 Renamed Outlet"), "the storefront's outlet picker shows the new outlet name");
    await sf.ctx.close();
    await ctx.close();
  }
} finally {
  await call(superCookie, "PATCH", `/api/platform/stores/${brandId}`, { name: STORE });
  await call(ownerCookie, "PATCH", `/api/outlets/${second._id}`, { name: secondName }, second._id);
  await call(ownerCookie, "PATCH", `/api/outlets/${second._id}/config`, { identity: { name: secondDisplay } }, second._id);
  ok((await storeNameNow()) === STORE && (await outletsNow()).find((o) => o.slug === "second").name === secondName, "the store and outlet names are put back");
  await browser.close();
}
console.log("console problems:", problems.length ? problems : "none");
ok(problems.length === 0, "the browser logged no errors or warnings");
console.log(`SUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
