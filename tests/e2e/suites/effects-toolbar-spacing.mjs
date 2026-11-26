// The category / filter strip of the storefront menu is drawn as a panel in every style effect. Its contents (the filter chips on the left, the
// category chips or the Categories button on the right) must not touch the panel's edges. Measured in Chrome for each effect, light and dark,
// on a laptop and a phone: the gap between the panel's edge and the first / last control, and above and below the controls.
// Under "None" the strip is not a panel (it runs the width of the menu with a line under it): there the chips line up with the headings below.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";

const SF = "http://localhost:3170";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];
const { EFFECT_PRESETS } = await import(pathToFileURL(fileURLToPath(new URL("../../../packages/config-schema/src/effect.js", import.meta.url))).href);
const EFFECTS = ["none", "glass", "neumorph", "clay", "aurora", "cyberpunk", "dark-premium"];
const VIEWPORTS = [{ name: "laptop", width: 1280, height: 900 }, { name: "phone", width: 390, height: 844 }];
const MIN_SIDE = 10, MIN_TOP = 4; // px of air between the panel's edge and the nearest control

const cookie = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "o@acme.test", password: "Owner123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const outlets = ((await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json()).outlets ?? []);
const main = outlets.find((o) => o.slug === "main");
const outletId = String(main._id ?? main.id);
const before = { effect: main.config.effect, theme: main.config.theme };
const H = { "content-type": "application/json", cookie, "x-rasoipulse-outlet": outletId };
const patch = async (body) => { const r = await fetch(`${API}/api/outlets/${outletId}/config`, { method: "PATCH", headers: H, body: JSON.stringify(body) }); if (!r.ok) { console.error("SETUP FAILED", r.status, (await r.text()).slice(0, 300)); process.exit(1); } };
const restore = () => fetch(`${API}/api/outlets/${outletId}/config`, { method: "PATCH", headers: H, body: JSON.stringify({ effect: before.effect ?? { style: "none" }, theme: before.theme }) });
const look = (effect) => {
  const p = EFFECT_PRESETS[effect]?.palette;
  return { effect: { style: effect }, theme: { ...before.theme, mode: "system", light: { ...before.theme.light, ...(p?.light ?? {}), colorPrimary: "#B5338A", colorOnPrimary: "#FFFFFF" }, dark: { ...before.theme.dark, ...(p?.dark ?? {}), colorPrimary: "#B5338A", colorOnPrimary: "#FFFFFF" } } };
};

/** in the page: the toolbar panel and the controls inside it */
const MEASURE = () => {
  const bar = document.querySelector("[data-fx-toolbar]");
  if (!bar) return null;
  const b = bar.getBoundingClientRect();
  const visible = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 4 && r.height > 4 && cs.visibility !== "hidden" && cs.display !== "none"; };
  const controls = [...bar.querySelectorAll("button, a")].filter(visible).map((e) => e.getBoundingClientRect());
  if (!controls.length) return null;
  const cs = getComputedStyle(bar);
  const heading = document.querySelector("section[id^=sec-] h2, section[id^=sec-] h3");
  return {
    left: Math.min(...controls.map((r) => r.left)) - b.left,
    right: b.right - Math.max(...controls.map((r) => r.right)),
    top: Math.min(...controls.map((r) => r.top)) - b.top,
    bottom: b.bottom - Math.max(...controls.map((r) => r.bottom)),
    panelLeft: b.left, headingLeft: heading ? heading.getBoundingClientRect().left : null, firstControlLeft: Math.min(...controls.map((r) => r.left)),
    hasEdge: ["Top", "Left", "Right"].every((side) => parseFloat(cs[`border${side}Width`]) > 0), radius: parseFloat(cs.borderTopLeftRadius) || 0, padLeft: parseFloat(cs.paddingLeft), n: controls.length,
  };
};

const browser = await chromium.launch();
try {
  for (const effect of EFFECTS) {
    await patch(look(effect));
    console.log(`== ${EFFECT_PRESETS[effect].label}`);
    for (const vp of VIEWPORTS) for (const mode of ["light", "dark"]) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, colorScheme: mode, reducedMotion: "reduce" });
      const page = await ctx.newPage();
      page.on("pageerror", (e) => problems.push(`${effect}/${vp.name}/${mode}: ${String(e).slice(0, 160)}`));
      await page.goto(`${SF}/main`, { waitUntil: "networkidle", timeout: 90000 });
      await page.waitForSelector("[data-fx-toolbar]", { timeout: 20000 });
      await page.waitForTimeout(500);
      const m = await page.evaluate(MEASURE);
      const tag = `${EFFECT_PRESETS[effect].label}, ${vp.name} ${mode}`;
      if (!m) { ok(false, `${tag}: the category / filter strip is on the page with controls in it`); await ctx.close(); continue; }
      if (effect === "none") {
        ok(m.hasEdge === false, `${tag}: not drawn as a panel — the strip runs the width of the menu`);
        ok(Math.abs(m.firstControlLeft - (m.headingLeft ?? m.firstControlLeft)) <= 2, `${tag}: the first chip lines up with the headings below it`, `${Math.round(m.firstControlLeft)}px vs ${Math.round(m.headingLeft ?? 0)}px`);
      } else {
        ok(m.left >= MIN_SIDE, `${tag}: the first control is ${Math.round(m.left)}px from the panel's left edge (at least ${MIN_SIDE})`);
        ok(m.right >= MIN_SIDE, `${tag}: the last control is ${Math.round(m.right)}px from the panel's right edge (at least ${MIN_SIDE})`);
        ok(m.top >= MIN_TOP && m.bottom >= MIN_TOP, `${tag}: air above (${Math.round(m.top)}px) and below (${Math.round(m.bottom)}px) the controls`);
        ok(m.hasEdge && m.radius >= 4, `${tag}: drawn as a finished panel — an edge all round and rounded corners`, `radius ${m.radius}px`);
      }
      await ctx.close();
    }
  }
} finally {
  await restore();
  await browser.close();
}
console.log("console problems:", problems.length ? problems : "none");
ok(problems.length === 0, "no page errors", problems.slice(0, 2).join(" | "));
console.log(`SUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
