// The API's request log must never contain a secret. Starts the REAL API (production mode, so its log is plain JSON lines on stdout — no database needed
// for these requests), sends requests that carry a session cookie, an app's Bearer token and the other secret headers, signs a (failed) login in, and
// reads everything the API wrote: not one secret value may be in it, the harmless parts of the request (method, address, the browser name) must still be.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const REPO = fileURLToPath(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const PORT = 3129;
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SECRET = {
  cookie: `rp_session_${randomBytes(6).toString("hex")}`,
  bearer: `bearer_${randomBytes(6).toString("hex")}`,
  revalidate: `reval_${randomBytes(6).toString("hex")}`,
  agent: `agent_${randomBytes(6).toString("hex")}`,
  site: `site_${randomBytes(6).toString("hex")}`,
  password: `Pw!${randomBytes(6).toString("hex")}`,
};

say("1. The real API, in production mode");
const requireApi0 = createRequire(`${REPO}/apps/api/package.json`);
const mms = await import(pathToFileURL(requireApi0.resolve("mongodb-memory-server")).href);
const mongod = await (mms.MongoMemoryServer ?? mms.default.MongoMemoryServer).create();
let out = "";
const child = spawn(process.execPath, ["--input-type=module", "-e", `
  const db = await import(${JSON.stringify(REPO + "/packages/db/src/index.js")});
  await db.connectDb({ uri: ${JSON.stringify(mongod.getUri())}, dbName: "logcheck" });
  const { createApp } = await import(${JSON.stringify(REPO + "/apps/api/src/app.js")});
  createApp().listen(${PORT}, () => console.log("READY"));
`], {
  cwd: `${REPO}/apps/api`,
  env: { ...process.env, NODE_ENV: "production", API_PORT: String(PORT), ENCRYPTION_KEY: randomBytes(24).toString("hex"), ALLOW_MOCK_GATEWAY: "", STOREFRONT_ORIGIN: "https://store.example.test", MONGODB_URI: mongod.getUri(), MONGODB_DB: "logcheck", WHATSAPP_WORKER: "off", RATE_LIMITS: "off", STORE_SUBDOMAIN_BASE: "example.test", PUBLIC_API_URL: "https://api.example.test", CORS_ORIGINS: "https://admin.example.test", WEBSITE_URL: "https://example.test" },
  stdio: ["ignore", "pipe", "pipe"],
});
child.stdout.on("data", (b) => { out += b.toString(); });
child.stderr.on("data", (b) => { out += b.toString(); });
const ready = await (async () => { for (let i = 0; i < 100; i++) { if (out.includes("READY")) return true; await sleep(150); } return false; })();
ok(ready, "the API started in production mode (plain JSON log lines)", out.slice(-200).replace(/\s+/g, " "));

if (ready) {
  say("2. Requests that carry secrets");
  const hit = async (path, init = {}) => { try { return (await fetch(`http://127.0.0.1:${PORT}${path}`, { signal: AbortSignal.timeout(4000), ...init })).status; } catch { return 0; } };
  const UA = { "user-agent": "LogCheck/1.0" };
  const s1 = await hit("/health", { headers: { cookie: `rp_session=${SECRET.cookie}; theme=dark`, ...UA } });
  const s2 = await hit("/health", { headers: { authorization: `Bearer ${SECRET.bearer}`, ...UA } });
  const s3 = await hit("/health", { headers: { "x-revalidate-secret": SECRET.revalidate, "x-rasoipulse-agent": SECRET.agent, "x-site-secret": SECRET.site, ...UA } });
  const s4 = await hit("/health", { method: "GET", headers: { "x-api-key": SECRET.password, "proxy-authorization": `Basic ${SECRET.password}`, ...UA } });
  ok([s1, s2, s3, s4].every((s) => s === 200), "the four requests were answered by the API", `${s1} ${s2} ${s3} ${s4}`);
  const s5 = await hit("/api/auth/login", { method: "POST", headers: { "content-type": "application/json", cookie: `rp_session=${SECRET.cookie}`, ...UA }, body: JSON.stringify({ email: "nobody@example.test", password: SECRET.password }) });
  ok(s5 === 401, "a sign-in with a wrong password is refused (401) and logged like any request", String(s5));
  await sleep(700);

  say("3. What the log says");
  const lines = out.split("\n").filter((l) => l.startsWith("{"));
  ok(lines.length >= 4, "the API wrote its request lines", `${lines.length} JSON lines`);
  for (const [name, value] of Object.entries(SECRET)) ok(!out.includes(value), `the ${name} value is nowhere in the log`);
  ok(/\[hidden\]/.test(out), "the places where a secret was are marked '[hidden]'");
  const req = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((j) => j?.req?.url === "/health")[0];
  ok(req && req.req.method === "GET" && req.req.headers?.["user-agent"] === "LogCheck/1.0" && req.res?.statusCode === s1, "the harmless parts are still logged (method, address, the browser name, the answer's status)", JSON.stringify(req?.req ?? {}).slice(0, 160));
  ok(req && req.req.headers.cookie === "[hidden]", "the cookie header is exactly '[hidden]'", String(req?.req?.headers?.cookie));
}
child.kill();
await mongod.stop();
await sleep(200);

say("4. The sign-in's Set-Cookie answer (the same logger set-up, written to a stream we can read)");
const http = await import("node:http");
const requireApi = createRequire(`${REPO}/apps/api/package.json`);
const { pinoHttp } = requireApi("pino-http");
const { createLogger } = await import(`${REPO}/apps/api/src/logger.js`);
let written = "";
const logger = createLogger({ write: (c) => { written += c; } });
const log = pinoHttp({ logger });
const srv = http.createServer((rq, rs) => { log(rq, rs); rs.setHeader("set-cookie", `rp_session=${SECRET.cookie}; HttpOnly; Path=/`); rs.end("ok"); });
await new Promise((r) => srv.listen(PORT + 1, "127.0.0.1", r));
await fetch(`http://127.0.0.1:${PORT + 1}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json", cookie: `rp_session=${SECRET.cookie}` }, body: JSON.stringify({ email: "a@b.test", password: SECRET.password }) });
await sleep(300);
srv.close();
const line = (() => { try { return JSON.parse(written.split("\n").filter((l) => l.startsWith("{") && l.includes("/api/auth/login"))[0]); } catch { return null; } })();
ok(Boolean(line), "the answer to a sign-in is logged", written.slice(0, 120));
ok(!written.includes(SECRET.cookie), "neither the cookie sent nor the cookie set by the answer is in the line");
ok(line?.res?.headers?.["set-cookie"] === "[hidden]" && line?.req?.headers?.cookie === "[hidden]", "both show '[hidden]'", JSON.stringify({ set: line?.res?.headers?.["set-cookie"], cookie: line?.req?.headers?.cookie }));
ok(!written.includes(SECRET.password), "the password typed is not in the line (bodies are never logged)");
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
