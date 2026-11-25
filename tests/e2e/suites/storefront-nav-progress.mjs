// A thin progress bar across the very top of the storefront while the page changes. Chrome against the bench store; the server's
// answers for the next page are held back on purpose (a slow network) so the bar can be watched.
//  - starts at once on a tap of a link to another page of the store, on Back / Forward, and when the code changes page itself
//    (the outlet picker); creeps forward, never reaches the end by itself; runs to the end and fades when the new page arrives;
//  - does NOT start for a link to the page you are on, a #hash, another website, a new tab, or a ctrl / middle click;
//  - gives up on its own if no page ever arrives.
import { chromium } from "playwright";
const SF = "http://localhost:3170";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 15000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* retry */ } await sleep(100); } return false; };

const cookie = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "o@acme.test", password: "Owner123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const outlets = ((await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json()).outlets ?? []);
const main = outlets.find((o) => o.slug === "main");
const outletId = String(main._id ?? main.id);
const other = outlets.find((o) => o.slug !== "main");
const call = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie, "x-rasoipulse-outlet": outletId }, body: body ? JSON.stringify(body) : undefined });
  let json = {}; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
const page1 = await call("POST", "/api/pages", { slug: "about-progress", title: "About progress", status: "published", showInFooter: true, showInHeader: false, blocks: [{ id: "b1", type: "text", markdown: "A page to move to." }] });

const browser = await chromium.launch();
/** a page whose "next page" answers (Next's RSC requests) are held for `hold.ms` */
const open = async (viewport, path = "/main") => {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const hold = { ms: 0 };
  await page.route("**/*", async (route) => {
    if (hold.ms && route.request().headers()["rsc"] === "1") await sleep(hold.ms);
    try { await route.continue(); } catch { /* the page moved on */ }
  });
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon/.test(m.text())) problems.push(`${viewport.width}: ${m.text().slice(0, 200)}`); });
  page.on("pageerror", (e) => problems.push(`${viewport.width} pageerror: ${String(e).slice(0, 200)}`));
  await page.goto(`${SF}${path}`, { waitUntil: "networkidle", timeout: 90000 });
  // keep a log of every state the bar goes through, with its width at that moment
  await page.evaluate(() => {
    window.__bar = [];
    const el = document.querySelector('[data-testid="nav-progress"]');
    const ratio = () => +(el.firstElementChild.getBoundingClientRect().width / el.getBoundingClientRect().width).toFixed(3);
    const note = () => { window.__bar.push({ state: el.dataset.state, ratio: ratio(), t: Math.round(performance.now()) }); if (el.dataset.state === "done") setTimeout(() => { window.__doneRatio = ratio(); }, 280); };
    new MutationObserver(note).observe(el, { attributes: true, attributeFilter: ["data-state"] });
    window.__sample = () => ({ state: el.dataset.state, ratio: +(el.firstElementChild.getBoundingClientRect().width / el.getBoundingClientRect().width).toFixed(3) });
  });
  return { ctx, page, hold };
};
const states = (page) => page.evaluate(() => window.__bar.map((s) => s.state));
const sample = (page) => page.evaluate(() => window.__sample());
const clear = (page) => page.evaluate(() => { window.__bar.length = 0; });
const geometry = (page) => page.evaluate(() => {
  const el = document.querySelector('[data-testid="nav-progress"]');
  const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
  const zs = [...document.querySelectorAll("*")].map((e) => parseInt(getComputedStyle(e).zIndex, 10)).filter(Number.isFinite);
  return { top: r.top, height: r.height, width: Math.round(r.width), vw: window.innerWidth, position: cs.position, z: parseInt(cs.zIndex, 10), highestOther: Math.max(...zs.filter((z) => z < 2e9)), opacity: parseFloat(cs.opacity), events: cs.pointerEvents };
});

