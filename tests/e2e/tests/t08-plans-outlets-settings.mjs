// T08 — three plans (Basic, Pro, Custom), a store that upgrades from Basic to Pro, three outlets with menus, every outlet
// setting, delivery distance and load management. Everything is done in Chrome: the platform console, the store
// owner's dashboard and the customer's storefront. No API calls.
import { BENCH } from "../bench/watch.mjs";
import * as ui from "../bench/ui.mjs";
import { MENUS, OUTLETS, OWNER, SUB_URL, W } from "./_world.mjs";

export const meta = {
  id: "t08-plans-outlets-settings",
  title: "Plans & outlets — Basic → Pro upgrade, outlets 1-3 with menus, all outlet settings, delivery distance, load management",
  area: "plans",
  fresh: true,
  summary: "In Chrome: the platform creates a Basic, a Pro and a Custom plan and a store on each. The Basic store's owner finds 'Add outlet' greyed out; after the platform upgrades the store to Pro the owner creates outlets 2 and 3 (a 4th is refused). Every outlet gets a menu and a full set of settings through the Settings screen (identity + location, opening hours, alerts, order handling, prep time, order limits, delivery, receipts, features, wallet, load management) which are read back after a reload and checked for isolation between outlets. Delivery distance is checked on the storefront with the browser's location (inside / outside each outlet's radius), and load management with real customer orders. Start of the t08–t12 chain: the later tests continue with this store.",
  expect: [
    "A Basic store's owner can't add a second outlet: the 'Add outlet' button is greyed out and says why.",
    "Coupons are refused on Basic with the plan message; after the upgrade to Pro they can be created.",
    "After the upgrade the owner creates outlets 2 and 3; the platform page shows 3 of 3 outlets; a 4th is refused ('Your plan allows 3 outlets.').",
    "Each outlet has its own menu on its own storefront page, and its own settings; saving one outlet changes nothing on the others.",
    "Every saved setting shows exactly the same after reloading Settings.",
    "Delivery: the storefront tells a customer inside the radius 'We deliver here' with that outlet's fee and distance, and one outside the radius that delivery isn't possible.",
    "Load management: at the busy threshold checkout shows the outlet's own 'busy' message; at the stop threshold the stop message appears and Delivery is still listed but greyed out, so it can no longer be chosen; after the orders are cancelled it returns to normal.",
    "A Pro store gets 3 outlets and every feature; a Custom store starts with nothing and gets exactly what the platform sets by hand.",
  ],
  expectNot: [
    "A Basic store must NOT get a 2nd outlet or coupons.",
    "A 4th outlet must NOT be created on a Pro plan limited to 3.",
    "One outlet's settings or menu must NOT leak into another outlet.",
    "A customer must NOT be offered delivery to an address outside the delivery radius.",
    "A customer must NOT be able to choose delivery while load management has it stopped.",
    "A Custom store must NOT get a 3rd outlet when limited to 2.",
  ],
};

const PLAN = { basic: "Lifecycle Basic", pro: "Lifecycle Pro", custom: "Lifecycle Custom" };

