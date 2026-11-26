// Every storefront style effect (Glassmorphism, Neumorphism, Claymorphism, Aurora, Cyberpunk, Dark Premium), in light and in dark, on a
// laptop and a phone: is every piece of text and every icon still readable?
//
// How it measures — no guessing from CSS: for each state of the page the text and icons are listed with their real colour; then ALL text
// and icons are made invisible and the page is photographed, so the pixels behind each one (glass blur, gradients, photos, shadows —
// whatever is really there) can be read. Contrast = the colour of the text composited on those pixels, against those pixels (WCAG).
// Each element is then compared with the SAME element under "None" (the reference design, the same mode and screen): an element is a
// problem when it is unreadable (below 3:1) where "None" is not, or when it falls below 4.5:1 where "None" is above it.
// Two brand colours are tried: the magenta of the reports (white text on buttons) and a bright yellow (dark text on buttons). Each effect uses
// its own suggested palette (what the console applies when it is chosen).
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";

const SF = "http://localhost:3170";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const REPORT = process.env.AUDIT_REPORT === "1"; // list everything below 3:1 even where "None" has it too

const { EFFECT_PRESETS } = await import(pathToFileURL(fileURLToPath(new URL("../../../packages/config-schema/src/effect.js", import.meta.url))).href);
const only = (name) => (process.env[name] ? new Set(process.env[name].split(",")) : null);
const wantEffects = only("AUDIT_EFFECTS"), wantModes = only("AUDIT_MODES"), wantViewports = only("AUDIT_VIEWPORTS"); // quicker re-runs while fixing
const EFFECTS = ["none", "glass", "neumorph", "clay", "aurora", "cyberpunk", "dark-premium"].filter((e) => e === "none" || !wantEffects || wantEffects.has(e));
const MODES = ["light", "dark"].filter((m) => !wantModes || wantModes.has(m));
const VIEWPORTS = [{ name: "laptop", width: 1280, height: 900 }, { name: "phone", width: 390, height: 844 }].filter((v) => !wantViewports || wantViewports.has(v.name));
const PALETTES = [
  { name: "magenta", primary: "#B5338A", onPrimary: "#FFFFFF", viewports: ["laptop", "phone"] }, // the reports' brand colour: white text on buttons
  { name: "yellow", primary: "#F2B705", onPrimary: "#1B1B1B", viewports: ["laptop"] },            // a light brand colour: dark text on buttons
].filter((pal) => !process.env.AUDIT_PALETTES || process.env.AUDIT_PALETTES.split(",").includes(pal.name));
const HARD = 3, SOFT = 4.5;

/* ------------------------------------------------------------ data, through the API */
const cookie = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "o@acme.test", password: "Owner123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const outlets = ((await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json()).outlets ?? []);
const main = outlets.find((o) => o.slug === "main");
const outletId = String(main._id ?? main.id);
const before = { effect: main.config.effect, theme: main.config.theme };
const H = { "content-type": "application/json", cookie, "x-rasoipulse-outlet": outletId };
const call = async (method, path, body) => { const r = await fetch(API + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined }); let json = {}; try { json = await r.json(); } catch {} return { status: r.status, json }; };
const restore = () => call("PATCH", `/api/outlets/${outletId}/config`, { effect: before.effect ?? { style: "none" }, theme: before.theme });
const setLook = async (effect, pal) => {
  const p = EFFECT_PRESETS[effect]?.palette;
  const base = before.theme;
  const theme = {
    ...base, mode: "system",
    light: { ...base.light, ...(p?.light ?? {}), colorPrimary: pal.primary, colorOnPrimary: pal.onPrimary },
    dark: { ...base.dark, ...(p?.dark ?? {}), colorPrimary: pal.primary, colorOnPrimary: pal.onPrimary },
  };
  const r = await call("PATCH", `/api/outlets/${outletId}/config`, { effect: { style: effect }, theme });
  if (r.status >= 400) { console.error("SETUP FAILED (look)", effect, r.status, JSON.stringify(r.json).slice(0, 300)); await restore(); process.exit(1); }
};
const aboutPage = await call("POST", "/api/pages", { slug: "about-audit", title: "About us", status: "published", showInFooter: true, showInHeader: false, blocks: [{ id: "b1", type: "text", markdown: "A page of the store, with a **bold** word and a [link](https://example.com)." }] });
const qr = (await call("GET", "/api/tables/qr-urls")).json;
const table = (qr.tables ?? [])[0];

