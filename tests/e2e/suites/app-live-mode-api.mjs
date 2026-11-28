// App Management → "Live connection": how an app that can listen (OMA, KDA, RDA) gets new data — the live connection first ("websocket", the default) or only on a
// timer ("polling"). Polling is the backup in both modes. A private API with the realtime hub attached; real WebSocket clients play the apps. No browser.
import { createRequire } from "node:module";
import { startApi } from "./_api-harness.mjs";

const PORT = 3131;
const t = await startApi(PORT, {}, { realtime: true });
const { call, ok, say, raw } = t;
const WS = createRequire(`${t.API}/package.json`)("ws");
const schema = await import(`${t.REPO}/packages/config-schema/src/index.js`);
const hub = await import(`${t.API}/src/realtime/hub.js`);
const registry = await import(`${t.API}/src/modules/app-releases/app-registry.js`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await sleep(40); } return false; };

let ipn = 0;
/** an app listening: resolves when the answer to the upgrade is known */
function listen(query, token) {
  return new Promise((resolve) => {
    const ws = new WS(`ws://127.0.0.1:${PORT}/realtime?${query}`, { headers: { authorization: `Bearer ${token}`, "x-forwarded-for": `198.51.100.${(ipn = (ipn % 200) + 1)}` } });
    const c = { ws, status: null, closeCode: null, reason: "", events: [] };
    ws.on("message", (d) => c.events.push(JSON.parse(String(d))));
    ws.on("close", (code, reason) => { c.closeCode = code; c.reason = String(reason); });
    ws.on("unexpected-response", (_rq, res) => { c.status = res.statusCode; resolve(c); });
    ws.on("error", () => {});
    ws.on("open", () => { c.status = 101; resolve(c); });
  });
}
const appLogin = async (email, app) => (await (await fetch(`${t.base}/api/auth/app-login`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${(ipn = (ipn % 200) + 1)}`, "x-app-id": app }, body: JSON.stringify({ email, password: "Staff123!" }) })).json()).token;

await t.run(async () => {
  const s = await t.makeStore({ slug: "acme", ownerEmail: "o@acme.test" });
  const hdr = { "x-rasoipulse-brand": s.brand };
  for (const [email, role] of [["cook@acme.test", "kitchen"], ["waiter@acme.test", "staff"]]) await call("POST", "/api/users", { cookie: s.owner, headers: hdr, body: { email, name: email, password: "Staff123!", role } });
  const waiter = await appLogin("waiter@acme.test", "oma");
  const cook = await appLogin("cook@acme.test", "kda");
  ok(Boolean(waiter && cook), "set-up: a waiter and a cook can sign in to their apps");
  const A = "/api/platform/app-releases";
  const admin = (method, path, body) => call(method, A + path, { cookie: s.su, body });
  const settingOf = async (slug) => (await admin("GET", "/settings")).json.settings.find((x) => x.app === slug);
  const q = (app) => `app=${app}&outletId=${s.outlet}`;

  say("1. What the console is told");
  ok(JSON.stringify(schema.APPS_WITH_LIVE) === JSON.stringify(Object.keys(hub.LIVE_APPS)), "the apps the console lets you choose for are exactly the apps the hub can serve", schema.APPS_WITH_LIVE.join());
  for (const slug of ["oma", "kda", "rda"]) { const x = await settingOf(slug); ok(x.supportsLive === true && x.liveMode === "websocket", `${slug}: can listen, and starts on the live connection`, `${x.supportsLive} ${x.liveMode}`); }
  for (const slug of ["admin", "business"]) { const x = await settingOf(slug); ok(x.supportsLive === false, `${slug}: has no live connection, so no choice`); }

  say("2. Who may change it, and what is refused");
  ok((await call("PUT", `${A}/live-mode/oma`, { cookie: s.owner, body: { liveMode: "polling" } })).status === 403, "a store owner can NOT change it: 403");
  ok((await call("PUT", `${A}/live-mode/oma`, { body: { liveMode: "polling" } })).status === 401, "nobody signed in: 401");
  ok((await admin("PUT", "/live-mode/business", { liveMode: "polling" })).status === 400, "an app with no live connection (Business): 400 with a reason", (await admin("PUT", "/live-mode/business", { liveMode: "polling" })).json.error);
  ok((await admin("PUT", "/live-mode/nope", { liveMode: "polling" })).status === 404, "an app that doesn't exist: 404");
  ok((await admin("PUT", "/live-mode/oma", { liveMode: "carrier-pigeon" })).status === 400 && (await admin("PUT", "/live-mode/oma", {})).status === 400, "something that isn't 'websocket' or 'polling': 400");
  ok((await settingOf("oma")).liveMode === "websocket", "…and nothing changed");

  say("3. Live connection (the default): the app can listen");
  const w1 = await listen(q("oma"), waiter);
  ok(w1.status === 101 && (await until(() => w1.events.some((e) => e.type === "hello"))), "OMA connects and is greeted");
  const k1 = await listen(q("kda"), cook);
  ok(k1.status === 101, "KDA connects");

  say("4. Switch OMA to polling: its open connections are let go at once, new ones are refused");
  const sw = await admin("PUT", "/live-mode/oma", { liveMode: "polling" });
  ok(sw.status === 200 && sw.json.setting.liveMode === "polling" && sw.json.setting.refreshSeconds > 0, "the console switches OMA to polling (its refresh interval is still there: it is the timer)");
  ok(await until(() => w1.closeCode !== null), "OMA's open connection is closed right away");
  ok(w1.closeCode === 4410 && /polling/.test(w1.reason), "…with the code the apps already understand (4410) and the reason", `${w1.closeCode} ${w1.reason}`);
  ok(k1.closeCode === null, "KDA's connection is NOT touched");
  const w2 = await listen(q("oma"), waiter);
  ok(w2.status === 503, "a new OMA connection is refused with 503 (an app that gets 503 falls back to asking on its timer)", `${w2.status}`);
  const k2 = await listen(q("kda"), cook);
  ok(k2.status === 101, "KDA still connects");
  const hdrs = await call("GET", "/api/health", { headers: { "x-app-id": "oma" } });
  ok(Number(hdrs.headers.get("x-refresh-seconds")) > 0, "OMA is still told how often to ask (the timer), in the x-refresh-seconds header of every answer", String(hdrs.headers.get("x-refresh-seconds")));
  ok((await t.raw("apps").findOne({ slug: "oma" })).liveMode === "polling", "the choice is stored with the app");
  registry.invalidateApps();
  ok((await settingOf("oma")).liveMode === "polling", "…and survives the memory being cleared (the other servers see it within seconds)");

  say("5. Switch back: the live connection works again");
  const back = await admin("PUT", "/live-mode/oma", { liveMode: "websocket" });
  ok(back.status === 200 && back.json.setting.liveMode === "websocket", "OMA is set back to the live connection");
  const w3 = await listen(q("oma"), waiter);
  ok(w3.status === 101 && (await until(() => w3.events.some((e) => e.type === "hello"))), "…and connects again, with no restart");
  ok((await admin("PUT", "/live-mode/oma", { liveMode: "websocket" })).status === 200, "choosing what is already chosen is harmless");
  ok(w3.closeCode === null, "…and does not drop anyone");

  say("6. An older database");
  await t.raw("apps").updateMany({}, { $unset: { liveMode: "" } });
  registry.invalidateApps();
  ok((await settingOf("oma")).liveMode === "websocket" && (await settingOf("rda")).liveMode === "websocket", "apps saved before this setting existed are on the live connection");

  for (const c of [w1, w2, w3, k1, k2]) try { c.ws.close(); } catch { /* gone */ }
});
