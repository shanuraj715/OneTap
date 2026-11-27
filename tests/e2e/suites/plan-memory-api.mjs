// A store's settings are kept PER PLAN. When it leaves a plan, what it had set up there (limits set by hand, features unlocked or locked) is saved;
// when it comes back to a plan it had before, that is restored; a plan it never had starts clean. No browser — a private API, in-memory database.
import { startApi } from "./_api-harness.mjs";

const t = await startApi(3122);
const { call, ok, say } = t;

await t.run(async () => {
  const s = await t.makeStore({ slug: "acme", ownerEmail: "o@acme.test", outlets: 1 });
  const mk = (body) => call("POST", "/api/platform/plans", { cookie: s.su, body });
  const pro = (await mk({ name: "Pro", limits: { maxUsers: 10, multiOutlet: true, maxOutlets: 3, maxTables: 20 }, entitlements: { features: ["takeaway", "dineInQr", "coupons"] } })).json.plan;
  const basic = (await mk({ name: "Basic", limits: { maxUsers: 3, multiOutlet: false, maxOutlets: 1, maxTables: 5 }, entitlements: { features: ["takeaway"] } })).json.plan;
  const custom = (await mk({ name: "Custom", custom: true })).json.plan;
  const patch = (body) => call("PATCH", `/api/platform/stores/${s.brand}/plan`, { cookie: s.su, body });
  const store = async () => (await call("GET", `/api/platform/stores/${s.brand}`, { cookie: s.su })).json.store;

  say("1. A Custom plan with hand-set limits and unlocked features");
  const customSettings = { limits: { maxUsers: 12, multiOutlet: true, maxOutlets: 7, maxTables: 40 }, entitlements: { features: { unlock: ["marketing", "delivery"], lock: [] } } };
  const r1 = await patch({ planId: custom.id, overrides: customSettings });
  ok(r1.status === 200 && r1.json.store.plan.id === custom.id, "the store is put on the Custom plan with its own limits and features");
  ok(r1.json.store.overrides.limits.maxOutlets === 7 && r1.json.store.overrides.entitlements.features.unlock.includes("marketing"), "…and holds them");
  ok(r1.json.planChange.from === null || r1.json.planChange.to === custom.id, "the answer says what changed (planChange)", JSON.stringify(r1.json.planChange).slice(0, 120));

  say("2. It moves to Pro: the Custom settings are put away, Pro starts clean");
  const r2 = await patch({ planId: pro.id });
  ok(r2.status === 200 && r2.json.store.plan.id === pro.id, "moved to Pro");
  ok(r2.json.planChange.savedPrevious === true && r2.json.planChange.clearedOnNewPlan === true && r2.json.planChange.restored === false, "planChange says: the Custom settings were saved, Pro started clean, nothing restored", JSON.stringify(r2.json.planChange));
  ok(Object.keys(r2.json.store.overrides.limits).length === 0 && r2.json.store.limits.maxOutlets === 3 && r2.json.store.limits.maxUsers === 10, "Pro's own limits apply (3 outlets, 10 people) — the 7 outlets of Custom did NOT carry over", `${r2.json.store.limits.maxOutlets}/${r2.json.store.limits.maxUsers}`);
  ok(!r2.json.store.entitlements.features.includes("marketing") && !r2.json.store.entitlements.features.includes("delivery"), "…and the features unlocked on Custom are not on Pro");
  const h2 = r2.json.store.planHistory.find((h) => h.planId === custom.id);
  ok(h2 && h2.planName === "Custom" && h2.saved.limits.maxOutlets === 7 && h2.saved.unlocked.includes("marketing") && h2.leftAt, "the store's page lists Custom among the plans it has left, with what it had (7 outlets, marketing …)", JSON.stringify(h2?.saved));

  say("3. Months later: back to Custom — the old settings come back by themselves");
  const r3 = await patch({ planId: custom.id });
  ok(r3.json.planChange.restored === true && r3.json.planChange.restoredFrom.planName === "Custom" && r3.json.planChange.restoredFrom.saved.limits.maxOutlets === 7, "planChange says the Custom settings were restored", JSON.stringify(r3.json.planChange.restoredFrom?.saved));
  ok(r3.json.store.limits.maxOutlets === 7 && r3.json.store.limits.maxUsers === 12 && r3.json.store.limits.maxTables === 40, "the old limits are back (7 outlets, 12 people, 40 tables)", JSON.stringify(r3.json.store.limits));
  ok(r3.json.store.entitlements.features.includes("marketing") && r3.json.store.entitlements.features.includes("delivery"), "…and the old features (marketing, delivery)");
  ok(JSON.stringify(r3.json.store.overrides) === JSON.stringify(r1.json.store.overrides), "the stored settings are exactly what they were before it left");

  say("4. Another plan it never had starts clean, and the first one is still remembered");
  const r4 = await patch({ planId: basic.id });
  ok(r4.json.planChange.restored === false && r4.json.store.limits.maxOutlets === 1 && Object.keys(r4.json.store.overrides.limits).length === 0, "Basic (never had) starts clean: its own 1 outlet");
  ok(r4.json.store.planHistory.some((h) => h.planId === custom.id) && r4.json.store.planHistory.some((h) => h.planId === pro.id), "…Custom and Pro are both remembered now");
  const r5 = await patch({ planId: pro.id });
  ok(r5.json.planChange.restored === false && r5.json.planChange.restoredFrom && r5.json.planChange.restoredFrom.saved.empty === true, "going back to Pro restores Pro's saved settings — there were none, so nothing is claimed as restored");

  say("5. Settings sent with the change always win");
  await patch({ planId: custom.id });
  await patch({ planId: pro.id });
  const explicit = { limits: {}, entitlements: { features: { unlock: ["wallet"], lock: [] } } };
  const r6 = await patch({ planId: custom.id, overrides: explicit });
  ok(r6.json.planChange.restored === false && r6.json.store.entitlements.features.includes("wallet") && !r6.json.store.entitlements.features.includes("marketing"), "overrides given in the same request replace what was saved (the admin chose them)");
  const r7 = await patch({ planId: pro.id });
  const savedCustom = r7.json.store.planHistory.find((h) => h.planId === custom.id);
  ok(savedCustom.saved.unlocked.includes("wallet") && !savedCustom.saved.unlocked.includes("marketing"), "…and it is those that are saved when it leaves again");

  say("5b. The console sends the settings itself (already filled in from the saved ones): still counts as restored");
  const sent = await patch({ planId: custom.id, overrides: savedCustom.overrides });
  ok(sent.json.planChange.restored === true && sent.json.store.entitlements.features.includes("wallet"), "same settings sent explicitly → planChange.restored is true (what the store ends up with decides)", JSON.stringify(sent.json.planChange.restored));
  const changed = await patch({ planId: pro.id });
  const edited = await patch({ planId: custom.id, overrides: { ...savedCustom.overrides, limits: { ...savedCustom.overrides.limits, maxUsers: 30 } } });
  ok(edited.json.planChange.restored === false && edited.json.store.limits.maxUsers === 30, "settings changed on the way (30 people instead) → NOT claimed as restored; the admin's choice is kept");
  await patch({ planId: pro.id });

  say("6. Things that are not a plan change");
  const same = await patch({ planId: pro.id, overrides: { limits: { maxUsers: 15 }, entitlements: {} } });
  ok(same.status === 200 && same.json.planChange === null && same.json.store.limits.maxUsers === 15, "changing only the settings on the same plan is not a plan change (planChange is null)");
  const none = await patch({ planId: null });
  ok(none.status === 200 && none.json.store.plan === null || none.json.store.plan?.id == null, "'No plan' (unlimited) is a plan too: leaving Pro saves its settings");
  ok(none.json.store.planHistory.find((h) => h.planId === pro.id)?.saved.limits.maxUsers === 15, "…Pro's settings (15 people) are kept");
  const back = await patch({ planId: pro.id });
  ok(back.json.store.limits.maxUsers === 15, "…and come back when it returns to Pro", String(back.json.store.limits.maxUsers));
  ok((await patch({ planId: "000000000000000000000000" })).status === 400, "an unknown plan is refused (400)");
  ok((await call("PATCH", `/api/platform/stores/${s.brand}/plan`, { cookie: s.owner, body: { planId: pro.id }, headers: { "x-rasoipulse-brand": s.brand } })).status === 403, "a store owner can't change plans (403)");
  const final = await store();
  ok(Array.isArray(final.planHistory) && final.planHistory.every((h) => h.planId && "saved" in h && "overrides" in h), "the store's page carries the history (plan, when it left, what it had, the raw settings)");
});
