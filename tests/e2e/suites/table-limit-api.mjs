// Tables are limited by the plan, in steps of 5 (Starter 5, Business 20, Custom set by hand). The rules, the console API, what a store's team
// can and cannot do, the Custom plan, the onboarding form's plan-fit and the price (per block of 5). No browser — a private API, in-memory database.
import { startApi } from "./_api-harness.mjs";

const t = await startApi(3121);
const { call, ok, say } = t;
const S = await import(`${t.REPO}/packages/config-schema/src/index.js`);
const plansCol = () => t.raw("plans");
const limitOf = (v) => { const r = S.planLimitsSchema.safeParse({ maxTables: v }); return r.success ? { ok: true, value: r.data.maxTables } : { ok: false, message: r.error.issues[0].message }; };

await t.run(async () => {
  say("1. The rules: only 5, 10, 15 …");
  ok(S.TABLE_STEP === 5, "tables are sold in blocks of 5");
  ok([5, 10, 15, 20, 100].every((n) => limitOf(n).ok && limitOf(n).value === n), "5, 10, 15, 20 and 100 are accepted");
  const bad = [12, 19, 54, 7, 4, 0, 2.5, -5].map((n) => [n, limitOf(n)]);
  ok(bad.every(([, r]) => !r.ok), "12, 19, 54, 7, 4, 0, 2.5 and -5 are refused", bad.filter(([, r]) => r.ok).map(([n]) => n).join(","));
  ok(/fives/i.test(limitOf(12).message) && /at least 5/i.test(limitOf(4).message), "…with a plain message (\"Tables go up in fives…\", \"at least 5\")", `${limitOf(12).message} | ${limitOf(4).message}`);
  ok(limitOf(null).ok && limitOf(null).value === null && limitOf(undefined).value === null, "no limit (null / not given) means unlimited — how every plan made before this behaves");
  ok(S.tableBlocks(0) === 0 && S.tableBlocks(5) === 1 && S.tableBlocks(6) === 2 && S.tableBlocks(12) === 3, "12 tables are 3 blocks of five");
  ok(S.roundUpTables(0) === 5 && S.roundUpTables(5) === 5 && S.roundUpTables(12) === 15 && S.roundUpTables(20) === 20 && S.roundUpTables(21) === 25, "a store's size rounds UP to the next five (12 → 15, 21 → 25, never below 5)");
  ok(S.tableLimit({ maxTables: null }) === Infinity && S.tableLimit({ maxTables: 10 }) === 10, "tableLimit: Infinity when unlimited");
  ok(S.resolvePlan({ limits: { maxUsers: 3 }, entitlements: {} }).limits.maxTables === null, "a plan saved before tables had a limit resolves to unlimited (nothing is cut off)");
  ok(S.resolvePlan({ custom: true }, {}).limits.maxTables === null && S.resolvePlan({ custom: true }, { limits: { maxTables: 15 } }).limits.maxTables === 15, "a Custom plan has no limit of its own; the store's own number is the limit");
  ok(!S.planOverridesSchema.safeParse({ limits: { maxTables: 12 } }).success && S.planOverridesSchema.safeParse({ limits: { maxTables: 15 } }).success, "a store's own table limit follows the same rule (12 refused, 15 accepted)");
  const [starter, business] = S.PLAN_PRESETS;
  ok(starter.limits.maxTables === 5 && business.limits.maxTables === 20, "the shared presets: Starter 5 tables, Business 20");

  say("2. Plans through the console's API");
  const s = await t.makeStore({ slug: "acme", outlets: 1 });
  const mk = (body) => call("POST", "/api/platform/plans", { cookie: s.su, body });
  const r12 = await mk({ name: "Twelve", limits: { maxUsers: 5, multiOutlet: true, maxOutlets: 3, maxTables: 12 } });
  ok(r12.status === 400 && /fives|5/i.test(JSON.stringify(r12.json)), "a plan with 12 tables is refused (400) — and the answer says why", `${r12.status} ${String(r12.json.error).slice(0, 80)}`);
  const r10 = await mk({ name: "Small", limits: { maxUsers: 5, multiOutlet: true, maxOutlets: 3, maxTables: 10 } });
  ok(r10.status === 201 && r10.json.plan.limits.maxTables === 10, "a plan with 10 tables is created", `${r10.status} ${r10.json.plan?.limits?.maxTables}`);
  const planSmall = r10.json.plan.id;
  const up = await call("PATCH", `/api/platform/plans/${planSmall}`, { cookie: s.su, body: { limits: { maxUsers: 5, multiOutlet: true, maxOutlets: 3, maxTables: 15 } } });
  ok(up.status === 200 && up.json.plan.limits.maxTables === 15, "…and raised to 15");
  const upBad = await call("PATCH", `/api/platform/plans/${planSmall}`, { cookie: s.su, body: { limits: { maxUsers: 5, multiOutlet: true, maxOutlets: 3, maxTables: 19 } } });
  ok(upBad.status === 400 && (await plansCol().findOne({ name: "Small" })).limits.maxTables === 15, "editing it to 19 is refused and the plan keeps 15");
  const rUnl = await mk({ name: "Unlimited tables", limits: { maxUsers: 5, multiOutlet: true, maxOutlets: 3, maxTables: null } });
  ok(rUnl.status === 201 && rUnl.json.plan.limits.maxTables === null, "a plan can still have no table limit (unlimited)");
  const rCus = await mk({ name: "Custom X", custom: true, limits: { maxTables: 25 } });
  ok(rCus.status === 201 && rCus.json.plan.limits.maxTables === null, "a Custom plan stores no limit of its own");
  ok((await call("GET", "/api/platform/plans", { cookie: s.su })).json.plans.find((p) => p.name === "Small").limits.maxTables === 15, "the list of plans shows the limit");

  say("3. A store with a 5-table plan");
  const five = (await mk({ name: "Five", limits: { maxUsers: 5, multiOutlet: true, maxOutlets: 3, maxTables: 5 }, entitlements: { features: ["dineInQr"] } })).json.plan;
  const st = await t.makeStore({ slug: "five", ownerEmail: "o@five.test", outlets: 2 });
  await call("PATCH", `/api/platform/stores/${st.brand}/plan`, { cookie: st.su, body: { planId: five.id } });
  const addTable = (who, outlet, number) => call("POST", "/api/tables", { cookie: who, headers: { "x-rasoipulse-outlet": outlet }, body: { number: String(number), seats: 4 } });
  const [oA, oB] = st.outletIds;
  const made = [];
  for (const [outlet, n] of [[oA, "T1"], [oA, "T2"], [oA, "T3"], [oB, "T4"], [oB, "T5"]]) made.push((await addTable(st.owner, outlet, n)).status);
  ok(made.every((x) => x === 201), "the owner adds five tables, three at one outlet and two at the other", made.join(","));
  const sixA = await addTable(st.owner, oA, "T6");
  const sixB = await addTable(st.owner, oB, "T6");
  ok(sixA.status === 409 && sixB.status === 409, "a sixth table is refused at either outlet (the limit is for the whole store)", `${sixA.status}/${sixB.status}`);
  ok(/allows 5 tables/.test(sixA.json.error) && /5 at a time/.test(sixA.json.error) && sixA.json.details?.code === "table_limit", "…and the message says what the plan allows and that tables are added 5 at a time", sixA.json.error);
  ok((await t.raw("tables").countDocuments({ brandId: st.brand })) === 5, "nothing was created by the refused requests");
  const storePlanNow = await call("GET", "/api/store/plan", { cookie: st.owner, headers: { "x-rasoipulse-brand": st.brand } });
  const pl = storePlanNow.json.plan ?? storePlanNow.json;
  ok(pl.usage.tables === 5 && pl.max.tables === 5, "the store's plan answer shows 5 of 5 tables in use", JSON.stringify([pl.usage, pl.max]));
  const consoleStore = (await call("GET", `/api/platform/stores/${st.brand}`, { cookie: st.su })).json;
  const cs = consoleStore.store ?? consoleStore;
  ok(cs.usage.tables === 5 && cs.max.tables === 5 && cs.status === "ok", "the console shows the same, and a full table limit is not an 'over limit' problem", `${cs.usage.tables}/${cs.max.tables} ${cs.status}`);

  const list = (await call("GET", "/api/tables", { cookie: st.owner, headers: { "x-rasoipulse-outlet": oA } })).json.tables;
  const del = await call("DELETE", `/api/tables/${list[0].id}`, { cookie: st.owner, headers: { "x-rasoipulse-outlet": oA } });
  const again = await addTable(st.owner, oA, "T7");
  ok(del.status === 204 || del.status === 200, "a table is removed", String(del.status));
  ok(again.status === 201, "…and the room it leaves can be used again at once (the count is read fresh, not remembered)", String(again.status));
  const sw = await call("PATCH", `/api/tables/${(await call("GET", "/api/tables", { cookie: st.owner, headers: { "x-rasoipulse-outlet": oA } })).json.tables[0].id}`, { cookie: st.owner, headers: { "x-rasoipulse-outlet": oA }, body: { isActive: false } });
  const stillFull = await addTable(st.owner, oA, "T8");
  ok(sw.status === 200 && stillFull.status === 409, "switching a table off doesn't free its place (it still counts); only removing it does");

  // adding or removing a table must not throw away what is remembered about the store (its menu, settings, offers…) — only its plan answer
  const { cache } = await import(`${t.API}/src/modules/cache/cache.js`);
  await call("GET", `/api/menu?outletId=${oA}`);
  const remembered = () => cache.describe(`brand:${st.brand}`).map((e) => e.key.split(":")[0]).sort();
  const beforeKinds = remembered();
  const planKeyBefore = cache.peek(`plan:${st.brand}`);
  await call("DELETE", `/api/tables/${(await call("GET", "/api/tables", { cookie: st.owner, headers: { "x-rasoipulse-outlet": oA } })).json.tables.at(-1).id}`, { cookie: st.owner, headers: { "x-rasoipulse-outlet": oA } });
  const afterKinds = remembered();
  ok(beforeKinds.includes("menu") && afterKinds.includes("menu") && afterKinds.filter((k) => k !== "plan").length === beforeKinds.filter((k) => k !== "plan").length, "removing a table keeps everything else remembered about the store (its menu etc.) — only the plan answer is renewed", `${beforeKinds.join(",")} → ${afterKinds.join(",")}`);
  ok(Boolean(planKeyBefore) && !afterKinds.includes("plan"), "…and the plan answer WAS dropped, so 'tables in use' is right at once");
  await addTable(st.owner, oA, "T7b");

  say("4. Raising the limit for one store, and the platform's own door");
  const over = await call("PATCH", `/api/platform/stores/${st.brand}/plan`, { cookie: st.su, body: { planId: five.id, overrides: { limits: { maxTables: 12 } } } });
  ok(over.status === 400, "a store's own limit of 12 is refused (fives only)", String(over.status));
  const ten = await call("PATCH", `/api/platform/stores/${st.brand}/plan`, { cookie: st.su, body: { planId: five.id, overrides: { limits: { maxTables: 10 } } } });
  ok(ten.status === 200, "…10 is accepted for this store");
  const six = await addTable(st.owner, oA, "T8");
  ok(six.status === 201, "the owner can add a sixth table straight away (the new limit is seen at once)", String(six.status));
  const adminAdd = await call("POST", "/api/tables", { cookie: st.su, headers: { "x-rasoipulse-outlet": oA }, body: { number: "A1", seats: 2 } });
  await call("PATCH", `/api/platform/stores/${st.brand}/plan`, { cookie: st.su, body: { planId: five.id, overrides: { limits: { maxTables: 5 } } } });
  const adminAdd2 = await call("POST", "/api/tables", { cookie: st.su, headers: { "x-rasoipulse-outlet": oA }, body: { number: "A2", seats: 2 } });
  const nowCount = await t.raw("tables").countDocuments({ brandId: st.brand });
  ok(adminAdd.status === 201 && adminAdd2.status === 201 && nowCount > 5, "the platform's own admin can add tables beyond the limit", `${adminAdd.status}/${adminAdd2.status} count ${nowCount}`);
  const ownerOver = await addTable(st.owner, oA, "T9");
  const cs2 = (await call("GET", `/api/platform/stores/${st.brand}`, { cookie: st.su })).json;
  const c2 = cs2.store ?? cs2;
  ok(ownerOver.status === 409 && c2.usage.tables > c2.max.tables, "a store that has MORE than its limit keeps every table but can't add one", `${ownerOver.status} ${c2.usage.tables}/${c2.max.tables}`);
  ok(c2.status === "ok" && c2.grace.over === false, "…and it is NOT put into the 'over its limits' grace period (tables can't be blocked like outlets and people)", `${c2.status} over=${c2.grace.over}`);
  ok((await t.raw("tables").countDocuments({ brandId: st.brand })) === nowCount, "no table was removed or switched off");

  say("5. Stores that existed before the limit");
  const old = await t.makeStore({ slug: "old", ownerEmail: "o@old.test", outlets: 1 });
  const noPlan = await Promise.all([1, 2, 3, 4, 5, 6, 7].map((n) => addTable(old.owner, old.outlet, `N${n}`)));
  ok(noPlan.every((r) => r.status === 201), "a store with no plan at all can still add as many tables as it likes (7 here)");
  await plansCol().insertOne({ name: "Legacy", custom: false, limits: { maxUsers: 5, multiOutlet: false, maxOutlets: 1 }, entitlements: { features: ["takeaway"], effects: [], qrCardFamilies: [] }, marketing: {}, archived: false, createdAt: new Date(), updatedAt: new Date() });
  const legacy = await plansCol().findOne({ name: "Legacy" });
  await call("PATCH", `/api/platform/stores/${old.brand}/plan`, { cookie: old.su, body: { planId: String(legacy._id) } });
  const more = await addTable(old.owner, old.outlet, "N8");
  ok(more.status === 201, "…and so can a store on a plan saved before tables had a limit");

  say("6. The Custom plan");
  const custom = (await mk({ name: "Custom plan", custom: true })).json.plan;
  await call("PATCH", `/api/platform/stores/${old.brand}/plan`, { cookie: old.su, body: { planId: custom.id } });
  const c3 = (await call("GET", `/api/platform/stores/${old.brand}`, { cookie: old.su })).json;
  const oc = c3.store ?? c3;
  ok(oc.limits.maxTables === 10, "a store with 8 tables put on Custom gets a limit that holds them, in fives (8 → 10)", String(oc.limits.maxTables));
  const addMore = await Promise.all([1, 2, 3].map((n) => addTable(old.owner, old.outlet, `M${n}`)));
  // (all three are sent in the same instant: exactly two may get in — which two is up to the server)
  ok(addMore.filter((r) => r.status === 201).length === 2 && addMore.filter((r) => r.status === 409).length === 1, "…so it has room for two more and then stops — even when three are added at the very same moment", addMore.map((r) => r.status).join(","));
  ok((await t.raw("tables").countDocuments({ brandId: old.brand })) === 10, "…and exactly 10 tables exist afterwards (the one that didn't fit was taken back out)");
  const fresh = await t.makeStore({ slug: "fresh", ownerEmail: "o@fresh.test", outlets: 1 });
  await call("PATCH", `/api/platform/stores/${fresh.brand}/plan`, { cookie: fresh.su, body: { planId: custom.id } });
  const f = (await call("GET", `/api/platform/stores/${fresh.brand}`, { cookie: fresh.su })).json;
  ok((f.store ?? f).limits.maxTables === 5, "a store with no tables put on Custom starts at 5 (the smallest size)", String((f.store ?? f).limits.maxTables));
  await call("PATCH", `/api/platform/stores/${fresh.brand}/plan`, { cookie: fresh.su, body: { planId: custom.id, overrides: { limits: { maxTables: 15 } } } });
  const f2 = (await call("GET", `/api/platform/stores/${fresh.brand}`, { cookie: fresh.su })).json;
  ok((f2.store ?? f2).limits.maxTables === 15, "…and the number set by hand is kept (15)");

  say("7. The onboarding form: plan fit");
  const planDocs = [
    { id: "starter", name: "Starter", custom: false, limits: starter.limits, entitlements: starter.entitlements, marketing: { monthly: 799 } },
    { id: "business", name: "Business", custom: false, limits: business.limits, entitlements: business.entitlements, marketing: { monthly: 2499 } },
    { id: "custom", name: "Custom", custom: true, limits: {}, entitlements: {}, marketing: {} },
  ];
  const form = (planId, tableCount, customLimits = {}, forced = []) => {
    const d = S.onboardingSchema.parse({ planId, setup: { tableCount }, customLimits, forced });
    d.outlets = [S.newOnboardingOutlet()];
    return d;
  };
  const fit = (planId, tableCount, customLimits, forced) => { const plan = planDocs.find((p) => p.id === planId); const d = form(planId, tableCount, customLimits, forced); const allow = S.planAllowances(plan, d); return { d, plan, allow, fit: S.planFit(d, allow), over: S.forcedOverrides(d, allow) }; };
  const a1 = fit("starter", 5);
  ok(a1.allow.maxTables === 5 && !a1.fit.issues.some((i) => i.kind === "tables") && a1.over.limits.maxTables === undefined, "Starter with 5 tables: fine, nothing to add");
  const a2 = fit("starter", 12);
  ok(a2.fit.issues.some((i) => i.kind === "tables") && a2.fit.blocking && /allows 5 tables and this form has 12/.test(a2.fit.issues.find((i) => i.kind === "tables").message), "Starter with 12 tables: an issue in plain words, and it blocks publishing");
  const a3 = fit("starter", 12, {}, ["tables"]);
  ok(!a3.fit.blocking && a3.over.limits.maxTables === 15, "…'add for this client' lets it through, and the store is published with 15 tables (12 rounded up to the next five)", String(a3.over.limits.maxTables));
  const a4 = fit("business", 20);
  const a5 = fit("business", 25);
  ok(!a4.fit.issues.some((i) => i.kind === "tables") && a5.fit.issues.some((i) => i.kind === "tables"), "Business allows 20 tables, not 25");
  ok(!fit("starter", 0).fit.issues.some((i) => i.kind === "tables"), "'0 tables' (takeaway only, or not decided) never raises an issue");
  const a6 = fit("custom", 12, { maxTables: 5 });
  ok(a6.allow.maxTables === 15 && a6.over.limits.maxTables === 15, "Custom: the store gets what was asked for, rounded up to fives (12 → 15) even when the typed limit was lower", String(a6.allow.maxTables));
  const a7 = fit("custom", 0, { maxTables: 30 });
  ok(a7.over.limits.maxTables === 30, "Custom: the limit typed for the client (30) is what the store is published with");
  const savedBefore = S.onboardingSchema.parse({ planId: "starter", setup: { teamCount: 2 } });
  ok(savedBefore.setup.tableCount === 0 && savedBefore.customLimits.maxTables === 5, "a form saved before tables existed opens fine (0 tables; Custom starts at 5)");
  // the published store really gets the limit: the same overrides, applied through the console
  const pubStore = await t.makeStore({ slug: "pub", ownerEmail: "o@pub.test", outlets: 1 });
  const starterDoc = await plansCol().insertOne({ name: "Starter2", custom: false, limits: starter.limits, entitlements: starter.entitlements, marketing: {}, archived: false, createdAt: new Date(), updatedAt: new Date() });
  const pub = await call("PATCH", `/api/platform/stores/${pubStore.brand}/plan`, { cookie: pubStore.su, body: { planId: String(starterDoc.insertedId), overrides: a3.over } });
  const pubGot = (await call("GET", `/api/platform/stores/${pubStore.brand}`, { cookie: pubStore.su })).json;
  ok(pub.status === 200 && (pubGot.store ?? pubGot).limits.maxTables === 15, "applying those overrides to a Starter store gives it 15 tables", `${pub.status} ${(pubGot.store ?? pubGot).limits.maxTables}`);

  say("8. The price: per block of 5 tables");
  const price = (planId, tableCount, customLimits, pricing) => { const { d, plan } = fit(planId, tableCount, customLimits); return S.estimatePrice({ data: d, plan, plans: planDocs, pricing }); };
  const line = (e) => e.lines.find((l) => /tables/i.test(l.label) && /block/.test(l.label));
  ok(S.resolvePricing({}).extraTables === 100, "the price list starts with ₹100 for every 5 extra tables");
  const p1 = price("starter", 5);
  ok(!line(p1) && p1.net === 799, "Starter with 5 tables: just the plan's price (₹799)", String(p1.net));
  const p2 = price("starter", 15);
  ok(line(p2)?.amount === 200 && p2.net === 999, "Starter with 15 tables: two more blocks of 5 × ₹100 = ₹200 on top (₹999)", `${line(p2)?.amount} ${p2.net}`);
  const p3 = price("starter", 12);
  ok(line(p3)?.amount === 200, "12 tables are charged as 15: the price is always by the block of 5", String(line(p3)?.amount));
  const p4 = price("starter", 12, {}, { extraTables: 150 });
  ok(line(p4)?.amount === 300, "the price per block is the one on the Price list page (₹150 → ₹300)", String(line(p4)?.amount));
  const p5 = price("business", 25);
  ok(line(p5)?.amount === 100 && p5.net === 2599, "Business with 25 tables: one block of 5 beyond its 20 (₹2,599)", `${line(p5)?.amount} ${p5.net}`);
  const p6 = price("custom", 30, { maxTables: 30 });
  ok(line(p6)?.amount === 200 && /20 tables/.test(p6.lines[0].label), "Custom starts from the dearest plan (20 tables) and charges the blocks beyond it (30 → ₹200)", `${line(p6)?.amount} | ${p6.lines[0].label}`);
  const p7 = price("custom", 10, { maxTables: 10 });
  ok(!line(p7), "Custom with 10 tables is inside what the dearest plan already has — nothing added");
  const fits = price("starter", 15).fits.map((f) => f.name);
  ok(fits.length === 1 && fits[0] === "Business", "'what else would do' knows tables: 15 tables don't fit Starter but fit Business", fits.join(","));
  const step = S.priceSteps(planDocs, {})[0];
  ok(step.tables === 15 && step.rateCard >= 3 * 100, "the 'do the prices add up' page counts the 15 extra tables a plan adds (3 blocks)", `tables ${step.tables}, rate card ${step.rateCard}`);
});
