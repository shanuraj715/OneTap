// The API speed-test script (apps/api/src/scripts/speed-test.js): response time inside the API, time waiting for the database, query plans, a
// load test, and comparing two saved runs. Runs the script as a separate process against a throwaway in-memory database; no browser.
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { startApi } from "./_api-harness.mjs";

const t = await startApi(3119);
const { call, ok, say } = t;
const SCRIPT = path.join(t.API, "src/scripts/speed-test.js");
const lib = await import(pathToFileURL(SCRIPT).href);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "speed-"));

const runScript = (args, env = {}) =>
  new Promise((resolve) => {
    execFile(process.execPath, [SCRIPT, ...args], { env: { ...process.env, ...env }, timeout: 120_000, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => resolve({ code: err ? (err.code ?? 1) : 0, out: String(stdout), err: String(stderr) }));
  });
const counts = async () => {
  const names = (await t.db.mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).sort();
  const o = {};
  for (const n of names) o[n] = await t.raw(n).countDocuments();
  return o;
};
const CREDS = { SPEED_EMAIL: "super@sandbox.test", SPEED_PASSWORD: "Super123!" };

await t.run(async () => {
  const s = await t.makeStore();
  void s;

  say("1. The small helpers");
  ok(lib.percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50) === 5 && lib.percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95) === 10 && lib.percentile([], 50) === null, "percentile: the middle of 1..10 is 5, the 95th is 10, nothing gives null");
  const st = lib.stats([10, 20, 30, 40, NaN]);
  ok(st.n === 4 && st.min === 10 && st.max === 40 && st.avg === 25 && st.p50 === 20, "stats: ignores non-numbers and gives n, min, avg, median, max", JSON.stringify(st));
  ok(lib.stats([]) === null, "stats of nothing is null");
  ok(lib.mergedMs([[0, 10], [5, 12], [20, 25]]) === 17 && lib.mergedMs([[0, 4], [4, 8]]) === 8 && lib.mergedMs([]) === 0, "mergedMs: queries that overlap are counted once ([0,10]+[5,12]+[20,25] = 17)");
  const a = lib.shapeOf("find", { find: "orders", filter: { outletId: "x1", status: { $in: ["a", "b"] } }, sort: { createdAt: -1 }, limit: 100 });
  const b = lib.shapeOf("find", { find: "orders", filter: { status: { $in: ["z"] }, outletId: "other" }, sort: { createdAt: -1 }, limit: 5 });
  ok(a.key === b.key && /orders · find/.test(a.text) && !/x1/.test(a.text), "the same query with different values has the same shape (ids are taken out)", a.text);
  ok(lib.shapeOf("find", { find: "orders", filter: { a: 1 } }).key !== lib.shapeOf("find", { find: "orders", filter: { b: 1 } }).key, "a query on other fields has another shape");
  const withMap = lib.shapeOf("find", { find: "orders", filter: { a: 1 }, sort: new Map([["createdAt", -1]]) });
  ok(/createdAt:-1/.test(withMap.text) && withMap.key !== lib.shapeOf("find", { find: "orders", filter: { a: 1 } }).key, "a sort sent as a Map (the way Mongoose sends it) is read, and makes another shape", withMap.text);
  ok(!/"sort"/.test(lib.shapeOf("find", { find: "orders", filter: { a: 1 }, sort: {} }).text), "an empty sort is not shown");
  ok(lib.shapeOf("find", { find: "orders", filter: { s: { $in: ["a", "b", "c"] } } }).key === lib.shapeOf("find", { find: "orders", filter: { s: { $in: ["z"] } } }).key && lib.shapeOf("find", { find: "orders", filter: { $or: [{ a: 1 }, { b: 2 }] } }).key !== lib.shapeOf("find", { find: "orders", filter: { $or: [{ a: 1 }] } }).key, "a list of values ($in) is one shape whatever its length; a list of conditions ($or) keeps its parts");
  const clean = lib.cleanForExplain("aggregate", { aggregate: "orders", pipeline: [{ $match: { a: 1 } }], lsid: { id: 1 }, $db: "x", $clusterTime: {}, batchSize: 5, cursor: { batchSize: 5 } });
  ok(!("lsid" in clean) && !("$db" in clean) && !("$clusterTime" in clean) && !("batchSize" in clean) && JSON.stringify(clean.cursor) === "{}" && clean.aggregate === "orders", "cleanForExplain drops session fields and gives an aggregate an empty cursor");

  say("2. Reading an explain answer");
  const idx = lib.planSummary({ queryPlanner: { winningPlan: { stage: "LIMIT", inputStage: { stage: "FETCH", inputStage: { stage: "IXSCAN", indexName: "outlet_1_createdAt_-1" } } } }, executionStats: { nReturned: 20, totalDocsExamined: 20, totalKeysExamined: 20, executionTimeMillis: 2 } });
  ok(idx.ok && idx.index === "outlet_1_createdAt_-1" && !idx.collscan && !idx.sort && !idx.inefficient && idx.returned === 20, "a query using an index is read as using it, with no warnings", JSON.stringify(idx));
  const scan = lib.planSummary({ queryPlanner: { winningPlan: { stage: "COLLSCAN" } }, executionStats: { nReturned: 3, totalDocsExamined: 5000, totalKeysExamined: 0, executionTimeMillis: 40 } });
  ok(scan.collscanMatters && scan.sortMatters === false, "…and it matters, because it read 5,000 documents");
  const tiny = lib.planSummary({ queryPlanner: { winningPlan: { stage: "SORT", inputStage: { stage: "COLLSCAN" } } }, executionStats: { nReturned: 12, totalDocsExamined: 12, totalKeysExamined: 0, executionTimeMillis: 0 } });
  ok(tiny.collscan && tiny.sort && !tiny.collscanMatters && !tiny.sortMatters && !tiny.inefficient, "a scan and an in-memory sort over 12 documents are noted but don't count as problems (harmless until the collection grows)");
  ok(scan.collscan && scan.inefficient && scan.index === null, "a whole-collection scan is flagged, and so is reading 5,000 documents to return 3", JSON.stringify(scan));
  const sorted = lib.planSummary({ queryPlanner: { winningPlan: { stage: "SORT", inputStage: { stage: "FETCH", inputStage: { stage: "IXSCAN", indexName: "a_1" } } } }, executionStats: { nReturned: 10, totalDocsExamined: 10, totalKeysExamined: 10, executionTimeMillis: 1 } });
  ok(sorted.sort && !sorted.collscan, "a sort done in memory is flagged");
  const agg = lib.planSummary({ stages: [{ $cursor: { queryPlanner: { winningPlan: { stage: "COLLSCAN" } }, executionStats: { nReturned: 100, totalDocsExamined: 100, totalKeysExamined: 0, executionTimeMillis: 3 } } }, { $group: {} }] });
  ok(agg.ok && agg.collscan, "an aggregate's plan, found inside its $cursor stage, is read too");
  ok(lib.planSummary({ nothing: true }).ok === false, "something that isn't an explain answer is reported as unreadable, not a crash");

  say("3. It refuses to change anything");
  const refuses = (m, p) => { try { lib.assertReadOnly(m, p); return false; } catch (e) { return /only reads/.test(e.message); } };
  ok(refuses("POST", "/api/orders") && refuses("DELETE", "/api/menu/x") && refuses("PUT", "/api/auth/login") && refuses("PATCH", "/api/outlets/1") && refuses("POST", "/api/auth/app-login"), "POST / PUT / PATCH / DELETE are refused (except the sign-in and sign-out below)");
  ok(!refuses("GET", "/api/orders") && !refuses("POST", "/api/auth/login") && !refuses("POST", "/api/auth/logout"), "GET is allowed, and POST only for /api/auth/login and /api/auth/logout");

  say("4. A full run (private copy of the API, signed in)");
  await new Promise((r) => setTimeout(r, 2500)); // the test's own API finishes its late sign-in log writes first
  const before = await counts();
  const j1 = path.join(tmp, "run1.json");
  const r1 = await runScript(["--runs", "6", "--warmup", "1", "--json", j1], CREDS);
  const after = await counts();
  ok(r1.code === 0, "the script finishes with exit code 0", r1.err.slice(0, 300) || String(r1.code));
  for (const [title, re] of [["the header", /API speed test ·/], ["the machine line", /Machine\s+\d+ CPU/], ["the database section", /1\. DATABASE/], ["the response-time section", /2\. API — response time/], ["the inside-the-API table", /Where the time goes inside the API/], ["the query-plans section", /3\. QUERY PLANS/], ["the 'things to look at' list", /THINGS TO LOOK AT/]]) ok(re.test(r1.out), `the report has ${title}`);
  ok(!/Super123|mongodb(\+srv)?:\/\/[^ ]*@/.test(r1.out), "the report never prints the password or a database address with a login in it");
  const run1 = JSON.parse(fs.readFileSync(j1, "utf8"));
  ok(run1.db?.ping?.n >= 20 && run1.db.ping.p50 > 0 && run1.db.trivialRead?.n >= 20, "the database ping and a small read are each timed at least 20 times", `${run1.db?.ping?.p50}`);
  ok(run1.meta?.mode === "private-copy" && run1.meta.runs === 6 && /\/ sandbox$/.test(run1.meta.database), "the saved run says it was a private copy, 6 runs, against the sandbox database", JSON.stringify(run1.meta.database));
  const byName = Object.fromEntries(run1.endpoints.map((e) => [e.name, e]));
  ok(byName["health (empty request)"]?.ok && byName["health (empty request)"].total.n === 6, "the empty request (health) answered 200 six times");
  ok(["tables board", "orders list (100)", "kitchen board", "dashboard stats", "who am I", "my outlets"].every((n) => byName[n]), "the signed-in endpoints were tested (tables, orders, kitchen, dashboard, who am I, outlets)", Object.keys(byName).join(" | "));
  const good = run1.endpoints.filter((e) => e.ok);
  ok(good.length >= 8, "most endpoints answered successfully", `${good.length}/${run1.endpoints.length}: ${run1.endpoints.filter((e) => !e.ok).map((e) => `${e.name} ${e.status}`).join(", ")}`);
  ok(good.every((e) => e.total.p50 > 0 && e.total.p95 >= e.total.p50 && e.total.max >= e.total.p95), "for each, typical ≤ slow 95% ≤ worst, all above zero");
  ok(good.every((e) => e.server && e.server.avg > 0 && e.server.avg <= e.total.avg + 0.5), "the time inside the API is measured, and is never longer than the whole trip (no network is counted)");
  const dbEndpoints = good.filter((e) => ["tables board", "orders list (100)", "kitchen board"].includes(e.name));
  ok(dbEndpoints.length === 3 && dbEndpoints.every((e) => e.queries >= 1 && e.dbWall > 0), "endpoints that use the database report their queries and the time waiting for it", dbEndpoints.map((e) => `${e.name}: ${e.queries?.toFixed(1)} q, ${e.dbWall?.toFixed(1)} ms`).join(" | "));
  ok(byName["storefront menu"]?.ok && byName["storefront menu"].queries < 1, "the storefront menu is answered from the API's own memory after the first time (no database queries), and the report shows it", `${byName["storefront menu"]?.queries} queries`);
  ok(byName["storefront menu"]?.first?.queries >= 1, "…while its very first request (cold) did query the database", `${byName["storefront menu"]?.first?.queries} queries`);
  ok(byName["health (empty request)"].queries === 0 || byName["health (empty request)"].queries === null || byName["health (empty request)"].queries < 1, "the empty request makes no database queries");
  ok(good.every((e) => e.app === null || e.app >= 0), "'the API's own work' is never negative");
  ok(run1.plans.length >= 1 && run1.plans.every((p) => p.query && p.collection && p.command), "query plans were collected for the queries the endpoints ran", `${run1.plans.length} plans`);
  ok(run1.plans.some((p) => p.ok && (p.index || p.collscan !== undefined)), "at least one plan could be read from MongoDB's explain", JSON.stringify(run1.plans.find((p) => p.ok) ?? run1.plans[0]).slice(0, 200));
  ok(r1.out.includes("read-only explain"), "the plans section says it only explains (read-only)");
  const changed = Object.keys({ ...before, ...after }).filter((k) => (before[k] ?? 0) !== (after[k] ?? 0));
  const allowed = changed.filter((k) => /session|signin|sign_in|login|audit|log/i.test(k));
  ok(changed.every((k) => allowed.includes(k)), "no collection changed except sign-in records", `changed: ${changed.map((k) => `${k} ${before[k] ?? 0}→${after[k] ?? 0}`).join(", ") || "none"}`);
  ok((after.sessions ?? 0) === (before.sessions ?? 0), "the session the script opened is closed again (the number of sessions is the same as before)", `${before.sessions} → ${after.sessions}`);
  const src = fs.readFileSync(SCRIPT, "utf8");
  ok(/mongoose\.set\("autoIndex", false\)/.test(src) && /mongoose\.set\("autoCreate", false\)/.test(src), "the script switches off automatic index and collection creation before loading the API's models (so it can't build anything on the real database)");
  ok(!changed.some((k) => /^(orders|menuitems|outlets|brands|users|tables)$/.test(k)), "orders, menu, outlets, stores, users and tables were not touched");

  say("5. Without a sign-in only the public endpoints are tested");
  const dumpTo = process.env.SPEED_DUMP;
  if (dumpTo) fs.writeFileSync(dumpTo, r1.out);
  const r2 = await runScript(["--runs", "3", "--warmup", "0", "--only", "api"], { SPEED_EMAIL: "", SPEED_PASSWORD: "" });
  ok(r2.code === 0 && /No sign-in/.test(r2.out) && !/tables board/.test(r2.out) && /health \(empty request\)/.test(r2.out), "it says there is no sign-in, tests the public endpoints and skips the dashboard ones");
  const r3 = await runScript(["--runs", "3", "--warmup", "0", "--only", "api"], { SPEED_EMAIL: "super@sandbox.test", SPEED_PASSWORD: "wrong-password" });
  ok(r3.code === 0 && /did not work/.test(r3.out) && !/tables board/.test(r3.out), "a wrong password is reported, and the run carries on with the public endpoints");

  say("6. The load test");
  const j2 = path.join(tmp, "run2.json");
  const r4 = await runScript(["--runs", "3", "--warmup", "0", "--load", "4", "--duration", "2", "--only", "load", "--json", j2], CREDS);
  const run2 = JSON.parse(fs.readFileSync(j2, "utf8"));
  ok(r4.code === 0 && /4\. LOAD — 4 requests at a time for 2 s/.test(r4.out), "a load run of 4 at a time for 2 seconds is reported", r4.err.slice(0, 200));
  ok(run2.load?.requests >= 20 && run2.load.perSecond > 5 && run2.load.errors === 0, "it sent real traffic (more than 20 requests) and all of it was answered with 2xx", JSON.stringify({ n: run2.load?.requests, rps: run2.load?.perSecond?.toFixed(0), errors: run2.load?.errors }));
  ok(run2.load.latency?.p50 > 0 && run2.load.latency.p99 >= run2.load.latency.p50, "load latency is typical ≤ slow 99%");
  ok(run2.load.apiBusy > 0 && run2.load.apiBusy <= 1.0001 && run2.load.loopLagP99 !== null, "it reports how busy the API's thread was (0-100%) and its event-loop lag", `${(run2.load.apiBusy * 100).toFixed(0)}% busy, lag ${run2.load.loopLagP99?.toFixed(1)} ms`);
  ok(run2.load.perEndpoint.length >= 8 && run2.load.perEndpoint.every((e) => e.requests > 0), "every tested endpoint received traffic");
  for (const bad of [["--load", "0"], ["--load", "21"], ["--duration", "61"], ["--runs", "0"], ["--only", "nonsense"]]) {
    const r = await runScript(bad);
    ok(r.code === 1 && /Speed test stopped/.test(r.err), `${bad.join(" ")} is refused with a message (exit 1)`, r.err.split("\n").find((l) => l.trim())?.slice(0, 120));
  }

  say("7. Measuring a live API from outside (--url)");
  const j3 = path.join(tmp, "run3.json");
  const r5 = await runScript(["--url", t.base, "--runs", "3", "--warmup", "0", "--only", "api,load", "--load", "2", "--duration", "2", "--json", j3], CREDS);
  const run3 = JSON.parse(fs.readFileSync(j3, "utf8"));
  ok(r5.code === 0 && run3.meta.mode === "live", "it measures the live API at that address", r5.err.slice(0, 200));
  ok(run3.endpoints.filter((e) => e.ok).length >= 8 && run3.endpoints.every((e) => e.server === null && e.queries === null), "from outside only the total time is known: nothing about the inside is claimed");
  ok(!/Where the time goes inside the API/.test(r5.out) && !/3\. QUERY PLANS/.test(r5.out), "so the inside-the-API table and the query plans are not shown");
  ok(run3.load?.requests > 10 && run3.load.apiBusy === null, "the load test works against it (busy% is unknown from outside)");

  say("8. Comparing two runs");
  const r6 = await runScript(["--compare", j1, j3]);
  ok(r6.code === 0 && /Comparing/.test(r6.out) && /typical ms/.test(r6.out) && /→/.test(r6.out) && /lower milliseconds are better/.test(r6.out), "--compare A B prints the endpoints side by side with before → after and the change in %", r6.out.split("\n").slice(0, 4).join(" / ").slice(0, 200));
  ok(/%/.test(r6.out), "…with a percentage change");
  const r6b = await runScript(["--compare", j1, "--compare", j3]);
  ok(r6b.code === 0 && /Comparing/.test(r6b.out), "--compare may also be repeated: --compare A --compare B");
  const r6c = await runScript(["--compare", j1, j3, j1]);
  ok(r6c.code === 1 && /one file .* or two files/.test(r6c.err), "three files are refused with a message");
  const r6d = await runScript(["stray"]);
  ok(r6d.code === 1 && /unexpected argument/.test(r6d.err), "a stray argument is refused instead of ignored");
  const r7 = await runScript(["--compare", path.join(tmp, "missing.json")], {});
  ok(r7.code === 1 && /can't read/.test(r7.err), "a missing file is reported (exit 1)");
  const h = await runScript(["--help"]);
  ok(h.code === 0 && /--runs/.test(h.out) && /--compare/.test(h.out) && /SPEED_EMAIL/.test(h.out), "--help lists the options and how to sign in");

  say("9. It is wired up");
  const pkg = JSON.parse(fs.readFileSync(path.join(t.API, "package.json"), "utf8"));
  ok(pkg.scripts?.speed === "node src/scripts/speed-test.js", "npm run speed (in apps/api) starts it");
  const readme = fs.readFileSync(path.join(t.REPO, "README.md"), "utf8");
  ok(/speed-test\.js/.test(readme) && /Measuring API speed/.test(readme), "the README explains how to use it");
  void call;
  fs.rmSync(tmp, { recursive: true, force: true });
});

