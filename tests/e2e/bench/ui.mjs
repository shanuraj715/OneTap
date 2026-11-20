// UI LAYER — everything a person does in the platform console, the store dashboard and the storefront, done by
// clicking and typing in Chrome (through the red-cursor helpers in watch.mjs). No API calls.
import { BENCH, sleep } from "./watch.mjs";

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** the input / select / textarea inside the <label> whose caption is `label` (exact first, then "starts with") */
export function field(d, label, scope) {
  const root = scope ?? d.page;
  const spans = (rx) => root.locator("label").filter({ has: d.page.locator("span").filter({ hasText: rx }) }).locator("input, select, textarea");
  const exact = spans(new RegExp(`^\\s*${esc(label)}\\s*$`));
  return { first: () => exact.first(), loc: exact, starts: spans(new RegExp(`^\\s*${esc(label)}`)) };
}
/** resolve a field locator: exact caption match if there is one, else "starts with" */
export async function F(d, label, scope) {
  const f = field(d, label, scope);
  if (await f.loc.count()) return f.loc.first();
  return f.starts.first();
}

/** type into a labelled field */
export async function fill(d, label, value, scope) {
  const el = await F(d, label, scope);
  await el.waitFor({ state: "visible", timeout: 15000 });
  if ((await el.getAttribute("type")) === "time") { await d.click(el, { after: 100 }); await el.fill(String(value)); await d.pause(120); return; }
  // click, select everything, type over it — a plain "clear" can leave a controlled number box on its minimum
  await d.click(el, { after: 100 });
  await d.page.keyboard.press("ControlOrMeta+a");
  if (process.env.HEADLESS === "1") await d.page.keyboard.insertText(String(value)); // nobody is watching: no need to type slowly
  else await d.page.keyboard.type(String(value), { delay: 25 });
  await d.pause(120);
}
/** set a labelled select by its visible option text (or a prefix of it) */
export async function pick(d, label, optionText, scope) {
  const el = await F(d, label, scope);
  await el.waitFor({ state: "visible", timeout: 15000 });
  const opts = await el.locator("option").allInnerTexts();
  const want = opts.find((o) => o.trim() === optionText) ?? opts.find((o) => o.trim().startsWith(optionText));
  if (!want) throw new Error(`"${label}" has no option "${optionText}" (has: ${opts.join(" | ")})`);
  await d.choose(el, { label: want });
}
/** make a checkbox (found by its caption) checked / unchecked */
export async function tick(d, caption, on = true, scope) {
  const root = scope ?? d.page;
  const box = root.getByRole("checkbox", { name: new RegExp(`^\\s*${esc(caption)}`) }).first();
  await box.waitFor({ state: "visible", timeout: 15000 });
  if ((await box.isChecked()) !== on) await d.click(box.locator("xpath=ancestor::label[1]").first(), { after: 250 });
}
/** a number box found by its caption */
export const num = (d, label, v, scope) => fill(d, label, v, scope);

export const text = async (d) => (await d.page.locator("body").innerText()).replace(/\s+/g, " ");
export const until = async (fn, ms = 16000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* retry */ } await sleep(600); } return false; };

/* ------------------------------------------------------------- signing in and out */
/** sign in to the dashboard as `who` (a BENCH.logins key or [email, password]); signs out whoever is signed in first */
export async function signIn(d, who) {
  const [email, pw] = Array.isArray(who) ? who : BENCH.logins[who];
  await d.goto(BENCH.admin + "/", 400);
  const out = d.page.getByRole("button", { name: "Sign out" }).first();
  if (await out.isVisible().catch(() => false)) {
    await d.click(out, { after: 700 });
    await d.page.locator('input[type="email"]').waitFor({ timeout: 15000 });
  }
  await d.type('input[type="email"]', email, { after: 100, delay: 20 });
  await d.type('input[type="password"]', pw, { after: 100, delay: 20 });
  await d.click(d.page.getByRole("button", { name: /sign in|log in/i }), { after: 400 });
  await d.page.waitForSelector("text=/^(Orders|Stores|Dashboard)$/", { timeout: 30000 }).catch(() => {});
  await sleep(600);
}
/** try to sign in and report whether the sign-in screen stayed (= it was refused) */
export async function signInFails(d, email, pw) {
  await d.goto(BENCH.admin + "/", 300);
  const out = d.page.getByRole("button", { name: "Sign out" }).first();
  if (await out.isVisible().catch(() => false)) { await d.click(out, { after: 700 }); await d.page.locator('input[type="email"]').waitFor(); }
  await d.type('input[type="email"]', email, { after: 100, delay: 20 });
  await d.type('input[type="password"]', pw, { after: 100, delay: 20 });
  await d.click(d.page.getByRole("button", { name: /sign in|log in/i }), { after: 1500 });
  return d.page.locator('input[type="password"]').isVisible().catch(() => false);
}

