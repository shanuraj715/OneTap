// T10 — degrade the store from Pro to Basic, all in Chrome: what stops, what keeps working, the grace period,
// what happens after it, and what a customer sees when the platform disables an outlet by hand.
import { BENCH } from "../bench/watch.mjs";
import * as ui from "../bench/ui.mjs";
import { OUTLETS, OWNER, PLAN, SUB_URL, W, requireWorld } from "./_world.mjs";

export const meta = {
  id: "t10-plan-downgrade",
  title: "Plan downgrade Pro → Basic — what stops, what keeps working, grace period, after the grace period, a manually disabled outlet",
  area: "plans",
  fresh: false,
  summary: "Continues from t09, in Chrome. The platform moves the store to Basic: it goes 'over limit' with a grace period; the three outlets keep serving customers and taking orders, but new outlets, delivery, the coin wallet and coupons are locked and the owner's dashboard shows a notice with the deadline. When the grace period has ended nothing is blocked automatically. Then the platform disables outlet 3 by hand: customers see 'temporarily unavailable' and can't order, the other outlets are unaffected, and it can be switched back on.",
  expect: [
    "Right after the downgrade the platform page shows the store over its limits with a grace deadline; the owner's dashboard shows 'Everything keeps working until …'.",
    "During grace all 3 outlets still open for customers and accept orders; the owner can still sign in and change settings.",
    "Locked on Basic: 'Add outlet' is greyed out, creating a coupon is refused, customers can no longer choose Delivery (it is still listed, but greyed out) — while .",
    "After the grace period the owner's notice says the grace period ended; still nothing is blocked automatically.",
    "Disabling outlet 3: its page says 'This outlet is temporarily unavailable' with no menu; outlets 1 and 2 are unaffected; enabling it again brings the menu back.",
  ],
  expectNot: [
    "The downgrade must NOT delete or switch off any outlet, menu or setting by itself.",
    "A Basic store must NOT be able to add an outlet, create coupons, switch delivery on or offer it to customers.",
    "The end of the grace period must NOT block outlets or the owner automatically.",
    "A disabled outlet must NOT show its menu; the other outlets must NOT be affected.",
    "The browser must NOT log JavaScript errors.",
  ],
};

