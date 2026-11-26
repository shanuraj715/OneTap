// The staff app loads the menu ONCE and afterwards asks only "what can't be ordered right now?" each time it starts an order.
// GET /api/menu/unavailable answers that from the same rule the order check uses; the menu carries a `version` so the app can tell
// when its copy is old. A private API on an in-memory database; no browser.
import { startApi } from "./_api-harness.mjs";
const t = await startApi(3109);
const { call, ok, say } = t;

await t.run(async () => {
  say("Setup: a store with a menu that has one of every kind of dish");
  const s = await t.makeStore();
  const hdr = { "x-rasoipulse-outlet": s.outlet };
  const post = async (path, body) => (await call("POST", path, { cookie: s.owner, headers: hdr, body })).json;
  const patch = async (path, body) => call("PATCH", path, { cookie: s.owner, headers: hdr, body });
  const cat = await post("/api/menu/categories", { name: "Momos" });
  const categoryId = String(cat.category?.id ?? cat.id ?? cat._id);
  const istNow = new Date(Date.now() + 5.5 * 3600_000);
  const hour = istNow.getUTCHours();
  const closedFrom = `${String((hour + 3) % 24).padStart(2, "0")}:00`;
  const closedTo = `${String((hour + 5) % 24).padStart(2, "0")}:00`;
  const make = async (name, extra = {}) => String((await post("/api/menu/items", { categoryId, name, basePrice: 10000, foodType: "veg", ...extra })).item?.id ?? "");
  const A = await make("Plain dish");
  const B = await make("Switched off", { isAvailable: false });
  const C = await make("Counted, none left", { stock: { tracked: true, left: 0, daily: null, lowAt: 5 } });
  const D = await make("Counted, running low", { stock: { tracked: true, left: 3, daily: null, lowAt: 5 } });
  const E = await make("Out of hours", { availability: { windows: [{ days: [0, 1, 2, 3, 4, 5, 6], from: closedFrom, to: closedTo }] } });
  const F = await make("Combo with a part that is off", { combo: { items: [{ itemId: B, variantId: null, quantity: 1 }] } });
  const G = await make("Counted, plenty", { stock: { tracked: true, left: 50, daily: null, lowAt: 5 } });
  for (let i = 0; i < 30; i++) await make(`Filler ${i}`); // a menu of a realistic size
  ok([A, B, C, D, E, F, G].every(Boolean), "the dishes were created", [A, B, C, D, E, F, G].map((x) => x.slice(-4)).join(" "));

  const unavailable = () => call("GET", `/api/menu/unavailable?outletId=${s.outlet}`);
  say("What the app is told");
  const u = await unavailable();
  const ids = (u.json.unavailable ?? []).map((x) => x.id);
  ok(u.status === 200, "GET /api/menu/unavailable answers (public, like the menu)", `status ${u.status}`);
  ok(ids.includes(B) && ids.includes(C) && ids.includes(E) && ids.includes(F), "lists the dish that is switched off, the counted one at zero, the one out of its hours and the combo with an unavailable part", ids.map((x) => x.slice(-4)).join(" "));
  ok(!ids.includes(A) && !ids.includes(D) && !ids.includes(G), "does NOT list a plain dish, one that is only running low, or one with plenty left (a dish not in the list can be ordered)");
  const label = (id) => u.json.unavailable.find((x) => x.id === id)?.label;
  ok(label(B) === "Sold out" && label(C) === "Sold out" && /^Available /.test(label(E) ?? "") && label(F) === "Sold out", "each comes with the words to show instead of the price", `${label(B)} | ${label(C)} | ${label(E)} | ${label(F)}`);
  ok(u.json.low?.length === 1 && u.json.low[0].id === D && u.json.low[0].left === 3, "a dish running low is reported with how many are left", JSON.stringify(u.json.low));
  const menu = await call("GET", `/api/menu?outletId=${s.outlet}`);
  ok(u.text.length < menu.text.length / 5, "the answer is a small fraction of the whole menu", `${u.text.length} bytes vs ${menu.text.length} bytes`);

  say("It follows what happens at the restaurant");
  await patch(`/api/menu/items/${B}`, { isAvailable: true });
  await patch(`/api/menu/items/${C}`, { stock: { tracked: true, left: 5, daily: null, lowAt: 5 } });
  const u2 = await unavailable();
  const ids2 = (u2.json.unavailable ?? []).map((x) => x.id);
  ok(!ids2.includes(B) && !ids2.includes(C) && !ids2.includes(F), "switching a dish on / adding stock takes it off the list — and the combo that needed it with it (absent = back in stock)", ids2.map((x) => x.slice(-4)).join(" "));
  ok(ids2.includes(E), "the dish that is out of its hours is still listed");
  await patch(`/api/menu/items/${A}`, { isAvailable: false });
  ok((await unavailable()).json.unavailable.some((x) => x.id === A), "switching a dish OFF puts it on the list at once");

  say("The same rule the order check uses");
  const quote = (itemId) => call("POST", "/api/orders/staff/quote", { cookie: s.owner, headers: hdr, body: { cart: { lines: [{ itemId, modifierOptionIds: [], quantity: 1 }] } } });
  ok((await quote(A)).status >= 400, "a dish on the list is refused when it is priced for an order", `status ${(await quote(A)).status}`);
  ok((await quote(G)).status === 200, "a dish NOT on the list can be priced", `status ${(await quote(G)).status}`);
  ok((await quote(E)).status >= 400, "so is the one that is out of its hours", `status ${(await quote(E)).status}`);

  say("The menu version: tells the app when its copy is old");
  const v1 = (await call("GET", `/api/menu?outletId=${s.outlet}`)).json.version;
  ok(typeof v1 === "string" && v1.length >= 8, "the menu carries a version", v1);
  ok((await unavailable()).json.version === v1, "and the unavailable answer carries the same one, so the app can compare");
  await patch(`/api/menu/items/${G}`, { stock: { tracked: true, left: 20, daily: null, lowAt: 5 } });
  ok((await call("GET", `/api/menu?outletId=${s.outlet}`)).json.version === v1, "how many are left changes with every order — it does NOT change the version");
  await patch(`/api/menu/items/${G}`, { basePrice: 12000 });
  const v2 = (await call("GET", `/api/menu?outletId=${s.outlet}`)).json.version;
  ok(v2 !== v1, "a new price DOES change it (the app must load the menu again)", `${v1} → ${v2}`);
  await post("/api/menu/items", { categoryId, name: "A brand new dish", basePrice: 5000 });
  ok((await call("GET", `/api/menu?outletId=${s.outlet}`)).json.version !== v2, "so does a new dish");

  say("Bad requests");
  ok((await call("GET", "/api/menu/unavailable")).status === 400, "no outlet named: 400");
  ok((await call("GET", "/api/menu/unavailable?outletId=000000000000000000000000")).status === 404, "an outlet that doesn't exist: 404");
});
