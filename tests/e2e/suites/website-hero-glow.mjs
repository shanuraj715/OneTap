// The coloured glow at the bottom of an app's page (and of /apps) must stay — and must end softly: no straight edge where the hero stops.
// Pixel-based, in Chrome against the bench website (:3173, built from the current code by `bench website`). Motion is switched off so the glow stands
// still. For each page and theme: the colour is still there inside the hero (not faded away), the rows just above and just below the hero's bottom edge are
// the same colour (no step), the glow carries on a little below the edge and has melted into the page colour further down; nothing sticks out sideways.
// On the /apps list page the cards section must also be one piece with the hero: no rule, no background of its own, no step in colour.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const BENCH = fileURLToPath(new URL("../bench/bench.mjs", import.meta.url));
const WEB = "http://localhost:3173";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);
const problems = [];
execFileSync(process.execPath, [BENCH, "website"], { stdio: "inherit" }); // builds it from the current code when it is out of date

/** One pixel row of the page, in 50 px windows: [r,g,b] each (averages) — read in the page through a canvas. */
async function row(page, y, width) {
  const png = await page.screenshot({ fullPage: true, clip: { x: 0, y: Math.round(y), width, height: 1 } });
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = 1;
    const x = c.getContext("2d"); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, img.width, 1).data; const out = [];
    for (let s = 0; s < img.width; s += 50) { let r = 0, g = 0, b = 0, n = 0; for (let i = s; i < Math.min(s + 50, img.width); i++) { r += d[i * 4]; g += d[i * 4 + 1]; b += d[i * 4 + 2]; n++; } out.push([r / n, g / n, b / n]); }
    return out;
  }, png.toString("base64"));
}
// (the windows the heartbeat's two dips pass through, x 450–700 px, are left out: the line itself is not the glow)
const diff = (a, b) => Math.max(...a.map((w, i) => (i >= 9 && i < 14 ? 0 : Math.max(...w.map((v, k) => Math.abs(v - b[i][k]))))));
const away = (rowA, bg) => Math.max(...rowA.map((w, i) => (i >= 9 && i < 14 ? 0 : Math.max(...w.map((v, k) => Math.abs(v - bg[k]))))));

const browser = await chromium.launch();
try {
  for (const [scheme, path, label] of [["light", "/apps/oma", "an app's page, light"], ["dark", "/apps/oma", "an app's page, dark"], ["light", "/apps", "the apps page, light"], ["dark", "/apps", "the apps page, dark"]]) {
    say(`${label}`);
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, colorScheme: scheme, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => problems.push(String(e).slice(0, 160)));
    await page.goto(WEB + path, { waitUntil: "load" });
    await page.waitForTimeout(900);
    const g = await page.evaluate(() => {
      const hero = document.querySelector(".apps-hero"); const r = hero.getBoundingClientRect();
      const bg = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number);
      return { bottom: r.bottom + scrollY, bg, over: document.documentElement.scrollWidth - innerWidth };
    });
    const inside = await row(page, g.bottom - 20, 1400);
    const above = await row(page, g.bottom - 2, 1400);
    const below = await row(page, g.bottom + 2, 1400);
    const farBelow = await row(page, g.bottom + 255, 1400);
    const tint = Math.round(away(inside, g.bg));
    ok(tint >= 20, "the colour is still there inside the hero, near its bottom (not faded away)", `${tint} away from the page colour`);
    const beat = await page.evaluate(() => { const b = document.querySelector(".apps-beat").getBoundingClientRect(); const h = document.querySelector(".apps-hero").getBoundingClientRect(); return { below: Math.round(b.bottom - h.bottom) }; });
    if (path === "/apps") {
      // the cards section is one piece with the hero: no rule, no background of its own (so no step in colour, and no strip of another colour at its end)
      const band = await page.evaluate(() => { const e = document.querySelector(".apps-band"); const c = getComputedStyle(e); return { top: c.borderTopWidth, bottom: c.borderBottomWidth, bg: c.backgroundColor, image: c.backgroundImage }; });
      ok(band.top === "0px" && band.bottom === "0px", "no rule above or below the cards section", `${band.top} / ${band.bottom}`);
      ok(/rgba\(0, 0, 0, 0\)|transparent/.test(band.bg) && band.image === "none", "the cards section has no background of its own (the hero's colour carries straight on into it)", `${band.bg} ${band.image.slice(0, 30)}`);
      const stepList = diff(above, below);
      ok(stepList <= 4, "no step in colour where the hero ends and the cards begin", `step ${Math.round(stepList * 10) / 10}`);
      ok(beat.below >= -20, "the heartbeat sits low in the hero, just above its bottom edge (not up among the buttons)", `${beat.below}px from the edge`);
      ok(g.over <= 0, "nothing sticks out sideways", `${g.over}px over`);
      await ctx.close();
      continue;
    }
    ok(beat.below >= 0, "the heartbeat sits at the very bottom of an app's top section", `${beat.below}px from the edge`);
    const step = Math.round(diff(above, below) * 10) / 10;
    ok(step <= 3, "no straight edge: the rows just above and just below the hero's bottom are the same colour", `step ${step}`);
    const lower = Math.round(away(farBelow, g.bg) * 10) / 10;
    ok(lower <= 3, "the glow has melted into the page colour well below the hero", `${lower} away at 255 px below`);
    ok(g.over <= 0, "nothing sticks out sideways", `${g.over}px over`);
    await ctx.close();
  }

  say("The heartbeat line has softly rounded corners");
  {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(WEB + "/apps/oma", { waitUntil: "load" });
    const beat = await page.evaluate(() => [...document.querySelectorAll(".apps-beat path")].map((p) => ({ cls: p.getAttribute("class"), d: p.getAttribute("d"), join: getComputedStyle(p).strokeLinejoin, cap: getComputedStyle(p).strokeLinecap })));
    ok(beat.length === 2 && beat.every((b) => b.d === beat[0].d), "the heartbeat is drawn twice (line and soft glow) along the same path");
    const curves = (beat[0]?.d.match(/Q/g) ?? []).length;
    ok(curves >= 6, "every corner of it is a small curve, not a sharp point", `${curves} curves`);
    ok(beat.every((b) => b.join === "round" && b.cap === "round"), "the joins and ends of the stroke are round too", beat.map((b) => `${b.join}/${b.cap}`).join(" "));
    // the sharpest tip, the tall peak, is cut back a little: its highest point is lower than the old sharp point (y 12) but not by much
    const ys = [...beat[0].d.matchAll(/Q\d+(?:\.\d+)? (\d+(?:\.\d+)?) /g)].map((m) => Number(m[1]));
    ok(ys.includes(12) && ys.includes(140), "the curves still bend towards the original peak and dip points (the shape is the same, only softer)", ys.join(","));
    await ctx.close();
  }

  say("A phone");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  for (const path of ["/apps/oma", "/apps"]) {
    await page.goto(WEB + path, { waitUntil: "load" });
    await page.waitForTimeout(500);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(over <= 0, `${path} fits a 390 px screen`, `${over}px over`);
  }
  await ctx.close();
} finally {
  await browser.close();
}
ok(problems.length === 0, "no errors in the browser", problems.slice(0, 3).join(" | "));
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
