// App Management in Chrome: (1) the tabs share the whole width, each with the app's icon and short name; (2) the "Live connection" card lets the platform admin
// choose, per app, the live connection first or polling only (polling is the backup either way). Against the bench console (super admin) and API. Everything it
// changes is put back at the end.
import { chromium } from "playwright";
const AD = "http://localhost:3171";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const problems = [];
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);
const norm = (t) => t.replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 12000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* retry */ } await sleep(250); } return false; };
const su = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "super@sandbox.test", password: "Super123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const call = async (method, path, body) => { const r = await fetch(API + path, { method, headers: { cookie: su, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => ({})) }; };
const A = "/api/platform/app-releases";
const settingOf = async (slug) => (await call("GET", A + "/settings")).json.settings.find((x) => x.app === slug);

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon|WebSocket/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  let confirmText = "";
  let confirmAnswer = true;
  page.on("dialog", (d) => { confirmText = d.message(); confirmAnswer ? d.accept() : d.dismiss(); });
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', "super@sandbox.test");
  await page.fill('input[type="password"]', "Super123!");
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector("aside a");
  await page.goto(AD + "/platform/app-management", { waitUntil: "load" });
  await page.getByTestId("app-tab-oma").waitFor({ timeout: 15000 });

  say("1. The tabs: the whole width, an icon and a short name");
  const geo = () => page.evaluate(() => {
    const tabs = [...document.querySelectorAll('[role="tab"]')].map((t) => { const r = t.getBoundingClientRect(); const i = t.querySelector("img"); return { id: t.getAttribute("data-testid").replace("app-tab-", ""), x: r.left, right: r.right, y: Math.round(r.top), w: r.width, h: r.height, text: t.innerText.replace(/\s+/g, " ").trim(), title: t.getAttribute("title"), src: i?.getAttribute("src") ?? "", loaded: Boolean(i && i.complete && i.naturalWidth > 0), icon: i ? Math.round(i.getBoundingClientRect().width) : 0 };});
    const list = document.querySelector('[role="tablist"]').getBoundingClientRect();
    return { tabs, list: { left: list.left, right: list.right }, over: document.documentElement.scrollWidth - innerWidth, header: document.querySelector("h1")?.getBoundingClientRect().left };
  });
  let g = await geo();
  ok(g.tabs.map((t) => t.id).join() === "oma,kda,rda,admin,business", "five tabs in order", g.tabs.map((t) => t.id).join());
  ok(g.tabs.map((t) => t.text).join("|") === "Order Management App|Kitchen Display App|Rider Delivery App|Platform Team App|Business Insights App", "each tab is just the app's short name (no 'Rasoi Pulse OMA · …')", g.tabs.map((t) => t.text).join("|"));
  ok(g.tabs.every((t) => t.title?.startsWith("Rasoi Pulse")), "…and hovering shows the full name", g.tabs.map((t) => t.title).join(" | "));
  ok(g.tabs.every((t) => t.loaded && t.icon >= 28 && /^\/app-icons\/[a-z]+\.svg$/.test(t.src)), "every tab shows the app's own icon (the same picture as the phone app)", g.tabs.map((t) => t.src).join(" "));
  ok(new Set(g.tabs.map((t) => t.y)).size === 1, "all five are in ONE row on a wide screen", g.tabs.map((t) => t.y).join());
  const span = (g.tabs.at(-1).right - g.tabs[0].x) / (g.list.right - g.list.left);
  ok(span >= 0.97, "together they use almost the whole width of the page", `${Math.round(span * 100)}%`);
  ok(Math.max(...g.tabs.map((t) => t.w)) - Math.min(...g.tabs.map((t) => t.w)) <= 2, "…each the same width", g.tabs.map((t) => Math.round(t.w)).join());
  ok(Math.max(...g.tabs.map((t) => t.h)) <= 56, "…and short (one line each)", `${Math.round(Math.max(...g.tabs.map((t) => t.h)))}px`);
  ok(g.over <= 0, "nothing runs off the screen");
  await page.setViewportSize({ width: 820, height: 1000 });
  await sleep(400);
  g = await geo();
  ok(g.over <= 0 && g.tabs.every((t) => t.right <= 820 && t.x >= 0), "on a narrow window the tabs wrap onto more rows instead of running off the side", `${new Set(g.tabs.map((t) => t.y)).size} rows`);
  await page.setViewportSize({ width: 390, height: 900 });
  await sleep(400);
  g = await geo();
  ok(g.over <= 0 && g.tabs.every((t) => t.right <= 390), "on a phone too", `${g.over}px over`);
  await page.setViewportSize({ width: 1360, height: 1000 });
  await sleep(300);

  const made = await call("POST", A + "/apps", { name: "Rasoi Pulse Counter", slug: "rasoi-pulse-counter", code: "RPC" });
  await page.reload({ waitUntil: "load" });
  await page.getByTestId("app-tab-rasoi-pulse-counter").waitFor({ timeout: 15000 });
  const mine = (await geo()).tabs.find((t) => t.id === "rasoi-pulse-counter");
  ok(made.status === 201 && mine.text === "Rasoi Pulse Counter" && /^data:image\/svg\+xml/.test(mine.src) && mine.loaded, "an app added in the console (no tagline) shows its name and a generated icon with its code", `${mine?.text} ${mine?.src.slice(0, 22)}`);
  await call("DELETE", A + "/apps/rasoi-pulse-counter");
  await page.reload({ waitUntil: "load" });
  await page.getByTestId("app-tab-oma").waitFor({ timeout: 15000 });

  say("2. Live connection: only for the apps that can listen");
  for (const [slug, shows] of [["oma", true], ["kda", true], ["rda", true], ["admin", false], ["business", false]]) {
    await page.getByTestId(`app-tab-${slug}`).click();
    await page.getByTestId("app-about").waitFor();
    await sleep(350);
    const there = (await page.getByTestId("app-live").count()) === 1;
    ok(there === shows, `${slug}: ${shows ? "has the Live connection card" : "has no Live connection card (it has no live connection)"}`);
  }
  await page.getByTestId("app-tab-oma").click();
  await page.getByTestId("app-live").waitFor();
  const radio = (m) => page.getByTestId(`live-mode-${m}`);
  const now = () => page.getByTestId("live-mode-now");
  ok((await radio("websocket").getAttribute("aria-checked")) === "true" && (await radio("polling").getAttribute("aria-checked")) === "false", "OMA starts on 'Live connection first'");
  ok(/live connection, with polling as the backup/.test(norm(await now().innerText())), "the card says it in words", norm(await now().innerText()));
  ok(/Recommended/.test(await radio("websocket").innerText()) && /never opens a live connection/.test(await radio("polling").innerText()), "each choice explains itself, the first is marked Recommended");
  ok(/polling is always the backup/.test(norm(await page.getByTestId("app-live").innerText())), "…and the card says polling is the backup either way");
  ok(/the backup, used whenever the live connection is down/.test(await page.getByTestId("app-refresh-now").innerText()), "the Refresh interval card now says that its seconds are the backup timer", norm(await page.getByTestId("app-refresh-now").innerText()));
  ok(/asks the server for new data every\s+8 seconds/.test(await page.getByTestId("app-refresh").innerText()), "…and still shows the number");

  say("3. Switch OMA to polling (with a question first)");
  confirmAnswer = false;
  confirmText = "";
  await radio("polling").click();
  await sleep(600);
  ok(/Switch Rasoi Pulse OMA to polling\?/.test(confirmText) && /let go now/.test(confirmText), "pressing it asks first and says what will happen", confirmText.slice(0, 90));
  ok((await settingOf("oma")).liveMode === "websocket" && (await radio("websocket").getAttribute("aria-checked")) === "true", "answering No changes nothing");
  confirmAnswer = true;
  await radio("polling").click();
  ok(await until(async () => (await radio("polling").getAttribute("aria-checked")) === "true"), "answering Yes switches it");
  ok((await settingOf("oma")).liveMode === "polling", "…and the server has it", (await settingOf("oma")).liveMode);
  await page.getByTestId("live-mode-saved").waitFor({ timeout: 8000 });
  ok(/polling only/.test(await page.getByTestId("live-mode-saved").innerText()) && /polling only/.test(await now().innerText()), "the card confirms: Saved, OMA now gets new data through polling only");
  ok(/always, because it is set to polling/.test(await page.getByTestId("app-refresh-now").innerText()), "the Refresh interval card now says the timer is always used");
  ok((await settingOf("kda")).liveMode === "websocket" && (await settingOf("rda")).liveMode === "websocket", "KDA and RDA are not changed");
  await page.reload({ waitUntil: "load" });
  await page.getByTestId("app-live").waitFor({ timeout: 15000 });
  ok((await radio("polling").getAttribute("aria-checked")) === "true", "after a reload it is still polling (the choice was saved)");
  await page.getByTestId("app-tab-kda").click();
  await page.waitForFunction(() => /KDA gets new data/.test(document.querySelector('[data-testid="live-mode-now"]')?.innerText ?? ""));
  ok((await radio("websocket").getAttribute("aria-checked")) === "true", "KDA's tab still shows the live connection");

  say("4. Back to the live connection (no question)");
  await page.getByTestId("app-tab-oma").click();
  await page.waitForFunction(() => /OMA gets new data/.test(document.querySelector('[data-testid="live-mode-now"]')?.innerText ?? ""));
  confirmText = "";
  await radio("websocket").click();
  ok(await until(async () => (await radio("websocket").getAttribute("aria-checked")) === "true") && confirmText === "", "choosing the live connection again needs no question");
  ok((await settingOf("oma")).liveMode === "websocket", "…and the server has it");
  ok(/the backup, used whenever the live connection is down/.test(await page.getByTestId("app-refresh-now").innerText()), "the Refresh interval card is back to 'the backup'");

  ok(problems.length === 0, "no errors in the browser console", problems.slice(0, 3).join(" | "));
} finally {
  await call("PUT", `${A}/live-mode/oma`, { liveMode: "websocket" }).catch(() => undefined);
  await call("DELETE", A + "/apps/rasoi-pulse-counter").catch(() => undefined);
  await browser.close();
}
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
