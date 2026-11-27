// Rasoi Pulse's OWN sales: what the stores pay for their subscription (not the orders the stores take). The team writes each payment down
// (a store pays outside the app); the dashboard's business numbers are worked out from that list. No browser — a private API, in-memory database.
// The expected numbers are worked out HERE, independently, from the dates and amounts that were written down.
import { startApi } from "./_api-harness.mjs";

const t = await startApi(3132);
const { call, ok, say, raw } = t;

/* ---- independent date helpers (India calendar days) ---- */
const IST = 330 * 60_000;
const DAY = 86_400_000;
const istDay = (offsetDays = 0) => new Date(Date.now() + IST + offsetDays * DAY).toISOString().slice(0, 10);
const idx = (s) => { const [y, m, d] = s.split("-").map(Number); return Math.floor(Date.UTC(y, m - 1, d) / DAY); };
const weekIdx = (s) => Math.floor((idx(s) + 3) / 7); // weeks start on Monday
const monthIdx = (s) => { const [y, m] = s.split("-").map(Number); return y * 12 + m - 1; };
const today = istDay(0);
const sum = (list) => Math.round(list.reduce((a, b) => a + b, 0) * 100) / 100;
const near = (a, b, tol = 1) => Math.abs(idx(a) - idx(b)) <= tol; // month lengths differ by a day or three: compare days loosely