export async function run(d, h) {
  const who = { now: "" };
  // one dashboard tab for both the platform console and the owner's dashboard: signing in as someone else signs the previous person out
  const signed = async (key, creds, label) => { await d.tab("dashboard", label); if (who.now !== key) { await ui.signIn(d, creds); who.now = key; } };
  const asSuper = () => signed("super", "super", "Platform console · super admin");
  const Owner = () => signed("owner", OWNER, "Store dashboard · owner of Lifecycle Foods");

  /* ------------------------------------------------------------------ plans */
  await asSuper();
  await d.step("Platform console → Plans: create Basic, Pro and Custom");
  await ui.createPlan(d, { name: PLAN.basic, description: "One outlet — takeaway and dine-in QR", people: 3, multiOutlet: false, features: ["Takeaway ordering", "Dine-in QR ordering"] });
  await ui.createPlan(d, { name: PLAN.pro, description: "Up to 3 outlets, everything unlocked", people: 10, multiOutlet: true, outlets: 3, features: "all" });
  await ui.createPlan(d, { name: PLAN.custom, description: "Set by hand for each store", custom: true });
  await ui.openPlatform(d, "/plans");
  const plans = await ui.text(d);
  d.check("all three plans are listed", Object.values(PLAN).every((n) => plans.includes(n)));
  const card = (n) => plans.slice(plans.indexOf(n), plans.indexOf(n) + 260);
  d.check("Basic shows 3 people · 1 outlet", /3 people\s*·\s*1 outlet/.test(card(PLAN.basic)), card(PLAN.basic).slice(0, 140));
  d.check("Pro shows 10 people · 3 outlets", /10 people\s*·\s*3 outlets/.test(card(PLAN.pro)), card(PLAN.pro).slice(0, 140));
  d.check("Custom is marked as a custom plan", /custom/i.test(card(PLAN.custom)), card(PLAN.custom).slice(0, 140));
  await d.shot("plans");

  /* ----------------------------------------------------------------- stores */
  await d.step("Platform console → Stores: create a store on each plan");
  await ui.createStore(d, { name: W.store, slug: W.slug, plan: PLAN.basic, outletName: "Central", outletSlug: "central", address: W.label, ownerEmail: W.ownerEmail, ownerPassword: W.ownerPassword });
  await ui.createStore(d, { name: "Pro Direct Co", slug: "prodirect", plan: PLAN.pro, address: "prodirect", ownerEmail: "owner@prodirect.test", ownerPassword: W.ownerPassword });
  await ui.createStore(d, { name: "Custom Kitchen", slug: "customkitchen", plan: PLAN.custom, address: "customkitchen", ownerEmail: "owner@customkitchen.test", ownerPassword: W.ownerPassword });
  await ui.openPlatform(d, "/stores");
  const stores = await ui.text(d);
  d.check("all three stores are listed", [W.store, "Pro Direct Co", "Custom Kitchen"].every((n) => stores.includes(n)));
  d.check("each store shows its own plan", new RegExp(`${W.store}[^]*?Plan\\s*${PLAN.basic}`).test(stores) && new RegExp(`Pro Direct Co[^]*?Plan\\s*${PLAN.pro}`).test(stores) && new RegExp(`Custom Kitchen[^]*?Plan\\s*${PLAN.custom}`).test(stores));

  /* ------------------------------------------------ Basic: one outlet, locked features */
  await Owner();
  await d.step("As the Basic store's owner: try to add a second outlet, a coupon, and switch delivery on");
  const addBasic = await ui.addOutlet(d, "Second", "second");
  d.never("a Basic store's owner can add a second outlet", !addBasic.refused);
  d.check("the 'Add outlet' button is greyed out and says why", addBasic.refused && /Multiple outlets aren't included in your plan/.test(addBasic.why), addBasic.why);
  const basicCoupon = await ui.createCoupon(d, "HELLO10");
  d.never("a Basic store creates a coupon", /HELLO10\s*10% off|Delete HELLO10/.test(basicCoupon) && !/isn't included in your plan/i.test(basicCoupon));
  d.check("…and is told coupons aren't in the plan", /isn't included in your plan/i.test(basicCoupon), basicCoupon.match(/[^.]*isn't included[^.]*\./)?.[0]);
  await d.goto(`${BENCH.admin}/settings`, 400);
  await d.click(d.page.getByRole("tab", { name: "Features" }), { after: 300 });
  const basicFeatures = await ui.text(d);
  d.check("Settings → Features shows Delivery as 'Not in your plan' (there is no switch to turn on)", /Delivery\s*Not in your plan/.test(basicFeatures), basicFeatures.match(/Ways to order[^]{0,160}/)?.[0]);
  await d.shot("basic-coupon-refused");

  /* ------------------------------------------------------------------ upgrade */
  await asSuper();
  await d.step("The platform upgrades the store from Basic to Pro");
  await ui.setStorePlan(d, W.store, PLAN.pro);
  await ui.openStore(d, W.store);
  const proPage = await ui.text(d);
  d.check("the store page now shows the Pro plan and 1 of 3 outlets", proPage.includes(PLAN.pro) && /Outlets\s*1\s*\/\s*3/.test(proPage), proPage.match(/Within plan[^]{0,80}/)?.[0]);

  await Owner();
  await d.step("The owner adds outlets 2 and 3 — and a 4th is refused");
  const o2 = await ui.addOutlet(d, "Second", "second");
  const o3 = await ui.addOutlet(d, "Third", "third");
  d.check("outlet 2 created", !o2.refused && /Second/.test(o2.text), o2.why ?? "");
  d.check("outlet 3 created", !o3.refused && /Third/.test(o3.text), o3.why ?? "");
  const o4 = await ui.addOutlet(d, "Fourth", "fourth");
  d.never("a 4th outlet is created on a plan limited to 3", !o4.refused);
  d.check("the 'Add outlet' button is greyed out: 'Your plan allows 3 outlets.'", o4.refused && /Your plan allows 3 outlets/.test(o4.why), o4.why);
  const list = await ui.text(d);
  d.check("the Outlets page lists Central, Second and Third", ["Central", "Second", "Third"].every((n) => list.includes(n)));
  await d.shot("outlets-3");
  const proCoupon = await ui.createCoupon(d, "HELLO10");
  d.check("on Pro the coupon that Basic refused now works", /HELLO10/.test(proCoupon) && !/isn't included in your plan/i.test(proCoupon));

  /* ------------------------------------------------------------------- menus */
  await d.step("Add a category and menu items to every outlet");
  for (const [slug, [category, items]] of Object.entries(MENUS)) {
    await ui.switchOutlet(d, OUTLETS[slug].name);
    await ui.addCategory(d, category);
    for (const [name, foodType, price] of items) await ui.addItem(d, category, { name, foodType, price });
    const menu = await ui.text(d);
    d.check(`${OUTLETS[slug].name}: the menu lists ${items.map((i) => i[0]).join(" and ")}`, items.every(([n]) => menu.includes(n)));
  }

  /* -------------------------------------------------------------- all settings */
  await d.step("Configure each outlet in Settings: identity, location, hours, alerts, order handling, delivery, receipts, features, wallet, load management");
  const specFor = (slug, i) => {
    const o = OUTLETS[slug];
    return [
      { tab: "Business", text: { "Tagline": `Outlet ${i + 1} tagline`, "FSSAI licence number": `1234567890${100 + i}`, "GSTIN": `07AAAAA0000A1Z${i + 1}`, "Phone": `+91 98000 0000${i}`, "Email": `${slug}@lifecycle.test`, "Address": `${o.name} address, Delhi NCR`, "Latitude": String(o.lat), "Longitude": String(o.lng), "Address shown to customers": `${o.name} address, Delhi NCR` } },
      { tab: "Opening hours", ticks: { "Enforce opening hours": true }, text: { "Opens at": o.hours[0], "Closes at": o.hours[1], "Stop taking orders early (minutes)": String(15 + i * 5), "Closed message": `${o.name} is closed right now.` } },
      { tab: "Missed-order alerts", ticks: { "Warn me about slow orders": true, "Play a sound": i !== 1, "Keep reminding me": i === 0 }, text: { "Accept within (minutes)": String(3 + i), "Finish cooking within (minutes)": String(25 + i) } },
      { tab: "Order handling", ticks: { "Show the oldest order first": i === 1, "Allow staff to correct a status": i !== 2, "Accept incoming orders automatically": false }, picks: { "Lock editing after": ["Once cooking starts", "Once the food is ready", "Once completed"][i] }, text: { "Fallback refresh (seconds)": String(10 + i) } },
      { tab: "Kitchen & delivery", ticks: { "Busy mode is on right now": i === 2 }, text: { "Normal prep time (minutes)": String(15 + i * 5), "Extra when busy (minutes)": String(10 + i), "Minimum order (₹)": String(o.minOrder), "Maximum items per order": String(30 + i), "Delivery fee (₹)": String(o.fee), "Free delivery above (₹)": String(o.free), "Delivery radius (km)": String(o.radius), "Delivery time per km (minutes)": String(3 + i), "Minimum delivery ETA (minutes)": String(20 + i) } },
      { tab: "Receipts & charges", ticks: { "Print a customer receipt automatically": i === 0, "Offer to text or email the receipt": true, "Print a tip line on the bill": i === 1 }, text: { "Service charge (%)": String(i * 2) } },
      { tab: "Features", ticks: { "Takeaway from the website": true, "Dine-in QR ordering": true, "Delivery": true } },
      { tab: "Coin wallet", ticks: { "Turn on the coin wallet": true }, text: { "Earn 1 coin per ₹": String(10 + i * 5), "1 coin is worth ₹": "1", "Minimum order to earn (₹)": String(10 * i), "Coins can cover up to (%)": String(40 + i * 10), "Coins expire after (days)": String(30 * (i + 1)) } },
      { tab: "Load management", ticks: { "Turn on load management": true }, text: { "Show 'High Orders' at": String([5, 2, 10][i]), "Stop new orders at": String([8, 4, 20][i]), "Warn at": String([3, 1, 4][i]), "Disable delivery at": String([6, 3, 9][i]), "'High Orders' message": `${o.name} is busy right now.`, "'Not Accepting Orders' message": `${o.name} is not taking orders.`, "'Limited riders' message": `${o.name} has few riders.` } },
    ];
  };
  const specs = {};
  for (const [i, slug] of Object.keys(OUTLETS).entries()) {
    await ui.switchOutlet(d, OUTLETS[slug].name);
    specs[slug] = specFor(slug, i);
    await ui.applySettings(d, specs[slug]);
    await ui.enableTestGateway(d); // delivery orders must be paid online, so each outlet needs an online payment method
  }

  await d.step("Reload Settings for each outlet: every value must be exactly as saved, and independent of the others");
  for (const slug of Object.keys(OUTLETS)) {
    await ui.switchOutlet(d, OUTLETS[slug].name);
    const bad = await ui.readBackSettings(d, specs[slug]);
    const n = specs[slug].reduce((a, t) => a + Object.keys(t.text ?? {}).length + Object.keys(t.ticks ?? {}).length + Object.keys(t.picks ?? {}).length, 0);
    d.check(`${OUTLETS[slug].name}: all ${n} settings across 10 tabs read back exactly as saved`, bad.length === 0, bad.slice(0, 3).join(" · "));
  }
  await d.shot("settings-readback");

  await d.step("Give each outlet the name customers see — Settings → Outlets → ✎ (the Store name in Settings is the whole store's and can't be edited there)");
  for (const slug of Object.keys(OUTLETS)) await ui.renameOutlet(d, OUTLETS[slug].name, OUTLETS[slug].title);
  const outletsPage = await ui.text(d);
  d.check("each outlet is listed under the name customers see", Object.values(OUTLETS).every((o) => outletsPage.includes(o.title)));

  /* ------------------------------------------------------------ delivery distance */
  await d.tab("customer", "Customer · storefront");
  await d.step("Delivery distance on the storefront: inside and outside each outlet's radius (using the browser's location)");
  await d.context.grantPermissions(["geolocation"]);
  const north = (o, km) => ({ latitude: o.lat + km / 111, longitude: o.lng });
  const delivery = async (slug, km) => {
    await d.context.setGeolocation(north(OUTLETS[slug], km));
    await d.goto(`${SUB_URL}/${slug}`, 300);
    const group = d.page.getByRole("group", { name: "Order type" });
    if (await group.isVisible().catch(() => false)) await d.click(group.getByRole("button", { name: "Delivery" }), { after: 300 });
    await ui.addToCart(d, Object.values(MENUS[slug][1])[0][0]);
    await d.click(d.page.getByRole("link", { name: /View cart/ }), { after: 600 });
    await d.page.waitForURL(/\/order/);
    if (await d.page.getByText("Sign in to order").first().isVisible({ timeout: 3000 }).catch(() => false)) await ui.customerSignIn(d, { name: "Distance Tester", phone: "9811100001" });
    await d.click(d.page.getByRole("button", { name: /Delivery/ }).first(), { after: 500 });
    await d.click(d.page.getByRole("button", { name: /^(Share my location|Update)$/ }).first(), { after: 2200 });
    return ui.text(d);
  };
  const near1 = await delivery("central", 1.2);
  d.check("Central, 1.2 km away (radius 3 km): 'We deliver here' with the ₹20 fee", /We deliver here\s*1\.\d km away\s*·\s*₹20 delivery/.test(near1), near1.match(/We deliver here[^]{0,60}|can.t deliver[^]{0,80}/)?.[0]);
  const far1 = await delivery("central", 5);
  d.never("Central offers delivery 5 km away (radius 3 km)", /We deliver here/.test(far1), far1.match(/We deliver here[^]{0,60}/)?.[0]);
  d.check("…and the customer is told it is too far", /(too far|outside|can.t deliver|don.t deliver|beyond|not deliver)/i.test(far1), far1.match(/Location shared[^]{0,160}/)?.[0]);
  await d.shot("delivery-too-far");
  const far3 = await delivery("third", 5);
  d.check("Third, 5 km away (radius 8 km): 'We deliver here' with Third's own ₹40 fee — every outlet uses its own radius and fee", /We deliver here\s*\d+(?:\.\d)? km away\s*·\s*₹40 delivery/.test(far3), far3.match(/We deliver here[^]{0,60}|can.t deliver[^]{0,80}/)?.[0]);

  /* ----------------------------------------------------------- load management */
  await d.step("Load management on Second (busy at 2 orders, stop at 4): the customer's checkout and the dashboard");
  const order = (n) => ui.placeTakeaway(d, `${SUB_URL}/second`, [{ name: "Margherita Pizza" }], { name: "Load Tester", phone: "9811100003" });
  const banner = async (rx) => ui.reloadUntil(d, async () => rx.test(await ui.text(d)), 32000);
  const placed = [];
  placed.push(await order(1));
  placed.push(await order(2));
  await d.goto(`${SUB_URL}/second`, 300);
  await ui.addToCart(d, "Margherita Pizza");
  await d.click(d.page.getByRole("link", { name: /View cart/ }), { after: 500 });
  const sawBusy = await banner(/Second is busy right now\./);
  d.check("2 orders in the queue: checkout shows Second's own 'busy' message", sawBusy);
  placed.push(await order(3));
  placed.push(await order(4));
  await d.goto(`${SUB_URL}/second`, 300);
  await ui.addToCart(d, "Margherita Pizza");
  await d.click(d.page.getByRole("link", { name: /View cart/ }), { after: 500 });
  const sawStop = await banner(/Second is not taking orders\./);
  d.check("4 orders: checkout shows Second's own 'not taking orders' message", sawStop);
  const bodyStop = await ui.text(d);
  const deliveryButton = d.page.getByRole("group", { name: "Order type" }).getByRole("button", { name: "Delivery" });
  const deliveryListed = await deliveryButton.isVisible().catch(() => false);
  const deliveryChoice = deliveryListed && (await deliveryButton.isEnabled().catch(() => false));
  d.check("Delivery is still listed in checkout but greyed out while load management has it stopped", deliveryListed && /How would you like it/.test(bodyStop) && !deliveryChoice);
  d.never("a customer can still choose Delivery while load management has it stopped", deliveryChoice);
  await d.shot("load-stopped");
  d.check("Central (busy only at 5 orders) shows no load message", await (async () => { await d.goto(`${SUB_URL}/central`, 300); await ui.addToCart(d, "Veg Burger"); await d.click(d.page.getByRole("link", { name: /View cart/ }), { after: 600 }); return !/busy right now|not taking orders/.test(await ui.text(d)); })());

  await Owner();
  await ui.switchOutlet(d, OUTLETS.second.title); // renamed to the name customers see, earlier in this test
  await d.goto(`${BENCH.admin}/orders`, 800);
  const bar = await ui.text(d);
  d.check("the dashboard's Orders screen lists the four orders", placed.every((n) => bar.includes(`#${n}`)), placed.join(", "));
  for (const n of placed) await ui.cancelOrder(d, n);
  d.check("all four orders are cancelled in the dashboard", await ui.until(async () => (await ui.text(d)).match(/Cancelled/g)?.length >= 4, 10000));
  await d.tab("customer", "Customer · storefront");
  await d.goto(`${SUB_URL}/second`, 300);
  await ui.addToCart(d, "Margherita Pizza");
  await d.click(d.page.getByRole("link", { name: /View cart/ }), { after: 500 });
  const cleared = await ui.reloadUntil(d, async () => !/Second is busy right now|Second is not taking orders/.test(await ui.text(d)), 32000);
  d.check("after the orders are cancelled the load messages are gone again", cleared);

  /* --------------------------------------------- Pro-direct store and Custom store */
  await asSuper();
  await d.step("The Pro store and the Custom store get what their plans give them");
  const pro = await ui.storeUsageText(d, "Pro Direct Co");
  d.check("Pro store: Pro plan, up to 3 outlets and 10 people", pro.includes(PLAN.pro) && /Outlets\s*1\s*\/\s*3/.test(pro) && /People\s*1\s*\/\s*10/.test(pro), pro.match(/Within plan[^]{0,60}/)?.[0]);
  const cus = await ui.storeUsageText(d, "Custom Kitchen");
  d.check("Custom store starts with nothing: 1 outlet, 1 person", cus.includes(PLAN.custom) && /Outlets\s*1\s*\/\s*1/.test(cus), cus.match(/Within plan[^]{0,60}|Over[^]{0,40}/)?.[0]);
  await d.click(d.page.getByRole("tab", { name: "Plan & limits" }), { after: 400 });
  await ui.pick(d, "Multi-outlet", "On");
  await ui.pick(d, "Outlets", "Number");
  const box = d.page.locator("label").filter({ has: d.page.locator("span").filter({ hasText: /^Outlets/ }) }).locator('input[type="number"]').first();
  await d.click(box, { after: 100 });
  await d.page.keyboard.press("ControlOrMeta+a");
  await d.page.keyboard.insertText("2");
  const saveC = d.page.getByRole("button", { name: /^Save/ }).first();
  if (await saveC.isEnabled().catch(() => false)) await d.click(saveC, { after: 1000 });
  await ui.openStore(d, "Custom Kitchen");
  const cus2 = await ui.text(d);
  d.check("the platform sets the Custom store to 2 outlets by hand", /Outlets\s*1\s*\/\s*2/.test(cus2), cus2.match(/Within plan[^]{0,60}/)?.[0]);
  await signed("ownerC", ["owner@customkitchen.test", W.ownerPassword], "Store dashboard · owner of Custom Kitchen");
  const c2 = await ui.addOutlet(d, "Kitchen 2", "kitchen2");
  d.check("Custom store: a 2nd outlet can be added", !c2.refused && /Kitchen 2/.test(c2.text), c2.why ?? "");
  const c3 = await ui.addOutlet(d, "Kitchen 3", "kitchen3");
  d.never("a Custom store limited to 2 outlets gets a 3rd", !c3.refused);
  d.check("…the button says why", c3.refused && /Your plan allows 2 outlets/.test(c3.why), c3.why);
  d.never("the browser logged JavaScript errors", d.problems.length > 0, d.problems.join(" | "));
}
