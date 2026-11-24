// The marketing website's "Product" dropdown: the highlighted (hovered / keyboard-focused) item must look like a
// neat rounded tile of its own — NOT inherit the header links' pill shape and grey wash. It renders the REAL
// SiteHeader component and loads the REAL globals.css into Chrome, so a CSS clash between header links and the
// dropdown (the bug: `.nav a` out-ranked `.dd-item`) shows up here.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readFileSync, rmSync } from "node:fs";
import { chromium } from "playwright";

const REPO = fileURLToPath(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const WEB = `${REPO}/apps/website`;
const reqAdmin = createRequire(`${REPO}/apps/admin/package.json`);
const esbuild = createRequire(reqAdmin.resolve("vite"))("esbuild");
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];

/* ------------------------------------------------ render the real header to HTML (server side, no Next needed) */
const entry = `
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteHeader } from "${WEB}/src/components/Chrome.jsx";
const settings = { brandName: "Rasoi Pulse", logoUrl: "", announcement: { show: false, text: "", href: "" }, contact: { phone: "" } };
const pages = [
  { slug: "home", title: "Home", nav: { show: true, label: "Home", order: 0 } },
  { slug: "pricing", title: "Pricing", nav: { show: true, label: "Pricing", order: 10 } },
  { slug: "faq", title: "FAQ", nav: { show: true, label: "FAQ", order: 20 } },
  { slug: "about", title: "About", nav: { show: true, label: "About", order: 30 } },
  { slug: "contact", title: "Contact", nav: { show: true, label: "Contact", order: 40 } },
];
const product = [
  { href: "/qr-ordering", label: "QR ordering", icon: "qr-code", text: "Guests order from their table" },
  { href: "/staff-ordering", label: "Staff ordering", icon: "concierge-bell", text: "Every waiter becomes an order-taker" },
  { href: "/website", label: "Your website", icon: "globe", text: "Takeaway and delivery on your own website" },
  { href: "/kitchen", label: "Kitchen", icon: "printer", text: "Tickets that print themselves" },
  { href: "/live-orders", label: "Live orders", icon: "layout-dashboard", text: "Every order on one live screen" },
  { href: "/loyalty", label: "Loyalty", icon: "coins", text: "Bring regulars back" },
];
export const html = renderToStaticMarkup(<SiteHeader settings={settings} pages={pages} product={product} />);
`;
const out = `${WEB}/.rasoipulse-test-header.cjs`;
await esbuild.build({
  stdin: { contents: entry, resolveDir: WEB, loader: "jsx", sourcefile: "entry.jsx" },
  absWorkingDir: WEB, bundle: true, write: true, outfile: out, format: "cjs", platform: "node", packages: "external",
  jsx: "automatic", loader: { ".js": "jsx", ".jsx": "jsx" }, logLevel: "silent",
  plugins: [{ name: "at", setup(b) { b.onResolve({ filter: /^@\// }, (a) => b.resolve("./" + a.path.slice(2), { resolveDir: `${WEB}/src`, kind: a.kind })); } }],
});
const { html } = createRequire(import.meta.url)(out);
rmSync(out, { force: true });
const css = readFileSync(`${WEB}/src/app/globals.css`, "utf8");
ok(/class="dd-item"/.test(html) && /class="nav"/.test(html), "the real header rendered (Product dropdown + header links)");

/* ------------------------------------------------ look at it in Chrome */
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) problems.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${css}</style></head><body>${html}<main style="height:600px"></main></body></html>`);

/** what a CSS colour token (var(--paper) …) resolves to right now, as the browser prints it */
const token = (name) => page.evaluate((n) => { const d = document.createElement("div"); d.style.backgroundColor = `var(${n})`; document.body.append(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; }, name);
const styleOf = (sel, props) => page.locator(sel).first().evaluate((el, ps) => Object.fromEntries(ps.map((p) => [p, getComputedStyle(el)[p]])), props);
const item = (n) => page.locator(".dd-item").nth(n);

async function scenario(scheme) {
  console.log(`== ${scheme} theme`);
  await page.emulateMedia({ colorScheme: scheme });
  await page.evaluate(() => document.activeElement?.blur()); // the earlier keyboard step leaves focus inside (which keeps the menu open)
  await page.mouse.move(5, 700);
  await page.waitForTimeout(250);
  const paper = await token("--paper"), brand = await token("--brand"), brandInk = await token("--brand-ink"), wash = await token("--brand-wash"), surface = await token("--surface");
  ok(!(await page.locator(".dd-panel").isVisible()), "the dropdown is closed until the pointer is over Product");
  await page.locator(".dd-btn").hover();
  await page.waitForTimeout(200);
  ok(await page.locator(".dd-panel").isVisible(), "hovering Product opens the panel with all 6 items", `${await page.locator(".dd-item").count()} items`);

  // not hovered: a plain row
  const rest = await styleOf(".dd-item:nth-child(2)", ["backgroundColor", "borderRadius", "paddingTop", "paddingLeft"]);
  ok(rest.backgroundColor === "rgba(0, 0, 0, 0)" || rest.backgroundColor === "transparent", "an item at rest has no background", rest.backgroundColor);

  // hovered
  await item(0).hover();
  await page.waitForTimeout(300); // let the 140ms fade finish
  const hov = await styleOf(".dd-item:first-child", ["backgroundColor", "borderTopLeftRadius", "paddingTop", "paddingLeft", "color", "fontSize", "fontWeight"]);
  ok(hov.backgroundColor === paper, "the hovered item is filled with the soft paper colour", `${hov.backgroundColor} vs paper ${paper}`);
  ok(hov.backgroundColor !== surface, "…which differs from the white panel behind it, so it shows");
  ok(parseFloat(hov.borderTopLeftRadius) >= 10 && parseFloat(hov.borderTopLeftRadius) <= 16, "…as a softly rounded tile (12px corners), not a pill", hov.borderTopLeftRadius);
  ok(hov.paddingTop === "10px" && hov.paddingLeft === "12px", "…with the dropdown's own padding", `${hov.paddingTop} ${hov.paddingLeft}`);
  ok(hov.fontSize !== "15px" || hov.fontWeight !== "500", "…and not the header links' 15px/500 type", `${hov.fontSize}/${hov.fontWeight}`);
  const title = await styleOf(".dd-item:first-child b", ["fontWeight", "fontSize"]);
  ok(title.fontWeight === "600", "the title keeps its bold weight", `${title.fontWeight}`);
  const icon = await styleOf(".dd-item:first-child .dd-icon", ["backgroundColor", "color"]);
  ok(icon.backgroundColor === brand && icon.color === brandInk, "the icon tile fills with the brand colour (white icon) so the highlight reads clearly", `${icon.backgroundColor} / ${icon.color}`);
  const other = await styleOf(".dd-item:nth-child(2) .dd-icon", ["backgroundColor", "color"]);
  ok(other.backgroundColor === wash, "the other items' icon tiles stay in the soft tint", other.backgroundColor);
  const box = await item(0).boundingBox();
  const panel = await page.locator(".dd-panel").boundingBox();
  ok(box.x >= panel.x && box.x + box.width <= panel.x + panel.width && box.y >= panel.y && box.y + box.height <= panel.y + panel.height, "the highlight stays inside the panel (nothing spills over its edge)");
  ok(box.width < panel.width / 2 + 1, "…and is one column wide");
  await page.screenshot({ path: `website-product-menu-${scheme}.png`, clip: { x: 640, y: 0, width: 640, height: 420 } });

  // moving to the next item moves the highlight
  await item(3).hover();
  await page.waitForTimeout(300);
  const a = await styleOf(".dd-item:nth-child(1)", ["backgroundColor"]);
  const d = await styleOf(".dd-item:nth-child(4)", ["backgroundColor"]);
  ok(a.backgroundColor === "rgba(0, 0, 0, 0)" && d.backgroundColor === paper, "moving the pointer moves the highlight (only one item highlighted)");

  // keyboard
  await page.mouse.move(5, 700);
  await page.locator(".dd-btn").focus();
  await page.keyboard.press("Tab");
  await page.waitForTimeout(300);
  const focused = await page.evaluate(() => document.activeElement?.className);
  const f = await styleOf(".dd-item:first-child", ["backgroundColor", "outlineStyle", "outlineWidth"]);
  ok(/dd-item/.test(focused) && f.backgroundColor === paper && f.outlineStyle === "solid", "Tab onto an item gives the same highlight plus a visible focus ring", `${focused} · ${f.backgroundColor} · outline ${f.outlineStyle} ${f.outlineWidth}`);
}
await scenario("light");
await scenario("dark");
await page.emulateMedia({ colorScheme: "light" });

console.log("== the panel is wide enough, and fits every desktop window");
for (const w of [1440, 1280, 1100, 1024, 900]) {
  await page.setViewportSize({ width: w, height: 720 });
  await page.evaluate(() => document.activeElement?.blur());
  await page.mouse.move(5, 700);
  await page.waitForTimeout(150);
  await page.locator(".dd-btn").hover();
  await page.waitForTimeout(250);
  const pb = await page.locator(".dd-panel").boundingBox();
  const lines = await page.locator(".dd-item small").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight))));
  ok(pb.x >= 0 && pb.x + pb.width <= w, `${w}px window: the panel sits fully inside the window`, `x ${Math.round(pb.x)} → ${Math.round(pb.x + pb.width)} of ${w}`);
  if (w >= 1100) ok(pb.width >= 560, `${w}px window: the panel is wide (${Math.round(pb.width)}px, it was 420px)`);
  ok(Math.max(...lines) <= 2, `${w}px window: every description fits in at most 2 lines`, `lines per description: ${lines.join(",")}`);
  if (w === 1280) await page.screenshot({ path: "website-product-menu-wide.png", clip: { x: 560, y: 0, width: 720, height: 420 } });
}
await page.setViewportSize({ width: 1280, height: 720 });
await page.mouse.move(5, 700);

console.log("== the pointer can travel from Product down into the panel without it closing");
{
  await page.evaluate(() => document.activeElement?.blur());
  await page.mouse.move(5, 700);
  await page.waitForTimeout(150);
  const b = await page.locator(".dd-btn").boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(150);
  const target = await item(0).boundingBox();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 25 });
  await page.waitForTimeout(250);
  ok(await page.locator(".dd-panel").isVisible(), "moving straight from Product onto the first item keeps the panel open");
  ok((await styleOf(".dd-item:first-child", ["backgroundColor"])).backgroundColor === (await token("--paper")), "…and that item is highlighted");
  const t2 = await item(5).boundingBox();
  await page.mouse.move(t2.x + t2.width / 2, t2.y + t2.height / 2, { steps: 15 });
  await page.waitForTimeout(250);
  ok(await page.locator(".dd-panel").isVisible(), "moving across the panel to the last item keeps it open");
  await page.mouse.move(5, 700, { steps: 10 });
  await page.waitForTimeout(250);
  ok(!(await page.locator(".dd-panel").isVisible()), "moving away closes it");
}

console.log("== the header links themselves are unchanged");
await page.mouse.move(5, 700);
await page.waitForTimeout(200);
const link = await styleOf(".nav > a:nth-of-type(1)", ["borderTopLeftRadius", "fontSize", "fontWeight", "paddingLeft"]);
ok(parseFloat(link.borderTopLeftRadius) >= 100 && link.fontSize === "15px" && link.fontWeight === "500" && link.paddingLeft === "12px", "Pricing / FAQ / About / Contact keep their pill shape and type", JSON.stringify(link));
await page.locator(".nav > a").first().hover();
await page.waitForTimeout(250);
const lh = await styleOf(".nav > a:nth-of-type(1)", ["backgroundColor"]);
ok(lh.backgroundColor !== "rgba(0, 0, 0, 0)" && lh.backgroundColor !== (await token("--paper")), "a hovered header link still gets its own light grey pill", lh.backgroundColor);

console.log("== a phone: the Product list inside the Menu is unaffected");
await page.setViewportSize({ width: 390, height: 800 });
await page.locator(".menu summary").click();
await page.waitForTimeout(200);
const sub = await styleOf(".menu-sub", ["display", "borderTopLeftRadius"]);
ok(sub.display === "flex" && parseFloat(sub.borderTopLeftRadius) <= 12, "the phone menu's Product rows still look as before", JSON.stringify(sub));
await page.locator(".menu-sub").first().hover();
await page.waitForTimeout(200);
ok((await styleOf(".menu-sub", ["backgroundColor"])).backgroundColor === (await token("--paper")), "…and highlight with the paper colour");

await browser.close();
console.log("console problems:", problems.length ? problems : "none");
ok(problems.length === 0, "the browser logged no errors or warnings");
console.log(`SUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