/** the toast / message that appeared (best effort): any role=alert or status text */
export async function notice(d) {
  const t = await d.page.locator('[role="alert"], [role="status"]').allInnerTexts().catch(() => []);
  return t.join(" | ").replace(/\s+/g, " ");
}

/* --------------------------------------------------------------------- platform console */
export async function openPlatform(d, path = "") {
  await d.goto(`${BENCH.admin}/platform${path}`, 500);
}

/**
 * Plans → New plan → fill the form → Save plan.
 *   features: caption list to tick (exact captions from the plan form), or "all"
 */
export async function createPlan(d, { name, description = "", custom = false, people, multiOutlet = false, outlets, features = [], monthly, yearly }) {
  await openPlatform(d, "/plans");
  await d.click(d.page.getByRole("button", { name: "New plan" }));
  const form = d.page.locator("form, [role=dialog]").filter({ has: d.page.getByRole("button", { name: "Save plan" }) }).last();
  await fill(d, "Name", name, form);
  if (description) await fill(d, "Description", description, form);
  if (custom) { await tick(d, "Custom plan", true, form); }
  else {
    if (people) { await tick(d, "Unlimited", false, form).catch(() => {}); await fill(d, "People (owners included)", people, form); }
    await tick(d, "Multi-outlet", multiOutlet, form);
    if (multiOutlet && outlets) await fill(d, "Outlets", outlets, form);
    // the form starts with every feature ticked: set EACH box to exactly what this plan should have
    const every = ["Takeaway ordering", "Dine-in QR ordering", "Delivery", "Online payments", "Coupons", "Coin wallet", "Printing", "WhatsApp & SMS alerts", "WhatsApp chat", "Marketing", "Analytics & reports", "Own favicon", "Own domain name"];
    const wanted = features === "all" ? every : features;
    for (const f of every) await tick(d, f, wanted.includes(f), form);
  }
  if (monthly) {
    // what the website shows for the plan — and what the onboarding price estimate starts from
    await tick(d, "Show this plan on the website's Pricing", true, form);
    await fill(d, "Monthly price (₹)", monthly, form);
    if (yearly) await fill(d, "Yearly discount (%)", yearly, form);
  }
  await d.click(d.page.getByRole("button", { name: "Save plan" }), { after: 900 });
}

/** the Stores list → open one store by name */
export async function openStore(d, name, tab) {
  await openPlatform(d, "/stores");
  await d.click(d.page.getByRole("link", { name: new RegExp(`^${esc(name)}\\b`) }));
  await d.page.getByRole("tab", { name: "Plan & limits" }).waitFor({ timeout: 15000 });
  if (tab) await d.click(d.page.getByRole("tab", { name: tab }), { after: 500 });
}