export async function run(d, h) {
  const who = { now: "" };
  const as = async (key, creds, label) => { await d.tab("dashboard", label); if (who.now !== key) { await ui.signIn(d, creds); who.now = key; } };
  const asSuper = () => as("super", "super", "Platform console · super admin");
  const asOwner = () => as("owner", OWNER, "Store dashboard · owner of Lifecycle Foods");
  const customer = async (url) => { await d.tab("customer", "Customer · browser"); return ui.visit(d, url); };
  const orderChoices = async (slug) => { await customer(`${SUB_URL}/${slug}`); return (await d.page.getByRole("group", { name: "Order type" }).innerText().catch(() => "")).replace(/\s+/g, " "); };
  await asSuper();
  await requireWorld(d);

  await d.step("Before: the store is on Pro and customers can choose Delivery");
  const p0 = await ui.storeUsageText(d, W.store);
  d.check("the platform shows Pro with 3 of 3 outlets and no grace period", p0.includes(PLAN.pro) && /Outlets\s*3\s*\/\s*3/.test(p0) && !/grace period|Over its limits/i.test(p0), p0.match(/Within plan[^]{0,60}/)?.[0]);
  d.check("customers are offered Delivery at Central (and can choose it)", /Delivery/.test(await orderChoices("central")) && (await d.page.getByRole("group", { name: "Order type" }).getByRole("button", { name: "Delivery" }).isEnabled()), await orderChoices("central"));
  await asSuper();
  await ui.setGraceDays(d, 7);
  await ui.openPlatform(d, "/settings");
  d.check("the grace period is set to 7 days", (await (await ui.F(d, "Days")).inputValue()) === "7");

  await d.step("The platform moves the store from Pro down to Basic");
  await ui.setStorePlan(d, W.store, PLAN.basic);
  const p1 = await ui.storeUsageText(d, W.store);
  d.check("the platform page now shows Basic with 3 outlets against a limit of 1", p1.includes(PLAN.basic) && /Outlets\s*3\s*\/\s*1/.test(p1), p1.match(/Within plan[^]{0,60}|Over[^]{0,80}/)?.[0]);
  d.check("…and says the store is over its limits, with the 7-day grace deadline", /Over its limits since[^]*Everything keeps working until/.test(p1), p1.match(/Over its limits since[^.]*\.[^.]*\./)?.[0]);
  await d.shot("platform-over-limit");
  await asSuper();
  await ui.openStore(d, W.store, "Outlets");
  d.never("the downgrade blocked an outlet by itself", /Blocked/.test(await ui.text(d)));

  await d.step("During grace: what the owner sees and what is locked");
  await asOwner();
  const home = await ui.text(d);
  d.check("the owner's dashboard shows 'Your store has 3 outlets (plan allows 1)' and 'Everything keeps working until …'", /3 outlets \(plan allows 1\)/.test(home) && /Everything keeps working until/.test(home), home.match(/Your store has[^]{0,160}/)?.[0]);
  await d.shot("owner-grace-banner");
  const add = await ui.addOutlet(d, "Fourth", "fourth");
  d.never("an outlet can be added while over the limit", !add.refused);
  d.check("'Add outlet' is greyed out", add.refused, add.why);
  const coupon = await ui.createCoupon(d, "AFTER10");
  d.never("a coupon is created on Basic", /Delete AFTER10/.test(coupon));
  d.check("…with the plan message", /isn't included in your plan/i.test(coupon));
  await ui.switchOutlet(d, OUTLETS.central.title);
  await d.goto(`${BENCH.admin}/settings`, 400);
  await d.click(d.page.getByRole("tab", { name: "Features" }), { after: 300 });
  const features = await ui.text(d);
  d.check("Settings → Features shows Delivery as 'Not in your plan' (no switch to turn on)", /Delivery\s*Not in your plan/.test(features), features.match(/Ways to order[^]{0,200}/)?.[0]);
  d.never("the Features tab still offers a Delivery switch", await d.page.getByRole("checkbox", { name: /^\s*Delivery/ }).count() > 0);
  await d.click(d.page.getByRole("tab", { name: "Coin wallet" }), { after: 300 });
  d.check("Settings → Coin wallet says it isn't in the plan", /isn't in your plan|not in your plan|Not in your plan|won't apply until/i.test(await ui.text(d)), (await ui.text(d)).match(/Coin wallet[^]{0,160}/)?.[0]);
  const edit = await ui.applySettings(d, [{ tab: "Business", text: { "Tagline": "Edited during grace" } }]).then(() => true).catch(() => false);
  d.check("the owner can still edit and save settings", edit && (await ui.readBackSettings(d, [{ tab: "Business", text: { "Tagline": "Edited during grace" } }])).length === 0);

  await d.step("During grace: the customer's side");
  for (const [slug, o] of Object.entries(OUTLETS)) {
    const page = await customer(`${SUB_URL}/${slug}`);
    d.check(`outlet "${slug}" still opens`, page.status === 200 && page.text.includes(o.title) && !/temporarily unavailable/.test(page.text));
  }
  // Delivery is still SHOWN (the switch always lists both) but is switched off: it can't be chosen
  await orderChoices("central");
  const orderGroup = d.page.getByRole("group", { name: "Order type" });
  d.check("Delivery is still listed, but greyed out and can't be chosen", (await orderGroup.getByRole("button", { name: "Delivery" }).isDisabled()) && (await orderGroup.getByRole("button", { name: "Takeaway" }).isEnabled()), await orderChoices("central"));
  d.never("customers can still choose Delivery", await orderGroup.getByRole("button", { name: "Delivery" }).isEnabled());
  const order1 = await ui.placeTakeaway(d, `${SUB_URL}/second`, [{ name: "Margherita Pizza" }], { name: "Grace Customer", phone: "9811100010" });
  d.check("a customer can still place a takeaway order at outlet 2", /^\d+$/.test(order1), `order #${order1}`);

  await d.step("After the grace period (set to 0 days): is anything blocked automatically?");
  await asSuper();
  await ui.setGraceDays(d, 0);
  const p2 = await ui.storeUsageText(d, W.store);
  d.check("the platform page says the grace period has ended", /grace period ended/.test(p2), p2.match(/This store went over[^]{0,160}/)?.[0]);
  await asOwner();
  d.check("the owner's dashboard says 'The grace period ended on …'", /The grace period ended on/.test(await ui.text(d)));
  await asSuper();
  await ui.openStore(d, W.store, "Outlets");
  d.never("an outlet was blocked automatically when the grace period ended", /Blocked/.test(await ui.text(d)));
  const stillOpen = await customer(`${SUB_URL}/second`);
  d.check("customers can still open outlet 2", stillOpen.status === 200 && !/temporarily unavailable/.test(stillOpen.text));
  const order2 = await ui.placeTakeaway(d, `${SUB_URL}/second`, [{ name: "Farmhouse Pizza" }], { name: "Grace Customer", phone: "9811100010" });
  d.check("…and still order", /^\d+$/.test(order2), `order #${order2}`);
  await asOwner();
  const add2 = await ui.addOutlet(d, "Fourth", "fourth");
  d.never("an outlet can be added after the grace period", !add2.refused);

  await d.step("The platform disables outlet 3 by hand — what a customer sees");
  await asSuper();
  await ui.setOutletBlocked(d, W.store, OUTLETS.third.title, true);
  d.check("the Outlets tab shows Third as blocked", /Blocked/.test(await ui.text(d)));
  const blocked = await customer(`${SUB_URL}/third`);
  d.check("customers see 'This outlet is temporarily unavailable'", /This outlet is temporarily unavailable/.test(blocked.text), blocked.text.slice(0, 100));
  d.never("the disabled outlet still shows its menu", ["Paneer Roll", "Egg Roll"].some((n) => blocked.text.includes(n)));
  await d.shot("outlet-3-disabled");
  const canOrder = await d.page.getByRole("button", { name: /^add /i }).count();
  d.never("the disabled outlet still offers 'Add' buttons to order", canOrder > 0, `${canOrder} buttons`);
  for (const slug of ["central", "second"]) {
    const page = await customer(`${SUB_URL}/${slug}`);
    d.never(`outlet "${slug}" is affected by outlet 3 being disabled`, page.status !== 200 || /temporarily unavailable/.test(page.text));
  }
  const root = await customer(`${SUB_URL}/`);
  d.check("the store's address still opens", root.status === 200);
  await asSuper();
  const p3 = await ui.storeUsageText(d, W.store);
  d.check("the disabled outlet no longer counts toward the limit: 2 outlets in use", /Outlets\s*2\s*\/\s*1/.test(p3), p3.match(/Over[^]{0,80}|Outlets\s*\d+\s*\/\s*\d+/)?.[0]);
  await ui.setOutletBlocked(d, W.store, OUTLETS.third.title, false);
  const back = await customer(`${SUB_URL}/third`);
  d.check("enabling it again brings the menu back", back.status === 200 && back.text.includes("Paneer Roll"));
  await asSuper();
  await ui.setOutletBlocked(d, W.store, OUTLETS.third.title, true);
  d.check("outlet 3 is left disabled for the next tests", /Blocked/.test(await ui.text(d)));

  await ui.setGraceDays(d, 30);
  d.never("the browser logged JavaScript errors", d.problems.length > 0, d.problems.join(" | "));
}
