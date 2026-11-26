// Shared start-up for the API-only suites: a private API on an in-memory database (nothing real is touched), no browser.
//   const t = await startApi(3109);   t.call(...), t.ok(...), t.say(...), t.finish()
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath as __f } from "node:url";
import { mkdirSync as __mk } from "node:fs";

export async function startApi(port, extraEnv = {}) {
  const REPO = __f(new URL("../../..", import.meta.url)).replace(/\/$/, "");
  const API = `${REPO}/apps/api`;
  const __RUN = __f(new URL("../.bench/suite-run/", import.meta.url));
  __mk(__RUN, { recursive: true });
  process.chdir(__RUN); // no .env here → the real database URI is never read
  const req = createRequire(`${API}/package.json`);
  const mms = await import(pathToFileURL(req.resolve("mongodb-memory-server")).href);
  const mongod = await (mms.MongoMemoryServer ?? mms.default.MongoMemoryServer).create();
  Object.assign(process.env, { NODE_ENV: "development", API_PORT: String(port), MONGODB_URI: mongod.getUri(), MONGODB_DB: "sandbox", LOG_LEVEL: "error", ...extraEnv });
  const db = await import(`${REPO}/packages/db/src/index.js`);
  await db.connectDb({ uri: mongod.getUri(), dbName: "sandbox" });
  const { env } = await import(`${API}/src/env.js`);
  const { createApp } = await import(`${API}/src/app.js`);
  const { ensureSuperAdmin } = await import(`${API}/src/modules/auth/auth.service.js`);
  const server = createApp().listen(port);
  await new Promise((r) => server.once("listening", r));
  await ensureSuperAdmin({ email: "super@sandbox.test", name: "Super", password: "Super123!" });
  env.RATE_LIMITS = "off";

  const base = `http://127.0.0.1:${port}`;
  let n = 0;
  const fresh = () => `198.51.100.${(n = (n % 250) + 1)}`;
  const call = async (method, path, { body, cookie, bearer, headers = {} } = {}) => {
    const r = await fetch(base + path, {
      method,
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), "x-forwarded-for": fresh(), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text(); let json = {}; try { json = JSON.parse(text); } catch {}
    return { status: r.status, json, text, headers: r.headers };
  };
  const cookieLogin = async (email, password) => (await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": fresh() }, body: JSON.stringify({ email, password }) })).headers.get("set-cookie")?.split(";")[0];

  let pass = 0, fail = 0;
  const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
  const say = (s) => console.log(`\n=== ${s}`);

  /** a store with an owner and one outlet; returns ids and the owner's cookie */
  async function makeStore({ slug = "acme", ownerEmail = "o@acme.test", outlets = 1 } = {}) {
    const su = await cookieLogin("super@sandbox.test", "Super123!");
    const made = (await call("POST", "/api/brands", { cookie: su, body: { brandName: slug, brandSlug: slug, outletName: "Main", outletSlug: "main", hostnames: [`${slug}.test`], ownerEmail, ownerName: "Owner", ownerPassword: "Owner123!" } })).json;
    const brand = String(made.brand?._id ?? made.brand?.id ?? made.brandId);
    const first = String(made.outlet?._id ?? made.outlet?.id ?? made.outletId);
    const owner = await cookieLogin(ownerEmail, "Owner123!");
    const outletIds = [first];
    for (let i = 2; i <= outlets; i++) {
      const o = await call("POST", "/api/outlets", { cookie: owner, headers: { "x-rasoipulse-brand": brand }, body: { name: `Outlet ${i}`, slug: `outlet-${i}` } });
      outletIds.push(String(o.json.outlet?._id ?? o.json.outlet?.id ?? o.json._id ?? o.json.id));
    }
    return { su, brand, outlet: first, outletIds, owner, ownerEmail };
  }
  async function finish() {
    server.close();
    await mongod.stop();
    console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
  /** run the suite body; an unexpected error is a FAILED check with the error, never a silent stop */
  async function run(body) {
    try { await body(); } catch (e) { ok(false, "the suite stopped with an error", String(e?.stack ?? e).split("\n").slice(0, 4).join(" | ")); }
    await finish();
  }
  return { REPO, API, db, env, base, call, cookieLogin, ok, say, makeStore, finish, run, raw: (c) => db.mongoose.connection.db.collection(c) };
}