/** Stores → Create store → fill the form → Create store */
export async function createStore(d, { name, slug, plan, outletName = "Central", outletSlug = "central", address, ownDomain = "", ownerName = "Owner", ownerEmail, ownerPassword }) {
  await openPlatform(d, "/stores");
  await d.click(d.page.getByRole("button", { name: "Create store" }).first());
  const form = d.page.locator("form, [role=dialog], section, div").filter({ has: d.page.getByRole("button", { name: "Create store" }) }).filter({ has: d.page.getByText("Owner email") }).last();
  await fill(d, "Store name", name, form);
  await fill(d, "Store slug", slug, form);
  if (plan) await pick(d, "Plan", plan, form);
  await fill(d, "First outlet's name", outletName, form);
  await fill(d, "Outlet URL slug", outletSlug, form);
  // the form suggests a TablePe address from the store name: leave it (address undefined), replace it, or empty it ("")
  if (address === "") { const el = await F(d, "TablePe address", form); await d.click(el, { after: 100 }); await d.page.keyboard.press("ControlOrMeta+a"); await d.page.keyboard.press("Backspace"); }
  else if (address) await fill(d, "TablePe address", address, form);
  if (ownDomain) await fill(d, "Own domain", ownDomain, form);
  await fill(d, "Owner name", ownerName, form);
  await fill(d, "Owner email", ownerEmail, form);
  await fill(d, "Owner password", ownerPassword, form);
  await d.click(form.getByRole("button", { name: "Create store" }).last(), { after: 1200 });
}

/* --------------------------------------------------------------------- the store dashboard */
/** choose the outlet being worked on, from the outlet button at the top of the sidebar */
export async function switchOutlet(d, outletName) {
  const chip = d.page.locator("aside button").filter({ has: d.page.locator(".lucide-chevrons-up-down") }).first();
  await chip.waitFor({ state: "visible", timeout: 15000 });
  if (((await chip.innerText()).trim()) === outletName) return;
  await d.click(chip, { after: 400 });
  await d.click(d.page.getByText(outletName, { exact: true }).last(), { after: 900 });
}

/** Menu → type a category name and press Enter */
export async function addCategory(d, name) {
  await d.goto(BENCH.admin + "/menu", 400);
  await d.type(d.page.getByPlaceholder("New category"), name, { after: 200, delay: 25 });
  await d.press("Enter", 700);
  await d.page.getByRole("button", { name: new RegExp(`^${esc(name)}\\b`) }).first().waitFor({ timeout: 10000 });
}

/** Menu → pick the category → Add item → Name, Food type, Price → Create item */
export async function addItem(d, category, { name, foodType = "veg", price }) {
  await d.goto(BENCH.admin + "/menu", 300);
  await d.click(d.page.getByRole("button", { name: new RegExp(`^${esc(category)}\\b`) }).first(), { after: 400 });
  await d.click(d.page.getByRole("button", { name: "Add item" }).first(), { after: 400 });
  await fill(d, "Name", name);
  await pick(d, "Food type", foodType === "veg" ? "Veg" : "Non");
  await fill(d, "Price", price);
  await d.click(d.page.getByRole("button", { name: "Create item" }), { after: 900 });
}

/**
 * Outlets → Add outlet → Name + URL slug → Create outlet.
 * Returns { refused: true, why } when the button is greyed out by the plan (its tooltip says why),
 * otherwise { refused: false, text } with whatever the page says afterwards.
 */
export async function addOutlet(d, name, slug) {
  await d.goto(BENCH.admin + "/outlets", 400);
  const add = d.page.getByRole("button", { name: "Add outlet" }).first();
  await add.waitFor({ state: "visible", timeout: 15000 });
  if (await add.isDisabled()) return { refused: true, why: (await add.getAttribute("title")) ?? "" };
  await d.click(add);
  const dlg = d.page.locator("form, [role=dialog], div").filter({ has: d.page.getByRole("button", { name: "Create outlet" }) }).last();
  await fill(d, "Name", name, dlg);
  await fill(d, "URL slug", slug, dlg);
  await d.click(dlg.getByRole("button", { name: "Create outlet" }), { after: 1200 });
  return { refused: false, text: await text(d) };
}

