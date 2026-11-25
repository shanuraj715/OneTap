// WATCHABLE BROWSER — opens a real, visible, FULL-SIZE Google Chrome window (a clean temporary profile: none of your
// logins or tabs) and drives it so a person can follow along: a red cursor glides to every click, typing is slow enough
// to read, a caption bar names each step, and named tabs let one window play several people (customer, staff…).
// It also records pass/fail checks and takes screenshots (those are for me to look at).
import { chromium, request as pwRequest } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOTS = fileURLToPath(new URL("../results/shots/", import.meta.url));
mkdirSync(SHOTS, { recursive: true });

/** runs inside every page (top frame only) */
const OVERLAY = () => {
  if (window.top !== window) return;
  const CSS = `
    #__w_cursor{position:fixed;left:0;top:0;width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:50%;background:rgba(220,38,38,.82);border:2.5px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.4),0 3px 10px rgba(0,0,0,.4);z-index:2147483647;pointer-events:none;transition:width .08s,height .08s,margin .08s}
    #__w_cursor.down{width:16px;height:16px;margin:-8px 0 0 -8px}
    .__w_ripple{position:fixed;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;border:3px solid rgba(220,38,38,.9);z-index:2147483646;pointer-events:none;animation:__w_rip .6s ease-out forwards}
    @keyframes __w_rip{to{transform:scale(4.5);opacity:0}}
    #__w_caption{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);max-width:min(980px,92vw);padding:12px 22px;border-radius:12px;background:rgba(17,17,17,.9);color:#fff;font:600 16px/1.35 -apple-system,system-ui,sans-serif;z-index:2147483647;pointer-events:none;box-shadow:0 8px 28px rgba(0,0,0,.4);text-align:center}
    #__w_caption::before{content:attr(data-t)}
    #__w_caption[hidden]{display:none}
    #__w_who{position:fixed;left:14px;bottom:22px;padding:7px 12px;border-radius:999px;background:rgba(220,38,38,.92);color:#fff;font:700 12.5px/1 -apple-system,system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;z-index:2147483647;pointer-events:none}
    #__w_who::before{content:attr(data-t)}
    #__w_who[hidden]{display:none}`;
  const mount = () => {
    if (document.getElementById("__w_root") || !document.body) return;
    const root = document.createElement("div");
    root.id = "__w_root";
    root.innerHTML = `<style>${CSS}</style><div id="__w_cursor"></div><div id="__w_who" hidden></div><div id="__w_caption" hidden></div>`;
    document.body.appendChild(root);
    const cur = root.querySelector("#__w_cursor");
    const cap = root.querySelector("#__w_caption");
    const who = root.querySelector("#__w_who");
    const move = (x, y) => { cur.style.left = x + "px"; cur.style.top = y + "px"; };
    const ripple = (x, y) => { const r = document.createElement("div"); r.className = "__w_ripple"; r.style.left = x + "px"; r.style.top = y + "px"; root.appendChild(r); setTimeout(() => r.remove(), 700); };
    window.__w_render = (t, w) => { cap.setAttribute("data-t", t || ""); cap.hidden = !t; who.setAttribute("data-t", w || ""); who.hidden = !w; }; // drawn by CSS, so it is never part of the page text
    if (!window.__w_wired) {
      window.__w_wired = true;
      addEventListener("mousemove", (e) => move(e.clientX, e.clientY), true);
      addEventListener("mousedown", (e) => { document.getElementById("__w_cursor")?.classList.add("down"); ripple(e.clientX, e.clientY); }, true);
      addEventListener("mouseup", () => document.getElementById("__w_cursor")?.classList.remove("down"), true);
    }
    window.__w_state?.().then((s) => { move(s.x, s.y); window.__w_render(s.caption, s.who); }).catch(() => {});
  };
  addEventListener("DOMContentLoaded", () => setTimeout(mount, 250));
  setInterval(mount, 600); // survives a framework re-render that drops it
};

