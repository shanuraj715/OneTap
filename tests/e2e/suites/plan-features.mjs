// Plans and their features: the rules (dependencies, "includes every feature"), the shared presets, the console API, and the two scripts that create /
// bring plans up to date (seed-plans.js, update-plans.js) — run as separate processes against a throwaway database laid out like production's
// (Starter with 4 features, Business with the 13 it had when it was made, Custom). No browser.
import { execFile } from "node:child_process";
import { startApi } from "./_api-harness.mjs";

const t = await startApi(3120);
const { call, ok, say } = t;
const S = await import(`${t.REPO}/packages/config-schema/src/index.js`);
const runScript = (name, args = []) => new Promise((resolve) => execFile(process.execPath, [`${t.API}/src/scripts/${name}`, ...args], { env: process.env, timeout: 90_000 }, (err, stdout, stderr) => resolve({ code: err ? 1 : 0, out: String(stdout), err: String(stderr) })));
const plans = () => t.raw("plans");
const snapshot = async () => JSON.stringify((await plans().find({}).sort({ name: 1 }).toArray()).map((p) => ({ n: p.name, e: p.entitlements, l: p.limits, c: p.custom })));

await t.run(async () => {
  say("1. The rules");
  ok(S.FEATURE_KEYS.length === 18, "the product has 18 plan features", String(S.FEATURE_KEYS.length));
  ok(Object.entries(S.FEATURE_REQUIRES).every(([f, needs]) => S.FEATURE_KEYS.includes(f) && needs.every(([n]) => S.FEATURE_KEYS.includes(n))), "every feature named in the dependency table really exists");
  const p1 = S.featureProblems(["delivery"]);
  ok(p1.length === 1 && /Delivery needs Online payments/.test(p1[0].text), "delivery without online payments is flagged, in plain words", p1[0]?.text);
  ok(S.featureProblems(["delivery", "onlinePayments"]).length === 0, "…and not when it has them");
  ok(S.featureProblems(["cartReminders"]).length === 1 && S.featureProblems(["cartReminders", "notifications"]).length === 0, "abandoned-cart reminders need the WhatsApp & SMS alerts");
  ok(S.featureProblems(["marketing"]).length === 1 && S.featureProblems(["scheduledOrders"]).length === 1 && S.featureProblems(["scheduledOrders", "takeaway"]).length === 0, "marketing needs alerts; pre-orders need takeaway");
  ok(S.featureProblems([]).length === 0 && S.featureProblems(S.FEATURE_KEYS).length === 0, "no features, or every feature, is never a problem");

  say("2. The shared presets");
  const [starter, business] = S.PLAN_PRESETS;
  ok(S.PLAN_PRESETS.length === 2 && starter.names[0] === "Starter" && starter.names.includes("Basic") && business.names[0] === "Business" && business.names.includes("Pro"), "two presets: Starter (once called Basic) and Business (once called Pro)");
  ok(S.featureProblems(starter.entitlements.features).length === 0 && S.featureProblems(business.entitlements.features).length === 0, "neither preset offers a feature without what it needs");
  ok(["takeaway", "dineInQr", "coupons", "printing"].every((k) => starter.entitlements.features.includes(k)), "Starter keeps what it always had (takeaway, dine-in QR, coupons, printing)");
  ok(["scheduledOrders", "feedback"].every((k) => starter.entitlements.features.includes(k)), "…and gains pre-orders and ratings (they cost the restaurant nothing to run and win it customers)");
  ok(["kitchenDisplay", "reservations", "cartReminders", "delivery", "onlinePayments", "marketing", "analytics", "notifications", "whatsappChat", "wallet", "customDomain"].every((k) => !starter.entitlements.features.includes(k)), "…but not the features that need a team or a sender account (kitchen display, bookings, reminders, delivery, marketing…)");
  ok(business.entitlements.allFeatures === true && S.FEATURE_KEYS.every((k) => business.entitlements.features.includes(k)), "Business includes every feature, with the 'every feature' switch on");
  ok(business.limits.maxOutlets === 3 && business.limits.maxUsers === 20 && starter.limits.maxOutlets === 1 && starter.limits.multiOutlet === false, "limits unchanged: Starter 1 outlet and 5 people, Business 3 outlets and 20 people");
  ok(starter.limits.maxTables === 5 && business.limits.maxTables === 20, "tables: Starter 5, Business 20 (tables are sold in fives)");

  say("3. 'Includes every feature' in the rules");
  const old = { name: "Old", limits: {}, entitlements: { features: ["takeaway", "delivery"] } };
  ok(S.resolvePlan(old).entitlements.features.length === 2, "a plan WITHOUT the switch keeps only its own list (a feature added later never reaches it: the problem we had)");
  const all = { name: "All", limits: {}, entitlements: { allFeatures: true, features: ["takeaway"] } };
  ok(S.resolvePlan(all).entitlements.features.length === S.FEATURE_KEYS.length, "a plan WITH the switch gets every feature, whatever its saved list says (so also features added in future)");
  const locked = S.resolvePlan(all, { entitlements: { features: { lock: ["marketing"] } } });
  ok(!locked.entitlements.features.includes("marketing") && locked.entitlements.features.length === S.FEATURE_KEYS.length - 1, "a store can still have one feature locked on such a plan");
  ok(S.resolvePlan({ name: "C", custom: true, entitlements: { allFeatures: true } }).entitlements.features.length === 0, "a Custom plan still includes nothing by itself (the switch is ignored there)");
  ok(S.effectiveFeatures({ allFeatures: true, features: [] }).length === 18 && S.effectiveFeatures({ features: ["a"] }).length === 1 && S.effectiveFeatures(undefined).length === 0, "effectiveFeatures: all when the switch is on, else the list, else nothing");

  say("4. Through the console's API");
  const s = await t.makeStore();
  const mk = (body) => call("POST", "/api/platform/plans", { cookie: s.su, body });
  const created = await mk({ name: "Everything", entitlements: { allFeatures: true, features: ["takeaway"] } });
  const ep = created.json.plan;
  ok(created.status === 201 && ep.entitlements.allFeatures === true && ep.entitlements.features.length === 18, "creating a plan with the switch on stores it and answers with every feature", `${created.status} ${ep?.entitlements?.features?.length}`);
  const listed = (await call("GET", "/api/platform/plans", { cookie: s.su })).json.plans.find((p) => p.name === "Everything");
  ok(listed.entitlements.features.length === 18 && listed.entitlements.allFeatures === true, "the list of plans shows it the same way (so the console and the website show every feature)");
  const upd = await call("PATCH", `/api/platform/plans/${ep.id}`, { cookie: s.su, body: { entitlements: { allFeatures: false, features: ["takeaway", "dineInQr"] } } });
  ok(upd.status === 200 && upd.json.plan.entitlements.allFeatures === false && upd.json.plan.entitlements.features.length === 2, "switching it off goes back to the plan's own list");
  ok((await mk({ name: "Bad", entitlements: { features: ["not-a-feature"] } })).status === 400, "a feature that doesn't exist is refused (400)");
  const cust = await mk({ name: "Custom X", custom: true, entitlements: { allFeatures: true } });
  ok(cust.json.plan.entitlements.features.length === 0 && cust.json.plan.entitlements.allFeatures === false, "a Custom plan saved with the switch on still stores nothing");
  await call("PATCH", `/api/platform/plans/${ep.id}`, { cookie: s.su, body: { entitlements: { allFeatures: true } } });
  await call("PATCH", `/api/platform/stores/${s.brand}/plan`, { cookie: s.su, body: { planId: ep.id } });
  const store1 = (await call("GET", `/api/platform/stores/${s.brand}`, { cookie: s.su })).json;
  const ent1 = (store1.store ?? store1).entitlements;
  ok(["kitchenDisplay", "reservations", "scheduledOrders", "feedback", "cartReminders"].every((k) => ent1.features.includes(k)), "a store on that plan has the five newest features (kitchen display, bookings, pre-orders, ratings, cart reminders)");
  const stored = await plans().findOne({ name: "Everything" });
  ok(stored.entitlements.allFeatures === true, "the switch is what is stored in the database");

  say("5. update-plans.js on a database laid out like production's");
  await plans().deleteMany({});
  const now = new Date();
  const L = { starter: ["takeaway", "dineInQr", "coupons", "printing"], business: ["takeaway", "dineInQr", "delivery", "onlinePayments", "coupons", "wallet", "printing", "notifications", "whatsappChat", "marketing", "analytics", "favicon", "customDomain"] };
  await plans().insertMany([
    { name: "Starter", custom: false, limits: { maxUsers: 5, multiOutlet: false, maxOutlets: 1 }, entitlements: { features: L.starter, effects: ["glass", "neumorph"], qrCardFamilies: ["minimal"] }, marketing: { show: true, monthly: 799 }, archived: false, createdAt: now, updatedAt: now },
    { name: "Business", custom: false, limits: { maxUsers: 20, multiOutlet: true, maxOutlets: 3 }, entitlements: { features: L.business, effects: ["glass"], qrCardFamilies: ["minimal"] }, marketing: { show: true, monthly: 2499 }, archived: false, createdAt: now, updatedAt: now },
    { name: "Custom", custom: true, limits: { maxUsers: null, multiOutlet: true, maxOutlets: null }, entitlements: { features: L.business, effects: [], qrCardFamilies: [] }, marketing: { show: true, price: "Custom" }, archived: false, createdAt: now, updatedAt: now },
  ]);
  const before = await snapshot();
  const dry = await runScript("update-plans.js");
  ok(dry.code === 0 && /DRY RUN/.test(dry.out) && /Starter/.test(dry.out) && /Business/.test(dry.out), "the default run is a dry run and says so");
  ok(/adds: scheduledOrders, feedback/.test(dry.out), "it says Starter would gain pre-orders and ratings", dry.out.split("\n").find((l) => /adds/.test(l)));
  ok(/adds: kitchenDisplay, reservations, scheduledOrders, feedback, cartReminders/.test(dry.out) && /includes every feature/.test(dry.out), "…and Business would gain the five newest features and switch on 'includes every feature'");
  ok(!/Custom/.test(dry.out) && (await snapshot()) === before, "Custom is not mentioned, and the dry run changed NOTHING in the database");
  const applied = await runScript("update-plans.js", ["--apply"]);
  ok(applied.code === 0 && /APPLYING/.test(applied.out) && /2 plan\(s\) updated/.test(applied.out), "--apply updates the two plans", applied.out.split("\n").slice(-3).join(" | "));
  const st = await plans().findOne({ name: "Starter" }), bz = await plans().findOne({ name: "Business" }), cu = await plans().findOne({ name: "Custom" });
  ok(L.starter.every((k) => st.entitlements.features.includes(k)) && st.entitlements.features.length === 6 && st.entitlements.features.includes("scheduledOrders") && st.entitlements.features.includes("feedback") && !st.entitlements.allFeatures, "Starter: everything it had is kept, plus pre-orders and ratings (6 features)", st.entitlements.features.join(","));
  ok(bz.entitlements.allFeatures === true && bz.entitlements.features.length === 18, "Business: the switch is on and the list is all 18", String(bz.entitlements.features.length));
  ok(JSON.stringify(cu.entitlements.features) === JSON.stringify(L.business) && cu.custom === true, "Custom is untouched");
  ok(st.limits.maxOutlets === 1 && bz.limits.maxOutlets === 3 && st.limits.maxUsers === 5 && bz.limits.maxUsers === 20 && bz.marketing.monthly === 2499 && st.marketing.monthly === 799, "outlet and people limits and website prices are untouched");
  ok(st.limits.maxTables === 5 && bz.limits.maxTables === 20 && cu.limits.maxTables === undefined, "the plans that had no table limit get one (Starter 5, Business 20); Custom is left alone", `${st.limits.maxTables}/${bz.limits.maxTables}/${cu.limits.maxTables}`);
  ok(/table limit: unlimited → 5 tables/.test(dry.out) && /table limit: unlimited → 20 tables/.test(dry.out), "the dry run said so beforehand");
  const again = await runScript("update-plans.js", ["--apply"]);
  ok(/Everything is up to date/.test(again.out) && /already up to date/.test(again.out), "run again: everything is already up to date (safe to repeat)");
  await plans().updateOne({ name: "Starter" }, { $set: { "limits.maxTables": 10 } });
  await runScript("update-plans.js", ["--apply"]);
  ok((await plans().findOne({ name: "Starter" })).limits.maxTables === 10, "a table limit someone has already set is never changed by the update");
  await call("PATCH", `/api/platform/stores/${s.brand}/plan`, { cookie: s.su, body: { planId: String(bz._id) } });
  const ent2 = ((await call("GET", `/api/platform/stores/${s.brand}`, { cookie: s.su })).json.store ?? {}).entitlements ?? (await call("GET", `/api/platform/stores/${s.brand}`, { cookie: s.su })).json.entitlements;
  ok(["kitchenDisplay", "feedback", "cartReminders"].every((k) => ent2.features.includes(k)), "a store on the updated Business plan now has the new features");
  await call("PATCH", `/api/platform/stores/${s.brand}/plan`, { cookie: s.su, body: { planId: String(st._id) } });
  const ent3 = ((await call("GET", `/api/platform/stores/${s.brand}`, { cookie: s.su })).json.store ?? {}).entitlements ?? (await call("GET", `/api/platform/stores/${s.brand}`, { cookie: s.su })).json.entitlements;
  ok(ent3.features.includes("feedback") && ent3.features.includes("scheduledOrders") && !ent3.features.includes("delivery") && !ent3.features.includes("kitchenDisplay"), "a store on Starter has ratings and pre-orders, and still no delivery or kitchen display");
  // a plan that does not exist under either name is skipped, not created
  await plans().deleteMany({ name: "Business" });
  const missing = await runScript("update-plans.js");
  ok(/Business: no such plan here — skipped/.test(missing.out) && (await plans().countDocuments({ name: "Business" })) === 0, "a plan that isn't there is skipped, never invented");

  say("6. seed-plans.js");
  await plans().deleteMany({});
  const fresh = await runScript("seed-plans.js");
  const names = (await plans().find({}).toArray()).map((p) => p.name).sort();
  ok(fresh.code === 0 && JSON.stringify(names) === JSON.stringify(["Business", "Custom", "Starter"]), "on an empty database it creates Starter, Business and Custom", names.join(","));
  const sn = await plans().findOne({ name: "Starter" }), bn = await plans().findOne({ name: "Business" }), cn = await plans().findOne({ name: "Custom" });
  ok(JSON.stringify(sn.entitlements.features) === JSON.stringify([...S.STARTER_FEATURES]) && sn.marketing.monthly === 799, "Starter is made from the preset, at ₹799");
  ok(bn.entitlements.allFeatures === true && bn.entitlements.features.length === 18 && bn.marketing.monthly === 2499 && bn.marketing.highlight === true, "Business is made with 'includes every feature', at ₹2,499, as the highlighted plan");
  ok(cn.custom === true && cn.marketing.price === "Custom", "Custom is made as a custom plan");
  ok(sn.limits.maxTables === 5 && bn.limits.maxTables === 20, "the new plans carry their table limits (Starter 5, Business 20)");
  const twice = await runScript("seed-plans.js");
  ok((await plans().countDocuments({})) === 3 && /already exists/i.test(twice.out + twice.err), "running it twice creates nothing new");
  await plans().deleteMany({});
  await plans().insertMany([{ name: "Basic", custom: false, limits: {}, entitlements: { features: L.starter }, marketing: {}, createdAt: now, updatedAt: now }, { name: "Pro", custom: false, limits: {}, entitlements: { features: L.business }, marketing: {}, createdAt: now, updatedAt: now }]);
  await runScript("seed-plans.js");
  const legacy = (await plans().find({}).toArray()).map((p) => p.name).sort();
  ok(JSON.stringify(legacy) === JSON.stringify(["Basic", "Custom", "Pro"]), "an install whose plans are still called Basic and Pro keeps them (no duplicate Starter / Business appears)", legacy.join(","));
  const upLegacy = await runScript("update-plans.js", ["--apply"]);
  ok(/Basic|Starter/.test(upLegacy.out) && (await plans().findOne({ name: "Pro" })).entitlements.allFeatures === true, "…and update-plans.js still finds them by their old names and brings them up to date");
});
