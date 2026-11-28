// The cards section of the website's /apps page: soft gradient circles in the apps' colours drifting slowly behind the cards (very faint, and standing
// still with "reduce motion"), see-through "glass" cards, a version pill, and a row that wraps with the odd card centred. Chrome against the bench website
// (:3173) and API (:3097). It makes the Business app public (and adds a fifth app) to see 4 and 5 cards, and puts everything back at the end.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const BENCH = fileURLToPath(new URL("../bench/bench.mjs", import.meta.url));
const WEB = "http://localhost:3173";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rebuild = () => execFileSync(process.execPath, [BENCH, "website"], { stdio: "inherit" }); // builds from the current code when out of date, restarts, refreshes

const su = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "super@sandbox.test", password: "Super123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const call = async (method, path, body) => { const r = await fetch(API + path, { method, headers: { cookie: su, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => ({})) }; };
const A = "/api/platform/app-releases";
const wasPublic = Object.fromEntries((await call("GET", A + "/settings")).json.settings.map((x) => [x.app, x.public]));

/** where the cards are: [x, y, width, height] of each, rounded */
const cards = (page) => page.evaluate(() => [...document.querySelectorAll(".apps-card")].map((c) => { const r = c.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height)]; }));
const rowsOf = (list) => { const rows = []; for (const c of list) { const row = rows.find((r) => Math.abs(r[0][1] - c[1]) < 6); row ? row.push(c) : rows.push([c]); } return rows; };

