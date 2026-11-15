// TEST RUNNER —  node run.mjs [options]        (or: pnpm/npm run test, test:visible, docs)
//
//   (no options)        run EVERY test headless (fast, no window), save results + docs
//   --visible           run in a real, full-size Chrome window with the red cursor + captions (slow, for watching)
//   --only t01,t03      run only the tests whose id starts with / contains one of these
//   --hold              keep the window open after the (last) test so you can look around (implies --visible)
//   --rebuild           rebuild the dashboard + storefront from the current code first (otherwise: only if the code changed)
//   --docs-only         don't run anything; just regenerate docs/*.md and docs/CATALOG.md from the saved results
//   --list              list the tests and their last result
//
// Every run saves: results/latest.json (last result per test), results/history.jsonl (every run), docs/<id>.md (steps,
// what to expect, what must NOT happen, passed/failed, findings) and docs/CATALOG.md (the overview).
import { readdirSync, readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };

const hold = flag("hold");
const visible = flag("visible") || hold;
const only = (opt("only") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

const RESULTS = join(ROOT, "results");
const DOCS = join(ROOT, "docs");
mkdirSync(RESULTS, { recursive: true });
mkdirSync(DOCS, { recursive: true });
const LATEST = join(RESULTS, "latest.json");
const HISTORY = join(RESULTS, "history.jsonl");

const readJson = (f, fallback) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return fallback; } };
const stamp = (iso) => (iso ? new Date(iso).toLocaleString("sv-SE", { hour12: false }).slice(0, 16) : "never");
const secs = (ms) => (ms >= 60000 ? `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s` : `${(ms / 1000).toFixed(1)} s`);
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

/* ------------------------------------------------------------------ discover tests */
async function loadTests() {
  const dir = join(ROOT, "tests");
  const files = readdirSync(dir).filter((f) => /^t\d+.*\.mjs$/.test(f)).sort();
  const tests = [];
  for (const f of files) {
    const mod = await import(pathToFileURL(join(dir, f)).href);
    if (!mod.meta?.id || typeof mod.run !== "function") { console.log(`skipping tests/${f}: it must export "meta" (with an id) and "run"`); continue; }
    tests.push({ file: f, meta: mod.meta, run: mod.run });
  }
  return tests;
}

