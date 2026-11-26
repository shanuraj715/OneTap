// An order that was marked Completed by mistake and put back to Preparing from the dashboard used to leave its TABLE free: the table
// freed itself on "Completed", and putting the order back never seated it again — so a party was being served at a table the app and the
// dashboard showed as free. Now the table is seated again; if somebody else sits there meanwhile, the dashboard is told (409 table_taken
// with the free tables) and the operator picks another table for that order. A private API on an in-memory database; no browser.
import { startApi } from "./_api-harness.mjs";
const t = await startApi(3110);
const { call, ok, say } = t;

await t.run(async () => {
  say("Setup: a store with three tables and a dish");
  const s = await t.makeStore();
  const hdr = { "x-rasoipulse-outlet": s.outlet };
  const own = (method, path, body) => call(method, path, { cookie: s.owner, headers: hdr, body });
  const cat = (await own("POST", "/api/menu/categories", { name: "Momos" })).json;
  const item = String((await own("POST", "/api/menu/items", { categoryId: String(cat.category?.id ?? cat.id), name: "Veg momos", basePrice: 9000, foodType: "veg" })).json.item?.id);
  const tableIds = {};
  for (const [number, zone] of [["T1", "Ground floor"], ["T2", "Ground floor"], ["T3", "Terrace"]]) {
    const r = (await own("POST", "/api/tables", { number, seats: 4, zone })).json;
    tableIds[number] = String(r.table?.id ?? r.id ?? r._id);
  }
  const board = async () => Object.fromEntries((await own("GET", "/api/tables")).json.tables.map((x) => [x.number, x]));
  const sessions = async () => (await own("GET", "/api/tables/sessions/active")).json.sessions;
  const place = async (table, phone, expectedSessionId) => (await own("POST", "/api/orders/staff", { tableId: tableIds[table], cart: { lines: [{ itemId: item, modifierOptionIds: [], quantity: 1 }] }, ...(phone ? { phone } : {}), ...(expectedSessionId !== undefined ? { expectedSessionId } : {}) }));
  const status = (id, to) => own("PATCH", `/api/orders/${id}/status`, { status: to });
  const manual = (id, to, tableId) => own("PATCH", `/api/orders/${id}/status/manual`, { status: to, ...(tableId ? { tableId } : {}) });
  const finish = async (orderId, sessionId) => {
    for (const to of ["preparing", "ready", "completed"]) await status(orderId, to);
    await own("POST", `/api/tables/sessions/${sessionId}/confirm-payment`, {});
  };
  const orderOf = async (id) => (await own("GET", `/api/orders/${id}?outletId=${s.outlet}`)).json.order;

  say("The mistake: Completed frees the table by itself");
  const first = (await place("T1", "9000000001")).json.order;
  ok(Boolean(first?.id), "an order is taken at T1", first?.orderNumber);
  await finish(first.id, first.sessionId);
  let b = await board();
  ok(b.T1.status === "free" && !b.T1.activeSessionId, "Completed (and paid) frees T1 by itself — that part is intended", b.T1.status);

  say("1. The table is still free: putting the order back seats the party again");
  const r1 = await manual(first.id, "preparing");
  ok(r1.status === 200 && r1.json.order?.status === "preparing", "the order goes back to Preparing", `${r1.status} ${r1.json.order?.status}`);
  ok(r1.json.table?.number === "T1" && r1.json.table?.moved === false, "the answer says the table was seated again (and that it is the same table)", JSON.stringify(r1.json.table));
  b = await board();
  ok(b.T1.status === "seated" && b.T1.activeSessionId === first.sessionId, "T1 is SEATED again, with the same party's session (this is the bug)", `${b.T1.status}`);
  ok((await sessions()).some((x) => x.id === first.sessionId && x.tableNumber === "T1"), "the party is back in the list of tables in service (the app reads this)");
  ok((await place("T1", "9000000002", null)).status === 409, "nobody else can be seated on T1 now (an order started while it looked free is refused)");

  say("2. Another party took the table meanwhile: the operator is asked to pick another table");
  await finish(first.id, first.sessionId); // completed + paid → T1 free again
  const other = (await place("T1", "9000000003")).json.order;
  ok(Boolean(other?.id), "another party is seated at T1", other?.orderNumber);
  const before = await orderOf(first.id);
  const r2 = await manual(first.id, "preparing");
  ok(r2.status === 409 && r2.json.details?.code === "table_taken", "putting the first order back is REFUSED with table_taken", `${r2.status} ${r2.json.details?.code}`);
  ok(/T1 has another party/.test(r2.json.error ?? ""), "in words the operator can use", r2.json.error);
  const free = r2.json.details?.freeTables ?? [];
  ok(free.map((x) => x.number).sort().join() === "T2,T3" && free.every((x) => x.id && x.seats === 4), "and it carries the free tables (id, number, seats) to choose from — not T1", free.map((x) => `${x.number}/${x.zone}`).join(" "));
  ok(free.some((x) => x.zone === "Terrace") && free.some((x) => x.zone === "Ground floor"), "with their areas, so the operator can group them");
  ok((await orderOf(first.id)).status === before.status && before.status === "completed", "NOTHING changed: the order is still Completed", (await orderOf(first.id)).status);
  b = await board();
  ok(b.T1.activeSessionId === other.sessionId && b.T2.status === "free" && b.T3.status === "free", "the other party still has T1, and T2 and T3 are untouched");

  say("3. Choosing a table");
  const occupied = await manual(first.id, "preparing", tableIds.T1);
  ok(occupied.status === 409 && occupied.json.details?.code === "table_taken", "choosing T1 again (it is occupied) is refused");
  const missing = await manual(first.id, "preparing", "000000000000000000000000");
  ok(missing.status === 404, "choosing a table that doesn't exist: 404", `${missing.status}`);
  const r3 = await manual(first.id, "preparing", tableIds.T3);
  ok(r3.status === 200 && r3.json.order?.status === "preparing", "choosing T3 puts the order back to Preparing", `${r3.status}`);
  ok(r3.json.table?.number === "T3" && r3.json.table?.moved === true, "the answer says it is a different table now", JSON.stringify(r3.json.table));
  b = await board();
  ok(b.T3.status === "seated" && b.T3.activeSessionId === first.sessionId, "T3 is seated with the first party's session");
  ok(b.T1.activeSessionId === other.sessionId, "the OTHER party keeps T1");
  ok((await orderOf(first.id)).tableId === tableIds.T3, "the order now says it is for T3 (orders follow their party)");
  const sess = (await sessions()).find((x) => x.id === first.sessionId);
  ok(sess?.tableNumber === "T3" && sess.tableHistory?.some((h) => h.number === "T3"), "the session's history shows the move", sess?.tableNumber);

  say("4. Not every rewind touches a table");
  const second = (await place("T3", undefined)).json.order; // another round on the same party (T3 is seated by them now)
  ok(Boolean(second?.id), "the party at T3 orders again", second?.orderNumber);
  await status(first.id, "ready"); await status(first.id, "completed");
  const r4 = await manual(first.id, "preparing");
  ok(r4.status === 200 && !r4.json.table, "while the party's session is still open (the second order is running) there is nothing to seat again — no table in the answer");
  ok((await board()).T3.status === "seated", "T3 stays seated");

  say("5. A cancelled table (voided) is put back the same way");
  const lone = (await place("T2", "9000000004")).json.order;
  await own("POST", `/api/tables/sessions/${lone.sessionId}/void`, { reason: "left" });
  ok((await board()).T2.status === "free" && (await orderOf(lone.id)).status === "cancelled", "voiding T2 cancels the order and frees the table");
  const r5 = await manual(lone.id, "accepted");
  ok(r5.status === 200 && r5.json.table?.number === "T2", "putting the cancelled order back seats T2 again", `${r5.status} ${r5.json.table?.number}`);
  ok((await board()).T2.status === "seated", "T2 is seated");

  say("6. The rule is the same for the people who may change a status");
  const staffLogin = await call("POST", "/api/users", { cookie: s.owner, headers: { "x-rasoipulse-brand": s.brand }, body: { email: "w@acme.test", name: "Waiter", password: "Staff123!", role: "staff" } });
  const waiter = (await t.cookieLogin("w@acme.test", "Staff123!"));
  const r6 = await call("PATCH", `/api/orders/${lone.id}/status/manual`, { cookie: waiter, headers: hdr, body: { status: "completed" } });
  ok(r6.status === 200, "staff can still make the correction themselves (completed again)", `${r6.status}`);
});