try {
  console.log("== At rest the bar is not there");
  {
    const { ctx, page } = await open({ width: 1280, height: 900 });
    const g = await geometry(page);
    ok((await sample(page)).state === "idle" && g.opacity === 0, "a freshly opened page shows no bar", JSON.stringify(await sample(page)));
    ok(g.position === "fixed" && g.top === 0 && g.height === 3 && g.width === g.vw, "when it shows it is a 3px line fixed at the very top, the full width of the screen", `${g.position} top ${g.top}, ${g.height}px high, ${g.width}/${g.vw}px wide`);
    ok(g.z > g.highestOther && g.events === "none", "…above every sticky bar and pop-up of the page, and it never catches a tap", `z-index ${g.z} vs ${g.highestOther} highest other`);
    await ctx.close();
  }

  console.log("== A tap on a link to another page of the store (a slow network)");
  {
    const { ctx, page, hold } = await open({ width: 1280, height: 900 });
    hold.ms = 2200;
    const link = page.locator('a[href="/main/about-progress"]').first();
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await sleep(250);
    const a = await sample(page), g = await geometry(page);
    ok(a.state === "running" && a.ratio >= 0.05 && g.opacity === 1, "the bar is on screen at once (a quarter of a second after the tap), already a little way along", JSON.stringify(a));
    await sleep(1100);
    const b = await sample(page);
    ok(b.state === "running" && b.ratio > a.ratio && b.ratio < 0.93, "…keeps creeping forward while the page is on its way, without reaching the end", `${a.ratio} → ${b.ratio}`);
    ok(/\/main\/about-progress$/.test(page.url()) === false, "…and the old page is still showing meanwhile (the new one hasn't arrived)", page.url());
    ok(await until(async () => /\/main\/about-progress$/.test(page.url()), 8000), "the new page arrives");
    ok(await until(async () => (await states(page)).includes("done"), 3000), "the bar runs to the end when it does");
    ok(await until(async () => (await sample(page)).state === "idle" && (await geometry(page)).opacity === 0, 4000), "…then fades away and is gone");
    const seq = (await states(page)).join(" → ");
    ok(/^running → done → idle$/.test(seq), "the whole story is: running → done → idle (once)", seq);
    await sleep(400);
    const doneRatio = await page.evaluate(() => window.__doneRatio);
    ok(doneRatio >= 0.99, "when it finishes it slides all the way across the screen", `${doneRatio}`);

    console.log("== Back");
    await clear(page);
    await page.goBack();
    ok(await until(async () => !/about-progress/.test(page.url()), 8000), "Back returns to the first page");
    ok(await until(async () => (await states(page)).includes("running") && (await states(page)).includes("idle"), 6000), "Back also shows the bar, and it finishes", (await states(page)).join(" → "));
    await ctx.close();
  }

  console.log("== Taps that do NOT leave the page");
  {
    const { ctx, page } = await open({ width: 1280, height: 900 });
    // inject links and dispatch clicks whose default action is cancelled, so only the bar's own listener is tested
    const tap = (html, init = {}) => page.evaluate(async ([markup, ev]) => {
      const holder = document.createElement("div"); holder.innerHTML = markup; document.body.appendChild(holder);
      const a = holder.firstElementChild;
      const stop = (e) => e.preventDefault(); document.addEventListener("click", stop);
      a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...ev }));
      document.removeEventListener("click", stop); holder.remove();
      await new Promise((r) => setTimeout(r, 250));
      return window.__bar.length;
    }, [html, init]);
    const here = new URL(page.url()).pathname;
    const cases = [
      ["a link to the page you are on", `<a href="${here}">x</a>`, {}],
      ["a #hash link on this page", `<a href="#menu">x</a>`, {}],
      ["a link to another website", `<a href="https://example.com/page">x</a>`, {}],
      ["a link that opens a new tab", `<a href="/main/about-progress" target="_blank">x</a>`, {}],
      ["a download link", `<a href="/main/about-progress" download>x</a>`, {}],
      ["a ctrl-click", `<a href="/main/about-progress">x</a>`, { ctrlKey: true }],
      ["a ⌘-click", `<a href="/main/about-progress">x</a>`, { metaKey: true }],
      ["a shift-click", `<a href="/main/about-progress">x</a>`, { shiftKey: true }],
      ["a middle-click", `<a href="/main/about-progress">x</a>`, { button: 1 }],
      ["a link marked data-no-progress", `<a href="/main/about-progress" data-no-progress>x</a>`, {}],
    ];
    for (const [label, html, init] of cases) {
      await clear(page);
      ok((await tap(html, init)) === 0, `${label}: no bar`);
    }

    console.log("== A link whose page never comes: the bar gives up by itself");
    await clear(page);
    await tap(`<a href="/main/about-progress">x</a>`);
    ok((await sample(page)).state === "running", "a plain tap on a link to another page starts the bar (here nothing will load)");
    await sleep(3000);
    const mid = await sample(page);
    ok(mid.state === "running" && mid.ratio < 0.93, "after 3 seconds it is still creeping, below the end", JSON.stringify(mid));
    ok(await until(async () => (await sample(page)).state === "idle", 9000), "within about 8 seconds it gives up and fades away instead of hanging for ever");
    const peak = Math.max(...(await page.evaluate(() => window.__bar.map((s) => s.ratio))));
    ok(await page.evaluate(() => window.__bar.some((s) => s.state === "done")) && peak <= 1, "(it closes with the same 'done' fade)");
    await ctx.close();
  }

  console.log("== A phone");
  {
    const { ctx, page, hold } = await open({ width: 390, height: 844 });
    hold.ms = 1500;
    await page.locator('a[href="/main/about-progress"]').first().click();
    await sleep(250);
    const g = await geometry(page);
    ok((await sample(page)).state === "running" && g.top === 0 && g.width === 390, "on a phone the bar is across the whole top too", `${g.width}px`);
    ok(await until(async () => /about-progress$/.test(page.url()) && (await sample(page)).state !== "running", 8000), "…and finishes when the page arrives");
    await ctx.close();
  }

  console.log("== The code changes the page itself (the order bar's outlet dropdown)");
  if (other) {
    const { ctx, page, hold } = await open({ width: 1280, height: 900 });
    const pill = page.locator("button.ot-ob-pill").first();
    ok(await pill.count() > 0, "a store with more than one outlet has the outlet dropdown in the order bar");
    await pill.click();
    await page.waitForSelector("ul li button[aria-current]", { timeout: 10000 }); // the list is open: the outlet you are on is marked
    const option = page.locator("ul li button:not([aria-current])").first(); // an outlet other than the one you are on
    hold.ms = 1800;
    await clear(page);
    await option.click();
    await sleep(300);
    ok((await sample(page)).state === "running", "choosing another outlet (the page is changed by the code, not by a link) shows the bar");
    ok(await until(async () => new URL(page.url()).pathname !== "/main", 9000), "the other outlet's page arrives", new URL(page.url()).pathname);
    ok(await until(async () => (await states(page)).join(" → ") === "running → done → idle", 4000), "…and the bar finishes", (await states(page)).join(" → "));
    await ctx.close();
  } else console.log("   (the bench store has one outlet — no outlet dropdown)");

  if (page1.json?.page?.id) await call("DELETE", `/api/pages/${page1.json.page.id}`);
} finally {
  await browser.close();
}
console.log("console problems:", problems.length ? problems : "none");
ok(problems.length === 0, "the browser logged no errors or warnings");
console.log(`SUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
