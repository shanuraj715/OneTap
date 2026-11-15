// Runs one of the stand-alone suites in tests/e2e/suites/ as part of a test: starts it as a child process and turns its
// output into recorded steps + checks.   "=== heading" / "== heading"  → a new numbered step
//                                          "PASS  label  — detail"       → a passed check
//                                          "FAIL  label  — detail"       → a failed check
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SUITES = fileURLToPath(new URL("../suites/", import.meta.url));
const RUN_DIR = fileURLToPath(new URL("../.bench/suite-run/", import.meta.url));

export async function runSuite(d, file, { env = {}, timeoutMs = 5 * 60_000 } = {}) {
  mkdirSync(RUN_DIR, { recursive: true });
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SUITES + file], { cwd: RUN_DIR, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let buf = "", errBuf = "", seen = 0;
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error(`${file} did not finish within ${timeoutMs / 1000} s`)); }, timeoutMs);
    const line = async (raw) => {
      const t = raw.replace(/\r$/, "");
      let m;
      if ((m = t.match(/^={2,3}\s*(.+)$/))) { seen++; d.steps.push({ n: d.steps.filter((x) => x.n > 0).length + 1, title: m[1].replace(/^\d+\.\s*/, ""), checks: [] }); console.log(`  » ${m[1]}`); }
      else if ((m = t.match(/^(PASS|FAIL)\s+(.*)$/))) {
        const [label, ...rest] = m[2].split("  — ");
        d.check(label.trim(), m[1] === "PASS", rest.join("  — ").trim());
        seen++;
      } else if (t.trim()) console.log("   " + t);
    };
    const feed = (chunk) => { buf += chunk; let i; while ((i = buf.indexOf("\n")) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); void line(l); } };
    child.stdout.on("data", (c) => feed(String(c)));
    child.stderr.on("data", (c) => { errBuf += String(c); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (buf) void line(buf);
      if (seen === 0) reject(new Error(`${file} produced no checks (exit ${code}). ${errBuf.trim().split("\n").slice(-3).join(" ").slice(0, 300)}`));
      else if (code !== 0 && !d.results.some((r) => !r.ok)) reject(new Error(`${file} exited with code ${code}. ${errBuf.trim().split("\n").slice(-3).join(" ").slice(0, 300)}`));
      else resolve();
    });
  });
}