/** Outlets → ✎ on the outlet called `current` → type `next` as its Name → Save changes (this is also the name customers see). */
export async function renameOutlet(d, current, next) {
  await d.goto(BENCH.admin + "/outlets", 400);
  // each outlet's pencil is labelled "Edit <its name>" (the name alone also matches the sidebar's outlet switcher)
  await d.click(d.page.getByRole("button", { name: `Edit ${current}`, exact: true }), { after: 400 });
  const dlg = d.page.locator("form, [role=dialog], div").filter({ has: d.page.getByRole("button", { name: "Save changes" }) }).last();
  await fill(d, "Name", next, dlg);
  await d.click(dlg.getByRole("button", { name: "Save changes" }), { after: 1000 });
}

/** Platform → store → Plan & limits → choose a plan → save. */
export async function setStorePlan(d, storeName, planName) {
  await openStore(d, storeName, "Plan & limits");
  await pick(d, "Plan", planName);
  const save = d.page.getByRole("button", { name: /^Save/ }).first();
  await save.waitFor({ state: "visible", timeout: 10000 });
  await d.click(save, { after: 1000 });
}

/* ------------------------------------------------------------------ Settings (per outlet) */
/**
 * spec: [{ tab, text: {caption: value}, ticks: {caption: bool}, picks: {caption: optionText} }, …]
 * Opens Settings, goes through every tab filling the boxes, and presses "Save changes" on each.
 */
export async function applySettings(d, spec) {
  await d.goto(BENCH.admin + "/settings", 400);
  for (const t of spec) {
    await d.click(d.page.getByRole("tab", { name: t.tab }), { after: 400 });
    for (const [cap, val] of Object.entries(t.ticks ?? {})) await tick(d, cap, val);
    for (const [cap, val] of Object.entries(t.text ?? {})) await fill(d, cap, val);
    for (const [cap, val] of Object.entries(t.picks ?? {})) await pick(d, cap, val);
    const save = d.page.getByRole("button", { name: /^Save/ }).first();
    if (await save.isEnabled().catch(() => false)) { await d.click(save, { after: 800 }); await d.page.getByText("Settings saved.").first().waitFor({ timeout: 8000 }).catch(() => {}); }
  }
}

/** reload Settings and read every field of the spec back; returns the list of differences ([] = all as saved) */
export async function readBackSettings(d, spec) {
  await d.goto(BENCH.admin + "/settings", 600);
  await d.page.reload({ waitUntil: "load" });
  await sleep(700);
  const bad = [];
  for (const t of spec) {
    await d.click(d.page.getByRole("tab", { name: t.tab }), { after: 250 });
    for (const [cap, val] of Object.entries(t.text ?? {})) { const got = await (await F(d, cap)).inputValue(); if (String(got) !== String(val)) bad.push(`${t.tab} › ${cap}: saved ${val}, shows ${got}`); }
    for (const [cap, val] of Object.entries(t.ticks ?? {})) { const got = await d.page.getByRole("checkbox", { name: new RegExp(`^\\s*${esc(cap)}`) }).first().isChecked(); if (got !== val) bad.push(`${t.tab} › ${cap}: saved ${val}, shows ${got}`); }
    for (const [cap, val] of Object.entries(t.picks ?? {})) { const el = await F(d, cap); const shown = (await el.evaluate((e) => e.options[e.selectedIndex].text)).trim(); if (!shown.startsWith(val)) bad.push(`${t.tab} › ${cap}: saved ${val}, shows ${shown}`); }
  }
  return bad;
}

/* --------------------------------------------------- platform: addresses, outlets, deleting, grace */
/** Domains tab: type an address name and report what the form says about it (free / reserved / taken …) */
const addressBox = async (d) => ((await field(d, "Name").loc.count()) ? "Name" : "Change the name");
export async function tryAddressName(d, storeName, label) {
  await openStore(d, storeName, "Domains");
  await fill(d, await addressBox(d), label);
  await sleep(1100);
  return text(d);
}
/** Domains tab: create (or change) the store's TablePe address. */
export async function setAddress(d, storeName, label) {
  await openStore(d, storeName, "Domains");
  await fill(d, await addressBox(d), label);
  await sleep(900);
  const go = d.page.getByRole("button", { name: /^(Create address|Change address)$/ }).first();
  await go.waitFor({ state: "visible", timeout: 10000 });
  const disabled = await go.isDisabled();
  if (!disabled) await d.click(go, { after: 1200 });
  return { disabled, text: await text(d) };
}