await t.run(async () => {
  const A = await t.makeStore({ slug: "acme", ownerEmail: "o@acme.test" });
  const su = A.su;
  const B = await t.makeStore({ slug: "beta", ownerEmail: "o@beta.test" });
  const C = await t.makeStore({ slug: "gamma", ownerEmail: "o@gamma.test" });
  const D = await t.makeStore({ slug: "delta", ownerEmail: "o@delta.test" });
  const E = await t.makeStore({ slug: "echo", ownerEmail: "o@echo.test" });
  const sa = (method, path, body) => call(method, `/api/platform${path}`, { cookie: su, body });
  const pay = (store, body, cookie = su) => call("POST", `/api/platform/stores/${store.brand}/payments`, { cookie, body });
  const plan = async (name, monthly, yearlyDiscount) => (await sa("POST", "/plans", { name, limits: { maxUsers: 5, multiOutlet: true, maxOutlets: 3, maxTables: 20 }, entitlements: { features: ["takeaway"] }, marketing: { monthly, yearlyDiscount } })).json.plan;
  const pro = await plan("Pro", 2499, 20);
  const basic = await plan("Basic", 999, 0);
  for (const s of [A, B, D]) await sa("PATCH", `/stores/${s.brand}/plan`, { planId: pro.id });
  await sa("PATCH", `/stores/${E.brand}/plan`, { planId: basic.id });

  say("1. The form's rules: a payment has to be sensible");
  const bad = async (body, label, status = 400) => { const r = await pay(A, body); ok(r.status === status, label, `${r.status} ${r.json.error ?? r.json.message ?? ""}`.slice(0, 120)); return r; };
  await bad({ amount: 0, paidOn: today, months: 1 }, "an amount of 0 is refused");
  await bad({ amount: -5, paidOn: today, months: 1 }, "a negative amount is refused");
  await bad({ amount: "lots", paidOn: today, months: 1 }, "an amount that is not a number is refused");
  await bad({ amount: 10.005, paidOn: today, months: 1 }, "more than two decimals (a fraction of a paisa) is refused");
  await bad({ amount: 99_999_999, paidOn: today, months: 1 }, "an absurd amount is refused");
  await bad({ amount: 100, paidOn: istDay(3), months: 1 }, "a payment dated in the future is refused (use the day the money arrived)");
  await bad({ amount: 100, paidOn: "2026-02-30", months: 1 }, "a day that does not exist is refused");
  await bad({ amount: 100, paidOn: "yesterday", months: 1 }, "a date that is not a date is refused");
  await bad({ amount: 100, paidOn: today, months: 0 }, "0 months is refused");
  await bad({ amount: 100, paidOn: today, months: 61 }, "more than 60 months is refused");
  await bad({ amount: 100, paidOn: today, months: 1.5 }, "half a month is refused");
  await bad({ amount: 100, paidOn: today, months: 1, planId: "000000000000000000000000" }, "a plan that does not exist is refused");
  await bad({ amount: 100, paidOn: today, months: 1, note: "x".repeat(201) }, "a very long note is refused");
  await bad({}, "an empty form is refused, with what to fix");
  const noStore = await call("POST", "/api/platform/stores/000000000000000000000000/payments", { cookie: su, body: { amount: 100, paidOn: today, months: 1 } });
  ok(noStore.status === 404, "a store that does not exist: 404");
  ok((await call("POST", "/api/platform/stores/not-an-id/payments", { cookie: su, body: { amount: 100, paidOn: today, months: 1 } })).status === 404, "a store id that is not an id: 404");
  ok((await call("GET", `/api/platform/stores/${A.brand}/payments`, { cookie: su })).json.payments.length === 0, "nothing was written by all those refused attempts");

  say("2. Writing payments down: the first is the new sale, later ones are re-subscriptions");
  const p1 = await pay(A, { amount: 2499, paidOn: istDay(-70), months: 1, note: "Bank transfer" });
  ok(p1.status === 201 && p1.json.payment.kind === "new" && p1.json.payment.amount === 2499 && p1.json.payment.months === 1, "A's first payment is written, and it is the NEW sale");
  ok(p1.json.payment.planName === "Pro" && p1.json.payment.storeName === "acme" && p1.json.payment.recordedBy === "Super" && p1.json.payment.note === "Bank transfer", "it keeps the plan (the store's current one), the store's name, who wrote it and the note");
  ok(p1.json.payment.paidOn === istDay(-70) && near(p1.json.payment.coversTo, istDay(-70 + 30), 3), "it says when it was paid and the last day it covers (about a month later)", `${p1.json.payment.paidOn} → ${p1.json.payment.coversTo}`);
  const dup = await pay(A, { amount: 2499, paidOn: istDay(-70), months: 1 });
  ok(dup.status === 409 && /already/.test(dup.json.error ?? dup.json.message ?? ""), "the same payment again (same store, day, amount — a double click) is refused (409)");
  await pay(A, { amount: 2499, paidOn: istDay(-10), months: 1 });
  const p3 = await pay(A, { amount: 2499, paidOn: istDay(-2), months: 1 });
  const listA = (await call("GET", `/api/platform/stores/${A.brand}/payments`, { cookie: su })).json;
  ok(listA.payments.length === 3 && listA.payments.map((p) => p.kind).join() === "renewal,renewal,new", "the list is newest first: renewal, renewal, new", listA.payments.map((p) => p.kind).join());
  const [third, second] = listA.payments;
  const secondEnds = istDay(idx(second.coversTo) - idx(today));
  ok(third.coversFrom === istDay(idx(second.coversTo) - idx(today) + 1), "an EARLY renewal carries on from where the last one ends — it does not waste the days still left", `${third.coversFrom} vs the day after ${second.coversTo}`);
  ok(near(third.coversTo, istDay(20 + 30), 4) && listA.standing.state === "active" && listA.standing.paidUntil === third.coversTo, "A is paid up until about 50 days from now", `${listA.standing.paidUntil}`);
  ok(listA.total === 7497, "the total A has paid is added up exactly", String(listA.total));
  ok(listA.suggest.planName === "Pro" && listA.suggest.monthly === 2499 && listA.suggest.yearly === 23990, "the form offers the plan's price to start from (monthly 2,499; yearly with the 20% off = 23,990)", JSON.stringify(listA.suggest));

  await pay(B, { amount: 999.5, paidOn: istDay(-20), months: 1 });
  const d1 = await pay(D, { amount: 1999.99, paidOn: istDay(-100), months: 1 });
  const d2 = await pay(D, { amount: 1000, paidOn: today, months: 1 });
  const e1 = await pay(E, { amount: 500, paidOn: istDay(-100), months: 1, planId: basic.id });
  ok(e1.status === 201 && e1.json.payment.planName === "Basic", "a plan can be chosen for the payment (Basic), whatever the store is on now");
  ok(d2.json.payment.kind === "renewal" && d2.json.payment.coversFrom === today, "D paid again today after running out: a re-subscription that starts today");
  const money = await pay(C, { amount: 0.07, paidOn: today, months: 1 });
  const money2 = await pay(C, { amount: 1999.99, paidOn: istDay(-1), months: 1 });
  const cl = (await call("GET", `/api/platform/stores/${C.brand}/payments`, { cookie: su })).json;
  ok(cl.total === 2000.06 && money.status === 201 && money2.status === 201, "amounts in paise add up exactly (0.07 + 1,999.99 = 2,000.06, no floating-point drift)", String(cl.total));
  // C is only used for that: take its payments off again so it stays "never paid"
  for (const p of cl.payments) ok((await call("DELETE", `/api/platform/stores/${C.brand}/payments/${p.id}`, { cookie: su })).status === 200, "a wrongly written payment is taken off the list");
  ok((await call("GET", `/api/platform/stores/${C.brand}/payments`, { cookie: su })).json.standing.state === "never", "…and the store is 'never paid' again");

  say("3. New or re-subscription is worked out from the DATES — late or deleted entries don't confuse it");
  const early = await pay(B, { amount: 999.5, paidOn: istDay(-60), months: 1 });
  let lb = (await call("GET", `/api/platform/stores/${B.brand}/payments`, { cookie: su })).json;
  ok(lb.payments.map((p) => p.kind).join() === "renewal,new" && lb.payments[1].paidOn === istDay(-60), "B's payment written LATER but dated EARLIER becomes the new sale; the one before it turns into a re-subscription");
  await call("DELETE", `/api/platform/stores/${B.brand}/payments/${early.json.payment.id}`, { cookie: su });
  lb = (await call("GET", `/api/platform/stores/${B.brand}/payments`, { cookie: su })).json;
  ok(lb.payments.length === 1 && lb.payments[0].kind === "new", "delete it again: the remaining payment is the new sale once more");
  ok((await call("DELETE", `/api/platform/stores/${A.brand}/payments/${lb.payments[0].id}`, { cookie: su })).status === 404, "a payment can't be deleted through another store's address (404)");
  ok((await call("DELETE", `/api/platform/stores/${B.brand}/payments/nope`, { cookie: su })).status === 404, "a payment id that is not an id: 404");

  say("4. The business numbers (the dashboard)");
  const rows = [
    { store: "acme", date: istDay(-70), amt: 2499, kind: "new" }, { store: "acme", date: istDay(-10), amt: 2499, kind: "renewal" }, { store: "acme", date: istDay(-2), amt: 2499, kind: "renewal" },
    { store: "beta", date: istDay(-20), amt: 999.5, kind: "new" },
    { store: "delta", date: istDay(-100), amt: 1999.99, kind: "new" }, { store: "delta", date: today, amt: 1000, kind: "renewal" },
    { store: "echo", date: istDay(-100), amt: 500, kind: "new" },
  ];
  const r = await sa("GET", "/business");
  const b = r.json;
  ok(r.status === 200, "the business numbers are served");
  ok(b.totals.sales === sum(rows.map((x) => x.amt)) && b.totals.payments === 7 && b.totals.shops === 4, "TOTAL SALES = everything stores have paid (11,996.49) over 7 payments from 4 shops", JSON.stringify(b.totals));
  const news = rows.filter((x) => x.kind === "new"), ren = rows.filter((x) => x.kind === "renewal");
  ok(b.newSales.shops === 4 && b.newSales.amount === sum(news.map((x) => x.amt)), "NEW SALES = shops that bought for the first time: 4 shops, 5,998.49", JSON.stringify(b.newSales));
  ok(b.renewals.payments === 3 && b.renewals.shops === 2 && b.renewals.amount === sum(ren.map((x) => x.amt)), "RE-SUBSCRIBED = later payments: 3 payments from 2 shops, 5,998", JSON.stringify(b.renewals));
  ok(b.totals.averagePerShop === Math.round((sum(rows.map((x) => x.amt)) / 4) * 100) / 100, "average per shop");
  const thisMonth = rows.filter((x) => x.date.slice(0, 7) === today.slice(0, 7));
  ok(b.month.sales === sum(thisMonth.map((x) => x.amt)) && b.month.newShops === thisMonth.filter((x) => x.kind === "new").length && b.month.renewals === thisMonth.filter((x) => x.kind === "renewal").length, "this month so far counts only payments dated this month, split into new and re-subscribed", JSON.stringify(b.month));
  ok(b.standing.active === 3 && b.standing.expired === 1 && b.standing.neverPaid === 1 && b.standing.expiringSoon === 1, "who is paid up (acme, beta, delta), who ran out (echo), who has no payment written down (gamma), who runs out within 14 days (beta)", JSON.stringify({ ...b.standing, neverPaidStores: undefined, expiredStores: undefined }));
  ok(b.standing.neverPaidStores.map((s) => s.name).join() === "gamma" && b.standing.expiredStores.map((s) => s.name).join() === "echo", "…and names them, so they can be followed up");
  ok(b.byPlan.find((p) => p.name === "Pro")?.activeShops === 3 && b.byPlan.find((p) => p.name === "Pro")?.amount === 11496.49 && b.byPlan.find((p) => p.name === "Basic")?.amount === 500, "by plan: Pro has 3 paying shops and 11,496.49 taken; Basic 500", JSON.stringify(b.byPlan));
  ok(b.recent.length === 7 && b.recent[0].paidOn === today && b.recent[0].storeName === "delta" && b.recent[0].kind === "renewal", "the latest payments, newest first, with the shop's name and new / re-subscription", `${b.recent.length} ${b.recent[0]?.storeName}`);
  ok(!("sales" in b) && !("topStores" in b) && !("channels" in b) && !JSON.stringify(b).includes("orders"), "it is the PRODUCT's business only: nothing about any store's orders or sales");
  const old = await sa("GET", "/dashboard");
  ok(old.status === 200 && old.json.sales && old.json.stores, "the existing dashboard numbers (the stores' own sales) are untouched");

  say("5. The charts: day, week and month, each against the period before, worked out again independently");
  const windowSum = (unit, back) => {
    const pick = { day: (s) => idx(today) - idx(s), week: (s) => weekIdx(today) - weekIdx(s), month: (s) => monthIdx(today) - monthIdx(s) }[unit];
    const n = unit === "day" ? 30 : 12;
    return sum(rows.filter((x) => { const k = pick(x.date); return back ? k >= n && k < 2 * n : k >= 0 && k < n; }).map((x) => x.amt));
  };
  for (const [unit, n] of [["day", 30], ["week", 12], ["month", 12]]) {
    const s = b.series[unit];
    ok(s.labels.length === n && s.current.length === n && s.previous.length === n && s.newAmount.length === n && s.renewalAmount.length === n && s.previousLabels.length === n, `${unit}: ${n} points in each line, and the same number in the period before`);
    ok(s.total === windowSum(unit, false) && s.previousTotal === windowSum(unit, true), `${unit}: this period ${s.total} and the one before ${s.previousTotal} match the payments`, `expected ${windowSum(unit, false)} / ${windowSum(unit, true)}`);
    ok(sum(s.current) === s.total && sum(s.previous) === s.previousTotal, `${unit}: the points add up to the totals`);
    ok(s.current.every((v, i) => sum([s.newAmount[i], s.renewalAmount[i]]) === v), `${unit}: in every point, new + re-subscribed = the whole`);
    ok(s.changePct === (s.previousTotal > 0 ? Math.round(((s.total - s.previousTotal) / s.previousTotal) * 1000) / 10 : null), `${unit}: the change against the period before is worked out (${s.changePct}%)`);
  }
  ok(b.series.day.current[29] === 1000 && b.series.day.renewalAmount[29] === 1000 && b.series.day.newAmount[29] === 0, "the last day on the day chart is today: 1,000 and it is a re-subscription");
  ok(b.series.day.dates[29] === today && b.series.day.labels.at(-1).split(" ")[0] === String(Number(today.slice(8))), "…labelled with today's date");
  ok(b.series.week.dates.every((d) => new Date(d + "T00:00:00Z").getUTCDay() === 1), "every point on the week chart starts on a Monday");
  ok(b.series.month.dates.every((d) => d.endsWith("-01")) && b.series.month.dates.at(-1) === `${today.slice(0, 7)}-01`, "every point on the month chart is a month, the last one this month");

  say("6. Who may see and write what");
  const PW = "Team2026Pass";
  const role = async (name, features) => (await sa("POST", "/roles", { name, features })).json.role;
  const member = async (name, email, roleId) => { await sa("POST", "/team", { name, email, password: PW, roleId }); return t.cookieLogin(email, PW); };
  const viewer = await member("Vera Viewer", "vera@rp.test", (await role("Viewer", ["dashboard:read"])).id);
  const reader = await member("Rick Reader", "rick@rp.test", (await role("Reader", ["stores:read"])).id);
  const manager = await member("Mia Manager", "mia@rp.test", (await role("Manager", ["stores:manage"])).id);
  const get = (cookie, p) => call("GET", `/api/platform${p}`, { cookie });
  ok((await get(viewer, "/business")).status === 200 && (await get(viewer, `/stores/${A.brand}/payments`)).status === 403, "dashboard access: sees the business numbers, but not a store's payment list");
  ok((await get(reader, `/stores/${A.brand}/payments`)).status === 200 && (await get(reader, "/business")).status === 403, "store-read access: sees a store's payment list, but not the business numbers");
  ok((await pay(A, { amount: 100, paidOn: today, months: 1 }, viewer)).status === 403 && (await pay(A, { amount: 100, paidOn: today, months: 1 }, reader)).status === 403, "neither of them can WRITE a payment (403)");
  ok((await call("DELETE", `/api/platform/stores/${A.brand}/payments/${third.id}`, { cookie: reader })).status === 403, "…or delete one (403)");
  const made = await pay(A, { amount: 300, paidOn: istDay(-5), months: 1, note: "by Mia" }, manager);
  ok(made.status === 201 && made.json.payment.recordedBy === "Mia Manager", "store-manage access can write one, and it says who did", made.json.payment?.recordedBy);
  ok((await call("DELETE", `/api/platform/stores/${A.brand}/payments/${made.json.payment.id}`, { cookie: manager })).status === 200, "…and delete one");
  ok((await call("GET", "/api/platform/business", { cookie: A.owner, headers: { "x-rasoipulse-brand": A.brand } })).status === 403 && (await call("GET", `/api/platform/stores/${A.brand}/payments`, { cookie: A.owner, headers: { "x-rasoipulse-brand": A.brand } })).status === 403, "a restaurant owner can't see any of it (403)");
  ok((await call("GET", "/api/platform/business")).status === 401 && (await call("POST", `/api/platform/stores/${A.brand}/payments`, { body: { amount: 1, paidOn: today, months: 1 } })).status === 401, "not signed in: 401");

  say("7. A deleted store's money stays in the sales figures");
  const before = await raw("subscriptionpayments").countDocuments();
  const del = await call("DELETE", `/api/platform/stores/${E.brand}`, { cookie: su, body: { confirmName: "echo" } });
  ok(del.status === 200, "the store 'echo' (which paid 500 once) is deleted", String(del.status) + " " + JSON.stringify(del.json).slice(0, 100));
  ok((await raw("subscriptionpayments").countDocuments()) === before && before === 7, "…its payment is still in the database (deleting a store must not erase Rasoi Pulse's sales history)");
  const after = (await sa("GET", "/business")).json;
  ok(after.totals.sales === b.totals.sales && after.newSales.shops === 4, "the totals did not change: total sales 11,996.49, 4 shops bought");
  const ghost = after.recent.find((p) => p.storeName === "echo");
  ok(ghost && ghost.storeDeleted === true, "the payment is still listed, with the shop's name as it was, marked as a deleted store");
  ok(after.standing.expired === 0, "…but a deleted store is no longer counted as 'ran out'");
});

t.finish();
