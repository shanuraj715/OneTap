// A team member can be mapped to one or several outlets when their account is made (or later). They then see — and can work in — only
// those outlets: not in the outlet list, not in the tables, orders or customers of another outlet. Nothing mapped = every outlet (as
// before). A private API on an in-memory database; no browser.
import { startApi } from "./_api-harness.mjs";
const t = await startApi(3111);
const { call, ok, say } = t;

await t.run(async () => {
  say("Setup: a store with three outlets, and a second store");
  const s = await t.makeStore({ outlets: 3 });
  const [o1, o2, o3] = s.outletIds;
  ok(s.outletIds.length === 3 && new Set(s.outletIds).size === 3, "the store has three outlets", s.outletIds.map((x) => x.slice(-4)).join(" "));
  const other = await t.makeStore({ slug: "other", ownerEmail: "o@other.test" });
  const brandHdr = { "x-rasoipulse-brand": s.brand };
  const addUser = (email, role, outletIds) => call("POST", "/api/users", { cookie: s.owner, headers: brandHdr, body: { email, name: email.split("@")[0], password: "Staff123!", role, ...(outletIds ? { outletIds } : {}) } });
  const outletsOf = async (cookie) => (await call("GET", "/api/outlets", { cookie, headers: brandHdr })).json.outlets?.map((x) => String(x._id ?? x.id)) ?? [];
  const at = (cookie, outlet, path) => call("GET", path, { cookie, headers: { "x-rasoipulse-outlet": outlet } });

  say("Making accounts with outlets");
  const a = await addUser("a@acme.test", "staff", [o1]);
  const b = await addUser("b@acme.test", "staff", [o2, o3]);
  const c = await addUser("c@acme.test", "staff"); // no outlets named = every outlet (how every existing account works)
  const k = await addUser("k@acme.test", "kitchen", [o2]);
  ok([a, b, c, k].every((r) => r.status === 201), "accounts are created with one outlet, several, none (= all), and for the kitchen", [a, b, c, k].map((r) => r.status).join(" "));
  ok(JSON.stringify(a.json.user.outletIds) === JSON.stringify([o1]) && JSON.stringify(b.json.user.outletIds) === JSON.stringify([o2, o3]) && c.json.user.outletIds.length === 0, "the answer says which outlets each person has", `${a.json.user.outletIds.length} / ${b.json.user.outletIds.length} / ${c.json.user.outletIds.length}`);
  const dup = await addUser("dup@acme.test", "staff", [o1, o1, o2]);
  ok(dup.status === 201 && dup.json.user.outletIds.length === 2, "the same outlet named twice is kept once");
  const foreign = await addUser("f@acme.test", "staff", [other.outlet]);
  ok(foreign.status === 400 && /isn't part of this store/.test(foreign.json.error ?? ""), "an outlet of ANOTHER store is refused", `${foreign.status} ${foreign.json.error}`);
  const nonsense = await addUser("n@acme.test", "staff", ["nope"]);
  ok(nonsense.status === 400, "an id that is not an outlet is refused", `${nonsense.status}`);
  const owner2 = await call("POST", "/api/users", { cookie: s.su, headers: brandHdr, body: { email: "own2@acme.test", name: "Own2", password: "Staff123!", role: "owner", outletIds: [o1] } });
  ok(owner2.status === 201 && owner2.json.user.outletIds.length === 0, "an owner always has every outlet — a mapping given to an owner is dropped", `${owner2.status} ${owner2.json.user?.outletIds?.length}`);

  const A = await t.cookieLogin("a@acme.test", "Staff123!");
  const B = await t.cookieLogin("b@acme.test", "Staff123!");
  const C = await t.cookieLogin("c@acme.test", "Staff123!");
  const K = await t.cookieLogin("k@acme.test", "Staff123!");

  say("What each person sees");
  ok(JSON.stringify(await outletsOf(A)) === JSON.stringify([o1]), "A sees only their outlet in the outlet list (nothing of the others, not even names)");
  ok(JSON.stringify((await outletsOf(B)).sort()) === JSON.stringify([o2, o3].sort()), "B sees their two");
  ok((await outletsOf(C)).length === 3, "C, who was not mapped, sees all three (nothing changes for existing accounts)");
  ok((await outletsOf(s.owner)).length === 3, "the owner sees all three");
  ok(JSON.stringify(await outletsOf(K)) === JSON.stringify([o2]), "the kitchen account sees only theirs");
  const raw = (await call("GET", "/api/outlets", { cookie: A, headers: brandHdr })).text;
  ok(!raw.includes(o2) && !raw.includes(o3) && !raw.includes("Outlet 2") && !raw.includes("Outlet 3"), "the other outlets' ids and names are nowhere in A's answer");

  say("What each person can do");
  ok((await at(A, o1, "/api/tables")).status === 200, "A can read the tables of their outlet");
  for (const [what, path] of [["tables", "/api/tables"], ["orders", "/api/orders"], ["tables in service", "/api/tables/sessions/active"]]) {
    const r = await at(A, o2, path);
    ok(r.status === 403 && /access to this outlet/.test(r.json.error ?? ""), `A is refused the ${what} of another outlet`, `${r.status} ${r.json.error ?? ""}`);
  }
  const place = await call("POST", "/api/orders/staff/quote", { cookie: A, headers: { "x-rasoipulse-outlet": o2 }, body: { cart: { lines: [] } } });
  ok(place.status === 403, "…and cannot price or place an order for it", `${place.status}`);
  ok((await at(B, o3, "/api/tables")).status === 200 && (await at(B, o2, "/api/tables")).status === 200, "B can use both of theirs");
  ok((await at(B, o1, "/api/tables")).status === 403, "but not the one they were not given");
  ok((await at(C, o1, "/api/tables")).status === 200 && (await at(C, o3, "/api/tables")).status === 200, "C (no mapping) can use every outlet");
  ok((await at(K, o1, "/api/tables")).status === 403, "the kitchen account is held to its outlet too");
  const viaApp = await call("POST", "/api/auth/app-login", { body: { email: "a@acme.test", password: "Staff123!" } });
  const appOutlets = (await call("GET", "/api/outlets", { bearer: viaApp.json.token, headers: brandHdr })).json.outlets?.map((x) => String(x._id ?? x.id));
  ok(JSON.stringify(appOutlets) === JSON.stringify([o1]), "the staff app (Bearer sign-in) gets the same restricted list", `${appOutlets?.length}`);
  ok((await call("GET", "/api/orders", { bearer: viaApp.json.token, headers: { "x-rasoipulse-outlet": o3 } })).status === 403, "…and the same refusal for another outlet");

  say("Changing the mapping later");
  const uid = a.json.user.id;
  const up = await call("PATCH", `/api/users/${uid}`, { cookie: s.owner, headers: brandHdr, body: { outletIds: [o1, o3] } });
  ok(up.status === 200 && up.json.user.outletIds.length === 2, "the owner gives A a second outlet", `${up.status}`);
  ok((await outletsOf(A)).sort().join() === [o1, o3].sort().join() && (await at(A, o3, "/api/tables")).status === 200, "A sees and can use it straight away (no new sign-in needed)");
  const down = await call("PATCH", `/api/users/${uid}`, { cookie: s.owner, headers: brandHdr, body: { outletIds: [o3] } });
  ok(down.status === 200 && (await at(A, o1, "/api/tables")).status === 403, "taking an outlet away takes the access away at once");
  const all = await call("PATCH", `/api/users/${uid}`, { cookie: s.owner, headers: brandHdr, body: { outletIds: [] } });
  ok(all.status === 200 && (await outletsOf(A)).length === 3, "an empty list means every outlet again");
  ok((await call("PATCH", `/api/users/${uid}`, { cookie: s.owner, headers: brandHdr, body: { outletIds: [other.outlet] } })).status === 400, "an outlet of another store is refused here too");
  const renamed = await call("PATCH", `/api/users/${uid}`, { cookie: s.owner, headers: brandHdr, body: { name: "New Name" } });
  ok(renamed.status === 200 && renamed.json.user.outletIds.length === 0, "editing something else (the name) leaves the outlets as they are");
  const me = (await call("GET", "/api/users", { cookie: s.owner, headers: brandHdr })).json.users.find((x) => x.email === s.ownerEmail);
  const self = await call("PATCH", `/api/users/${me.id}`, { cookie: s.owner, headers: brandHdr, body: { outletIds: [o1] } });
  ok(self.status === 403 || self.status === 400, "the owner's own account cannot be changed from the store (owners are managed by Rasoi Pulse)", `${self.status}`);
  ok((await call("PATCH", `/api/users/${uid}`, { cookie: A, headers: brandHdr, body: { outletIds: [] } })).status === 403, "a staff member cannot change anyone's access");

  say("The list the owner manages from");
  const list = (await call("GET", "/api/users", { cookie: s.owner, headers: brandHdr })).json.users;
  const rowB = list.find((x) => x.email === "b@acme.test");
  ok(rowB && JSON.stringify(rowB.outletIds) === JSON.stringify([o2, o3]), "GET /api/users shows each person's outlets (the dashboard form reads this)");
});
