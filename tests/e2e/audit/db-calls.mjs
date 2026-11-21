// CACHE AUDIT — how many database operations does each API read cause the FIRST time and the SECOND time it is asked?
//   node audit/db-calls.mjs            (needs the bench running: node bench/bench.mjs reset)
// A read that is cached shows its database work only once; a read that must be live (an order's status, a table's
// state…) shows it every time. The bench API records the operations of every request that carries an x-audit header.
const API = "http://localhost:3097";
const REC = "http://127.0.0.1:3189/audit";
const login = async (email, password) => (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const owner = await login("o@acme.test", "Owner123!");
const sup = await login("super@sandbox.test", "Super123!");
const get = async (path, { cookie, outlet, label } = {}) => {
  const r = await fetch(API + path, { headers: { ...(cookie ? { cookie } : {}), ...(outlet ? { "x-onetap-outlet": outlet } : {}), "x-audit": label ?? path } });
  let json = null; try { json = await r.json(); } catch { /* not json */ }
  return { status: r.status, json };
};
const outlets = (await get("/api/outlets", { cookie: owner })).json;
const main = (outlets.outlets ?? outlets).find((o) => o.slug === "main");
const oid = String(main._id ?? main.id);
const host = main.hostnames?.[0] ?? "localhost:3170";
const tables = (await get("/api/tables", { cookie: owner, outlet: oid })).json.tables;
const table = tables[0];
const orders = (await get("/api/orders?limit=5", { cookie: owner, outlet: oid })).json.orders ?? [];
const order = orders[0];
const brandId = String(main.brandId);
const stores = (await get("/api/platform/stores", { cookie: sup })).json.stores;
const storeId = String(stores.find((s) => s.name === "Acme Momos").id);

const P = (path, who = "owner") => ({ path, who });
const routes = [
  // public / storefront reads
  ["public", P(`/api/outlets/resolve?host=${encodeURIComponent(host)}&slug=main`, "none")],
  ["public", P(`/api/outlets/for-host?host=${encodeURIComponent(host)}`, "none")],
  ["public", P(`/api/menu?outletId=${oid}`, "none")],
  ["public", P(`/api/pages/public?outletId=${oid}`, "none")],
  ["public", P(`/api/coupons/public?outletId=${oid}`, "none")],
  ["public", P(`/api/orders/capacity?outletId=${oid}`, "none")],
  ["public", P(`/api/orders/pickup-slots?outletId=${oid}`, "none")],
  ["public", P(`/api/payments/config?outletId=${oid}`, "none")],
  ["public", P(`/api/delivery/origin?outletId=${oid}`, "none")],
  ["public", P(`/api/site/settings`, "none")],
  ["public", P(`/api/site/links`, "none")],
  ["public", P(`/api/site/pricing`, "none")],
  ["public", P(`/api/site/pages`, "none")],
  // must be live
  ["live", P(`/api/tables/public?outletId=${oid}`, "none")],
  ["live", P(`/api/reservations/availability?outletId=${oid}&party=2`, "none")],
  ["live", order ? P(`/api/orders/${order.id}?outletId=${oid}`) : null],
  ["live", P(`/api/orders?limit=50`)],
  ["live", P(`/api/orders/staff/customers?q=98`)],
  ["live", P(`/api/kitchen/orders`)],
  ["live", P(`/api/tables`)],
  ["live", P(`/api/tables/sessions/active`)],
  ["live", P(`/api/reservations`)],
  ["live", P(`/api/reservations/summary`)],
  ["live", P(`/api/dashboard/stats`)],
  ["live", P(`/api/feedback`)],
  ["live", P(`/api/customers`)],
  ["live", P(`/api/printing/jobs`)],
  ["live", P(`/api/notify/logs`)],
  ["live", P(`/api/riders`)],
  // dashboard configuration reads (settings-like: cacheable if invalidated on write)
  ["config", P(`/api/auth/me`)],
  ["config", P(`/api/outlets`)],
  ["config", P(`/api/outlets/${oid}`)],
  ["config", P(`/api/store/plan`)],
  ["config", P(`/api/users`)],
  ["config", P(`/api/coupons`)],
  ["config", P(`/api/pages`)],
  ["config", P(`/api/printing/printers`)],
  ["config", P(`/api/printing/templates`)],
  ["config", P(`/api/printing/targets`)],
  ["config", P(`/api/notify/config`)],
  ["config", P(`/api/notify/messaging`)],
  ["config", P(`/api/qr-cards/design`)],
  ["config", P(`/api/cart-reminders`)],
  ["config", P(`/api/analytics/options`)],
  ["config", P(`/api/whatsapp/me`)],
  ["config", P(`/api/payments/order/000000000000000000000000`)],
  // platform console
  ["platform", P(`/api/platform/stores`, "sup")],
  ["platform", P(`/api/platform/plans`, "sup")],
  ["platform", P(`/api/platform/settings`, "sup")],
  ["platform", P(`/api/platform/overview`, "sup")],
  ["platform", P(`/api/platform/dashboard`, "sup")],
  ["platform", P(`/api/platform/cache`, "sup")],
  ["platform", P(`/api/platform/stores/${storeId}`, "sup")],
].filter(([, r]) => r);

const cookieFor = (who) => (who === "owner" ? owner : who === "sup" ? sup : undefined);
const out = [];
await fetch(REC + "?clear=1");
for (const [kind, r] of routes) {
  for (let n = 1; n <= 2; n++) await get(r.path, { cookie: cookieFor(r.who), outlet: r.who === "owner" ? oid : undefined, label: `${kind}|${r.path}|${n}` });
}
const rec = await (await fetch(REC + "?clear=1")).json();
for (const [kind, r] of routes) {
  const a = rec.find((x) => x.label === `${kind}|${r.path}|1`);
  const b = rec.find((x) => x.label === `${kind}|${r.path}|2`);
  out.push({ kind, path: r.path.replace(oid, ":outlet").replace(storeId, ":store").replace(/\?.*$/, ""), status: a?.status, first: a?.ops.length ?? "?", second: b?.ops.length ?? "?", ops: [...new Set((b ?? a)?.ops ?? [])].join(", "), opsFirst: [...new Set(a?.ops ?? [])].join(", ") });
}
const pad = (s, n) => String(s).padEnd(n);
console.log(pad("KIND", 9) + pad("ROUTE", 44) + pad("ST", 5) + pad("1st", 5) + pad("2nd", 5) + "DB operations on the 2nd call");
for (const o of out) console.log(pad(o.kind, 9) + pad(o.path, 44) + pad(o.status, 5) + pad(o.first, 5) + pad(o.second, 5) + o.ops);
import("node:fs").then((fs) => fs.writeFileSync(new URL("./db-calls.json", import.meta.url), JSON.stringify(out, null, 1)));