/** the row of an outlet in a store's Outlets tab */
const outletRow = (d, outletName) => d.page.getByText(outletName).first().locator("xpath=ancestor::*[.//button[normalize-space()='Block' or normalize-space()='Unblock']][1]");
/** Outlets tab: Block / Unblock one outlet ("disable it by hand") */
export async function setOutletBlocked(d, storeName, outletName, blocked) {
  await openStore(d, storeName, "Outlets");
  const row = outletRow(d, outletName);
  await d.click(row.getByRole("button", { name: blocked ? "Block" : "Unblock", exact: true }), { after: 1000 });
}

/** Actions menu → Delete store → type the name → confirm. Returns the page text afterwards. */
export async function deleteStore(d, storeName, typed = storeName) {
  await openStore(d, storeName);
  await d.click(d.page.getByRole("button", { name: `Actions for ${storeName}` }), { after: 400 });
  await d.click(d.page.getByText("Delete store", { exact: false }).first(), { after: 700 });
  const dlg = d.page.getByRole("dialog", { name: `Delete ${storeName}` });
  await dlg.waitFor({ timeout: 10000 });
  await d.type(dlg.getByLabel("Type the store's name to confirm"), typed, { after: 400, delay: 20 });
  const confirm = dlg.getByRole("button", { name: /delete/i }).last();
  const enabled = await confirm.isEnabled();
  if (enabled) await d.click(confirm, { after: 1500 });
  return { enabled, text: await text(d) };
}

/** Platform settings → Grace period → Days → Save */
export async function setGraceDays(d, days) {
  await openPlatform(d, "/settings");
  await fill(d, "Days", days);
  await d.click(d.page.getByRole("button", { name: "Save" }).first(), { after: 900 });
}

/** the plan limits line of a store page ("People 1 / 10  Outlets 1 / 3 …") */
export const storeUsageText = async (d, storeName) => { await openStore(d, storeName); return text(d); };

/* ------------------------------------------------------------------------- the storefront */
/** open a storefront address in the customer's tab and give the page time to render */
export async function visit(d, url) {
  const res = await d.page.goto(url, { waitUntil: "load", timeout: 60000 });
  return { status: res?.status() ?? 0, text: await text(d) };
}

/** add one item to the cart from the menu page (opens its sheet, optional size, quantity, Add) */
export async function addToCart(d, name, { size, qty = 1 } = {}) {
  await d.click(d.page.getByRole("button", { name: new RegExp(`^add ${esc(name)}$`, "i") }));
  const dlg = d.page.getByRole("dialog", { name });
  await dlg.waitFor();
  if (size) await d.click(dlg.locator("label", { hasText: size }), { after: 250 });
  for (let i = 1; i < qty; i++) await d.click(dlg.getByRole("button", { name: "One more" }), { after: 200 });
  await d.click(dlg.getByRole("button", { name: /^Add ·/ }), { after: 900 });
}

/** the customer's own sign-in on the order page (new or returning: pass `extra` for the one-time details) */
export async function customerSignIn(d, { name, phone, extra = { gender: "Male", age: "30" } }) {
  await d.page.getByText("Sign in to order").first().waitFor({ timeout: 15000 });
  await d.type(d.page.getByRole("textbox", { name: "Your name" }), name, { after: 150, delay: 20 });
  await d.type(d.page.getByRole("textbox", { name: "Mobile number" }), phone, { after: 150, delay: 20 });
  await d.click(d.page.getByRole("button", { name: "Send code" }), { after: 700 });
  await d.page.getByText("Enter the code").first().waitFor({ timeout: 15000 });
  await d.click(d.page.getByLabel("Digit 1 of 6"), { after: 150 });
  await d.page.keyboard.type("123456", { delay: 120 });
  await d.click(d.page.getByRole("button", { name: "Verify code" }), { after: 900 });
  if (await d.page.getByText("Just a couple more details").first().waitFor({ timeout: 4000 }).then(() => true).catch(() => false)) {
    await d.click(d.page.getByRole("group", { name: "Gender" }).getByRole("button", { name: extra.gender, exact: true }));
    await d.type(d.page.getByRole("spinbutton", { name: "Age" }), extra.age, { after: 150, delay: 20 });
    await d.click(d.page.getByRole("button", { name: "Save and continue" }), { after: 1000 });
  }
  await d.page.getByRole("button", { name: /place order|add delivery address|send to kitchen/i }).first().waitFor({ timeout: 20000 }); // a table order says "Send to kitchen"
}

