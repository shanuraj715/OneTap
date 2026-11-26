// How often each mobile app asks the server for new data: ONE number per app (OMA, KDA, RDA), default 8 seconds, set by the platform admin in the
// console and announced to the app in the `x-refresh-seconds` header of every answer it gets. A private API on an in-memory database; no browser.
import { startApi } from "./_api-harness.mjs";

const t = await startApi(3118);
const { call, ok, say } = t;

await t.run(async () => {
  const s = await t.makeStore();
  const hdr = { "x-rasoipulse-brand": s.brand };
  await call("POST", "/api/users", { cookie: s.owner, headers: hdr, body: { email: "w@acme.test", name: "Waiter", password: "Staff123!", role: "staff" } });
  const waiter = await t.cookieLogin("w@acme.test", "Staff123!");
  const S = "/api/platform/app-releases/settings";
  /** an answer's refresh header as the app would read it, for a request that says it is `app` */
  const asApp = async (app, path = "/api/app-updates/check?app=oma&versionCode=1", extra = {}) => (await call("GET", path, { headers: { ...(app ? { "x-app-id": app } : {}), ...extra } })).headers.get("x-refresh-seconds");

  say("1. Nothing set yet: every app asks every 8 seconds");
  for (const app of ["oma", "kda", "rda"]) ok((await asApp(app)) === "8", `${app}: the answer says 8 seconds`, String(await asApp(app)));
  const list0 = await call("GET", S, { cookie: s.su });
  ok(list0.status === 200 && list0.json.limits?.default === 8 && list0.json.limits?.min === 3 && list0.json.limits?.max === 600, "the console is told the limits (default 8, from 3 to 600)", JSON.stringify(list0.json.limits));
  ok(list0.json.settings?.length === 3 && list0.json.settings.every((x) => x.refreshSeconds === 8 && x.isDefault === true), "and lists the three apps, all at the default", JSON.stringify(list0.json.settings?.map((x) => [x.app, x.refreshSeconds, x.isDefault])));
  ok(JSON.stringify(list0.json.settings?.map((x) => x.code)) === JSON.stringify(["OMA", "KDA", "RDA"]), "with their codes (OMA, KDA, RDA)");

  say("2. Only the platform admin can see or change it");
  for (const [who, cookie] of [["a store owner", s.owner], ["a waiter", waiter], ["nobody signed in", undefined]]) {
    const g = await call("GET", S, { cookie });
    const p = await call("PUT", `${S}/rda`, { cookie, body: { refreshSeconds: 3 } });
    ok([401, 403].includes(g.status) && [401, 403].includes(p.status), `${who} is refused (read and change)`, `${g.status}/${p.status}`);
  }
  ok((await asApp("rda")) === "8", "…and nothing changed");

  say("3. Each app has its own number: the delivery app set to 15 asks every 15 seconds");
  const put = await call("PUT", `${S}/rda`, { cookie: s.su, body: { refreshSeconds: 15 } });
  ok(put.status === 200 && put.json.setting?.app === "rda" && put.json.setting?.refreshSeconds === 15 && put.json.setting?.isDefault === false, "saving 15 for RDA is accepted", JSON.stringify(put.json));
  ok((await asApp("rda")) === "15", "the very next answer to the delivery app says 15");
  ok((await asApp("oma")) === "8" && (await asApp("kda")) === "8", "the order app and the kitchen app are still at 8");
  ok((await asApp("rda", "/api/rider/deliveries")) === "15", "the number rides on every kind of answer, e.g. the rider's delivery list (a refusal for no sign-in)");
  ok((await asApp("rda", "/api/no-such-route")) === "15", "…and on errors (404) too");
  await call("PUT", `${S}/kda`, { cookie: s.su, body: { refreshSeconds: 5 } });
  await call("PUT", `${S}/oma`, { cookie: s.su, body: { refreshSeconds: 600 } });
  ok((await asApp("kda")) === "5" && (await asApp("oma")) === "600" && (await asApp("rda")) === "15", "the kitchen app at 5, the order app at 600 (the largest allowed), the delivery app at 15");
  const list1 = await call("GET", S, { cookie: s.su });
  ok(JSON.stringify(list1.json.settings.map((x) => [x.app, x.refreshSeconds, x.isDefault])) === JSON.stringify([["oma", 600, false], ["kda", 5, false], ["rda", 15, false]]), "the console's list shows each app's own number", JSON.stringify(list1.json.settings.map((x) => [x.app, x.refreshSeconds])));

  say("4. A change is seen at once, and again by a fresh read of the database");
  await call("PUT", `${S}/rda`, { cookie: s.su, body: { refreshSeconds: 30 } });
  ok((await asApp("rda")) === "30", "changing 15 → 30: the next answer already says 30");
  const row = await t.raw("appsettings").findOne({ app: "rda" });
  ok(row?.refreshSeconds === 30, "it is stored in the database (one document per app)", JSON.stringify(row));
  await call("PUT", `${S}/rda`, { cookie: s.su, body: { refreshSeconds: 8 } });
  const back = (await call("GET", S, { cookie: s.su })).json.settings.find((x) => x.app === "rda");
  ok((await asApp("rda")) === "8" && back.refreshSeconds === 8, "setting it back to 8 works");

  say("5. Wrong numbers are refused with a message a person can act on");
  const bad = [[2, /At least 3 seconds/], [601, /At most 600 seconds/], [7.5, /whole number/], ["abc", /whole number/], [null, /whole number/], [undefined, /Enter how many seconds/], [-4, /At least 3/], [0, /At least 3/]];
  for (const [v, re] of bad) {
    const r = await call("PUT", `${S}/rda`, { cookie: s.su, body: v === undefined ? {} : { refreshSeconds: v } });
    ok(r.status === 400 && re.test(r.json.error ?? ""), `${JSON.stringify(v)} is refused (400)`, `${r.status} ${r.json.error ?? ""}`);
  }
  ok((await asApp("rda")) === "8", "and the number did not change");
  const unknown = await call("PUT", `${S}/zzz`, { cookie: s.su, body: { refreshSeconds: 10 } });
  ok(unknown.status === 404, "an app that doesn't exist is refused (404)", String(unknown.status));

  say("6. Only mobile apps are told: the dashboard, the storefront and old builds get nothing added");
  ok((await asApp(undefined)) === null, "a request with no app id has no refresh header (an old OMA build sent none)");
  ok((await asApp("zzz")) === null, "an unknown app id gets none either");
  const dash = await call("GET", "/api/auth/me", { cookie: s.owner });
  ok(dash.headers.get("x-refresh-seconds") === null, "the dashboard's own calls carry none");

  say("7. The apps' own copy of the limits matches the server's");
  const src = (await import("node:fs")).readFileSync(`${t.REPO}/packages/config-schema/src/app-release.js`, "utf8");
  ok(/APP_REFRESH = \{ default: 8, min: 3, max: 600 \}/.test(src), "APP_REFRESH is { default: 8, min: 3, max: 600 } (each app's jest suite compares its own config to this line)");
});
