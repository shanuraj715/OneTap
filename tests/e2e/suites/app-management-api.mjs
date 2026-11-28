// App Management is data, not code: the platform admin adds an app (a name is enough), changes its words, makes it public or private, uploads its
// versions and removes it — the built-in apps (oma, kda, rda, admin, business) are rows in the database too, but can't be removed.
// A private API on an in-memory database, files in a temporary folder; no browser.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeApk, startApi } from "./_api-harness.mjs";

const base = fs.mkdtempSync(path.join(os.tmpdir(), "app-mgmt-"));
const dir = path.join(base, ".app-releases");
const t = await startApi(3117, { APP_RELEASES_DIR: dir, UPLOADS_DIR: ".uploads-t140", APP_RELEASE_MAX_MB: "20", WEBSITE_URL: "https://site.example.test" });
fs.rmSync(path.join(process.cwd(), ".uploads-t140"), { recursive: true, force: true });
const { call, ok, say } = t;

await t.run(async () => {
  const s = await t.makeStore();
  const brandHdr = { "x-rasoipulse-brand": s.brand };
  await call("POST", "/api/users", { cookie: s.owner, headers: brandHdr, body: { email: "w@acme.test", name: "Waiter", password: "Staff123!", role: "staff" } });
  const A = "/api/platform/app-releases";
  const admin = (method, p, body) => call(method, A + p, { cookie: s.su, body });
  const listed = async () => (await call("GET", "/api/app-updates/apps")).json.apps.map((a) => a.id);
  const settingOf = async (slug) => (await admin("GET", "/settings")).json.settings.find((x) => x.app === slug);
  const registry = await import(`${t.API}/src/modules/app-releases/app-registry.js`);

  say("1. The built-in apps are rows in the database, in a fixed order");
  const first = await admin("GET", "/settings");
  const slugs = first.json.settings.map((x) => x.app);
  ok(first.status === 200 && slugs.join() === "oma,kda,rda,admin,business", "the console lists the five built-in apps in order", slugs.join());
  ok(first.json.settings.every((x) => x.builtIn === true), "…each marked as built in");
  ok((await t.raw("apps").countDocuments({})) === 5, "…and they were written to the apps collection (so the console owns them from now on)");
  ok(!(await listed()).includes("business") && !(await listed()).includes("admin"), "Business and Admin start PRIVATE: not in the website's list");
  ok((await listed()).join() === "oma,kda,rda", "…while Staff, Kitchen and Rider are public", (await listed()).join());

  say("2. Only the platform admin adds, edits, removes");
  const s2 = await t.cookieLogin("w@acme.test", "Staff123!");
  for (const [who, cookie] of [["a store owner", s.owner], ["a waiter", s2], ["nobody signed in", undefined]]) {
    const r = await call("POST", `${A}/apps`, { cookie, body: { name: "Sneaky" } });
    ok(r.status === 401 || r.status === 403, `${who} cannot add an app`, `${r.status}`);
  }
  ok((await call("PATCH", `${A}/apps/oma`, { cookie: s.owner, body: { tagline: "x" } })).status === 403, "…nor change one");
  ok((await call("DELETE", `${A}/apps/business`, { cookie: s.owner })).status === 403, "…nor remove one");

  say("3. Add an app with just a name");
  const made = await admin("POST", "/apps", { name: "Rasoi Pulse POS" });
  const pos = made.json.setting;
  ok(made.status === 201 && pos?.app === "rasoi-pulse-pos", "the address is made from the name", pos?.app);
  ok(pos?.code === "RPP" && pos.name === "Rasoi Pulse POS", "…and so is the code on its icon (capitals of the words)", pos?.code);
  ok(pos?.public === false && pos?.builtIn === false, "it starts PRIVATE and is not built in");
  ok(!(await listed()).includes("rasoi-pulse-pos"), "…so it is not in the website's list yet");
  const page = await call("GET", "/api/app-updates/releases?app=rasoi-pulse-pos");
  ok(page.status === 200 && page.json.app?.name === "Rasoi Pulse POS" && page.json.app.listed === false, "its own page still opens for anyone with the link (the website reads the app from here)");
  ok(page.json.pageUrl === "https://site.example.test/apps/rasoi-pulse-pos" && page.json.releases.length === 0, "…at /apps/<address>, with no versions yet", page.json.pageUrl);
  ok(!("createdBy" in (page.json.app ?? {})) && !("builtIn" in (page.json.app ?? {})), "…and no internal fields are shown to the public");
  ok((await admin("GET", "/settings")).json.settings.at(-1).app === "rasoi-pulse-pos", "the new app comes after the built-in ones in the console");

  say("4. Wrong details are refused with a clear sentence");
  const bad = async (body) => admin("POST", "/apps", body);
  ok((await bad({})).status === 400, "no name: 400");
  ok((await bad({ name: "x" })).status === 400, "a one-letter name: 400");
  const dupSame = await bad({ name: "Rasoi Pulse POS" });
  ok(dupSame.status === 409 && /already an app/.test(dupSame.json.error ?? ""), "the same name (same address) again: 409 and says so", dupSame.json.error);
  const dupBuiltIn = await bad({ name: "Another", slug: "oma" });
  ok(dupBuiltIn.status === 409, "an address that a built-in app already has: 409");
  ok((await bad({ name: "Another", slug: "Bad Address" })).status === 400, "an address with capitals and spaces: 400");
  ok((await bad({ name: "Another", slug: "-x-" })).status === 400, "an address that starts or ends with a hyphen: 400");
  ok((await bad({ name: "Another", slug: "a".repeat(31) })).status === 400, "an address over 30 characters: 400");
  ok((await bad({ name: "Another", code: "TOOLONG" })).status === 400, "a code over 5 characters: 400");
  ok((await bad({ name: "Another", code: "a!" })).status === 400, "a code with a symbol: 400");
  ok((await bad({ name: "!!!" })).status === 400, "a name with no letters or numbers to make an address from: 400");
  ok((await admin("GET", "/settings")).json.settings.length === 6, "none of those left an app behind", `${(await admin("GET", "/settings")).json.settings.length} apps`);

  say("5. Change an app's words — never its address");
  const edit = await admin("PATCH", "/apps/rasoi-pulse-pos", { name: "Rasoi Pulse Counter", tagline: "Billing at the counter", audience: "For cashiers", description: "Bill a walk-in guest in seconds.", code: "pos" });
  ok(edit.status === 200 && edit.json.setting.name === "Rasoi Pulse Counter" && edit.json.setting.code === "POS", "name changed; the code is upper-cased", `${edit.json.setting?.name} / ${edit.json.setting?.code}`);
  const page2 = await call("GET", "/api/app-updates/releases?app=rasoi-pulse-pos");
  ok(page2.json.app.tagline === "Billing at the counter" && page2.json.app.audience === "For cashiers" && /walk-in/.test(page2.json.app.description), "the public page shows the new words at once (not after the cache runs out)");
  ok(page2.json.app.slug === "rasoi-pulse-pos", "the address stayed the same");
  await admin("PATCH", "/apps/rasoi-pulse-pos", { slug: "something-else", builtIn: true, isPublic: true });
  const still = await settingOf("rasoi-pulse-pos");
  ok(still?.app === "rasoi-pulse-pos" && still.builtIn === false && still.public === false, "an address, 'built in' or 'public' sent in an edit is ignored");
  ok((await admin("PATCH", "/apps/rasoi-pulse-pos", {})).status === 400, "an edit with nothing in it: 400");
  ok((await admin("PATCH", "/apps/rasoi-pulse-pos", { name: "" })).status === 400, "an empty name: 400");
  ok((await admin("PATCH", "/apps/no-such-app", { tagline: "x" })).status === 404, "an app that doesn't exist: 404");
  const oma = await admin("PATCH", "/apps/oma", { tagline: "Run the floor" });
  ok(oma.status === 200 && (await call("GET", "/api/app-updates/releases?app=oma")).json.app.tagline === "Run the floor", "a built-in app's words can be changed too (the console owns them)");

  say("6. Public / private");
  const pub = await admin("PUT", "/visibility/rasoi-pulse-pos", { public: true });
  ok(pub.status === 200 && pub.json.setting.public === true, "make it public");
  const inList = (await call("GET", "/api/app-updates/apps")).json.apps.find((a) => a.id === "rasoi-pulse-pos");
  ok(inList?.name === "Rasoi Pulse Counter" && inList.code === "POS" && inList.page === "/apps/rasoi-pulse-pos" && inList.latest === null, "it is in the website's list with its name, code, page and no version yet", JSON.stringify(inList));
  ok((await listed()).at(-1) === "rasoi-pulse-pos", "…after the built-in apps");
  ok((await admin("PUT", "/visibility/rasoi-pulse-pos", { public: "yes" })).status === 400, "'public' must be true or false");
  ok((await admin("PUT", "/visibility/no-such-app", { public: true })).status === 404, "an app that doesn't exist: 404");
  await admin("PUT", "/visibility/rasoi-pulse-pos", { public: false });
  ok(!(await listed()).includes("rasoi-pulse-pos"), "make it private again: gone from the list, page still opens", String((await call("GET", "/api/app-updates/releases?app=rasoi-pulse-pos")).status));
  const biz = await admin("PUT", "/visibility/business", { public: true });
  ok(biz.status === 200 && (await listed()).includes("business"), "the Business app can be made public (and it shows in the list)");
  await admin("PUT", "/visibility/business", { public: false });

  say("7. Versions of an app that was added in the console");
  const CHUNK = 4 * 1024 * 1024;
  const upload = async (app, apk, version, extra = {}) => {
    const start = await admin("POST", "/uploads", { fileName: `${app}.apk`, size: apk.length, app });
    if (start.status !== 201) return { start };
    await fetch(`${t.base}${A}/uploads/${start.json.uploadId}/chunks/0`, { method: "PUT", headers: { cookie: s.su, "content-type": "application/octet-stream", "x-forwarded-for": "198.51.100.90" }, body: apk.subarray(0, CHUNK) });
    const done = await admin("POST", `/uploads/${start.json.uploadId}/complete`, { version, publish: true, notes: "First", ...extra });
    return { start, done };
  };
  const apk = makeApk(6000);
  const up = await upload("rasoi-pulse-pos", apk, "v-26.11.28-002");
  ok(up.start.status === 201 && up.done.status === 201 && up.done.json.release.app === "rasoi-pulse-pos", "a file can be uploaded and published for the new app", `${up.done?.status}`);
  const nope = await admin("POST", "/uploads", { fileName: "a.apk", size: 6000, app: "no-such-app" });
  ok(nope.status === 404 || nope.status === 400, "…but not for an app that doesn't exist", `${nope.status}`);
  const chk = await call("GET", "/api/app-updates/check?app=rasoi-pulse-pos&versionCode=1");
  ok(chk.json.updateAvailable === true && chk.json.latest?.version === "v-26.11.28-002", "a phone running that app is told about its version");
  ok((await call("GET", "/api/app-updates/check?app=oma&versionCode=1")).json.latest === null, "…and the other apps are not affected");
  const rel = (await call("GET", "/api/app-updates/releases?app=rasoi-pulse-pos")).json;
  ok(rel.latest?.version === "v-26.11.28-002" && rel.releases.length === 1, "its page lists the version");
  const dl = await call("GET", `/api/app-updates/download/${rel.latest.id}`);
  ok(dl.status === 200 && /rasoi-pulse-rasoi-pulse-pos-v-26\.11\.28-002\.apk/.test(dl.headers.get("content-disposition") ?? ""), "the file downloads under a name that tells which app it is", dl.headers.get("content-disposition") ?? "");
  const withApp = await call("GET", "/api/health", { headers: { "x-app-id": "rasoi-pulse-pos" } });
  ok(!withApp.headers.get("x-refresh-seconds") || Number(withApp.headers.get("x-refresh-seconds")) > 0, "a request from the app is answered normally (the refresh number is told only if set)");

  say("8. Refresh interval is per app, also for the new one");
  const ri = await admin("PUT", "/settings/rasoi-pulse-pos", { refreshSeconds: 30 });
  ok(ri.status === 200 && ri.json.setting.refreshSeconds === 30, "its refresh interval can be set");
  const hdr = await call("GET", "/api/health", { headers: { "x-app-id": "rasoi-pulse-pos" } });
  ok(hdr.headers.get("x-refresh-seconds") === "30", "…and its requests are answered with that number", String(hdr.headers.get("x-refresh-seconds")));
  const unknown = await call("GET", "/api/health", { headers: { "x-app-id": "mystery" } });
  ok(!unknown.headers.get("x-refresh-seconds"), "an app nobody knows is told nothing");
  ok((await admin("PUT", "/settings/no-such-app", { refreshSeconds: 30 })).status === 404, "a refresh number for an unknown app: 404");

  say("9. Signing in from an app that was added in the console");
  const login = await call("POST", "/api/auth/app-login", { headers: { "x-app-id": "rasoi-pulse-pos" }, body: { email: "w@acme.test", password: "Staff123!" } });
  ok(login.status === 200 && login.json.token, "any account may sign in (the new app has no role rule of its own)", `${login.status}`);
  const kda = await call("POST", "/api/auth/app-login", { headers: { "x-app-id": "kda" }, body: { email: "w@acme.test", password: "Staff123!" } });
  ok(kda.status === 403 && kda.json.details?.code === "app_not_allowed", "…while the built-in Kitchen app still turns a waiter away", `${kda.status}`);

  say("10. Removing an app");
  const withVersions = await admin("DELETE", "/apps/rasoi-pulse-pos");
  ok(withVersions.status === 409 && /still has 1 version/.test(withVersions.json.error ?? ""), "an app that still has versions can't be removed (nothing is lost by accident)", withVersions.json.error);
  const builtInDel = await admin("DELETE", "/apps/business");
  ok(builtInDel.status === 400 && /can't be removed/.test(builtInDel.json.error ?? ""), "a built-in app can't be removed — it can be made private instead", builtInDel.json.error);
  ok((await admin("DELETE", "/apps/no-such-app")).status === 404, "an app that doesn't exist: 404");
  await admin("DELETE", `/${rel.latest.id}`);
  const gone = await admin("DELETE", "/apps/rasoi-pulse-pos");
  ok(gone.status === 200, "after its versions are deleted the app can be removed");
  ok((await call("GET", "/api/app-updates/releases?app=rasoi-pulse-pos")).status === 404, "its page is gone (404)");
  ok(!(await admin("GET", "/settings")).json.settings.some((x) => x.app === "rasoi-pulse-pos") && !(await listed()).includes("rasoi-pulse-pos"), "…and it is not in the console or the website's list any more");
  ok((await t.raw("appsettings").countDocuments({ app: "rasoi-pulse-pos" })) === 0, "…and its refresh setting is cleaned up too");
  const again = await admin("POST", "/apps", { name: "Rasoi Pulse POS" });
  ok(again.status === 201, "the same address can be used again afterwards");
  await admin("DELETE", "/apps/rasoi-pulse-pos");

  say("11. An older database: what was chosen before apps became data is kept");
  // the earlier version kept only a Public/Private choice (and the refresh seconds) per built-in app; the apps collection did not exist yet
  await t.raw("apps").deleteMany({});
  await t.raw("appsettings").deleteMany({});
  await t.raw("appsettings").insertMany([
    { app: "business", isPublic: true, refreshSeconds: 12 },
    { app: "rda", isPublic: false, refreshSeconds: 20 },
  ]);
  registry.invalidateApps();
  const mig = await admin("GET", "/settings");
  const byApp = Object.fromEntries(mig.json.settings.map((x) => [x.app, x]));
  ok(mig.json.settings.map((x) => x.app).join() === "oma,kda,rda,admin,business", "the five built-in apps are written again, in order");
  ok(byApp.business.public === true && byApp.rda.public === false, "…carrying over what was chosen: Business public, Rider private");
  ok(byApp.oma.public === true && byApp.admin.public === false, "…and the usual start for apps nobody chose for (Staff public, Admin private)");
  ok(byApp.rda.refreshSeconds === 20 && byApp.business.refreshSeconds === 12, "the refresh seconds saved before are still in force");
  ok((await listed()).join() === "oma,kda,business", "the website's list follows", (await listed()).join());
});
