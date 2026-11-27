// Roles for the Rasoi Pulse team (platform console) — the server's side. A private API on an in-memory database, no browser. What is checked:
//   1. only the super admin makes roles and team members (names, features, password rules, duplicates);
//   2. a team member sees and may do ONLY what their role holds — in every part of the platform API, with the same answer for the app's Bearer token;
//   3. a role's change reaches the people holding it at once (no new sign-in), a person switched off or given a new password is signed out at once;
//   4. a restaurant's own staff can't get in, team members can't get into a store, nobody can make themselves bigger;
//   5. every route of the platform API has been decided on (a new route is closed until a rule is written) — and the sign-in of the Admin app.
import { execFileSync } from "node:child_process";
import { startApi } from "./_api-harness.mjs";

const t = await startApi(3131);
const { call, ok, say, raw } = t;
const access = await import(`${t.API}/src/modules/platform/platform-access.js`);
const S = await import(`${t.REPO}/packages/config-schema/src/index.js`);

await t.run(async () => {
  const A = await t.makeStore({ slug: "acme", ownerEmail: "o@acme.test" });
  const B = await t.makeStore({ slug: "beta", ownerEmail: "o@beta.test" });
  const su = A.su;
  const sa = (method, path, body) => call(method, `/api/platform${path}`, { cookie: su, body });
  const as = (cookie, method, path, body, headers) => call(method, path, { cookie, body, headers });
  const PW = "Sales2026Pass";

  say("1. Roles: only the super admin makes them");
  let r = await sa("GET", "/roles");
  ok(r.status === 200 && r.json.roles.length === 0 && r.json.features.length === S.PLATFORM_FEATURE_KEYS.length && r.json.groups.includes("Sales"), "the super admin sees the list of features a role can hold, and no roles yet");
  r = await sa("POST", "/roles", { name: "Sales", description: "Gets clients and onboards them", features: ["onboarding:manage", "onboarding:manage"] });
  const sales = r.json.role;
  ok(r.status === 201 && sales.name === "Sales" && JSON.stringify(sales.features) === JSON.stringify(["onboarding:manage"]), "a role is made with its features, each ticked feature once", JSON.stringify(sales?.features));
  ok(JSON.stringify(sales.effective) === JSON.stringify(["onboarding:manage"]) && sales.members === 0, "…and says what the people holding it can really do, and how many hold it");
  ok((await sa("POST", "/roles", { name: "sales", features: [] })).status === 409, "a second role with the same name (any capitals) is refused (409)");
  ok((await sa("POST", "/roles", { name: "x", features: [] })).status === 400 && (await sa("POST", "/roles", { name: "Ghost", features: ["stores:read", "nuke:everything"] })).status === 400, "a one-letter name, or a feature that doesn't exist, is refused (400)");
  ok((await sa("POST", "/roles", { name: "Manager of everything", features: S.PLATFORM_FEATURE_KEYS })).status === 201, "a role can hold every feature (and still isn't the super admin)");

  say("2. Team members: the password, the email, the role");
  const mk = (over = {}) => sa("POST", "/team", { name: "Sam Sales", email: "sam@rasoipulse.test", password: PW, roleId: sales.id, ...over });
  ok((await mk({ password: "short1" })).status === 400 && (await mk({ password: "onlyletterspassword" })).status === 400 && (await mk({ password: "1234567890123" })).status === 400, "a password needs 10 characters, letters AND a number (these accounts can change every store)");
  ok((await mk({ email: "not-an-email" })).status === 400 && (await mk({ roleId: "000000000000000000000000" })).status === 400 && (await mk({ roleId: "nope" })).status === 400, "a bad email, or a role that doesn't exist, is refused");
  ok((await mk({ email: "o@acme.test" })).status === 409, "an email already used by a restaurant's owner is refused (409)");
  r = await mk();
  const sam = r.json.member;
  ok(r.status === 201 && sam.roleName === "Sales" && sam.isActive && !JSON.stringify(r.json).includes(PW) && !("passwordHash" in sam), "the member is made; the answer never holds the password or its hash");
  const stored = await raw("users").findOne({ email: "sam@rasoipulse.test" });
  ok(stored.isSuperAdmin === false && stored.memberships.length === 0 && stored.platformRoleId === sales.id && stored.passwordHash && !stored.passwordHash.includes(PW), "stored: not a super admin, no store at all, the role, and only a hash of the password");
  ok((await sa("GET", "/team")).json.members.map((m) => m.email).join() === "sam@rasoipulse.test", "the team list has only team members (not the super admin, not restaurant staff)");

  say("3. What a team member sees and may do — the Sales role holds only Onboarding");
  const samCookie = await t.cookieLogin("sam@rasoipulse.test", PW);
  ok(Boolean(samCookie), "Sam signs in to the console with the email and password");
  let me = (await call("GET", "/api/auth/me", { cookie: samCookie })).json.user;
  ok(me.isSuperAdmin === false && me.platform.access === true && me.platform.role.name === "Sales" && JSON.stringify(me.platform.features) === JSON.stringify(["onboarding:manage"]) && me.brandId === null && me.permissions.length === 0, "the session says: a team member, role Sales, the one feature Onboarding (not even 'Plans' in the sidebar), no store, no store permissions", JSON.stringify(me.platform));
  const samGet = (p) => as(samCookie, "GET", `/api/platform${p}`);
  ok((await samGet("/onboarding")).status === 200 && (await samGet("/plans")).status === 200 && (await samGet("/subdomains/check?label=sam-client")).status === 200 && (await samGet("/onboarding/pricing")).status === 200, "Sam CAN: the onboarding forms, the price list, the plan list (for the form to offer a plan) and the address check");
  r = await as(samCookie, "POST", "/api/platform/onboarding", { data: { storeName: "Sam's first client" } });
  ok(r.status === 201 && r.json.form.id, "…and can start a new onboarding form");
  const denied = [
    ["GET", "/overview"], ["GET", "/dashboard"], ["GET", "/login-logs"], ["GET", "/stores"], ["GET", `/stores/${A.brand}`], ["GET", `/stores/${A.brand}/cache`],
    ["GET", `/stores/${A.brand}/deletion-summary`], ["POST", `/stores/${A.brand}/disable`, {}], ["POST", `/stores/${A.brand}/enable`], ["PATCH", `/stores/${A.brand}`, { name: "Hijacked" }],
    ["PATCH", `/stores/${A.brand}/plan`, { planId: null }], ["DELETE", `/stores/${A.brand}`], ["DELETE", `/stores/${A.brand}/outlets/${A.outlet}`], ["POST", `/stores/${A.brand}/owners`, {}],
    ["POST", "/plans", { name: "Free for all" }], ["PATCH", "/plans/anything", {}], ["GET", "/settings"], ["PUT", "/settings", { graceDays: 365 }],
    ["GET", "/security/blocks"], ["DELETE", "/security/blocks"], ["GET", "/cache"], ["POST", "/cache/expire", {}], ["GET", "/storage"], ["PUT", "/storage", {}], ["GET", "/ai"], ["GET", "/server"],
    ["GET", "/app-releases/settings"], ["GET", "/app-releases/oma"], ["GET", "/roles"], ["POST", "/roles", { name: "Mine", features: S.PLATFORM_FEATURE_KEYS }], ["GET", "/team"],
    ["PATCH", `/team/${sam.id}`, { roleId: "x" }], ["GET", "/audit"],
  ];
  const leaks = [];
  for (const [m, p, b] of denied) { const x = await as(samCookie, m, `/api/platform${p}`, b); if (x.status !== 403) leaks.push(`${m} ${p} → ${x.status}`); }
  ok(leaks.length === 0, `Sam can NOT do any of ${denied.length} other things in the platform console: every one answers 403`, leaks.join(" | "));
  const other = [["GET", "/api/brands"], ["POST", "/api/brands", { brandName: "x" }], ["GET", "/api/platform/site/pages"], ["GET", "/api/platform/site/settings"], ["GET", "/api/platform/site/leads"], ["POST", "/api/platform/site/pages", {}]];
  const leaks2 = [];
  for (const [m, p, b] of other) { const x = await as(samCookie, m, p, b); if (x.status !== 403) leaks2.push(`${m} ${p} → ${x.status}`); }
  ok(leaks2.length === 0, "…nor the store list, creating a store, the website pages or its enquiries (403)", leaks2.join(" | "));
  ok((await call("GET", "/api/platform/plans", {})).status === 401 && (await as(null, "GET", "/api/platform/onboarding")).status === 401, "nobody signed in: 401");
  // (the menu LIST is public — the storefront reads it — so a menu CHANGE is what shows whether Sam could do something in a store)
  const stMenu = (await call("POST", `/api/menu/categories`, { cookie: samCookie, headers: { "x-rasoipulse-outlet": A.outlet }, body: { name: "Hacked" } })).status;
  const stOrders = (await call("GET", `/api/orders`, { cookie: samCookie, headers: { "x-rasoipulse-outlet": A.outlet } })).status;
  ok(stMenu === 403 && stOrders === 403, "Sam can't change any restaurant's menu or read its orders either (no store: 403)", `menu ${stMenu}, orders ${stOrders}`);
  ok((await call("GET", "/api/outlets", { cookie: samCookie })).json.outlets?.length === 0 || (await call("GET", "/api/outlets", { cookie: samCookie })).status >= 400, "…and sees no outlets");

  say("4. A role's change reaches its people at once, with no new sign-in");
  ok((await as(samCookie, "GET", "/api/platform/site/leads")).status === 403, "before: Sam can't see the website enquiries");
  r = await sa("PATCH", `/roles/${sales.id}`, { name: "Sales", description: "Gets clients and onboards them", features: ["onboarding:manage", "leads:manage"] });
  ok(r.status === 200 && r.json.role.members === 1, "the super admin adds 'Website enquiries' to the role (and it knows one person holds it)");
  ok((await as(samCookie, "GET", "/api/platform/site/leads")).status === 200, "Sam's very next request is allowed (leads), without signing in again");
  r = await call("GET", "/api/auth/me", { cookie: samCookie });
  ok(JSON.stringify(r.json.user.platform.features) === JSON.stringify(["onboarding:manage", "leads:manage"]), "…and /me lists the new features", JSON.stringify(r.json.user.platform.features));
  await sa("PATCH", `/roles/${sales.id}`, { name: "Sales", features: ["onboarding:manage"] });
  ok((await as(samCookie, "GET", "/api/platform/site/leads")).status === 403 && (await samGet("/onboarding")).status === 200, "taking it away shuts it again at once, onboarding stays");
  ok((await as(samCookie, "GET", "/api/platform/plans")).status === 200 && (await as(samCookie, "POST", "/api/platform/plans", { name: "x" })).status === 403, "(the onboarding form may READ the plan list, never change a plan)");

  say("5. Another role: Support — stores (view), then (change), then (delete)");
  const support = (await sa("POST", "/roles", { name: "Support", features: ["dashboard:read", "stores:read", "server:read"] })).json.role;
  await sa("POST", "/team", { name: "Sue Support", email: "sue@rasoipulse.test", password: "Support2026Pass", roleId: support.id });
  const sueCookie = await t.cookieLogin("sue@rasoipulse.test", "Support2026Pass");
  const sue = (m, p, b) => as(sueCookie, m, `/api/platform${p}`, b);
  ok((await sue("GET", "/stores")).status === 200 && (await sue("GET", `/stores/${A.brand}`)).status === 200 && (await sue("GET", "/dashboard")).status === 200 && (await sue("GET", "/server")).status === 200, "Sue can see the dashboard, the store list and one store, and the server");
  ok((await sue("GET", "/onboarding")).status === 403 && (await sue("GET", "/plans")).status === 403 && (await sue("POST", `/stores/${A.brand}/disable`, {})).status === 403 && (await sue("PATCH", `/stores/${A.brand}`, { name: "x" })).status === 403, "…but not onboarding, plans, or any change to a store");
  ok((await call("GET", "/api/brands", { cookie: sueCookie })).status === 200 && (await call("POST", "/api/brands", { cookie: sueCookie, body: {} })).status === 403, "'/api/brands': the list yes, creating a store no");
  await sa("PATCH", `/roles/${support.id}`, { name: "Support", features: ["stores:manage"] });
  ok((await sue("GET", "/stores")).status === 200, "'change stores' brings 'view stores' along");
  const sueRename = (await sue("PATCH", `/stores/${A.brand}`, { name: "Acme (renamed by Sue)" })).status;
  const sueOff = (await sue("POST", `/stores/${A.brand}/disable`, { message: "late payment" })).status;
  const sueOn = (await sue("POST", `/stores/${A.brand}/enable`)).status;
  ok(sueRename === 200 && sueOff === 200 && sueOn === 200, "…and she can rename, switch off and on a store", `rename ${sueRename}, off ${sueOff}, on ${sueOn}`);
  ok((await sue("DELETE", `/stores/${B.brand}`)).status === 403 && (await sue("GET", `/stores/${B.brand}/deletion-summary`)).status === 403 && (await sue("DELETE", `/stores/${B.brand}/outlets/${B.outlet}`)).status === 403, "…but deleting a store or an outlet is a feature of its own: refused (403)");
  await sa("PATCH", `/roles/${support.id}`, { name: "Support", features: ["stores:delete"] });
  ok((await sue("GET", `/stores/${B.brand}/deletion-summary`)).status === 200 && (await sue("GET", "/stores")).status === 200 && (await sue("PATCH", `/stores/${B.brand}`, { name: "x" })).status === 403, "'delete' brings 'view' along but not 'change'");

  say("6. The app: the same rules, with the Bearer token");
  const appLogin = (email, password, headers = {}) => call("POST", "/api/auth/app-login", { body: { email, password }, headers: { "x-app-id": "admin", ...headers } });
  const samApp = await appLogin("sam@rasoipulse.test", PW, { "x-app-version-code": "1" });
  ok(samApp.status === 200 && samApp.json.token && samApp.json.user.platform.access === true, "Sam signs in to the Admin app (and no 'update required' wall: the Admin app is not in the update channel)");
  ok((await call("GET", "/api/platform/onboarding", { bearer: samApp.json.token })).status === 200 && (await call("GET", "/api/platform/stores", { bearer: samApp.json.token })).status === 403, "with the token: onboarding yes, stores no — as in the web console");
  const ownerApp = await appLogin("o@acme.test", "Owner123!");
  ok(ownerApp.status === 403 && ownerApp.json.details?.code === "app_not_allowed" && !ownerApp.json.token, "a restaurant's owner is turned away from the Admin app (403)");
  ok((await raw("sessions").countDocuments({ userId: String((await raw("users").findOne({ email: "o@acme.test" }))._id) })) <= 1, "…and the session opened for that check ended (nothing left behind)");
  const suApp = await appLogin("super@sandbox.test", "Super123!");
  ok(suApp.status === 200 && suApp.json.user.isSuperAdmin === true && suApp.json.user.platform.features.length === S.PLATFORM_FEATURE_KEYS.length, "the super admin signs in with everything");
  ok((await call("GET", "/api/platform/roles", { bearer: samApp.json.token })).status === 403 && (await call("GET", "/api/platform/roles", { bearer: suApp.json.token })).status === 200, "roles: the super admin's token yes, Sam's no");

  say("7. A restaurant's own staff can't get in");
  ok((await call("GET", "/api/platform/plans", { cookie: A.owner })).status === 403 && (await call("GET", "/api/platform/stores", { cookie: A.owner })).status === 403 && (await call("GET", "/api/platform/roles", { cookie: A.owner })).status === 403, "an owner gets 403 on the platform API, even to look at the plans");
  const own = await call("GET", "/api/auth/me", { cookie: A.owner });
  ok(own.json.user.platform.access === false && own.json.user.platform.features.length === 0, "an owner's session says: no platform access");

  say("8. Managing a person");
  r = await sa("PATCH", `/team/${sam.id}`, { name: "Samuel Sales", isSuperAdmin: true, memberships: [{ brandId: A.brand, role: "owner" }] });
  const after = await raw("users").findOne({ email: "sam@rasoipulse.test" });
  ok(r.status === 200 && r.json.member.name === "Samuel Sales" && after.isSuperAdmin === false && after.memberships.length === 0, "extra fields like isSuperAdmin or a store are ignored: a team member can't be made bigger through this");
  ok((await sa("PATCH", `/team/${(await raw("users").findOne({ email: "super@sandbox.test" }))._id}`, { name: "Not me" })).status === 404 && (await sa("PATCH", `/team/${(await raw("users").findOne({ email: "o@acme.test" }))._id}`, { name: "Not mine" })).status === 404 && (await sa("DELETE", `/team/${(await raw("users").findOne({ email: "o@acme.test" }))._id}`)).status === 404, "the super admin and a restaurant's owner can't be reached through the team routes (404)");
  r = await sa("PATCH", `/team/${sam.id}`, { roleId: support.id });
  ok(r.status === 200 && r.json.member.roleName === "Support" && (await samGet("/onboarding")).status === 403 && (await samGet("/stores")).status === 200, "moving Sam to another role changes what he can do at once");
  await sa("PATCH", `/team/${sam.id}`, { roleId: sales.id });
  ok((await sa("DELETE", `/roles/${sales.id}`)).status === 409, "a role somebody holds can't be deleted (409)");
  const extra = (await sa("POST", "/roles", { name: "Empty", features: [] })).json.role;
  ok((await sa("DELETE", `/roles/${extra.id}`)).status === 204, "…an empty one can");
  r = await sa("PATCH", `/team/${sam.id}`, { isActive: false });
  ok(r.status === 200 && (await samGet("/onboarding")).status === 401 && (await appLogin("sam@rasoipulse.test", PW)).status === 401, "switching Sam off signs him out at once (401), and he can't sign in again");
  await sa("PATCH", `/team/${sam.id}`, { isActive: true });
  const again = await t.cookieLogin("sam@rasoipulse.test", PW);
  ok(Boolean(again), "switched on again, he can sign in with the same password");
  r = await sa("PATCH", `/team/${sam.id}`, { password: "BrandNewPass99" });
  ok(r.status === 200 && (await as(again, "GET", "/api/platform/onboarding")).status === 401 && !(await t.cookieLogin("sam@rasoipulse.test", PW)) && Boolean(await t.cookieLogin("sam@rasoipulse.test", "BrandNewPass99")), "a new password ends every old sign-in at once; the old password stops working");
  ok((await sa("PATCH", `/team/${sam.id}`, { password: "weak" })).status === 400 && (await sa("PATCH", `/team/${sam.id}`, {})).status === 400, "a weak password, or an empty change, is refused");

  say("9. The activity log");
  const log = (await sa("GET", "/audit?limit=100")).json.entries;
  const actions = log.map((e) => e.action);
  ok(["role.create", "role.update", "role.delete", "member.create", "member.update", "member.password"].every((a) => actions.includes(a)), "the log has roles made, changed and deleted, and people made, changed and given new passwords", [...new Set(actions)].join(","));
  ok(!JSON.stringify(log).includes(PW) && !JSON.stringify(log).includes("BrandNewPass99") && !JSON.stringify(log).includes("Support2026Pass"), "…and never a password");
  ok(log.every((e) => e.actor === "Super") && log.some((e) => /added: leads:manage/.test(e.detail)), "…it says who did it and what changed (added: leads:manage)");
  ok((await samGet("/audit")).status === 401 || (await as(again, "GET", "/api/platform/audit")).status === 403, "a team member can't read it");
  const loginLog = (await sa("GET", "/login-logs?filter=platform")).json;
  ok(JSON.stringify(loginLog).includes("sam@rasoipulse.test") && JSON.stringify(loginLog).includes("platform_team"), "the sign-in log lists Sam's sign-ins as a platform team member");
  await sa("DELETE", `/team/${sam.id}`);
  ok(!(await raw("users").findOne({ email: "sam@rasoipulse.test" })) && !(await t.cookieLogin("sam@rasoipulse.test", "BrandNewPass99")), "deleting a person removes the account and every sign-in");

  say("10. Every route of the platform API has been decided on");
  const inv = JSON.parse(execFileSync(process.execPath, [`${t.API}/src/scripts/route-inventory.js`, "--json"], { env: { ...process.env, LOG_LEVEL: "error" }, encoding: "utf8", cwd: t.API, maxBuffer: 16 * 1024 * 1024 }));
  const platform = inv.filter((e) => e.path.startsWith("/api/platform/") && !e.path.startsWith("/api/platform/site"));
  const undecided = platform.filter((e) => !access.platformRuleIsExplicit(e.method, e.path.replace("/api/platform", "").replace(/:[A-Za-z]+/g, "abc")));
  ok(platform.length > 60 && undecided.length === 0, `all ${platform.length} routes of /api/platform have a rule in the table`, undecided.map((e) => `${e.method} ${e.path}`).join(" | "));
  ok(access.platformRuleFor("GET", "/something-brand-new").superAdminOnly === true && access.platformRuleFor("DELETE", "/stores").superAdminOnly === true, "a route nobody wrote a rule for is closed to everybody but the super admin");
  ok(access.platformRuleFor("GET", "/roles").superAdminOnly && access.platformRuleFor("POST", "/team").superAdminOnly && access.platformRuleFor("GET", "/audit").superAdminOnly, "roles, team and the log are super-admin-only in the table too");
  const siteRoutes = inv.filter((e) => e.path.startsWith("/api/platform/site"));
  ok(siteRoutes.length >= 8, `the website's own platform routes (${siteRoutes.length}) are guarded by their own feature check (tested above: pages/settings → website, leads → leads)`);
});