/* ------------------------------------------------------------ in the page: list text + icons, then read the pixels behind them */
const COLLECT = () => {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
  const cx = canvas.getContext("2d", { willReadFrequently: true });
  const rgba = (str) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000"; cx.fillStyle = str; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const vw = innerWidth, vh = innerHeight;
  const out = [];
  const chain = (el) => { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden") return 0; o *= parseFloat(cs.opacity); } return o; };
  const name = (el) => el.getAttribute("aria-label") || el.getAttribute("data-testid") || el.getAttribute("title") || (typeof el.className === "string" ? el.className.split(" ").filter(Boolean)[0] : "") || "";
  const place = (rect) => {
    const x1 = Math.max(0, rect.left), y1 = Math.max(0, rect.top), x2 = Math.min(vw, rect.right), y2 = Math.min(vh, rect.bottom);
    if (x2 - x1 < 2 || y2 - y1 < 2) return null;
    if ((x2 - x1) * (y2 - y1) < 0.6 * rect.width * rect.height) return null; // mostly off screen
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  };
  // faded on purpose: the edges of a scrolling strip fade out (a hint that there is more); and partly covered elements are measured on
  // another scroll step, where nothing is on top of them
  const faded = (el, r) => {
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      const mask = cs.maskImage && cs.maskImage !== "none" ? cs.maskImage : cs.webkitMaskImage && cs.webkitMaskImage !== "none" ? cs.webkitMaskImage : null;
      if (!mask) continue;
      const a = e.getBoundingClientRect();
      if (r.x < a.left + 26 || r.x + r.w > a.right - 26) return true;
    }
    return false;
  };
  const covered = (el, r) => { // is something else on top of it?
    if (faded(el, r)) return true;
    for (const [px, py] of [[r.x + r.w / 2, r.y + r.h / 2], [r.x + 1.5, r.y + 1.5], [r.x + r.w - 1.5, r.y + 1.5], [r.x + 1.5, r.y + r.h - 1.5], [r.x + r.w - 1.5, r.y + r.h - 1.5]]) {
      const top = document.elementFromPoint(Math.min(vw - 1, Math.max(0, px)), Math.min(vh - 1, Math.max(0, py)));
      if (top && !(el.contains(top) || top.contains(el))) return true;
    }
    return false;
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent.replace(/\s+/g, " ").trim();
    const el = n.parentElement;
    if (!text || !el || ["SCRIPT", "STYLE", "NOSCRIPT", "TITLE"].includes(el.tagName)) continue;
    const op = chain(el); if (op < 0.05) continue;
    const range = document.createRange(); range.selectNodeContents(n);
    const rects = [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1);
    if (!rects.length) continue;
    const r = place({ left: Math.min(...rects.map((x) => x.left)), top: Math.min(...rects.map((x) => x.top)), right: Math.max(...rects.map((x) => x.right)), bottom: Math.max(...rects.map((x) => x.bottom)), get width() { return this.right - this.left; }, get height() { return this.bottom - this.top; } });
    if (!r || covered(el, r)) continue;
    const cs = getComputedStyle(el);
    const [cr, cg, cb, ca] = rgba(cs.color);
    out.push({ kind: "text", key: `${text.slice(0, 30)}|${el.tagName.toLowerCase()}|${name(el)}`, text: text.slice(0, 30), fg: [cr, cg, cb, ca * op], size: parseFloat(cs.fontSize), bold: parseInt(cs.fontWeight, 10) >= 600, rect: r });
  }
  const shapeSel = "path, rect, circle, line, polyline, polygon, ellipse";
  for (const svg of document.querySelectorAll("svg")) {
    const op = chain(svg); if (op < 0.05) continue;
    const bb = svg.getBoundingClientRect();
    if (bb.width < 8 || bb.height < 8) continue;
    // the veg / egg / non-veg marks are a standard symbol (a white tile with a fixed colour) and deliberately ignore the theme
    if (svg.getAttribute("role") === "img" && /vegetarian|egg/i.test(svg.getAttribute("aria-label") || "")) continue;
    // what an icon really looks like is what its SHAPES are painted with (the <svg> itself often carries only the default black fill)
    let best = null;
    for (const shape of svg.querySelectorAll(shapeSel)) {
      const cs = getComputedStyle(shape);
      const stroked = cs.stroke && cs.stroke !== "none" && parseFloat(cs.strokeWidth) > 0;
      const filled = cs.fill && cs.fill !== "none";
      if (!stroked && !filled) continue;
      const r0 = shape.getBoundingClientRect();
      const area = r0.width * r0.height;
      if (!best || area > best.area) best = { paint: stroked ? cs.stroke : cs.fill, area, rect: r0 };
    }
    if (!best) continue;
    const r = place(best.rect.width > 1 && best.rect.height > 1 ? best.rect : bb); if (!r || covered(svg, r)) continue;
    const [cr, cg, cb, ca] = rgba(best.paint);
    const host = svg.closest("button, a, label, [role]") ?? svg.parentElement;
    out.push({ kind: "icon", key: `icon|${svg.getAttribute("class") || ""}|${host ? (host.getAttribute("aria-label") || (host.textContent || "").trim().slice(0, 16) || name(host)) : ""}`, text: "(icon)", fg: [cr, cg, cb, ca * op], size: bb.height, bold: true, rect: r });
  }
  return out;
};
const CLEAN_CSS = `*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; caret-color: transparent !important; } svg { visibility: hidden !important; } ::placeholder { color: transparent !important; }`;
const SAMPLE = async ({ b64, items }) => {
  const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const cx = c.getContext("2d", { willReadFrequently: true }); cx.drawImage(img, 0, 0);
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (p) => 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]);
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return items.map((it) => {
    const x = Math.max(0, Math.floor(it.rect.x)), y = Math.max(0, Math.floor(it.rect.y));
    const w = Math.max(1, Math.min(img.width - x, Math.ceil(it.rect.w))), h = Math.max(1, Math.min(img.height - y, Math.ceil(it.rect.h)));
    const d = cx.getImageData(x, y, w, h).data;
    const step = Math.max(1, Math.floor((w * h) / 600));
    const ratios = [], bgs = [];
    const [fr, fg, fb, fa] = it.fg;
    for (let i = 0; i < w * h; i += step) {
      const o = i * 4; const bg = [d[o], d[o + 1], d[o + 2]];
      const comp = [fr * fa + bg[0] * (1 - fa), fg * fa + bg[1] * (1 - fa), fb * fa + bg[2] * (1 - fa)];
      ratios.push(ratio(lum(comp), lum(bg))); bgs.push(bg);
    }
    ratios.sort((a, b) => a - b);
    const mid = bgs[Math.floor(bgs.length / 2)] ?? [0, 0, 0];
    return { ...it, contrast: ratios[Math.floor(ratios.length * 0.25)] ?? 21, bg: mid };
  });
};

