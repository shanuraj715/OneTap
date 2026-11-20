// Kitchen tickets (KOT): (1) each dish goes to the printer of the station that makes it, (2) an order edited after its ticket went
// out sends the kitchen a short "ORDER CHANGED" ticket with only the difference, (3) a cancelled order withdraws a waiting ticket or
// sends a big "ORDER CANCELLED — DO NOT COOK" one. API checks on an in-memory database (nothing real is touched); the text on the
// tickets is read straight from the saved print jobs.
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { fileURLToPath as __f } from "node:url";
import { mkdirSync as __mk } from "node:fs";
const REPO = __f(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const API = `${REPO}/apps/api`;
const PORT = 3086;
const __RUN = __f(new URL("../.bench/suite-run/", import.meta.url));
__mk(__RUN, { recursive: true });
process.chdir(__RUN); // no .env here → the real database URI is never read
const req = createRequire(`${API}/package.json`);
const mms = await import(pathToFileURL(req.resolve("mongodb-memory-server")).href);
const mongod = await (mms.MongoMemoryServer ?? mms.default.MongoMemoryServer).create();
Object.assign(process.env, { NODE_ENV: "development", API_PORT: String(PORT), MONGODB_URI: mongod.getUri(), MONGODB_DB: "sandbox", LOG_LEVEL: "error", RATE_LIMITS: "off" });
const db = await import(`${REPO}/packages/db/src/index.js`);
await db.connectDb({ uri: mongod.getUri(), dbName: "sandbox" });
const { createApp } = await import(`${API}/src/app.js`);
const server = createApp().listen(PORT);
await new Promise((r) => server.once("listening", r));
const { ensureSuperAdmin } = await import(`${API}/src/modules/auth/auth.service.js`);
await ensureSuperAdmin({ email: "super@sandbox.test", name: "Super", password: "Super123!" });
const schema = await import(`${REPO}/packages/config-schema/src/index.js`);
const raw = (c) => db.mongoose.connection.db.collection(c);

const base = `http://127.0.0.1:${PORT}`;
const call = async (method, path, { body, cookie, headers = {} } = {}) => {
  const r = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json = {}; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json };
};
const login = async (email, password) => (await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);
const must = async (p, what) => { const r = await p; if (r.status >= 400) { console.error("SETUP FAILED", what, r.status, JSON.stringify(r.json).slice(0, 300)); process.exit(1); } return r; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ setup */
const su = await login("super@sandbox.test", "Super123!");
const idOf = (o) => String(o?._id ?? o?.id);
const plan = idOf((await must(call("POST", "/api/platform/plans", { cookie: su, body: { name: "Everything", entitlements: { features: schema.FEATURE_KEYS } } }), "plan")).json.plan);
const planNo = idOf((await must(call("POST", "/api/platform/plans", { cookie: su, body: { name: "No printing", entitlements: { features: schema.FEATURE_KEYS.filter((k) => k !== "printing") } } }), "plan 2")).json.plan);
const mk = async (name, slug, email, planId) => {
  const j = (await must(call("POST", "/api/brands", { cookie: su, body: { brandName: name, brandSlug: slug, outletName: "Main", outletSlug: "main", hostnames: [`${slug}.test`], ownerEmail: email, ownerName: "Owner", ownerPassword: "Owner123!", planId } }), `store ${slug}`)).json;
  return { brand: String(j.brand?._id ?? j.brand?.id ?? j.brandId), outlet: String(j.outlet?._id ?? j.outlet?.id ?? j.outletId) };
};
const A = await mk("Acme", "acme", "o@acme.test", plan);
const owner = await login("o@acme.test", "Owner123!");
const H = { "x-onetap-outlet": A.outlet, "x-onetap-brand": A.brand };
const own = (method, path, body) => call(method, path, { cookie: owner, headers: H, body });
await must(own("PATCH", `/api/outlets/${A.outlet}/config`, { operations: { orders: { allowOrderEdit: true, editLockAfter: "never" } } }), "let orders be edited");

// the menu: Food (kitchen by default), Drinks (bar) with Hot Drinks inside it, and two dishes that override their category
const cat = async (name, extra = {}) => (await must(own("POST", "/api/menu/categories", { name, ...extra }), `category ${name}`)).json.category;
const itm = async (categoryId, name, extra = {}) => (await must(own("POST", "/api/menu/items", { categoryId, name, basePrice: 10000, ...extra }), `item ${name}`)).json.item;
const food = await cat("Food");
const drinks = await cat("Drinks", { prepStation: "bar" });
const hot = await cat("Hot Drinks", { parentId: drinks.id });
const momos = await itm(food.id, "Veg Momos");
const roll = await itm(food.id, "Paneer Roll");
const chai = await itm(hot.id, "Masala Chai");            // bar — through Hot Drinks → Drinks
const lassi = await itm(drinks.id, "Sweet Lassi", { prepStation: "kitchen" }); // the dish says kitchen although Drinks says bar
const coffee = await itm(food.id, "Cold Coffee", { prepStation: "bar" });      // the dish says bar although Food says nothing

const printer = async (name, station, docType, extra = {}) =>
  (await must(own("POST", "/api/printing/printers", { name, station, docType, target: "browser", paperWidth: "80mm", autoPrintOn: ["accepted"], ...extra }), `printer ${name}`)).json.printer;
const K = await printer("Kitchen KOT", "kitchen", "kot");
const B = await printer("Bar KOT", "bar", "kot");
const R = await printer("Counter receipt", "counter", "receipt");

const line = (item, quantity, extra = {}) => ({ itemId: item.id, quantity, modifierOptionIds: [], ...extra });
const place = async (lines, extra = {}) => (await must(call("POST", "/api/orders", { cookie: owner, headers: H, body: { outletId: A.outlet, cart: { lines }, channel: "takeaway", name: "Walk-in", ...extra } }), "place order")).json.order;
const setStatus = (id, status) => own("PATCH", `/api/orders/${id}/status`, { status });
const edit = (id, body) => own("PATCH", `/api/orders/${id}`, body);
const jobsOf = async (orderId) => (await raw("printjobs").find({ orderId: String(orderId) }).sort({ createdAt: 1 }).toArray());
const textOf = (j) => j?.payload?.text ?? "";
/** wait (a printing job is queued a moment after the call returns) until the order has `n` jobs — or a short while passes */
const waitJobs = async (orderId, n, ms = 4000) => { const end = Date.now() + ms; let js = await jobsOf(orderId); while (js.length < n && Date.now() < end) { await sleep(150); js = await jobsOf(orderId); } await sleep(250); return jobsOf(orderId); };
const forPrinter = (js, p) => js.filter((j) => j.printerId === String(p._id ?? p.id));
const markPrinted = async (js) => { for (const j of js.filter((x) => x.status === "queued")) await must(own("POST", `/api/printing/jobs/${j._id}/result`, { ok: true }), "mark printed"); };
const orderJobs = async (orderId) => forPrinter(await jobsOf(orderId), K).concat(forPrinter(await jobsOf(orderId), B));

/* ------------------------------------------------------------------ 1 */
say("1. every dish goes to the printer of the station that makes it");
let o1;
{
  o1 = await place([line(momos, 2), line(chai, 1), line(lassi, 1), line(coffee, 1)]);
  await setStatus(o1.id, "accepted");
  const js = await waitJobs(o1.id, 3);
  const k = forPrinter(js, K)[0], b = forPrinter(js, B)[0], r = forPrinter(js, R)[0];
  ok(js.length === 3 && k && b && r, "accepting an order queues a ticket for the kitchen printer, one for the bar printer and the counter receipt", `${js.length} jobs`);
  const kt = textOf(k), bt = textOf(b);
  ok(/Veg Momos/.test(kt) && /Sweet Lassi/.test(kt), "the KITCHEN ticket has the kitchen dishes (Veg Momos, and Sweet Lassi — the dish says kitchen although its category says bar)", kt.replace(/\n+/g, " | ").slice(0, 160));
  ok(!/Masala Chai|Cold Coffee/.test(kt), "…and none of the bar's dishes");
  ok(/Masala Chai/.test(bt) && /Cold Coffee/.test(bt), "the BAR ticket has the bar dishes (Masala Chai — through Hot Drinks inside Drinks — and Cold Coffee — the dish says bar although its category says nothing)", bt.replace(/\n+/g, " | ").slice(0, 160));
  ok(!/Veg Momos|Sweet Lassi/.test(bt), "…and none of the kitchen's dishes");
  ok(/2 x Veg Momos/.test(kt) && /1 x Masala Chai/.test(bt), "quantities are on the tickets ('2 x Veg Momos')");
  ok(!/Rs\.|₹|\d\.\d\d/.test(kt + bt), "kitchen tickets never show a price");
  const rt = textOf(r);
  ok(/Veg Momos/.test(rt) && /Masala Chai/.test(rt) && /Rs\.|₹/.test(rt), "the counter receipt still has the whole order, with prices");
}

/* ------------------------------------------------------------------ 2 */
say("2. no empty tickets");
{
  const o = await place([line(momos, 1), line(roll, 1)]);
  await setStatus(o.id, "accepted");
  const js = await waitJobs(o.id, 2);
  ok(forPrinter(js, K).length === 1 && forPrinter(js, B).length === 0, "an order with only kitchen dishes sends nothing to the bar printer", `kitchen ${forPrinter(js, K).length}, bar ${forPrinter(js, B).length}`);
  ok(forPrinter(js, R).length === 1, "…and the counter receipt still prints");
}

/* ------------------------------------------------------------------ 3 */
say("3. a dish is never left without a ticket");
{
  await must(own("PATCH", `/api/printing/printers/${B.id}`, { isActive: false }), "switch bar off");
  const o = await place([line(momos, 1), line(chai, 2)]);
  await setStatus(o.id, "accepted");
  let js = await waitJobs(o.id, 2);
  ok(forPrinter(js, B).length === 0 && /Veg Momos/.test(textOf(forPrinter(js, K)[0])) && /2 x Masala Chai/.test(textOf(forPrinter(js, K)[0])), "with the bar printer switched off, the bar's dish comes out on the kitchen ticket", textOf(forPrinter(js, K)[0]).replace(/\n+/g, " | ").slice(0, 120));
  await must(own("PATCH", `/api/printing/printers/${B.id}`, { isActive: true }), "bar on");

  await must(own("PATCH", `/api/printing/printers/${K.id}`, { isActive: false }), "switch kitchen off");
  const o2 = await place([line(momos, 3)]);
  await setStatus(o2.id, "accepted");
  js = await waitJobs(o2.id, 2);
  ok(forPrinter(js, B).length === 1 && /3 x Veg Momos/.test(textOf(forPrinter(js, B)[0])), "with ONLY a bar printer left, a kitchen dish still prints (on the bar printer)");
  await must(own("PATCH", `/api/printing/printers/${K.id}`, { isActive: true }), "kitchen on");

  const M = await printer("Counter KOT", "counter", "kot");
  const o3 = await place([line(momos, 1), line(chai, 1)]);
  await setStatus(o3.id, "accepted");
  js = await waitJobs(o3.id, 4);
  const mt = textOf(forPrinter(js, M)[0]);
  ok(/Veg Momos/.test(mt) && /Masala Chai/.test(mt), "a KOT printer at any other station (here: counter) is a master copy with every dish", mt.replace(/\n+/g, " | ").slice(0, 120));
  ok(!/Masala Chai/.test(textOf(forPrinter(js, K)[0])) && !/Veg Momos/.test(textOf(forPrinter(js, B)[0])), "…while the kitchen and bar printers still split as before");
  await must(own("DELETE", `/api/printing/printers/${M.id}`), "remove master");
}

/* ------------------------------------------------------------------ 4 */
say("4. an order edited after its ticket went out sends a CHANGE ticket");
let o4;
{
  o4 = await place([line(momos, 2), line(chai, 1), line(lassi, 1)]);
  await setStatus(o4.id, "accepted");
  let js = await waitJobs(o4.id, 3);
  await markPrinted(js);
  ok(js.length === 3, "(setup) the first tickets were sent and printed");

  // 2→3 Veg Momos, Masala Chai taken off, a Paneer Roll added; Sweet Lassi untouched
  await must(edit(o4.id, { cart: { lines: [line(momos, 3), line(lassi, 1), line(roll, 1)] } }), "edit 1");
  js = await waitJobs(o4.id, 5);
  const kc = forPrinter(js, K).find((j) => j.ticket?.kind === "change");
  const bc = forPrinter(js, B).find((j) => j.ticket?.kind === "change");
  ok(kc && bc, "both printers that make a changed dish get a change ticket", `${js.length} jobs`);
  const kt = textOf(kc), bt = textOf(bc);
  ok(/ORDER CHANGED/.test(kt) && /ORDER CHANGED/.test(bt), "each change ticket says ORDER CHANGED at the top");
  ok(/ADD:/.test(kt) && /1 x Veg Momos/.test(kt) && /1 x Paneer Roll/.test(kt), "kitchen: ADD 1 x Veg Momos (it went from 2 to 3) and ADD 1 x Paneer Roll", kt.replace(/\n+/g, " | ").slice(0, 170));
  ok(!/Sweet Lassi/.test(kt) && !/2 x Veg Momos|3 x Veg Momos/.test(kt), "…and nothing about what did not change (Sweet Lassi), nor the whole quantity");
  ok(!/Masala Chai/.test(kt), "…and nothing about the bar's dish");
  ok(/REMOVE/.test(bt) && /1 x Masala Chai/.test(bt) && !/ADD:/.test(bt), "bar: REMOVE 1 x Masala Chai, nothing to add", bt.replace(/\n+/g, " | ").slice(0, 170));
  ok(!/Veg Momos|Paneer Roll/.test(bt), "…and none of the kitchen's dishes");

  // an edit that only touches the bar leaves the kitchen alone
  const kitchenBefore = forPrinter(await jobsOf(o4.id), K).length;
  await must(edit(o4.id, { cart: { lines: [line(momos, 3), line(lassi, 1), line(roll, 1), line(coffee, 1)] } }), "edit 2");
  js = await waitJobs(o4.id, 6);
  ok(forPrinter(js, K).length === kitchenBefore && /1 x Cold Coffee/.test(textOf(forPrinter(js, B).filter((j) => j.ticket?.kind === "change").at(-1))), "adding a bar dish sends a change ticket to the bar only — the kitchen is not disturbed");

  // nothing really changed → no ticket
  const count = (await jobsOf(o4.id)).length;
  await must(edit(o4.id, { cart: { lines: [line(momos, 3), line(lassi, 1), line(roll, 1), line(coffee, 1)] } }), "edit 3");
  await sleep(800);
  ok((await jobsOf(o4.id)).length === count, "an edit that changes nothing sends no ticket");

  // a changed note
  await must(edit(o4.id, { note: "less spicy please" }), "edit note");
  js = await waitJobs(o4.id, count + 2);
  const noteTicket = forPrinter(js, K).filter((j) => j.ticket?.kind === "change").at(-1);
  ok(/Note is now: less spicy please/.test(textOf(noteTicket)) && !/ADD:|REMOVE \(do not/.test(textOf(noteTicket)) && /Only the kitchen note changed/.test(textOf(noteTicket)), "changing only the kitchen note sends a ticket that says what the note is now", textOf(noteTicket).replace(/\n+/g, " | ").replace(/ +/g, " ").slice(0, 500));

  // a printer that got nothing at first still hears about a new dish for it
  const o = await place([line(momos, 1)]);
  await setStatus(o.id, "accepted");
  let ojs = await waitJobs(o.id, 2);
  ok(forPrinter(ojs, B).length === 0, "(setup) an order that started with only a kitchen dish: the bar printer got nothing");
  await must(edit(o.id, { cart: { lines: [line(momos, 1), line(chai, 2)] } }), "edit add chai");
  ojs = await waitJobs(o.id, 3);
  const barNew = forPrinter(ojs, B)[0];
  ok(barNew?.ticket?.kind === "change" && /2 x Masala Chai/.test(textOf(barNew)), "…and when a chai is added later, the bar printer gets it", textOf(barNew).replace(/\n+/g, " | ").slice(0, 120));

  // edited before any ticket went out → nothing to correct, and the ticket that does go out shows the new order
  const early = await place([line(momos, 1)]);
  await must(edit(early.id, { cart: { lines: [line(momos, 4)] } }), "edit early");
  await sleep(500);
  ok((await jobsOf(early.id)).length === 0, "an order edited before its kitchen ticket was sent sends no change ticket");
  await setStatus(early.id, "accepted");
  const ejs = await waitJobs(early.id, 2);
  ok(/4 x Veg Momos/.test(textOf(forPrinter(ejs, K)[0])) && !/ORDER CHANGED/.test(textOf(forPrinter(ejs, K)[0])), "…the ticket that is sent later simply shows the new order (4 x Veg Momos)");
}

/* ------------------------------------------------------------------ 5 */
say("5. a cancelled order: withdraw a waiting ticket, or send a CANCELLED one");
{
  // a) both tickets already printed → each printer gets a big CANCELLED ticket
  await must(own("PATCH", `/api/printing/printers/${K.id}`, { autoPrintOn: ["accepted", "cancelled"] }), "kitchen also on cancelled");
  const a = await place([line(momos, 2), line(chai, 1)]);
  await setStatus(a.id, "accepted");
  let js = await waitJobs(a.id, 3);
  await markPrinted(js);
  await setStatus(a.id, "cancelled");
  js = await waitJobs(a.id, 5);
  const kc = forPrinter(js, K).filter((j) => j.ticket?.kind === "cancel");
  const bc = forPrinter(js, B).filter((j) => j.ticket?.kind === "cancel");
  ok(kc.length === 1 && bc.length === 1, "both printers that had printed the order get one CANCELLED ticket (even though the kitchen printer is also set to fire on 'cancelled' — no second ticket)", `kitchen ${kc.length}, bar ${bc.length}, total ${js.length}`);
  const kt = textOf(kc[0]), bt = textOf(bc[0]);
  ok(/ORDER CANCELLED/.test(kt) && /DO NOT COOK/.test(kt) && /2 x Veg Momos/.test(kt) && !/Masala Chai/.test(kt), "the kitchen's says ORDER CANCELLED / DO NOT COOK and names the order and ITS dishes only", kt.replace(/\n+/g, " | ").slice(0, 160));
  ok(/ORDER CANCELLED/.test(bt) && /1 x Masala Chai/.test(bt) && !/Veg Momos/.test(bt), "…and the bar's names the bar's dish");
  ok(js.filter((j) => j.docType === "receipt").every((j) => !/CANCELLED/.test(textOf(j))), "the counter receipt is not turned into a cancelled ticket");
  await must(own("PATCH", `/api/printing/printers/${K.id}`, { autoPrintOn: ["accepted"] }), "kitchen back");

  // b) tickets still waiting in the queue → just withdrawn, no cancelled ticket
  const b = await place([line(momos, 1), line(chai, 1)]);
  await setStatus(b.id, "accepted");
  js = await waitJobs(b.id, 3);
  await setStatus(b.id, "cancelled");
  await sleep(700);
  js = await jobsOf(b.id);
  const kot = js.filter((j) => j.docType === "kot");
  ok(kot.length === 2 && kot.every((j) => j.status === "cancelled"), "tickets still waiting to print are withdrawn when the order is cancelled", kot.map((j) => j.status).join(","));
  ok(!kot.some((j) => j.ticket?.kind === "cancel"), "…and no CANCELLED ticket is printed for something the kitchen never saw");

  // c) one printed, one still waiting
  const c = await place([line(momos, 1), line(chai, 1)]);
  await setStatus(c.id, "accepted");
  js = await waitJobs(c.id, 3);
  await markPrinted(forPrinter(js, K));
  await setStatus(c.id, "cancelled");
  js = await waitJobs(c.id, 4);
  ok(forPrinter(js, K).some((j) => j.ticket?.kind === "cancel") && forPrinter(js, B).every((j) => j.status === "cancelled" && j.ticket?.kind !== "cancel"), "kitchen already printed → it gets the CANCELLED ticket; bar still waiting → its ticket is just withdrawn");
}

/* ------------------------------------------------------------------ 6 */
say("6. reprints, hand printing and the print log");
{
  const js = await jobsOf(o4.id);
  const change = forPrinter(js, K).find((j) => j.ticket?.kind === "change");
  const rp = (await must(own("POST", `/api/printing/jobs/${change._id}/reprint`), "reprint change")).json.job;
  const rpDoc = await raw("printjobs").findOne({ _id: new db.mongoose.Types.ObjectId(rp.id) });
  ok(/ORDER CHANGED/.test(textOf(rpDoc)) && /REPRINT/.test(textOf(rpDoc)) && /Paneer Roll/.test(textOf(rpDoc)) && !/Sweet Lassi/.test(textOf(rpDoc)), "reprinting a change ticket prints that same change ticket again (marked REPRINT)", textOf(rpDoc).replace(/\n+/g, " | ").slice(0, 140));

  const first = forPrinter(await jobsOf(o1.id), B).find((j) => !j.ticket);
  const rp2 = (await must(own("POST", `/api/printing/jobs/${first._id}/reprint`), "reprint bar")).json.job;
  const rp2Doc = await raw("printjobs").findOne({ _id: new db.mongoose.Types.ObjectId(rp2.id) });
  ok(/Masala Chai/.test(textOf(rp2Doc)) && !/Veg Momos/.test(textOf(rp2Doc)), "reprinting the bar's ticket still has only the bar's dishes");

  const kitchenOnly = await place([line(roll, 1)]);
  const manual = (await must(own("POST", `/api/printing/orders/${kitchenOnly.id}/print`, { printerId: B.id }), "print by hand")).json.job;
  const manualDoc = await raw("printjobs").findOne({ _id: new db.mongoose.Types.ObjectId(manual.id) });
  ok(/Paneer Roll/.test(textOf(manualDoc)), "printing an order by hand on a printer that would otherwise get nothing still prints (the whole order) — a person asked for it");

  const all = (await must(own("GET", "/api/printing/jobs?limit=200"), "list jobs")).json.jobs;
  ok(all.some((j) => j.ticketKind === "change") && all.some((j) => j.ticketKind === "cancel") && all.some((j) => j.ticketKind === "kot"), "the print log says which tickets are normal, changed or cancelled", [...new Set(all.map((j) => j.ticketKind))].join(","));
}

/* ------------------------------------------------------------------ 7 */
say("7. setting where a dish or category is prepared");
{
  let r = await own("PATCH", `/api/menu/items/${roll.id}`, { prepStation: "bar" });
  ok(r.status === 200 && r.json.item.prepStation === "bar", "a dish can be set to 'bar'", `${r.status}`);
  r = await own("PATCH", `/api/menu/items/${roll.id}`, { prepStation: null });
  ok(r.status === 200 && r.json.item.prepStation === null, "…and set back to 'same as its category'");
  r = await own("PATCH", `/api/menu/items/${roll.id}`, { prepStation: "tandoor" });
  ok(r.status === 400, "any other place is refused", `${r.status}`);
  r = await own("PATCH", `/api/menu/categories/${food.id}`, { prepStation: "kitchen" });
  ok(r.status === 200 && r.json.category.prepStation === "kitchen", "a category can be set too");
  const menu = (await call("GET", `/api/menu?outletId=${A.outlet}`)).json;
  ok(menu.categories.find((c) => c.id === drinks.id)?.prepStation === "bar" && menu.items.find((i) => i.id === lassi.id)?.prepStation === "kitchen", "the menu carries each category's and dish's setting");
  await must(own("PATCH", `/api/menu/categories/${food.id}`, { prepStation: null }), "clear");
}

/* ------------------------------------------------------------------ 8 */
say("8. a store without the Printing feature");
{
  const N = await mk("No Print", "noprint", "o@noprint.test", planNo);
  const ownN = await login("o@noprint.test", "Owner123!");
  const HN = { "x-onetap-outlet": N.outlet, "x-onetap-brand": N.brand };
  const c = (await must(call("POST", "/api/menu/categories", { cookie: ownN, headers: HN, body: { name: "Food" } }), "cat")).json.category;
  const i = (await must(call("POST", "/api/menu/items", { cookie: ownN, headers: HN, body: { categoryId: c.id, name: "Momos", basePrice: 9000 } }), "item")).json.item;
  const o = (await must(call("POST", "/api/orders", { cookie: ownN, headers: HN, body: { outletId: N.outlet, cart: { lines: [{ itemId: i.id, quantity: 1, modifierOptionIds: [] }] }, channel: "takeaway", name: "x" } }), "order")).json.order;
  // a kitchen printer exists (put in directly — the plan would not let this store add one), set to print on accept
  await raw("printers").insertOne({ brandId: N.brand, outletId: N.outlet, name: "Kitchen KOT", station: "kitchen", docType: "kot", target: "browser", paperWidth: "80mm", autoPrintOn: ["accepted"], channels: [], copies: 1, cutAfter: true, openDrawer: false, isActive: true, connection: {}, createdAt: new Date(), updatedAt: new Date() });
  await call("PATCH", `/api/orders/${o.id}/status`, { cookie: ownN, headers: HN, body: { status: "accepted" } });
  await call("PATCH", `/api/orders/${o.id}`, { cookie: ownN, headers: HN, body: { note: "changed" } });
  await sleep(700);
  ok((await jobsOf(o.id)).length === 0, "no tickets of any kind are queued");
}

await server.close?.();
await mongod.stop();
console.log(`SUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