/** Coupons → New coupon → Code + Description + Percent off → Create coupon. Returns the page text afterwards. */
export async function createCoupon(d, code, description = "10% off", percent = 10) {
  await d.goto(BENCH.admin + "/coupons", 400);
  await d.click(d.page.getByRole("button", { name: "New coupon" }).first(), { after: 400 });
  await fill(d, "Code", code);
  await fill(d, "Description", description);
  await fill(d, "Percent off", percent);
  await d.click(d.page.getByRole("button", { name: "Create coupon" }), { after: 1100 });
  return text(d);
}

/**
 * The customer's takeaway order, from the storefront menu to "Order #… placed" — cash at the counter.
 * `signIn` is used only if the order page asks the customer to sign in.
 */
export async function placeTakeaway(d, url, items, signIn) {
  await d.goto(url, 300);
  const group = d.page.getByRole("group", { name: "Order type" });
  if (await group.isVisible().catch(() => false)) await d.click(group.getByRole("button", { name: "Takeaway" }), { after: 300 });
  for (const it of items) await addToCart(d, it.name, it);
  await d.click(d.page.getByRole("link", { name: /View cart/ }), { after: 600 });
  await d.page.waitForURL(/\/order/);
  if (await d.page.getByText("Sign in to order").first().isVisible({ timeout: 3000 }).catch(() => false)) await customerSignIn(d, signIn);
  await d.page.getByRole("button", { name: /place order/i }).first().waitFor({ timeout: 20000 });
  const how = d.page.getByRole("button", { name: /Takeaway/ });
  if (await how.first().isVisible().catch(() => false)) await d.click(how.first(), { after: 250 });
  const cash = d.page.locator("label", { hasText: "Cash / pay at counter" });
  if (await cash.first().isVisible().catch(() => false)) await d.click(cash.first(), { after: 250 });
  await d.click(d.page.getByRole("button", { name: /place order/i }), { after: 600 });
  await d.page.waitForSelector("text=/Order #\\d+ placed/", { timeout: 25000 });
  return (await d.page.locator("h2", { hasText: /placed/ }).innerText()).match(/#(\d+)/)[1];
}

/** Orders (store dashboard): cancel one order by its number — "More actions" → "Cancel order" → confirm with Enter */
export async function cancelOrder(d, orderNo) {
  const row = d.page.locator("tr", { hasText: `#${orderNo}` }).first();
  await row.waitFor({ timeout: 15000 });
  await d.click(row.getByRole("button", { name: "More actions" }), { after: 400 });
  await d.click(d.page.getByText("Cancel order", { exact: true }).first(), { after: 500 });
  const dlg = d.page.getByRole("dialog", { name: "Confirm status change" });
  await dlg.waitFor({ timeout: 8000 });
  await d.press("Enter", 900);
  await dlg.waitFor({ state: "hidden", timeout: 8000 });
}

/** reload the current page until `fn` is true (for things the server refreshes every few seconds) */
export async function reloadUntil(d, fn, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn().catch(() => false)) return true;
    await sleep(2500);
    await d.page.reload({ waitUntil: "load" });
    await sleep(600);
  }
  return false;
}

/** Payments → switch on the test gateway (the online payment delivery needs) → Save */
export async function enableTestGateway(d) {
  await d.goto(BENCH.admin + "/payments", 400);
  await tick(d, "Test gateway", true);
  const save = d.page.getByRole("button", { name: /^Save$/ }).first();
  if (await save.isEnabled().catch(() => false)) await d.click(save, { after: 900 });
}