/** look at the page as it is now: list text + icons, hide them, photograph, read the pixels; merge into `into` (worst contrast per element) */
const capture = async (page, into) => {
  const items = await page.evaluate(COLLECT);
  if (!items.length) return;
  await page.addStyleTag({ content: CLEAN_CSS, }).then(async (tag) => {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const shot = await page.screenshot({ type: "png" });
    await tag.evaluate((n) => n.remove());
    const measured = await page.evaluate(SAMPLE, { b64: shot.toString("base64"), items });
    for (const m of measured) {
      // an element seen at several scroll positions counts at its clearest: a sticky bar's soft shadow can fall across it for a moment
      // while scrolling, but a real problem (white on white) is bad at every position
      const prev = into.get(m.key);
      if (!prev || m.contrast > prev.contrast) into.set(m.key, m);
    }
  });
};
const settle = async (page, ms = 250) => { await page.waitForLoadState("networkidle").catch(() => {}); await sleep(ms); };
/** the whole page, top to bottom (the menu draws in chunks as you scroll) */
const scanWhole = async (page, into, maxSteps = 12) => {
  let last = 0;
  for (let i = 0; i < 30; i++) { const h = await page.evaluate(() => document.documentElement.scrollHeight); await page.evaluate((y) => window.scrollTo(0, y), h); await sleep(250); if (h === last) break; last = h; }
  const vh = page.viewportSize().height, total = await page.evaluate(() => document.documentElement.scrollHeight);
  const steps = Math.min(maxSteps, Math.max(1, Math.ceil(total / (vh - 120))));
  for (let s = 0; s < steps; s++) { await page.evaluate((y) => window.scrollTo(0, y), s * (vh - 120)); await sleep(220); await capture(page, into); }
  await page.evaluate(() => window.scrollTo(0, 0)); await sleep(150);
};

