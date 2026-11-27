// The dashboard and who may see what: every widget needs a permission (and some a plan feature), the numbers a person is SENT are only those behind
// widgets they may see, the three new widgets (deliveries, bookings, rating), and the Indian-day boundary. No browser — a private API, in-memory database.
import { startApi } from "./_api-harness.mjs";

const t = await startApi(3122);
const { call, ok, say } = t;
const S = await import(`${t.REPO}/packages/config-schema/src/index.js`);
const mk = (cookie, body) => call("POST", "/api/platform/plans", { cookie, body });

const IST = 5.5 * 3_600_000;
const ist = new Date(Date.now() + IST);
const today0 = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST; // midnight in India today, as an instant
const dayOf = (ms) => new Date(ms + IST).toISOString().slice(0, 10);

await t.run(async () => {
  say("1. The rules");
  const ids = S.DASHBOARD_WIDGET_IDS;
  const perms = new Set(S.ROLES.flatMap((r) => S.permissionsForRole(r)));
  ok(ids.length === 20 && ids.every((id) => S.DASHBOARD_WIDGET_CATALOG[id]), "20 widgets, every one in the catalogue", String(ids.length));
  ok(ids.every((id) => perms.has(S.DASHBOARD_WIDGET_CATALOG[id].requires.permission)), "every widget names a permission that really exists");
  ok(ids.every((id) => { const m = S.DASHBOARD_WIDGET_CATALOG[id]; return !m.requires.feature || S.FEATURE_KEYS.includes(m.requires.feature); }), "…and a plan feature that really exists, when it names one");
  ok(ids.every((id) => S.DASHBOARD_WIDGET_CATALOG[id].defaultRoles.every((r) => S.permissionsForRole(r).includes(S.DASHBOARD_WIDGET_CATALOG[id].requires.permission))), "no widget is shown BY DEFAULT to a role that may not read its numbers");
  ok(!S.DASHBOARD_ROLES.includes("editor") && ["super_admin", "owner", "manager", "staff", "kitchen", "accountant"].every((r) => S.DASHBOARD_ROLES.includes(r)), "the roles that have a dashboard are those who can read orders (the content editor has none)", S.DASHBOARD_ROLES.join(","));
  const a = (id, role, f) => S.widgetAvailability(id, role, f);
  ok(!a("revenue-today", "kitchen").ok && a("revenue-today", "kitchen").reason === "permission" && a("revenue-today", "kitchen").need === "analytics:read", "the kitchen can't be given Revenue (it needs Reports)");
  ok(a("revenue-today", "accountant").ok && a("revenue-today", "owner").ok && !a("revenue-today", "staff").ok, "…the accountant and owner can; a cashier can't");
  ok(!a("bookings-today", "accountant").ok && a("bookings-today", "staff").ok, "bookings: a cashier yes, the accountant no (no access to Bookings)");
  ok(a("deliveries-active", "owner", ["takeaway"]).reason === "plan" && a("deliveries-active", "owner", ["delivery"]).ok && a("deliveries-active", "owner").ok, "a plan without Delivery can't have the deliveries widget; asking only about the role leaves the plan out");
  ok(!a("revenue-today", "editor").ok && !a("revenue-today", null).ok, "no role / the editor: nothing");
  const all = S.recommendedDashboardWidgets();
  ok(all.length === 20 && all.every((w) => w.enabled), "the recommended dashboard has every widget on");
  const stale = { widgets: all.map((w) => (w.id === "revenue-today" ? { ...w, roles: [...w.roles, "kitchen", "staff"] } : w)) };
  ok(!S.visibleWidgetsFor(stale, "kitchen").some((w) => w.id === "revenue-today") && S.visibleWidgetsFor(stale, "owner").some((w) => w.id === "revenue-today"), "a tick left on a role that may not read the numbers shows nothing (the permission wins over the tick)");
  const off = { widgets: all.map((w) => (w.id === "orders-today" ? { ...w, enabled: false } : w)) };
  ok(!S.visibleWidgetsFor(off, "owner").some((w) => w.id === "orders-today") && !S.visibleWidgetsFor(off, "super_admin").some((w) => w.id === "orders-today") && S.visibleWidgetsFor(off, "super_admin").length === 19, "a widget switched off is gone for everyone, the platform's super admin included — who otherwise sees every enabled widget");
  const kitchenDefaults = ids.filter((id) => S.DASHBOARD_WIDGET_CATALOG[id].defaultRoles.includes("kitchen")).length;
  ok(kitchenDefaults > 0 && S.visibleWidgetsFor({ widgets: [] }, "kitchen").length === kitchenDefaults, "a dashboard with nothing saved shows each role the widgets it is a default for (a store's saved list is only ever added to)", String(kitchenDefaults));

  say("2. Two stores: the full plan and a small one");
  const s = await t.makeStore({ slug: "dash", ownerEmail: "o@dash.test" });
  const fullPlan = (await mk(s.su, { name: "Full", entitlements: { allFeatures: true } })).json.plan;
  const miniPlan = (await mk(s.su, { name: "Mini", entitlements: { features: ["takeaway", "coupons"] } })).json.plan;
  await call("PATCH", `/api/platform/stores/${s.brand}/plan`, { cookie: s.su, body: { planId: fullPlan.id } });
  const m = await t.makeStore({ slug: "mini", ownerEmail: "o@mini.test" });
  await call("PATCH", `/api/platform/stores/${m.brand}/plan`, { cookie: m.su, body: { planId: miniPlan.id } });
  const team = {};
  for (const [role, email, pw] of [["manager", "m@dash.test", "Manager123!"], ["staff", "s@dash.test", "Staff1234!"], ["kitchen", "k@dash.test", "Kitchen123!"], ["accountant", "a@dash.test", "Account123!"], ["editor", "e@dash.test", "Editor1234!"]]) {
    const r = await call("POST", "/api/users", { cookie: s.owner, headers: { "x-rasoipulse-brand": s.brand }, body: { email, name: role, password: pw, role } });
    team[role] = await t.cookieLogin(email, pw);
    if (r.status !== 201) ok(false, `could not create the ${role}`, `${r.status} ${r.json.error}`);
  }

  const seed = async (store) => {
    const base = { brandId: store.brand, outletId: store.outlet, customer: { name: "Asha" }, channel: "takeaway", status: "completed", lines: [{ name: "Veg Momos", quantity: 2, lineTotal: 20000 }], totals: { grandTotal: 20000 }, payment: { status: "paid", gateway: "cod" } };
    const at = (ms) => ({ createdAt: new Date(ms), updatedAt: new Date(ms) });
    await t.db.OrderModel.collection.insertMany([
      { ...base, orderNumber: 1, ...at(today0 + 60_000) }, // a minute into India's day: counts for TODAY (and hour 0)
      { ...base, orderNumber: 2, channel: "dine-in", lines: [{ name: "Paneer Momos", quantity: 3, lineTotal: 30000 }], totals: { grandTotal: 30000 }, ...at(today0 + 2 * 3_600_000) },
      { ...base, orderNumber: 3, status: "placed", payment: { status: "pending", gateway: "cod" }, ...at(today0 + 3 * 3_600_000) },
      { ...base, orderNumber: 4, status: "completed", totals: { grandTotal: 40000 }, ...at(today0 - 3 * 3_600_000) }, // yesterday evening
      { ...base, orderNumber: 5, channel: "delivery", status: "ready", payment: { status: "pending", gateway: "cod" }, ...at(today0 + 4 * 3_600_000) },
      { ...base, orderNumber: 6, channel: "delivery", status: "out_for_delivery", payment: { status: "pending", gateway: "cod" }, ...at(today0 + 5 * 3_600_000) },
      { ...base, orderNumber: 7, ...at(today0 - 60_000) }, // a minute BEFORE India's day began: yesterday
    ]);
    await t.db.ReservationModel.collection.insertMany([
      { brandId: store.brand, outletId: store.outlet, code: "B1", name: "A", phone: "1", partySize: 2, status: "requested", at: new Date(today0 + 19 * 3_600_000), createdAt: new Date(), updatedAt: new Date() },
      { brandId: store.brand, outletId: store.outlet, code: "B2", name: "B", phone: "2", partySize: 2, status: "confirmed", at: new Date(today0 + 20 * 3_600_000), createdAt: new Date(), updatedAt: new Date() },
      { brandId: store.brand, outletId: store.outlet, code: "B3", name: "C", phone: "3", partySize: 2, status: "completed", at: new Date(today0 + 12 * 3_600_000), createdAt: new Date(), updatedAt: new Date() },
      { brandId: store.brand, outletId: store.outlet, code: "B4", name: "D", phone: "4", partySize: 2, status: "requested", at: new Date(today0 + 30 * 3_600_000), createdAt: new Date(), updatedAt: new Date() }, // tomorrow
    ]);
    const rate = (rating, ago) => ({ brandId: store.brand, outletId: store.outlet, rating, createdAt: new Date(Date.now() - ago * 86_400_000), updatedAt: new Date() });
    await t.db.FeedbackModel.collection.insertMany([rate(5, 1), rate(4, 2), rate(3, 3), rate(1, 40)]); // the 1-star is 40 days old: outside the 30
  };
  await seed(s);
  await seed(m);
  const stats = async (cookie, store = s) => { const r = await call("GET", "/api/dashboard/stats", { cookie, headers: { "x-rasoipulse-outlet": store.outlet } }); return { status: r.status, d: r.json }; };

  say("3. What each role is SENT");
  const own = await stats(s.owner);
  ok(own.status === 200 && own.d.today.orders === 5, "the owner's 'orders today' counts today's five (not the two from before India's midnight)", String(own.d.today.orders));
  ok(own.d.today.revenue === 50000, "…revenue today is ₹500 (two paid orders; the unpaid and the delivery ones aren't paid)", String(own.d.today.revenue));
  ok(own.d.today.revenueYesterday === 60000, "…and yesterday's ₹600 (₹400 + the ₹200 order one minute before midnight) is there for 'compared with yesterday'", String(own.d.today.revenueYesterday));
  ok(own.d.revenueTrend.length === 14 && own.d.revenueTrend[13].date === dayOf(today0) && own.d.revenueTrend[13].revenue === 50000 && own.d.revenueTrend[12].date === dayOf(today0 - 86_400_000) && own.d.revenueTrend[12].revenue === 60000, "the 14-day trend's last day is TODAY in India (right date, right money), the day before it is yesterday", `${own.d.revenueTrend[13].date} ${own.d.revenueTrend[13].revenue} / ${own.d.revenueTrend[12].date} ${own.d.revenueTrend[12].revenue}`);
  ok(own.d.ordersByHour.length === 24 && own.d.ordersByHour[0].count === 1 && own.d.ordersByHour[2].count === 1, "the hour chart agrees with India's clock: the order a minute past midnight is in hour 0", own.d.ordersByHour.slice(0, 6).map((h) => h.count).join(","));
  ok(own.d.today.deliveriesOut === 1 && own.d.today.deliveriesWaiting === 1, "deliveries: 1 on its way, 1 ready and waiting for a rider", `${own.d.today.deliveriesOut}/${own.d.today.deliveriesWaiting}`);
  ok(own.d.today.bookings === 3 && own.d.today.bookingsAwaiting === 1 && own.d.today.bookingsActive === 2, "bookings: 3 today (tomorrow's is left out), 1 waiting for a yes, 2 still to come", `${own.d.today.bookings}/${own.d.today.bookingsAwaiting}/${own.d.today.bookingsActive}`);
  ok(own.d.today.ratingCount === 3 && own.d.today.ratingAverage === 4, "rating: 4.0 from 3 ratings (the 40-day-old 1-star is outside the 30 days)", `${own.d.today.ratingAverage} / ${own.d.today.ratingCount}`);
  ok(own.d.topItems.length > 0 && own.d.recentOrders.length > 0 && own.d.ordersByChannel.length > 0, "the owner also gets the charts and lists");

  const mgr = await stats(team.manager);
  ok(mgr.d.today.revenue === 50000 && mgr.d.today.ratingCount === 3, "a manager gets the same");
  const kit = await stats(team.kitchen);
  ok(kit.status === 200 && kit.d.today.revenue === 0 && kit.d.today.avgOrderValue === 0 && kit.d.revenueTrend.length === 0, "the KITCHEN is sent no revenue, no average and no trend — even though paid orders exist (the numbers are never computed for them)", `revenue ${kit.d.today.revenue}, trend ${kit.d.revenueTrend.length}`);
  ok(kit.d.today.orders === 5 && kit.d.today.activeQueue === 1 && kit.d.ordersByStatus.length > 0 && kit.d.recentOrders.length > 0, "…but gets what a kitchen needs: today's orders, the queue, orders by status, recent orders", `${kit.d.today.orders}/${kit.d.today.activeQueue}`);
  ok(kit.d.today.newCustomers === 0 && kit.d.today.coinsIssued === 0 && kit.d.today.ratingCount === 0 && kit.d.today.bookings === 0, "…nothing about customers, coins, ratings or bookings (it has no access to those pages)");
  ok(kit.d.today.deliveriesOut === 1, "…and the deliveries on their way (the kitchen hands them over)");
  const stf = await stats(team.staff);
  ok(stf.d.today.revenue === 0 && stf.d.today.activeQueue === 1 && stf.d.today.bookings === 3, "a cashier: no revenue, the queue, and the bookings (they take them)", `${stf.d.today.revenue}/${stf.d.today.activeQueue}/${stf.d.today.bookings}`);
  const acc = await stats(team.accountant);
  ok(acc.d.today.revenue === 50000 && acc.d.revenueTrend.length === 14 && acc.d.today.bookings === 0, "the accountant: the money and the trend, no bookings", `${acc.d.today.revenue}/${acc.d.revenueTrend.length}/${acc.d.today.bookings}`);
  ok(acc.d.recentOrders.length === 0 && acc.d.topItems.length === 0 && acc.d.ordersByHour.length === 24, "…and only the lists and charts that were set for the accountant (no recent orders or top items by default, the hour chart yes)");
  const ed = await stats(team.editor);
  ok(ed.status === 403, "the content editor has no dashboard at all (403)", String(ed.status));
  const sup = await stats(s.su);
  ok(sup.d.today.revenue === 50000 && sup.d.today.ratingCount === 3, "the platform's super admin sees everything that is switched on");

  say("4. The plan");
  const mini = await stats(m.owner, m);
  ok(mini.d.today.orders === 5 && mini.d.today.revenue === 50000, "on the small plan the owner still gets orders and revenue");
  ok(mini.d.today.deliveriesOut === 0 && mini.d.today.deliveriesWaiting === 0, "…but nothing about deliveries (no Delivery in the plan), though delivery orders exist");
  ok(mini.d.today.bookings === 0 && mini.d.today.ratingCount === 0 && mini.d.today.coinsIssued === 0, "…nothing about bookings or ratings (no Table reservations / Ratings in the plan)");
  await call("PATCH", `/api/platform/stores/${m.brand}/plan`, { cookie: m.su, body: { planId: miniPlan.id, overrides: { entitlements: { features: { unlock: ["delivery", "onlinePayments"], lock: [] } } } } });
  const unlocked = await stats(m.owner, m);
  ok(unlocked.d.today.deliveriesOut === 1, "unlock Delivery for that one store and its deliveries appear at once", String(unlocked.d.today.deliveriesOut));

  say("5. The owner's own choices");
  const putWidgets = (cookie, store, widgets) => call("PATCH", `/api/outlets/${store.outlet}/config`, { cookie, headers: { "x-rasoipulse-outlet": store.outlet }, body: { dashboard: { widgets } } });
  const recommended = S.recommendedDashboardWidgets();
  const without = (ids) => recommended.map((w) => (ids.includes(w.id) ? { ...w, enabled: false } : w));
  const r1 = await putWidgets(s.owner, s, without(["revenue-today", "avg-order-value-today", "revenue-trend"]));
  ok(r1.status === 200, "the owner switches Revenue, Average and the trend off", String(r1.status));
  const own2 = await stats(s.owner);
  ok(own2.d.today.revenue === 0 && own2.d.revenueTrend.length === 0 && own2.d.today.orders === 5, "…and the server stops computing them (revenue 0, no trend) while the rest still comes", `${own2.d.today.revenue}/${own2.d.revenueTrend.length}/${own2.d.today.orders}`);
  const r2 = await putWidgets(s.owner, s, recommended.map((w) => (w.id === "revenue-today" ? { ...w, roles: [...w.roles, "kitchen", "staff"] } : w)));
  const kit2 = await stats(team.kitchen);
  const stf2 = await stats(team.staff);
  ok(r2.status === 200 && kit2.d.today.revenue === 0 && stf2.d.today.revenue === 0, "ticking Revenue for the kitchen and a cashier changes nothing: the permission still wins (they are sent 0)", `${kit2.d.today.revenue}/${stf2.d.today.revenue}`);
  const only = recommended.map((w) => ({ ...w, roles: w.id === "orders-today" ? ["owner"] : w.roles }));
  await putWidgets(s.owner, s, only);
  const kit3 = await stats(team.kitchen);
  const own3 = await stats(s.owner);
  ok(kit3.d.today.orders === 0 && own3.d.today.orders === 5, "taking the kitchen off 'Orders today' stops them being sent it, the owner still gets it", `${kit3.d.today.orders}/${own3.d.today.orders}`);
  await putWidgets(s.owner, s, recommended.map((w) => ({ ...w, enabled: false })));
  const none = await stats(s.owner);
  ok(none.status === 200 && none.d.today.orders === 0 && none.d.today.revenue === 0 && none.d.recentOrders.length === 0 && none.d.revenueTrend.length === 0, "with every widget off, nothing is computed or sent — and the call still answers 200");
  await putWidgets(s.owner, s, recommended);
  const back = await stats(s.owner);
  ok(back.d.today.revenue === 50000 && back.d.today.orders === 5, "back to the recommended dashboard, everything is there again");

  say("6. A store saved before the new widgets existed");
  const oldWidgets = recommended.filter((w) => !["deliveries-active", "bookings-today", "customer-rating"].includes(w.id));
  const saved = await putWidgets(s.owner, s, oldWidgets);
  const stored = (await call("GET", "/api/outlets", { cookie: s.owner })).json.outlets.find((x) => String(x._id ?? x.id) === s.outlet);
  ok(saved.status === 200 && stored.config.dashboard.widgets.length === 17, "a dashboard saved with only the 17 older widgets is accepted and stored as it is", `${saved.status} ${stored?.config?.dashboard?.widgets?.length}`);
  const old = await stats(s.owner);
  ok(old.d.today.deliveriesOut === 1 && old.d.today.bookings === 3 && old.d.today.ratingCount === 3, "…and the three newest widgets still arrive for it, with their defaults (nobody has to re-save Settings to get them)", `${old.d.today.deliveriesOut}/${old.d.today.bookings}/${old.d.today.ratingCount}`);
  const resolved = S.resolveDashboardWidgets({ widgets: oldWidgets });
  ok(resolved.length === 20 && resolved.slice(-3).map((w) => w.id).join() === "deliveries-active,bookings-today,customer-rating", "they are appended in their catalogue order");
});
