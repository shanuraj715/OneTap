// A printer's cloud API key never leaves the server: the answer says only THAT a key is set (and a masked tail), and carries nothing of the
// stored copy — before this check the printer's `connection` was a raw Mongoose sub-document, which spread its internals (`$__parent`,
// `_doc` …: the whole printer, with the key as it is stored) into every answer, to anyone who may read printers (a waiter, the kitchen…).
// API checks on an in-memory database; nothing real is touched.
import { startApi } from "./_api-harness.mjs";

const t = await startApi(3124);
const { call, ok, say } = t;

await t.run(async () => {
  const s = await t.makeStore({ slug: "leak", ownerEmail: "o@leak.test" });
  const h = { "x-rasoipulse-outlet": s.outlet, "x-rasoipulse-brand": s.brand };
  const KEY = "SECRET-KEY-123456789";
  const clean = (text, what) => {
    ok(!text.includes(KEY), `${what}: the key itself is not in the answer`);
    ok(!/\$__|\$isNew|"_doc"|"\$__parent"/.test(text), `${what}: no database internals ($__parent, _doc …) in the answer`);
  };

  say("1. Creating a cloud printer with a key");
  const made = await call("POST", "/api/printing/printers", { cookie: s.owner, headers: h, body: { name: "Cloud", station: "kitchen", docType: "kot", target: "cloud", paperWidth: "80mm", connection: { cloudPrinterId: "P-1", cloudApiKey: KEY } } });
  ok(made.status === 201, "the printer is created", `HTTP ${made.status}`);
  const stored = (await t.raw("printers").findOne({}))?.connection?.cloudApiKey;
  ok(typeof stored === "string" && stored && stored !== KEY && !stored.includes(KEY), "in the database the key is stored scrambled (encrypted), not as typed");
  clean(made.text, "the create answer");
  ok(!made.text.includes(stored), "the create answer does not carry the stored (scrambled) copy either");
  const p = made.json.printer;
  ok(p.cloudApiKeySet === true, "it says a key is set (cloudApiKeySet)");
  ok(p.connection.cloudApiKey && p.connection.cloudApiKey !== KEY && p.connection.cloudApiKey !== stored && p.connection.cloudApiKey.length < 20, "…and shows only a short masked tail", String(p.connection.cloudApiKey));
  ok(p.connection.cloudPrinterId === "P-1" && p.connection.port === 80 && "host" in p.connection && "agentId" in p.connection, "the other connection fields are all still there (the dashboard reads them)");

  say("2. Listing, as the owner and as a waiter");
  const list = await call("GET", "/api/printing/printers", { cookie: s.owner, headers: h });
  clean(list.text, "the owner's list");
  ok(!list.text.includes(stored), "the owner's list does not carry the stored copy");
  ok(list.json.printers[0].connection.cloudPrinterId === "P-1", "the list still shows the printer's connection details");
  await call("POST", "/api/users", { cookie: s.owner, headers: h, body: { email: "w@leak.test", name: "Waiter", password: "Staff123!", role: "staff" } });
  const login = await call("POST", "/api/auth/app-login", { body: { email: "w@leak.test", password: "Staff123!" } });
  const asWaiter = await call("GET", "/api/printing/printers", { bearer: login.json.token, headers: { "x-rasoipulse-outlet": s.outlet } });
  ok(asWaiter.status === 200 && asWaiter.json.printers.length === 1, "a waiter can read the printers", `HTTP ${asWaiter.status}`);
  clean(asWaiter.text, "the waiter's list");
  ok(!asWaiter.text.includes(stored), "the waiter's list does not carry the stored copy");

  say("3. Changing the printer");
  const patched = await call("PATCH", `/api/printing/printers/${p.id}`, { cookie: s.owner, headers: h, body: { name: "Cloud 2" } });
  ok(patched.status === 200 && patched.json.printer.name === "Cloud 2", "a rename works");
  clean(patched.text, "the change answer");
  ok(patched.json.printer.cloudApiKeySet === true, "renaming keeps the key (still set)");
  const again = await t.raw("printers").findOne({});
  ok(again.connection.cloudApiKey === stored, "…and the stored key is untouched");
});