/** make the window fill the screen (not fullscreen — the address bar stays visible) */
async function maximize(context, page) {
  try {
    const cdp = await context.newCDPSession(page);
    const { windowId } = await cdp.send("Browser.getWindowForTarget");
    await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "maximized" } });
    await cdp.detach().catch(() => {});
  } catch (e) {
    console.log("  (couldn't maximize through the browser protocol:", String(e).slice(0, 120), ")");
  }
}

/**
 * options:  full (default) — a maximized window, the page fills it
 *           mobile        — a phone-sized window with touch instead (full = false)
 */
export async function openWatch({ mobile = false, slow: slowOpt = 1, geolocation, viewport, testId = "test", headlessOnly = false } = {}) {
  // HEADLESS=1 → no window (a quick dry run); SLOW=0.2 → everything 5× faster. headlessOnly: this test never needs a window.
  const headless = headlessOnly || process.env.HEADLESS === "1";
  const slow = Number(process.env.SLOW ?? slowOpt);
  const full = !mobile && !viewport && !headless;
  const browser = await chromium.launch({
    ...(headless ? {} : { channel: "chrome" }),
    headless,
    args: ["--window-position=0,0", "--no-first-run", "--no-default-browser-check", "--disable-features=Translate", "--host-resolver-rules=MAP *.test 127.0.0.1"], // any *.test store domain opens the local storefront
  });
  const context = await browser.newContext({
    viewport: full ? null : mobile ? { width: 390, height: 844 } : (viewport ?? { width: 1440, height: 900 }),
    ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
    ...(geolocation ? { geolocation, permissions: ["geolocation"] } : {}),
  });
  const state = { x: 400, y: 300, caption: "", who: "" };
  await context.exposeBinding("__w_state", () => state);
  await context.addInitScript(OVERLAY);

  const problems = [];
  const tabs = new Map();
  const wire = (p, name) => {
    // watching: let each page sit for a moment after it loads, so it can be read
    const goto0 = p.goto.bind(p);
    p.goto = async (...a) => { const r = await goto0(...a); await sleep(1300 * slow); return r; };
    p.on("pageerror", (e) => problems.push(`[${name}] page error: ${String(e).slice(0, 200)}`));
    p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|favicon/.test(m.text())) problems.push(`[${name}] console: ${m.text().slice(0, 200)}`); });
    p.on("dialog", (dlg) => dlg.accept().catch(() => {}));
  };
  let page = await context.newPage();
  if (full) await maximize(context, page);
  tabs.set("main", page);
  wire(page, "main");
  let current = "main";
  const size = async () => (await page.evaluate(() => [innerWidth, innerHeight, outerWidth, outerHeight, screen.availWidth, screen.availHeight]).catch(() => [0, 0, 0, 0, 0, 0]));
  [state.x, state.y] = await size().then(([w, h]) => [w / 2, h / 2]);

  const T0 = Date.now();
  const results = [];
  /** show the latest check result as the caption (visible runs only) — no waiting */
  const showCheck = (t) => { if (headless && process.env.WATCH_CAPTIONS !== "1") return; state.caption = t; void page.evaluate(([c, w]) => window.__w_render?.(c, w), [t, state.who]).catch(() => {}); };
  // What gets saved to the test's doc: numbered steps, each with the checks made in it, plus findings.
  const steps = [];
  const findings = [];
  const stepOf = () => steps[steps.length - 1] ?? (steps.push({ n: 0, title: "Setup", checks: [] }), steps[0]);
  const apiClients = [];
  const d = {
    steps,
    findings,
    context,
    browser,
    results,
    problems,
    get page() { return page; },
    size,
    pause: (ms = 600) => sleep(ms * slow),

    /** switch to (or open) a named tab; `who` shows as a red label at the bottom-left so you know whose screen it is */
    async tab(name, who) {
      if (!tabs.has(name)) {
        const p = await context.newPage();
        tabs.set(name, p);
        wire(p, name);
      }
      page = tabs.get(name);
      current = name;
      state.who = who ?? state.who;
      await page.bringToFront();
      await sleep(350 * slow);
      return page;
    },
    /** a NUMBERED step of the test: shown on screen as a caption AND saved in the test's doc. Checks that follow belong to it. */
    async step(title, ms = 1700) {
      const n = steps.filter((x) => x.n > 0).length + 1;
      steps.push({ n, title, checks: [] });
      const t = ((Date.now() - T0) / 1000).toFixed(0);
      await d.say(`STEP ${n} — ${title}`, ms);
      console.log(`      (+${t}s since the test started)`);
    },
    async say(text, ms = 1100) {
      state.caption = text;
      console.log(`  » [${current}] ${text}`);
      await page.evaluate(([t, w]) => window.__w_render?.(t, w), [text, state.who]).catch(() => {});
      await sleep(ms * slow);
    },
    async goto(url, wait = 700) {
      await page.goto(url, { waitUntil: "load", timeout: 60000 });
      await sleep(wait * slow);
    },
    /** glide the red cursor to the middle of an element, then click it */
    async click(target, { after = 500 } = {}) {
      const loc = (typeof target === "string" ? page.locator(target) : target).first();
      await loc.waitFor({ state: "visible", timeout: 15000 });
      await loc.scrollIntoViewIfNeeded();
      await sleep(150 * slow);
      const box = headless ? null : await loc.boundingBox(); // nobody is watching: no need to glide the cursor there
      if (box && !mobile) {
        const x = box.x + box.width / 2, y = box.y + box.height / 2;
        // glide: an eased path with a small pause per step, so the eye can follow it
        const x0 = state.x, y0 = state.y;
        const dist = Math.hypot(x - x0, y - y0);
        const n = Math.max(14, Math.min(46, Math.round(dist / 16)));
        for (let i = 1; i <= n; i++) {
          const t = i / n, e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          await page.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e);
          await sleep(11 * slow);
        }
        state.x = x; state.y = y;
        await sleep(240 * slow);
      }
      await (mobile ? loc.tap() : loc.click({ delay: 90 }));
      await sleep(after * slow);
    },
    /** click a box, clear it, type slowly */
    async type(target, text, { after = 400, delay = 45 } = {}) {
      const loc = (typeof target === "string" ? page.locator(target) : target).first();
      await d.click(loc, { after: 150 });
      await loc.fill("");
      await page.keyboard.type(text, { delay });
      await sleep(after * slow);
    },
    async choose(target, option, { after = 500 } = {}) {
      const loc = (typeof target === "string" ? page.locator(target) : target).first();
      await d.click(loc, { after: 200 });
      await loc.selectOption(option);
      await sleep(after * slow);
    },
    async press(key, after = 500) {
      await page.keyboard.press(key);
      await sleep(after * slow);
    },
    async scroll(by = 500, ms = 900) {
      await page.mouse.wheel(0, by);
      await sleep(ms * slow);
    },
    /** outline an element in red for a moment — "look here" */
    async spot(target, ms = 1500) {
      const loc = (typeof target === "string" ? page.locator(target) : target).first();
      await loc.scrollIntoViewIfNeeded().catch(() => {});
      await loc.evaluate((el) => { el.__w_old = el.style.cssText; el.style.outline = "4px solid #dc2626"; el.style.outlineOffset = "3px"; el.style.transition = "outline .15s"; }).catch(() => {});
      await sleep(ms * slow);
      await loc.evaluate((el) => { el.style.outline = ""; el.style.outlineOffset = ""; }).catch(() => {});
    },
    /** a screenshot for ME to look at (the window itself is for you) */
    async shot(name, opts = {}) {
      const path = `${SHOTS}${testId}-${name}.png`;
      await page.screenshot({ path, ...opts });
      return path;
    },
    /** record a pass/fail check */
    check(label, ok, detail = "") {
      const rec = { label, ok: Boolean(ok), detail: String(detail ?? ""), kind: "expect" };
      results.push(rec);
      stepOf().checks.push(rec);
      console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`);
      showCheck(`${ok ? "✅" : "❌"} ${label}`);
      return Boolean(ok);
    },
    /** a MUST-NOT check: `bad` is true when the thing that must not happen DID happen (that fails the check) */
    never(label, bad, detail = "") {
      const rec = { label, ok: !bad, detail: String(detail ?? ""), kind: "never" };
      results.push(rec);
      stepOf().checks.push(rec);
      console.log(`  ${rec.ok ? "PASS" : "FAIL"}  MUST NOT: ${label}${detail ? "  — " + detail : ""}`);
      showCheck(`${rec.ok ? "✅" : "❌"} must NOT: ${label}`);
      return rec.ok;
    },
    /** something noticed that isn't a pass/fail of this test but the owner should know (a gap, a bug, a missing feature) */
    finding(text) {
      findings.push(text);
      console.log(`  FINDING  ${text}`);
    },
    /** call the bench API as whoever is signed in in the browser (shares the browser's cookies) */
    async api(method, path, { body, outlet, brand } = {}) {
      return callApi(context.request, method, path, { body, outlet, brand });
    },
    /** an API client with its own empty cookie jar (a customer who has not signed in yet) */
    async anon() {
      const ctx = await pwRequest.newContext({ baseURL: BENCH.api });
      apiClients.push(ctx);
      return { call: (method, path, o) => callApi(ctx, method, path, o) };
    },
    /** call the bench API as a given login with its OWN session (does not touch the browser) */
    async apiAs(who) {
      const [email, password] = Array.isArray(who) ? who : BENCH.logins[who];
      const ctx = await pwRequest.newContext({ baseURL: BENCH.api });
      apiClients.push(ctx);
      const r = await ctx.post("/api/auth/login", { data: { email, password } });
      if (!r.ok()) throw new Error(`apiAs(${email}) login failed: ${r.status()}`);
      return { call: (method, path, o) => callApi(ctx, method, path, o) };
    },
    summary() {
      const pass = results.filter((r) => r.ok).length;
      console.log(`\nSUMMARY ${pass} passed, ${results.length - pass} failed${problems.length ? `, ${problems.length} browser problems:\n  ` + problems.join("\n  ") : ", no browser errors"}`);
      return { pass, fail: results.length - pass };
    },
    /** leave the window open for you to use; ends when you close it */
    async hold(note = "Window left open — click around yourself; close it when you're done.") {
      if (headless) return d.close();
      await d.say(note, 0);
      console.log("  (holding the window open)");
      await new Promise((res) => browser.on("disconnected", res));
    },
    async close() {
      for (const c of apiClients) await c.dispose().catch(() => {});
      await browser.close().catch(() => {});
    },
  };
  return d;
}

async function callApi(ctx, method, path, { body, outlet, brand } = {}) {
  const r = await ctx.fetch(BENCH.api + path, {
    method,
    headers: { ...(outlet ? { "x-rasoipulse-outlet": outlet } : {}), ...(brand ? { "x-rasoipulse-brand": brand } : {}) },
    ...(body ? { data: body } : {}),
  });
  let json = null;
  try { json = await r.json(); } catch { /* not json */ }
  return { status: r.status(), ok: r.ok(), json };
}

/** shared logins for the test bench */
export const BENCH = {
  api: "http://localhost:3097",
  storefront: "http://localhost:3170",
  betaStorefront: "http://beta.localhost:3170",
  admin: "http://localhost:3171",
  logins: {
    super: ["super@sandbox.test", "Super123!"],
    owner: ["o@acme.test", "Owner123!"],
    manager: ["m@acme.test", "Manager123!"],
    cashier: ["s@acme.test", "Staff1234!"],
    kitchen: ["k@acme.test", "Kitchen123!"],
    betaOwner: ["o@beta.test", "Owner123!"],
  },
};

/** sign in to the dashboard in the current tab */
export async function adminLogin(d, who = "owner") {
  const [email, pw] = Array.isArray(who) ? who : BENCH.logins[who];
  await d.goto(BENCH.admin + "/", 500);
  await d.type('input[type="email"]', email, { after: 150 });
  await d.type('input[type="password"]', pw, { after: 250 });
  await d.click(d.page.getByRole("button", { name: /sign in|log in/i }), { after: 300 });
  await d.page.waitForSelector("text=/^(Orders|Stores)$/", { timeout: 30000 }).catch(() => {});
  await sleep(700);
}