/** the states of the storefront that are looked at */
async function scanStates(page, vp) {
  const out = {};
  const state = async (name, fn) => { const m = new Map(); try { await fn(m); } catch (e) { m.error = String(e.message ?? e).slice(0, 160); } out[name] = m; };
  await page.goto(`${SF}/main`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector("[aria-label^='Add']", { timeout: 20000 });
  await state("home", async (m) => { await settle(page); await scanWhole(page, m); });
  await state("outlet-list", async (m) => {
    const pill = page.locator("button.ot-ob-pill").first();
    if (await pill.count()) { await pill.click(); await settle(page, 400); await capture(page, m); await page.keyboard.press("Escape"); await page.mouse.click(5, 5); await sleep(200); }
  });
  if (vp.name === "phone") {
    await state("phone-menu", async (m) => { const b = page.locator("button.ot-nav-toggle").first(); if (await b.count() && await b.isVisible()) { await b.click(); await settle(page, 400); await capture(page, m); await page.keyboard.press("Escape"); await page.mouse.click(5, 5); await sleep(200); } });
    await state("categories", async (m) => { const b = page.locator("button.ot-cat-button").first(); if (await b.count() && await b.isVisible()) { await b.click(); await settle(page, 400); await capture(page, m); await page.keyboard.press("Escape"); await sleep(200); } });
  }
  await state("item-popup", async (m) => {
    await page.evaluate(() => window.scrollTo(0, 0)); await sleep(150);
    await page.locator("[aria-label^='Add']").first().click(); await settle(page, 500);
    await capture(page, m);
  });
  await state("cart-bar", async (m) => {
    const dialog = page.locator("[role='dialog']").first();
    const add = dialog.locator("button").filter({ hasText: /add/i }).last();
    if (await add.count()) { await add.click(); await settle(page, 500); }
    await page.keyboard.press("Escape"); await sleep(250);
    await capture(page, m);
  });
  await state("checkout", async (m) => { await page.goto(`${SF}/main/order`, { waitUntil: "networkidle" }); await settle(page, 400); await scanWhole(page, m, 6); });
  await state("account", async (m) => { await page.goto(`${SF}/main/account`, { waitUntil: "networkidle" }); await settle(page, 300); await scanWhole(page, m, 3); });
  await state("store-page", async (m) => { await page.goto(`${SF}/main/about-audit`, { waitUntil: "networkidle" }); await settle(page, 300); await scanWhole(page, m, 3); });
  if (table) await state("table-page", async (m) => { const u = new URL(table.url); await page.goto(`${SF}${u.pathname}${u.search}`, { waitUntil: "networkidle" }); await settle(page, 300); await scanWhole(page, m, 3); });
  return out;
}

/* ------------------------------------------------------------ run everything, then compare with "None" */
const browser = await chromium.launch();
const results = {}; // palette → effect → viewport → mode → state → Map
try {
  for (const pal of PALETTES) {
    results[pal.name] = {};
    for (const effect of EFFECTS) {
      await setLook(effect, pal);
      results[pal.name][effect] = {};
      for (const vp of VIEWPORTS.filter((v) => pal.viewports.includes(v.name))) {
        results[pal.name][effect][vp.name] = {};
        for (const mode of MODES) {
          const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, colorScheme: mode, reducedMotion: "reduce" });
          const page = await ctx.newPage();
          page.on("pageerror", (e) => problems.push(`${pal.name}/${effect}/${vp.name}/${mode} pageerror: ${String(e).slice(0, 160)}`));
          await page.addInitScript(() => { const s = document.createElement("style"); s.textContent = "*,*::before,*::after{transition:none!important;animation:none!important}"; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s)); });
          results[pal.name][effect][vp.name][mode] = await scanStates(page, vp);
          await ctx.close();
        }
      }
      console.log(`   scanned ${pal.name} / ${effect}`);
    }
  }
} finally {
  await restore();
  if (aboutPage.json?.page?.id) await call("DELETE", `/api/pages/${aboutPage.json.page.id}`);
  await browser.close();
}