/** Domains tab → Remove address (the store's TablePe address) */
export async function removeAddress(d, storeName) {
  await openStore(d, storeName, "Domains");
  await d.click(d.page.getByRole("button", { name: "Remove address" }), { after: 400 });
  await d.click(d.page.getByRole("button", { name: "Yes, remove it" }), { after: 1000 });
  await sleep(600);
  return text(d);
}

/** Outlets (store dashboard): the bin icon on an outlet's row; the browser's own "Delete …?" box is accepted. Returns the page text. */
export async function deleteOutletRow(d, outletName) {
  await d.goto(BENCH.admin + "/outlets", 500);
  // each outlet's × is labelled "Delete <its name>" (the name alone also matches the sidebar's outlet switcher)
  const del = d.page.getByRole("button", { name: `Delete ${outletName}`, exact: true });
  await del.waitFor({ timeout: 10000 });
  await d.click(del, { after: 1200 });
  return text(d);
}

/** Plans → Edit one plan → tick / untick a feature → Save plan. */
export async function setPlanFeature(d, planName, featureCaption, on) {
  await openPlatform(d, "/plans");
  const card = d.page.locator("section").filter({ has: d.page.getByText(planName, { exact: true }) });
  await d.click(card.getByRole("button", { name: "Edit" }).first(), { after: 700 });
  const form = d.page.locator("form, [role=dialog]").filter({ has: d.page.getByRole("button", { name: "Save plan" }) }).last();
  await tick(d, featureCaption, on, form);
  await d.click(d.page.getByRole("button", { name: "Save plan" }), { after: 1000 });
}
/* ------------------------------------------------------------------------ marketing */
export const openMarketing = (d, tab = "new") => d.goto(`${BENCH.admin}/marketing/${tab}`, 500);

/** the "N people will get this" number, once the live count has stopped updating */
export async function audienceCount(d) {
  await sleep(850); // the count is asked for ~0.45 s after the last change
  let last = null;
  let stable = 0;
  for (let i = 0; i < 40; i++) {
    const t = await d.page.getByTestId("audience-count").innerText().catch(() => "");
    const busy = (await d.page.getByText("updating…").count()) > 0;
    if (!busy && t && t === last) { if (++stable >= 2) return Number(t.replace(/\D/g, "")); } else stable = 0;
    last = t;
    await sleep(350);
  }
  throw new Error("The audience count never settled");
}
/** the names in the preview table, sorted */
export async function audienceNames(d) {
  const cells = await d.page.locator("tbody tr td:first-child").allInnerTexts();
  return cells.map((c) => c.trim()).filter((c) => c && c !== "—").sort();
}

/** Notifications → SMS → fill the gateway → Save the connection */
export async function configureSms(d, { requestUrl, apiKey, method = "GET" }) {
  await d.goto(`${BENCH.admin}/notifications`, 500);
  await d.click(d.page.getByRole("tab", { name: "SMS" }), { after: 400 });
  await fill(d, "HTTP method", method);
  await fill(d, "Request URL", requestUrl);
  await fill(d, "API key / auth token", apiKey);
  await d.click(d.page.getByRole("button", { name: "Save", exact: true }).first(), { after: 1000 });
}

/** the sidebar as a person reads it: groups in order, whether a divider comes before each, and its items */
export async function sidebarGroups(d) {
  return d.page.locator("aside nav > div").evaluateAll((groups) =>
    groups.map((g) => ({
      group: g.querySelector("span")?.textContent?.trim() ?? "",
      divider: Boolean(g.querySelector("hr[role=separator]")),
      items: [...g.querySelectorAll("a")].map((a) => a.textContent.trim()),
    })),
  );
}

