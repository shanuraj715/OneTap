// The Kitchen app's server side: who may sign in to it (roles), the dishes' sold out / unavailable / available switch, the manager's numbers
// — and that nothing the other apps and the dashboard do has changed. A private API on an in-memory database; no browser.
import { startApi } from "./_api-harness.mjs";
const t = await startApi(3114, { WEBSITE_URL: "https://site.example.test" });
const { call, ok, say } = t;

await t.run(async () => {
  const s = await t.makeStore();
  const hdr = { "x-rasoipulse-brand": s.brand };
  const mk = (email, name, role) => call("POST", "/api/users", { cookie: s.owner, headers: hdr, body: { email, name, password: "Staff123!", role } });
  for (const [email, role] of [["cook@acme.test", "kitchen"], ["boss@acme.test", "manager"], ["waiter@acme.test", "staff"], ["books@acme.test", "accountant"], ["ed@acme.test", "editor"]]) await mk(email, email, role);
  let ip = 0;
  const appLogin = (email, app) => fetch(`${t.base}/api/auth/app-login`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${100 + ip++}`, ...(app ? { "x-app-id": app } : {}) }, body: JSON.stringify({ email, password: email === "super@sandbox.test" ? "Super123!" : email === s.ownerEmail ? "Owner123!" : "Staff123!" }) }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }));
  const bearer = (r) => ({ authorization: `Bearer ${r.json.token}`, "x-rasoipulse-outlet": s.outlet });
  const as = (r, method, path, body) => fetch(`${t.base}${path}`, { method, headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${100 + ip++}`, ...bearer(r) }, body: body ? JSON.stringify(body) : undefined }).then(async (x) => ({ status: x.status, json: await x.json().catch(() => ({})) }));

  say("1. Who may sign in to the Kitchen app (the server decides, not the app)");
  const cook = await appLogin("cook@acme.test", "kda"), boss = await appLogin("boss@acme.test", "kda"), owner = await appLogin(s.ownerEmail, "kda"), su = await appLogin("super@sandbox.test", "kda");
  ok([cook, boss, owner, su].every((r) => r.status === 200 && r.json.token), "kitchen staff, a manager, the owner and the platform admin can sign in", [cook, boss, owner, su].map((r) => r.status).join(","));
  ok(cook.json.user.permissions.includes("kitchen:app") && cook.json.user.permissions.includes("menu:availability") && !cook.json.user.permissions.includes("menu:update"), "a cook may use the app and switch a dish, but may not edit the menu");
  for (const who of ["waiter@acme.test", "books@acme.test", "ed@acme.test"]) {
    const r = await appLogin(who, "kda");
    ok(r.status === 403 && r.json.details?.code === "app_not_allowed" && /kitchen team/.test(r.json.error ?? "") && !r.json.token, `${who.split("@")[0]} (not kitchen) is turned away, in words`, r.json.error);
  }
  const waiterOma = await appLogin("waiter@acme.test", undefined);
  ok(waiterOma.status === 200 && waiterOma.json.token, "the same waiter signs in to OMA exactly as before (no app named = OMA)");
  ok((await appLogin("waiter@acme.test", "oma")).status === 200, "…and when OMA names itself");
  ok((await appLogin("cook@acme.test", undefined)).status === 200, "a cook can still use OMA's sign-in too (nothing was taken away from anyone)");
  const turned = await fetch(`${t.base}/api/auth/app-login`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.220", "x-app-id": "kda" }, body: JSON.stringify({ email: "waiter@acme.test", password: "Staff123!" }) });
  ok(!(turned.headers.get("set-cookie")), "a refused sign-in sets nothing");
  const sessions = await t.raw("sessions").countDocuments({ userId: String((await t.raw("users").findOne({ email: "waiter@acme.test" }))._id) });
  ok(sessions === 2, "…and the session each refused sign-in opened is ended (only the two OMA sign-ins of this waiter are left)", `${sessions} session(s)`);

  say("2. The dishes");
  const cat = (await call("POST", "/api/menu/categories", { cookie: s.owner, headers: { "x-rasoipulse-outlet": s.outlet }, body: { name: "Momos" } })).json.category;
  const dish = async (body) => (await call("POST", "/api/menu/items", { cookie: s.owner, headers: { "x-rasoipulse-outlet": s.outlet }, body: { categoryId: cat.id, foodType: "veg", basePrice: 9000, ...body } })).json.item;
  const plain = await dish({ name: "Veg Momos" }), counted = await dish({ name: "Paneer Momos", stock: { tracked: true, left: 0, daily: null, lowAt: 3 } }), low = await dish({ name: "Chicken Momos", foodType: "non-veg", stock: { tracked: true, left: 2, daily: null, lowAt: 3 } });
  const list = await as(cook, "GET", "/api/kitchen/items");
  const by = Object.fromEntries((list.json.items ?? []).map((i) => [i.name, i]));
  ok(list.status === 200 && list.json.items.length === 3 && list.json.categories[0].name === "Momos", "the cook sees every dish with its category");
  ok(by["Veg Momos"].state === "available" && by["Veg Momos"].stock === null, "an ordinary dish: available, not counted");
  ok(by["Paneer Momos"].state === "sold-out" && by["Paneer Momos"].stock.left === 0, "a counted dish with none left shows as sold out");
  ok(by["Chicken Momos"].state === "available" && by["Chicken Momos"].low === true && by["Chicken Momos"].stock.left === 2, "a counted dish running low is flagged");
  ok((await as(await appLogin("waiter@acme.test", "oma"), "GET", "/api/kitchen/items")).status === 200, "(a waiter can already read the menu, so reading the list is no new power)");

  say("3. Switching a dish (the dish's own switch, so every screen obeys it)");
  let r = await as(cook, "POST", `/api/kitchen/items/${plain.id}/availability`, { state: "sold-out" });
  ok(r.status === 200 && r.json.item.state === "sold-out" && r.json.item.switchedOff === true, "the cook marks a dish SOLD OUT");
  let un = (await as(cook, "GET", "/api/menu/unavailable")).json;
  ok(un.unavailable?.some((u) => u.id === plain.id && u.label === "Sold out"), "the staff app's 'unavailable now' list has it at once, labelled Sold out", JSON.stringify(un.unavailable));
  r = await as(cook, "POST", `/api/kitchen/items/${plain.id}/availability`, { state: "unavailable" });
  ok(r.json.item.state === "unavailable", "…then UNAVAILABLE (it can't be made today): a different state");
  ok((await as(cook, "GET", "/api/kitchen/items")).json.items.find((i) => i.id === plain.id).state === "unavailable", "the list agrees");
  r = await as(cook, "POST", `/api/kitchen/items/${plain.id}/availability`, { state: "available" });
  ok(r.json.item.state === "available" && r.json.item.stillSoldOut === false, "…and AVAILABLE again");
  ok(!(await as(cook, "GET", "/api/menu/unavailable")).json.unavailable.some((u) => u.id === plain.id), "it leaves the 'unavailable now' list");
  const publicMenu = await (await fetch(`${t.base}/api/menu?outletId=${s.outlet}`)).json();
  ok(publicMenu.items.find((i) => i.id === plain.id).isAvailable === true && !("offReason" in publicMenu.items.find((i) => i.id === plain.id)), "the storefront's menu has it back, and shows nothing of the kitchen's note");

  say("4. Who may do what");
  const waiter = await appLogin("waiter@acme.test", "oma");
  ok((await as(waiter, "POST", `/api/kitchen/items/${plain.id}/availability`, { state: "sold-out" })).status === 403, "a waiter can NOT switch a dish from here (no menu:availability)");
  ok((await as(cook, "POST", `/api/kitchen/items/${plain.id}/availability`, { state: "maybe" })).status === 400, "an unknown state is refused");
  ok((await as(cook, "POST", "/api/kitchen/items/ffffffffffffffffffffffff/availability", { state: "sold-out" })).status === 404, "a dish that doesn't exist is a 404");
  r = await as(cook, "POST", `/api/kitchen/items/${counted.id}/availability`, { state: "available" });
  ok(r.status === 200 && r.json.item.state === "sold-out" && r.json.item.stillSoldOut === true, "a counted dish with none left stays sold out when put back, and says so (it needs a number)");
  ok((await as(cook, "POST", `/api/kitchen/items/${counted.id}/availability`, { state: "available", left: 5 })).status === 403, "a cook can NOT set a stock number (that is the manager's, menu:update)");
  r = await as(boss, "POST", `/api/kitchen/items/${counted.id}/availability`, { state: "available", left: 5 });
  ok(r.status === 200 && r.json.item.state === "available" && r.json.item.stock.left === 5, "the manager restocks it: available with 5 left");
  ok((await as(boss, "POST", `/api/kitchen/items/${plain.id}/availability`, { state: "available", left: 5 })).status === 400, "a number for a dish that isn't counted is refused");

  say("5. The dashboard's own switch is unchanged");
  await as(cook, "POST", `/api/kitchen/items/${low.id}/availability`, { state: "sold-out" });
  ok((await as(cook, "GET", "/api/kitchen/items")).json.items.find((i) => i.id === low.id).state === "sold-out", "the cook's sold-out shows");
  await call("PATCH", `/api/menu/items/${low.id}`, { cookie: s.owner, headers: { "x-rasoipulse-outlet": s.outlet }, body: { isAvailable: true } });
  ok((await as(cook, "GET", "/api/kitchen/items")).json.items.find((i) => i.id === low.id).state === "available", "the owner switching it back on in the dashboard puts it back (and the kitchen's note is forgotten)");
  await call("PATCH", `/api/menu/items/${low.id}`, { cookie: s.owner, headers: { "x-rasoipulse-outlet": s.outlet }, body: { isAvailable: false } });
  ok((await as(cook, "GET", "/api/kitchen/items")).json.items.find((i) => i.id === low.id).state === "unavailable", "switching it OFF in the dashboard is 'unavailable' (not a stale 'sold out')");

  say("6. The board and the manager's numbers");
  const board = await as(cook, "GET", "/api/kitchen/orders?screen=all");
  ok(board.status === 200 && Array.isArray(board.json.orders) && board.json.settings.lateAfterMinutes > 0, "the board is the existing one, unchanged");
  const sum = await as(boss, "GET", "/api/kitchen/summary");
  ok(sum.status === 200 && sum.json.now.new === 0 && sum.json.today.ready === 0 && sum.json.today.averageMinutes === null && Array.isArray(sum.json.today.topDishes), "today's summary with no orders: zeros, no average", JSON.stringify(sum.json.today));
});