const issuesFor = (pal, effect, vp, mode) => {
  const list = [];
  for (const [state, map] of Object.entries(results[pal][effect][vp][mode])) {
    const base = results[pal].none[vp][mode][state];
    for (const [key, m] of map) {
      const b = base?.get(key);
      const large = m.size >= 24 || (m.bold && m.size >= 18.66);
      const need = m.kind === "icon" || large ? HARD : SOFT;
      const baseHard = b ? b.contrast < HARD : false;
      const unreadable = m.contrast < HARD && !baseHard && (b ? true : false);
      const lost = b && m.kind === "text" && m.contrast < SOFT && b.contrast >= SOFT && b.contrast - m.contrast >= 1;
      if (unreadable || lost || (REPORT && m.contrast < HARD)) list.push({ state, key, text: m.text, kind: m.kind, contrast: m.contrast, base: b?.contrast, fg: m.fg, bg: m.bg, need });
    }
  }
  return list.sort((a, b) => a.contrast - b.contrast);
};
const describe = (i) => `[${i.state}] "${i.text}" ${i.kind} ${i.contrast.toFixed(1)}:1 (None ${i.base?.toFixed(1) ?? "—"}:1) text rgb(${i.fg.slice(0, 3).map(Math.round).join(",")}) on rgb(${i.bg.map(Math.round).join(",")})`;

for (const pal of PALETTES) for (const vp of VIEWPORTS.filter((v) => pal.viewports.includes(v.name))) for (const mode of MODES) {
  console.log(`== ${pal.name} brand colour, ${vp.name} (${vp.width}px), ${mode}`);
  const errs = Object.entries(results[pal.name].none[vp.name][mode]).filter(([, m]) => m.error).map(([st, m]) => `${st}: ${m.error}`);
  ok(errs.length === 0, `${pal.name} ${vp.name} ${mode}: every page state could be scanned`, errs.join(" | "));
  for (const effect of EFFECTS.filter((e) => e !== "none")) {
    const issues = issuesFor(pal.name, effect, vp.name, mode);
    ok(issues.length === 0, `${pal.name}: ${EFFECT_PRESETS[effect].label}, ${vp.name} ${mode}: nothing loses contrast compared with None`, issues.length ? `${issues.length} problem(s): ${issues.slice(0, 6).map(describe).join(" ‖ ")}` : "");
  }
}
// every distinct problem once, with where it shows (so nothing hides behind the 6-per-row preview above)
const distinct = new Map();
for (const pal of PALETTES) for (const vp of VIEWPORTS.filter((v) => pal.viewports.includes(v.name))) for (const mode of MODES) for (const effect of EFFECTS.filter((e) => e !== "none")) {
  for (const i of issuesFor(pal.name, effect, vp.name, mode)) {
    const k = `${pal.name}|${i.state}|${i.key}`;
    const d = distinct.get(k) ?? { ...i, pal: pal.name, where: new Set(), worst: i.contrast };
    d.where.add(`${EFFECT_PRESETS[effect].label}/${mode}/${vp.name}`); d.worst = Math.min(d.worst, i.contrast); distinct.set(k, d);
  }
}
console.log(`   ${distinct.size} distinct problem(s):`);
for (const d of [...distinct.values()].sort((a, b) => a.worst - b.worst).slice(0, 80)) console.log(`   ISSUE (${d.pal}) [${d.state}] "${d.text}" ${d.kind} worst ${d.worst.toFixed(1)}:1 (None ${d.base?.toFixed(1) ?? "—"}) in ${[...d.where].slice(0, 5).join(", ")}${d.where.size > 5 ? ` +${d.where.size - 5} more` : ""}`);
const covered = Object.values(results[PALETTES[0].name].none[VIEWPORTS[0].name][MODES[0]]).reduce((n, m) => n + m.size, 0);
ok(covered > 60, "the scan really looked at the page (many texts and icons measured)", `${covered} elements in the first reference scan`);
console.log("console problems:", problems.length ? problems : "none");
ok(problems.length === 0, "no page errors while scanning", problems.slice(0, 2).join(" | "));
console.log(`SUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