/** a box found by its aria-label (not a captioned field): click, select all, type over */
export async function fillBox(d, ariaLabel, value) {
  const el = d.page.getByLabel(ariaLabel).first();
  await el.waitFor({ state: "visible", timeout: 15000 });
  await d.click(el, { after: 100 });
  await d.page.keyboard.press("ControlOrMeta+a");
  if (process.env.HEADLESS === "1") await d.page.keyboard.insertText(String(value));
  else await d.page.keyboard.type(String(value), { delay: 15 });
  await d.pause(120);
}
/** who is in the audience once the live count has settled */
export async function whoGetsIt(d) { await audienceCount(d); return audienceNames(d); }

/**
 * Platform → store → Features tab → one feature's choice for THIS store ("From plan", "Unlocked for this store",
 * "Locked for this store") → Save.
 */
export async function setStoreFeature(d, storeName, featureLabel, choice) {
  await openStore(d, storeName, "Features");
  const row = d.page.getByText(featureLabel, { exact: true }).first().locator("xpath=ancestor::div[.//select][1]");
  await row.waitFor({ timeout: 10000 });
  const select = row.locator("select");
  const options = await select.locator("option").allInnerTexts();
  const want = options.find((o) => o.trim().startsWith(choice));
  if (!want) throw new Error(`"${featureLabel}" has no choice "${choice}" (has: ${options.join(" | ")})`);
  await d.choose(select, { label: want });
  const save = d.page.getByRole("button", { name: /^Save/ }).first();
  await save.waitFor({ state: "visible", timeout: 10000 });
  await d.click(save, { after: 1000 });
}

/* ----------------------------------------------------------------------------------- Tables & dine-in (store dashboard) */
/** Tables & QR page, ready (the "Add a table" form is there) */
export async function openTables(d) {
  await d.goto(BENCH.admin + "/tables", 500);
  await d.page.getByText("Add a table").first().waitFor({ timeout: 15000 });
}
/** every table tile as the screen shows it: [{ number, status, seats, text }] — the zone headings are not tiles */
export async function tableTiles(d) {
  const raw = await d.page.locator("button.ot-press").allInnerTexts();
  return raw.map((t) => {
    const [number, status, seats] = t.split("\n").map((x) => x.trim()).filter(Boolean);
    return { number, status, seats: Number((seats ?? "").match(/\d+/)?.[0]), text: t.replace(/\s+/g, " ").trim() };
  });
}
/** one tile's button (matched by its number, so T1 never finds T10) */
export const tableTile = (d, number) => d.page.locator("button.ot-press").filter({ hasText: new RegExp(`^${esc(number)}(Free|Seated|Needs cleaning|Bill requested|Reserved)`) }).first();
/** clear a text box with the keyboard (a plain "type nothing" leaves the old text selected) */
async function blank(d, label) {
  const el = await F(d, label);
  await d.click(el, { after: 80 });
  await d.page.keyboard.press("ControlOrMeta+a");
  await d.page.keyboard.press("Backspace");
}
/** "Add a table": Number, Zone (empty = none), Seats (undefined = leave the form's 4), then press Add table */
export async function addTable(d, { number, zone = "", seats }) {
  await (number === "" ? blank(d, "Number") : fill(d, "Number", number));
  await (zone === "" ? blank(d, "Zone") : fill(d, "Zone", zone));
  if (seats !== undefined) await (String(seats) === "" ? blank(d, "Seats") : fill(d, "Seats", seats));
  await d.click(d.page.getByRole("button", { name: "Add table" }), { after: 1200 });
}
/** open a table's QR panel (click its tile); returns the dialog and the address printed in it */
export async function openTableQr(d, number) {
  await d.click(tableTile(d, number), { after: 900 });
  const dlg = d.page.getByRole("dialog", { name: `Table ${number}` });
  await dlg.waitFor({ timeout: 10000 });
  await until(async () => /http\S+/.test(await dlg.innerText()), 8000);
  return { dlg, url: (await dlg.innerText()).match(/http\S+/)?.[0] };
}
/** the address printed in a table's QR panel, with the panel closed again */
export async function tableQrUrl(d, number) {
  const { dlg, url } = await openTableQr(d, number);
  await d.click(dlg.getByRole("button", { name: "Done" }), { after: 400 });
  return url;
}

