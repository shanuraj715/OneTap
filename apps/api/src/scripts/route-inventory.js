/**
 * Every route the API serves, with the request limits that stand in front of it.
 *
 *   node src/scripts/route-inventory.js              a plain table
 *   node src/scripts/route-inventory.js --json       the same as JSON
 *   node src/scripts/route-inventory.js --markdown   the tables docs/api-rate-limiting.md is built from
 *   node src/scripts/route-inventory.js --write-doc  refresh those tables inside the doc
 *
 * It loads the real app and watches the routers being built (no server is started, no database is touched), so it
 * cannot disagree with the code. A limit is any middleware that carries a `policy` name (middleware/rate-limit.js:
 * limiter(), usesPolicy(), onlyWrites()). tests/e2e/suites/rate-limits.mjs uses this to fail when a route that
 * changes data has no limit of its own.
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(here, "../..");
const requireFromApi = createRequire(`${apiRoot}/package.json`);
const requireFromExpress = createRequire(requireFromApi.resolve("express"));
const Router = requireFromExpress("router");

/* ------------------------------------------------------------ watch the routers being built */

const records = []; // in the order they were registered
const routeOriginal = Router.prototype.route;
const useOriginal = Router.prototype.use;

Router.prototype.route = function route(path) {
  const r = routeOriginal.call(this, path);
  records.push({ kind: "route", router: this, path: String(path), route: r });
  return r;
};

Router.prototype.use = function use(...args) {
  let paths = ["/"];
  let rest = args;
  if (typeof args[0] === "string") [paths, ...rest] = [[args[0]], ...args.slice(1)];
  else if (Array.isArray(args[0]) && args[0].every((x) => typeof x === "string")) [paths, ...rest] = [args[0], ...args.slice(1)];
  for (const fn of rest.flat(Infinity)) records.push({ kind: "use", router: this, paths, fn });
  return useOriginal.apply(this, args);
};

/* --------------------------------------------------------------------- build the real app */

const { createApp } = await import(`${apiRoot}/src/app.js`);
const app = createApp();
const { POLICIES, WRITE_EXEMPT } = await import(`${apiRoot}/src/middleware/rate-limit.js`);

const join = (a, b) => `${a}/${b}`.replace(/\/+/g, "/").replace(/(.)\/$/, "$1") || "/";
const isRouter = (fn) => typeof fn === "function" && Array.isArray(fn.stack) && typeof fn.route === "function";
const covers = (under, full) => under === "/" || full === under || full.startsWith(`${under}/`);
const isRead = (m) => m === "GET" || m === "HEAD" || m === "OPTIONS";

const byRouter = new Map();
for (const r of records) {
  if (!byRouter.has(r.router)) byRouter.set(r.router, []);
  byRouter.get(r.router).push(r);
}

const rows = [];

/** `active`: limits that already apply to everything below this point, each { policy, writesOnly, under } */
function walk(router, prefix, active) {
  const here = [...active];
  for (const it of byRouter.get(router) ?? []) {
    if (it.kind === "use") {
      for (const p of it.paths) {
        const under = join(prefix, p);
        if (isRouter(it.fn)) walk(it.fn, under, here);
        else if (it.fn?.policy) here.push({ policy: it.fn.policy, writesOnly: Boolean(it.fn.writesOnly), under });
      }
      continue;
    }
    const full = join(prefix, it.path);
    for (const method of Object.keys(it.route.methods ?? {})) {
      if (method === "_all") continue;
      const M = method.toUpperCase();
      const own = it.route.stack.map((l) => l.handle).filter((h) => h?.policy).map((h) => ({ policy: h.policy, writesOnly: Boolean(h.writesOnly), under: "/" }));
      const policies = [...here.filter((a) => covers(a.under, full)), ...own].filter((a) => !(a.writesOnly && isRead(M))).map((a) => a.policy);
      rows.push({ method: M, path: full, policies: [...new Set(policies)] });
    }
  }
}
walk(app.router, "/", []);
rows.sort((a, b) => (a.path === b.path ? a.method.localeCompare(b.method) : a.path.localeCompare(b.path)));

export const inventory = rows;
export const exempt = WRITE_EXEMPT;

/* -------------------------------------------------------------------------- output */

function markdown() {
  const L = [];
  const routesOf = (name) => rows.filter((r) => r.policies.includes(name));
  const human = (ms) => (ms === 3_600_000 ? "hour" : ms === 60_000 ? "min" : ms % 3_600_000 === 0 ? `${ms / 3_600_000} h` : ms % 60_000 === 0 ? `${ms / 60_000} min` : `${ms / 1000} s`);
  L.push("| Limit | Counted per | Allows | Why | Where it applies |", "|---|---|---|---|---|");
  for (const [name, p] of Object.entries(POLICIES)) {
    const where = routesOf(name);
    const allows = p.allows ?? (p.managedBy ? `see ${p.managedBy}` : `${p.limit} per ${human(p.windowMs)}`);
    const label = { ip: "visitor's address", user: "signed-in user (else address)", identity: "user, else customer, else address", store: "store", account: "account (email)", number: "phone number" }[p.key] ?? p.key;
    const applies = p.appliesTo ?? (name === "api" ? "every `/api` request" : where.length > 12 ? `${where.length} routes (see the full list below)` : where.map((r) => `\`${r.method} ${r.path}\``).join("<br>") || "—");
    L.push(`| \`${name}\` | ${label} | ${allows} | ${p.why.replace(/\|/g, "\\|")} | ${applies} |`);
  }
  L.push("", "### Every route", "", "| Method | Path | Limits |", "|---|---|---|");
  for (const r of rows) L.push(`| ${r.method} | \`${r.path}\` | ${r.policies.map((x) => `\`${x}\``).join(", ") || "—"} |`);
  L.push("", `Exempt from a limit of their own (still under \`api\`): ${Object.keys(WRITE_EXEMPT).map((k) => `\`${k}\``).join(", ")}.`);
  return L.join("\n");
}

/** put the generated tables into docs/api-rate-limiting.md, between its two markers */
async function writeDoc() {
  const { readFileSync, writeFileSync } = await import("node:fs");
  const file = resolve(apiRoot, "../../docs/api-rate-limiting.md");
  const text = readFileSync(file, "utf8");
  const begin = "<!-- generated:begin (node apps/api/src/scripts/route-inventory.js --write-doc) -->";
  const end = "<!-- generated:end -->";
  const a = text.indexOf("<!-- generated:begin");
  const b = text.indexOf(end);
  if (a < 0 || b < 0) throw new Error("docs/api-rate-limiting.md is missing its generated:begin / generated:end markers");
  writeFileSync(file, `${text.slice(0, a)}${begin}\n\n${markdown()}\n\n${text.slice(b)}`);
  console.log(`updated ${file} — ${rows.length} routes, ${Object.keys(POLICIES).length} limits`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--write-doc")) await writeDoc();
  else if (process.argv.includes("--json")) console.log(JSON.stringify(rows, null, 2));
  else if (process.argv.includes("--markdown")) console.log(markdown());
  else for (const r of rows) console.log(`${r.method.padEnd(7)} ${r.path.padEnd(58)} ${r.policies.join(", ") || "—"}`);
  process.exit(0);
}