const browser = await chromium.launch();
try {
  await call("PUT", `${A}/visibility/business`, { public: true });
  rebuild();

  say("1. The circles behind the cards");
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(String(e).slice(0, 160)));
  await page.goto(WEB + "/apps", { waitUntil: "load" });
  await sleep(600);
  const orbs = await page.evaluate(() => {
    const box = document.querySelector(".apps-orbs");
    const read = (e) => { const s = getComputedStyle(e); return { opacity: Number(s.opacity), anim: s.animationName, dur: s.animationDuration, c: e.style.getPropertyValue("--c") }; };
    return { hidden: box?.getAttribute("aria-hidden"), inBand: Boolean(box?.closest(".apps-band")), orbs: [...document.querySelectorAll(".apps-orb-bg")].map(read), rings: [...document.querySelectorAll(".apps-ring-bg")].map(read) };
  });
  ok(orbs.hidden === "true" && orbs.inBand, "the circles are decoration (hidden from screen readers) inside the cards section");
  ok(orbs.orbs.length >= 5 && orbs.rings.length >= 3, "there are big gradient circles and thin ripple rings", `${orbs.orbs.length} circles, ${orbs.rings.length} rings`);
  ok(orbs.orbs.every((o) => o.opacity <= 0.6), "every circle is very faint", orbs.orbs.map((o) => o.opacity).join(","));
  const colours = new Set(orbs.orbs.map((o) => o.c.trim()));
  ok(colours.size >= 4, "the circles wear the apps' own colours (indigo, teal, violet, rose…), not one colour", [...colours].join(" "));
  ok(orbs.orbs.every((o) => /apps-orb-drift/.test(o.anim) && parseFloat(o.dur) >= 20), "each circle drifts slowly (a lap of 20 seconds or more)", orbs.orbs.map((o) => o.dur).join(","));
  ok(orbs.rings.every((o) => /apps-ring-swell/.test(o.anim)), "the rings slowly swell and fade");
  const at = () => page.evaluate(() => [...document.querySelectorAll(".apps-orb-bg")].map((e) => getComputedStyle(e).transform));
  const t1 = await at(); await sleep(2500); const t2 = await at();
  ok(t1.filter((v, i) => v !== t2[i]).length >= 4, "they really move: most circles are somewhere else 2.5 seconds later", `${t1.filter((v, i) => v !== t2[i]).length} of ${t1.length} moved`);

  say("2. The cards: see-through glass, a version pill");
  const glass = await page.evaluate(() => { const c = document.querySelector(".apps-card"); const s = getComputedStyle(c); const p = document.querySelector(".apps-card .app-version-meta"); const ps = getComputedStyle(p); return { blur: s.backdropFilter || s.webkitBackdropFilter, radius: s.borderRadius, pill: { display: ps.display, radius: parseFloat(ps.borderTopLeftRadius), border: ps.borderTopWidth, pad: ps.paddingLeft }, rings: getComputedStyle(c, "::before").animationName }; });
  ok(/blur/.test(glass.blur), "a card is a little see-through: it blurs what is behind it, so the circles glow through", glass.blur);
  ok(/flex/.test(glass.pill.display) && glass.pill.radius >= 20 && glass.pill.border === "1px", "the version (or 'No version published yet') is a small rounded pill in the app's colour", JSON.stringify(glass.pill));
  ok(/apps-card-breathe/.test(glass.rings), "the rings in a card's corner slowly breathe");

  say("3. The layout: the odd card is centred, never left alone");
  for (const w of [1400, 1100]) {
    await page.setViewportSize({ width: w, height: 1000 });
    await sleep(500);
    const list = await cards(page); const rows = rowsOf(list);
    ok(list.length === 4 && rows.length === 2 && rows.every((r) => r.length === 2), `${w}px, four apps: two rows of two`, rows.map((r) => r.length).join("+"));
    ok(new Set(list.map((c) => c[2])).size === 1, `${w}px: every card is the same width`, [...new Set(list.map((c) => c[2]))].join(","));
    ok(rows.every((r) => new Set(r.map((c) => c[3])).size === 1), `${w}px: the cards in a row are the same height`);
  }
  await page.setViewportSize({ width: 390, height: 800 });
  await sleep(400);
  { const list = await cards(page); ok(list.length === 4 && new Set(list.map((c) => c[0])).size === 1 && list.every((c) => c[2] >= 340), "a phone: one card per row, using the width", list.map((c) => c[2]).join(",")); }
  ok((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, "…and nothing sticks out sideways");

  // a fifth app: three on the first row, two centred on the second
  const made = await call("POST", `${A}/apps`, { name: "Rasoi Pulse Counter", slug: "rasoi-pulse-counter", tagline: "Billing", isPublic: true });
  ok(made.status === 201, "(a fifth app, added in the console, is public)");
  rebuild();
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto(WEB + "/apps", { waitUntil: "load" });
  await sleep(1800); // the cards rise into place one after another: measure when they have settled
  { const list = await cards(page); const rows = rowsOf(list);
    ok(list.length === 5 && rows.length === 2 && rows[0].length === 3 && rows[1].length === 2, "five apps: three, then two", rows.map((r) => r.length).join("+"));
    const wrap = await page.evaluate(() => { const r = document.querySelector(".apps-grid").getBoundingClientRect(); return [r.left, r.right]; });
    const [l, rt] = [rows[1][0][0], rows[1][1][0] + rows[1][1][2]];
    ok(Math.abs((l - wrap[0]) - (wrap[1] - rt)) <= 2, "…and the two on the last row are centred under the three", `left gap ${Math.round(l - wrap[0])}, right gap ${Math.round(wrap[1] - rt)}`);
    ok(new Set(list.map((c) => c[2])).size === 1, "…all the same width", [...new Set(list.map((c) => c[2]))].join(",")); }
  const generated = await page.locator('li.apps-card', { hasText: "Rasoi Pulse Counter" }).locator("img").first().getAttribute("src");
  ok(/^data:image\/svg\+xml/.test(generated ?? ""), "the added app's card has its generated icon");
  await call("DELETE", `${A}/apps/rasoi-pulse-counter`);

  // three apps (Business private again): three across
  await call("PUT", `${A}/visibility/business`, { public: false });
  rebuild();
  await page.goto(WEB + "/apps", { waitUntil: "load" });
  await sleep(1800);
  { const list = await cards(page); ok(list.length === 3 && rowsOf(list).length === 1, "three apps: three across, one row", `${list.length} cards`); }

  say("4. 'Reduce motion': everything stands still");
  const calm = await browser.newContext({ viewport: { width: 1400, height: 1000 }, reducedMotion: "reduce" });
  const cp = await calm.newPage();
  await cp.goto(WEB + "/apps", { waitUntil: "load" });
  await sleep(500);
  const still = await cp.evaluate(() => ({
    orbs: [...document.querySelectorAll(".apps-orb-bg, .apps-ring-bg")].every((e) => getComputedStyle(e).animationName === "none"),
    card: getComputedStyle(document.querySelector(".apps-card"), "::before").animationName,
    visible: [...document.querySelectorAll(".apps-card")].every((c) => Number(getComputedStyle(c).opacity) === 1),
  }));
  ok(still.orbs && still.card === "none", "no circle, ring or card ring moves", JSON.stringify(still));
  ok(still.visible, "…and every card is fully visible");
  await calm.close();
  await ctx.close();
} finally {
  await call("DELETE", `${A}/apps/rasoi-pulse-counter`).catch(() => undefined);
  for (const [app, was] of Object.entries(wasPublic)) await call("PUT", `${A}/visibility/${app}`, { public: was }).catch(() => undefined);
  await browser.close();
}
ok(problems.length === 0, "no errors in the browser", problems.slice(0, 3).join(" | "));
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