/* ------------------------------------------------------------------ docs */
function writeDocs(tests, latest) {
  const history = existsSync(HISTORY) ? readFileSync(HISTORY, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
  const badge = (r) => (!r ? "⚪ not run yet" : r.status === "pass" ? "✅ PASSED" : r.status === "fail" ? "❌ FAILED" : "💥 ERROR");

  for (const t of tests) {
    const m = t.meta;
    const r = latest[m.id];
    const L = [];
    L.push(`# ${m.id.toUpperCase().split("-")[0]} — ${m.title}`, "");
    L.push(`**Area:** ${m.area ?? "—"} · **Last result:** ${badge(r)}${r ? ` (${r.pass} passed, ${r.fail} failed · ${stamp(r.at)} · ${r.mode} · ${secs(r.durationMs)})` : ""}`, "");
    L.push(`**Run it alone:** \`node run.mjs --only ${m.id.split("-")[0]}\` (add \`--visible\` to watch it)${m.fresh ? " · starts from fresh fake data" : ""}`, "");
    L.push("## What this test does", "", m.summary ?? "", "");

    L.push("## Steps", "");
    if (r?.steps?.length) {
      for (const s of r.steps) L.push(s.n === 0 ? `- _(set-up)_` : `${s.n}. ${s.title}`);
    } else L.push("_The steps are recorded the first time the test runs._");
    L.push("");

    L.push("## What to expect (these must happen)", "");
    for (const e of m.expect ?? []) L.push(`- ${e}`);
    L.push("", "## What must NOT happen", "");
    for (const e of m.expectNot ?? []) L.push(`- ${e}`);
    L.push("");

    L.push("## Result of the last run", "");
    if (!r) L.push("_Not run yet._", "");
    else {
      if (r.error) L.push(`**The test stopped early:** \`${esc(r.error)}\``, "");
      const all = r.steps.flatMap((s) => s.checks.map((c) => ({ ...c, step: s })));
      const failed = all.filter((c) => !c.ok);
      L.push(`### ❌ Failed (${failed.length})`, "");
      if (!failed.length) L.push("_Nothing failed._");
      for (const c of failed) L.push(`- ${c.kind === "never" ? "**MUST NOT:** " : ""}${c.label}${c.detail ? ` — _${esc(c.detail)}_` : ""}  \n  _in step ${c.step.n || "set-up"}: ${esc(c.step.title)}_`);
      L.push("", `### ✅ Passed (${all.length - failed.length})`, "");
      for (const s of r.steps) {
        const ok = s.checks.filter((c) => c.ok);
        if (!ok.length) continue;
        L.push(`**${s.n ? `Step ${s.n}` : "Set-up"} — ${s.title}**`, "");
        for (const c of ok) L.push(`- ${c.kind === "never" ? "did not happen: " : ""}${c.label}${c.detail && c.kind !== "never" && c.detail.length < 90 ? ` — _${esc(c.detail)}_` : ""}`);
        L.push("");
      }
      if (r.findings?.length) { L.push("### 🔎 Findings (not a pass/fail, but you should know)", ""); for (const f of r.findings) L.push(`- ${f}`); L.push(""); }
      if (r.problems?.length) { L.push("### Browser problems logged", ""); for (const p of r.problems) L.push(`- ${esc(p)}`); L.push(""); }
    }

    const runs = history.filter((h) => h.id === m.id).slice(-10).reverse();
    L.push("## History (latest 10 runs)", "");
    if (!runs.length) L.push("_No runs yet._");
    else { L.push("| When | Result | Passed | Failed | Mode | Time |", "|---|---|---|---|---|---|"); for (const h of runs) L.push(`| ${stamp(h.at)} | ${h.status} | ${h.pass} | ${h.fail} | ${h.mode} | ${secs(h.durationMs)} |`); }
    L.push("", "---", "_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/" + t.file + "`), not this page._", "");
    writeFileSync(join(DOCS, `${m.id}.md`), L.join("\n"));
  }

  // the overview
  const C = ["# TablePe end-to-end tests — catalog", ""];
  const ran = tests.map((t) => latest[t.meta.id]).filter(Boolean);
  const bad = ran.filter((r) => r.status !== "pass");
  C.push(`**${tests.length} tests** · ${ran.length - bad.length} passing · ${bad.length} failing/error · ${tests.length - ran.length} not run yet`, "");
  C.push("| Test | Area | Result | Checks | Last run |", "|---|---|---|---|---|");
  for (const t of tests) { const r = latest[t.meta.id]; C.push(`| [${t.meta.id}](${t.meta.id}.md) — ${esc(t.meta.title)} | ${t.meta.area ?? ""} | ${badge(r)} | ${r ? `${r.pass}/${r.pass + r.fail}` : "—"} | ${r ? stamp(r.at) : "—"} |`); }
  const findings = tests.flatMap((t) => (latest[t.meta.id]?.findings ?? []).map((f) => ({ id: t.meta.id, f })));
  C.push("", "## Open findings (noticed during tests, not yet fixed)", "");
  if (!findings.length) C.push("_None._");
  for (const x of findings) C.push(`- **${x.id}** — ${x.f}`);
  C.push("", "## How to run", "", "```", "cd tests/e2e", "npm install                      # once", "node run.mjs                     # every test, headless, ~minutes", "node run.mjs --visible           # watch it in a full-size Chrome window", "node run.mjs --only t01 --visible", "node run.mjs --docs-only         # rebuild these pages from the saved results", "```", "", "See [README](../README.md) for the rules and for how to add a test.", "");
  writeFileSync(join(DOCS, "CATALOG.md"), C.join("\n"));
}

/* ------------------------------------------------------------------ main */
const tests = await loadTests();
const latest = readJson(LATEST, {});

if (flag("list")) {
  for (const t of tests) console.log(`${t.meta.id.padEnd(30)} ${(latest[t.meta.id]?.status ?? "not run").padEnd(8)} ${t.meta.title}`);
  process.exit(0);
}
if (flag("docs-only")) { writeDocs(tests, latest); console.log(`docs regenerated for ${tests.length} tests → tests/e2e/docs/`); process.exit(0); }

const selected = tests.filter((t) => !only.length || only.some((o) => t.meta.id.toLowerCase().startsWith(o) || t.meta.id.toLowerCase().includes(o)));
if (!selected.length) { console.log("no test matches --only " + only.join(",")); process.exit(1); }

if (!visible) { process.env.HEADLESS = "1"; process.env.SLOW ??= "0.15"; }
const mode = visible ? "visible" : "headless";

const bench = await import("./bench/bench.mjs");
const wasUp = bench.isUp(bench.PORTS.api) && bench.isUp(bench.PORTS.admin) && bench.isUp(bench.PORTS.storefront);
console.log(`\n▶ ${selected.length} test(s), ${mode}${flag("rebuild") ? ", rebuilding the apps first" : ""}\n`);
const ok = flag("rebuild") ? await bench.rebuild() : await bench.up();
if (!ok) { console.log("The bench could not start — see tests/e2e/.bench/logs/"); process.exit(2); }
let pristine = !wasUp || flag("rebuild"); // fake data nobody has touched yet in this session

const { openWatch } = await import("./bench/watch.mjs");
const summary = [];
for (let i = 0; i < selected.length; i++) {
  const t = selected[i];
  const m = t.meta;
  if (m.fresh && !pristine) { console.log("  (resetting the fake data for a clean start)"); await bench.reset(); }
  pristine = false;
  console.log(`\n━━ ${m.id} — ${m.title}`);
  const started = Date.now();
  const d = await openWatch({ testId: m.id, headlessOnly: m.browser === false });
  let error = "";
  try {
    await t.run(d, { ids: bench.ids() });
  } catch (e) {
    error = String(e?.message ?? e).split("\n").slice(0, 3).join(" ").slice(0, 400);
    console.log("\n  TEST STOPPED EARLY:", error);
    await d.shot("error").catch(() => {});
  }
  const pass = d.results.filter((r) => r.ok).length;
  const fail = d.results.length - pass;
  const status = error ? "error" : fail ? "fail" : "pass";
  const rec = {
    id: m.id, title: m.title, status, pass, fail, error, mode,
    at: new Date().toISOString(), durationMs: Date.now() - started,
    steps: d.steps, findings: d.findings, problems: d.problems,
  };
  latest[m.id] = rec;
  appendFileSync(HISTORY, JSON.stringify({ id: m.id, status, pass, fail, mode, at: rec.at, durationMs: rec.durationMs, error: error || undefined }) + "\n");
  summary.push(rec);
  d.summary();
  if (hold && i === selected.length - 1) await d.hold(); else await d.close();
}

writeFileSync(LATEST, JSON.stringify(latest, null, 2));
writeDocs(tests, latest);

console.log("\n════════════════════════ RESULTS ════════════════════════");
for (const r of summary) console.log(`${r.status === "pass" ? "PASS" : r.status === "fail" ? "FAIL" : "ERR "}  ${r.id.padEnd(28)} ${r.pass}/${r.pass + r.fail} checks  ${secs(r.durationMs)}${r.findings.length ? `  (${r.findings.length} finding${r.findings.length > 1 ? "s" : ""})` : ""}`);
console.log(`\nsaved → tests/e2e/results/latest.json · tests/e2e/docs/CATALOG.md\n`);
process.exit(summary.some((r) => r.status !== "pass") ? 1 : 0);
