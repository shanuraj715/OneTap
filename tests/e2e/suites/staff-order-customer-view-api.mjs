// "Will the customer see the order I took for them on their own phone?" — an order taken by staff is attached to the customer record of
// the number typed. When that person opens the storefront and signs in with the SAME number, the order is in "My orders", with its
// status and how it is paid, and the tracking page follows it live. A private API on an in-memory database; no browser.
import { startApi } from "./_api-harness.mjs";
const t = await startApi(3112);
const { call, ok, say } = t;

await t.run(async () => {
  say("Setup: a store, a table, a dish — a waiter takes an order for a customer's number");
  const s = await t.makeStore();
  const hdr = { "x-rasoipulse-outlet": s.outlet };
  const own = (method, path, body) => call(method, path, { cookie: s.owner, headers: hdr, body });
  const cat = (await own("POST", "/api/menu/categories", { name: "Momos" })).json;
  const item = String((await own("POST", "/api/menu/items", { categoryId: String(cat.category?.id ?? cat.id), name: "Veg momos", basePrice: 9000, foodType: "veg" })).json.item?.id);
  const table = String((await own("POST", "/api/tables", { number: "T1", seats: 4 })).json.table?.id);
  const placed = (await own("POST", "/api/orders/staff", { tableId: table, phone: "9000000001", name: "Ravi", cart: { lines: [{ itemId: item, modifierOptionIds: [], quantity: 2 }] } })).json.order;
  ok(Boolean(placed?.id), "the waiter takes an order for 9000000001", placed?.orderNumber);

  /** a customer signs in on the storefront (the test setup has no SMS, so the code 123456 is accepted) */
  const customerLogin = async (phone, extra = {}) => {
    await call("POST", "/api/customer/otp/request", { body: { outletId: s.outlet, destination: phone, ...extra } });
    const r = await fetch(`${t.base}/api/customer/otp/verify`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7" }, body: JSON.stringify({ outletId: s.outlet, destination: phone, code: "123456", ...extra }) });
    return { status: r.status, cookie: r.headers.get("set-cookie")?.split(";")[0], json: await r.json().catch(() => ({})) };
  };
  const mine = (cookie) => call("GET", `/api/customer/orders?outletId=${s.outlet}`, { cookie });

  say("The customer signs in on their own phone with the same number");
  const login = await customerLogin("9000000001");
  ok(login.status === 200 && Boolean(login.cookie), "signing in with the same number works without asking for anything new (the record already exists)", `${login.status} ${login.json.error ?? ""}`);
  const list = await mine(login.cookie);
  const row = list.json.orders?.find((o) => o.id === placed.id || o.orderNumber === placed.orderNumber);
  ok(Boolean(row), "the order the waiter took is in their 'My orders' list", `${list.json.orders?.length} order(s)`);
  ok(row?.status === "accepted", "with its status (staff orders go straight to the kitchen)", row?.status);
  ok(JSON.stringify(row ?? {}).includes("Veg momos") && (row?.items?.[0]?.quantity === 2 || row?.lines?.[0]?.quantity === 2 || JSON.stringify(row).includes('"quantity":2')), "and its items", Object.keys(row ?? {}).join(","));
  ok(row?.payment?.status === "pending" || row?.paymentStatus === "pending" || JSON.stringify(row).includes("pending"), "and that it is not paid yet", JSON.stringify(row?.payment ?? row?.paymentStatus));

  say("The status follows the kitchen");
  const track = () => call("GET", `/api/customer/orders/${placed.id}?outletId=${s.outlet}`, { cookie: login.cookie });
  ok((await track()).json.order?.status === "accepted", "the tracking page shows Accepted");
  for (const to of ["preparing", "ready"]) await own("PATCH", `/api/orders/${placed.id}/status`, { status: to });
  const t2 = await track();
  ok(t2.json.order?.status === "ready" && t2.json.order.history?.length >= 3, "…then Ready, with how it moved (status and time)", `${t2.json.order?.status} / ${t2.json.order?.history?.length} steps`);
  await own("POST", `/api/tables/sessions/${placed.sessionId}/confirm-payment`, {});
  ok(JSON.stringify((await mine(login.cookie)).json.orders?.[0] ?? {}).includes("paid"), "and once the waiter confirms payment, 'My orders' says paid");

  say("A second round at the same table is there too");
  const round2 = (await own("POST", "/api/orders/staff", { tableId: table, cart: { lines: [{ itemId: item, modifierOptionIds: [], quantity: 1 }] } })).json.order;
  ok((await mine(login.cookie)).json.orders?.length === 2, "a later order on the same party's table is added to their list", `${(await mine(login.cookie)).json.orders?.length}`);
  ok(Boolean(round2?.id), "(taken without typing the number again)");

  say("Only the right person sees it");
  const stranger = await customerLogin("9000000002", { name: "Sita", gender: "female", age: 30 });
  ok(stranger.status === 200, "another customer signs up", `${stranger.status} ${stranger.json.error ?? ""}`);
  ok((await mine(stranger.cookie)).json.orders?.length === 0, "they do NOT see the first customer's orders");
  ok((await call("GET", `/api/customer/orders/${placed.id}?outletId=${s.outlet}`, { cookie: stranger.cookie })).status === 404, "and cannot open that order's tracking page either");
  ok((await call("GET", `/api/customer/orders?outletId=${s.outlet}`)).status === 401, "someone not signed in sees nothing (401)");

  say("The same number written differently");
  const spaced = await customerLogin("+91 90000 00001");
  const viaSpaced = spaced.cookie ? await mine(spaced.cookie) : { json: {} };
  ok(spaced.status === 200 && (viaSpaced.json.orders?.length ?? 0) === 2, "signing in as '+91 90000 00001' reaches the same orders", `${spaced.status} ${viaSpaced.json.orders?.length ?? 0} order(s) ${spaced.json.error ?? ""}`);

  say("They can remove it from their own list; the store keeps it");
  const hide = await call("DELETE", `/api/customer/orders/${placed.id}?outletId=${s.outlet}`, { cookie: login.cookie });
  const after = await mine(login.cookie);
  ok(hide.status < 300 && after.json.orders?.length === 1, "a customer's Remove hides it from THEIR list only", `${hide.status} ${after.json.orders?.length}`);
  ok((await own("GET", "/api/orders")).json.orders?.some((o) => o.id === placed.id), "the restaurant still has the order");
});
