// App Management in Chrome: the super admin ADDS an app by typing its name, edits its words, makes it public, sees it on the website (with a
// generated icon), and removes it — nothing about the app is written in code. Built-in apps show their limits (can't be removed). Against the bench
// console (super admin) and the bench website. What it adds is removed again at the end.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const AD = "http://localhost:3171";
const API = "http://localhost:3097";
const WEB = "http://localhost:3173";
const BENCH = fileURLToPath(new URL("../bench/bench.mjs", import.meta.url));
let pass = 0, fail = 0;
const problems = [];
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);
const norm = (t) => t.replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 15000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* retry */ } await sleep(250); } return false; };
const listed = async () => (await (await fetch(`${API}/api/app-updates/apps`)).json()).apps.map((a) => a.id);

const browser = await chromium.launch();
let su = "";
try {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 1100 } });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon|WebSocket/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  page.on("dialog", (d) => d.accept());

  say("1. The console lists the built-in apps; they can be edited but not removed");
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', "super@sandbox.test");
  await page.fill('input[type="password"]', "Super123!");
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector("aside a");
  su = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  await page.goto(AD + "/platform/app-management", { waitUntil: "load" });
  await page.getByTestId("app-tab-oma").waitFor({ timeout: 15000 });
  const tabs = () => page.locator('[data-testid^="app-tab-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid").replace("app-tab-", "")));
  ok((await tabs()).join() === "oma,kda,rda,admin,business", "five tabs, in order: OMA, KDA, RDA, Admin, Business", (await tabs()).join());
  ok(await page.getByTestId("app-add").isVisible(), "an 'Add an app' button is at the top");
  await page.getByTestId("app-tab-oma").click();
  await page.getByTestId("app-about").waitFor();
  ok(/Built in/.test(await page.getByTestId("app-about").innerText()) && await page.getByTestId("app-remove").isDisabled(), "a built-in app says 'Built in' and its Remove button is off");
  ok(/can't be removed/.test(await page.getByTestId("app-remove-why").innerText()) && /private/.test(await page.getByTestId("app-remove-why").innerText()), "…with the reason, and what to do instead (make it private)");
  await page.getByTestId("app-edit").click();
  const form = page.getByTestId("app-form");
  await form.waitFor();
  ok(await page.getByTestId("app-form-slug").isDisabled() && (await page.getByTestId("app-form-slug").inputValue()) === "oma", "editing shows the address, and it can't be changed");
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click().catch(() => {});
  await form.waitFor({ state: "detached" }).catch(() => {});

  say("2. Add an app: only a name is needed");
  await page.getByTestId("app-add").click();
  await form.waitFor();
  ok(await page.getByTestId("app-form-save").isDisabled(), "the Add button is off until there is a name");
  await page.getByTestId("app-form-name").fill("Rasoi Pulse POS");
  ok((await page.getByTestId("app-form-slug").inputValue()) === "rasoi-pulse-pos" && (await page.getByTestId("app-form-code").inputValue()) === "RPP", "the address (rasoi-pulse-pos) and the icon code (RPP) are made from the name");
  ok(/\/apps\/rasoi-pulse-pos/.test(norm(await form.innerText())), "…and the form says where its page will be");
  await page.getByTestId("app-form-slug").fill("Bad Address!");
  ok((await page.getByTestId("app-form-slug").inputValue()) === "bad address!" && await page.getByTestId("app-form-save").isDisabled() && /lowercase letters/.test(await page.getByTestId("app-form-problem").innerText()), "a bad address (spaces, symbols) is explained and the Add button stays off");
  await page.getByTestId("app-form-slug").fill("rasoi-pulse-pos");
  await page.getByTestId("app-form-code").fill("TOOLONGCODE");
  ok((await page.getByTestId("app-form-code").inputValue()).length <= 5, "the code box takes 5 characters at most");
  await page.getByTestId("app-form-code").fill("POS");
  await page.getByTestId("app-form-tagline").fill("Billing at the counter");
  await page.getByTestId("app-form-audience").fill("For cashiers who bill walk-in guests");
  await page.locator('[data-testid="app-form-description"]').fill("Bill a walk-in guest in seconds and print the receipt.");
  await page.getByTestId("app-form-save").click();
  await form.waitFor({ state: "detached" });
  await page.getByTestId("app-tab-rasoi-pulse-pos").waitFor({ timeout: 10000 });
  ok((await tabs()).join() === "oma,kda,rda,admin,business,rasoi-pulse-pos", "the new app has its own tab after the built-in ones", (await tabs()).join());
  ok((await page.getByTestId("app-tab-rasoi-pulse-pos").getAttribute("aria-selected")) === "true", "…and it is open");
  const about = norm(await page.getByTestId("app-about").innerText());
  ok(/Rasoi Pulse POS/.test(about) && /POS/.test(about) && /Added here/.test(about) && /Billing at the counter/.test(about) && /walk-in guest/.test(about) && /rasoi-pulse-pos/.test(about), "the About card shows its name, code, 'Added here', tagline, audience, description and address");
  ok(/Private/.test(norm(await page.getByTestId("app-visibility-now").innerText())), "it starts PRIVATE");
  ok(await page.getByTestId("app-remove").isEnabled(), "…and, having no versions, it can be removed");
  ok((await page.getByTestId("app-refresh").count()) === 0, "no Refresh interval card (this app does not ask for it)");
  ok(/No version uploaded yet/.test(await page.locator("body").innerText()) && await page.getByTestId("app-new-version").isVisible(), "'New version' is there to upload its first file");

  say("3. The same address can't be used twice");
  await page.getByTestId("app-add").click();
  await form.waitFor();
  await page.getByTestId("app-form-name").fill("Rasoi Pulse POS");
  await page.getByTestId("app-form-save").click();
  await page.getByTestId("app-form-error").waitFor({ timeout: 8000 });
  ok(/already an app/.test(await page.getByTestId("app-form-error").innerText()), "adding it again says there is already an app at that address", norm(await page.getByTestId("app-form-error").innerText()));
  ok((await tabs()).filter((x) => x === "rasoi-pulse-pos").length === 1, "…and no second tab appeared");
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await form.waitFor({ state: "detached" });

  say("4. Edit its words");
  await page.getByTestId("app-edit").click();
  await form.waitFor();
  ok(await page.getByTestId("app-form-slug").isDisabled() && (await page.getByTestId("app-form-name").inputValue()) === "Rasoi Pulse POS", "the form opens with its current words; the address is locked");
  await page.getByTestId("app-form-name").fill("Rasoi Pulse Counter");
  await page.getByTestId("app-form-tagline").fill("Billing, faster");
  await page.getByTestId("app-form-save").click();
  await form.waitFor({ state: "detached" });
  ok(await until(async () => /Rasoi Pulse Counter/.test(await page.getByTestId("app-about-name").innerText())) && /Billing, faster/.test(await page.getByTestId("app-about").innerText()), "the About card shows the new words");
  ok(/Rasoi Pulse Counter/.test(await page.getByTestId("app-tab-rasoi-pulse-pos").innerText()), "…and so does its tab (the address stayed rasoi-pulse-pos)");

  say("5. Private: its page opens by the link, the list leaves it out");
  execFileSync(process.execPath, [BENCH, "website"], { stdio: "inherit" });
  const apps = await ctx.newPage();
  apps.on("pageerror", (e) => problems.push(`website pageerror: ${String(e).slice(0, 200)}`));
  await apps.goto(`${WEB}/apps`, { waitUntil: "load" });
  ok(/Rasoi Pulse OMA/.test(await apps.locator("body").innerText()) && !/Rasoi Pulse Counter/.test(await apps.locator("body").innerText()), "the website's /apps page does not list it while it is private");
  const own = await apps.goto(`${WEB}/apps/rasoi-pulse-pos`, { waitUntil: "load" });
  const body = norm(await apps.locator("body").innerText());
  ok(own.status() === 200 && /Rasoi Pulse Counter/i.test(body) && /Billing, faster/i.test(body) && /walk-in guest/i.test(body), "its own page opens by the link with the words written in the console", `${own.status()} ${body.slice(0, 300)}`);
  ok(/noindex/.test(await apps.locator('meta[name="robots"]').getAttribute("content")), "…and tells search engines to skip it");
  ok(!(await apps.getByRole("link", { name: /^Download/ }).count()), "…and, with no version yet, shows no Download button");
  await apps.goto(`${WEB}/apps/no-such-app`, { waitUntil: "load" });
  ok(await until(async () => /couldn't find that page/i.test(await apps.locator("body").innerText())) && !(await apps.getByRole("link", { name: /^Download/ }).count()), "an address that is no app says it couldn't find that page (like every unknown address on the site)");

  say("6. Public: it joins the website's list with a generated icon");
  await page.getByTestId("app-visibility-toggle").click();
  await page.waitForFunction(() => /Public/.test(document.querySelector('[data-testid="app-visibility-now"]')?.innerText ?? ""), null, { timeout: 8000 });
  ok((await listed()).at(-1) === "rasoi-pulse-pos", "the server's public list has it, after the built-in apps");
  execFileSync(process.execPath, [BENCH, "website"], { stdio: "inherit" });
  await apps.goto(`${WEB}/apps`, { waitUntil: "load" });
  const card = apps.locator("li.apps-card").filter({ has: apps.locator('a[href="/apps/rasoi-pulse-pos"]') });
  ok((await card.count()) === 1, "the website's /apps page has a card for it");
  ok(/Rasoi Pulse Counter/.test(await card.innerText()) && /Billing, faster/i.test(await card.innerText()) && /No version published yet/.test(await card.innerText()), "…with its name, tagline and 'No version published yet'");
  const icon = await card.locator("img").first().getAttribute("src");
  ok(/^data:image\/svg\+xml/.test(icon ?? "") && /POS/.test(decodeURIComponent(icon ?? "")), "…and an icon made from its code (POS) in a colour of its own", (icon ?? "").slice(0, 40));
  await apps.goto(`${WEB}/apps/rasoi-pulse-pos`, { waitUntil: "load" });
  ok((await apps.locator('.app-icon-lg img[src^="data:image/svg+xml"]').count()) === 1, "its own page shows the same generated icon");

  say("7. Remove it");
  await page.getByTestId("app-remove").click();
  await page.getByTestId("app-remove-confirm").click();
  ok(await until(async () => !(await tabs()).includes("rasoi-pulse-pos")), "the tab goes away");
  ok(/Rasoi Pulse OMA|Rasoi Pulse|Staff/.test(await page.getByTestId("app-about-name").innerText()), "…and the console shows the first app again");
  ok(!(await listed()).includes("rasoi-pulse-pos"), "the public list no longer has it");
  execFileSync(process.execPath, [BENCH, "website"], { stdio: "inherit" });
  await apps.goto(`${WEB}/apps/rasoi-pulse-pos`, { waitUntil: "load" });
  ok(await until(async () => /couldn't find that page/i.test(await apps.locator("body").innerText())), "its page on the website says it couldn't find that page now");

  ok(problems.length === 0, "no errors in the browser console", problems.slice(0, 3).join(" | "));
} finally {
  // put back what a stopped run could have left behind
  try {
    if (!su) su = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "super@sandbox.test", password: "Super123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    await fetch(`${API}/api/platform/app-releases/apps/rasoi-pulse-pos`, { method: "DELETE", headers: { cookie: su } });
  } catch { /* nothing to clean */ }
  await browser.close();
}
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
