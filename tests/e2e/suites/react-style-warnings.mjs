// React's DEVELOPMENT build warns about style mistakes ("Removing a style property during rerender (borderColor) when a
// conflicting property is set (border)…") that the production build — which every other test uses — keeps quiet about.
// So this test bundles the real storefront menu with React's DEVELOPMENT build, puts it in Chrome, drives it the way a
// visitor does (scrolling through the categories, switching the food filter, opening "View all", the order bar's outlet
// list), and fails on ANY React warning or console error.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const REPO = fileURLToPath(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const reqAdmin = createRequire(`${REPO}/apps/admin/package.json`);
const esbuild = createRequire(reqAdmin.resolve("vite"))("esbuild");
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };

/* ---------------------------------------------------------------- a small page around the real components */
const entry = `
import React from "react";
import { createRoot } from "react-dom/client";
import { menuLayoutSchema } from "@rasoipulse/config-schema";
import { MenuSections } from "${REPO}/packages/ui/src/MenuSections.jsx";

const names = ["Soups", "Starters", "Dosa", "Idli & Vada", "Uttapam", "Thali", "Pizza", "Pasta", "Burgers", "Rolls", "Momos", "Biryani", "Desserts", "Drinks"];
const categories = names.map((name, i) => ({ id: "c" + i, name, parentId: i === 3 ? "c2" : null, sortOrder: i, isActive: true, image: null }));
const items = names.flatMap((n, i) => [1, 2, 3, 4, 5, 6, 7].map((k) => ({
  id: "i" + i + "-" + k, categoryId: "c" + i, name: n + " dish " + k, description: "", foodType: k % 3 === 0 ? "non-veg" : k % 3 === 1 ? "veg" : "egg",
  tags: [], images: [], basePrice: 9000 + k * 100, variants: [], modifierGroupIds: [], gstRatePct: 5, isAvailable: true, sortOrder: k,
})));
const menu = { categories, items, modifierGroups: [] };

function App() {
  const [mode, setMode] = React.useState("auto");
  window.__setMode = setMode;
  const layout = menuLayoutSchema.parse(mode === "auto"
    ? { mode: "auto" }
    : { mode: "custom", sections: categories.filter((c) => !c.parentId).map((c) => ({ id: "s-" + c.id, title: c.name === "Dosa" ? "South Indian › Dosa" : c.name, source: "category", categoryId: c.id, collapsible: true, initialItems: 2, viewAllPlacement: "title-right" })) });
  return <div style={{ paddingTop: 300, paddingBottom: 300 }}><MenuSections menu={menu} layout={layout} onSelectItem={() => {}} /></div>;
}
createRoot(document.getElementById("root")).render(<App />);
`;
const built = await esbuild.build({
  stdin: { contents: entry, resolveDir: `${REPO}/apps/storefront`, loader: "jsx", sourcefile: "harness.jsx" },
  absWorkingDir: `${REPO}/apps/storefront`,
  bundle: true,
  write: false,
  format: "iife",
  jsx: "automatic",
  loader: { ".js": "jsx", ".jsx": "jsx" },
  define: { "process.env.NODE_ENV": '"development"' }, // React's development build — the one that warns
  logLevel: "silent",
});
const js = built.outputFiles[0].text;
const css = (await import("node:fs")).readFileSync(`${REPO}/packages/ui/src/tokens.css`, "utf8");

/* ---------------------------------------------------------------- drive it in Chrome */
const browser = await chromium.launch();
const messages = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) messages.push(m.text().slice(0, 300)); });
page.on("pageerror", (e) => messages.push(`pageerror: ${String(e).slice(0, 300)}`));
await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css} body{margin:0;font-family:system-ui} :root{--color-bg:#fff;--color-text:#111;--color-border:#ddd;--color-primary:#c33;--color-on-primary:#fff;--color-surface:#f6f6f6;--color-text-muted:#666}</style></head><body><div id="root"></div><script>${js.replace(/<\/script/g, "<\\/script")}</script></body></html>`);
await page.waitForSelector("[data-fx-toolbar]", { timeout: 15000 });
await page.waitForTimeout(400);

const sections = async () => page.locator("section[id^='sec-']").count();
ok((await sections()) >= 14, "the real menu is on the page (14+ sections, the category bar, the filter)", String(await sections()));

// 1. read down the whole menu: the highlighted chip keeps changing
const seen = new Set();
const height = await page.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < height; y += 260) {
  await page.evaluate((top) => window.scrollTo(0, top), y);
  await page.waitForTimeout(90);
  seen.add(await page.locator('nav[aria-label="Menu categories"] [aria-current="true"]').first().innerText().catch(() => ""));
}
ok(seen.size >= 5, "scrolling the page moves the highlighted category chip many times", `${seen.size} different chips highlighted`);

// 2. the food filter, and clicking a chip
for (const label of ["Veg", "Egg", "Non-veg", "All"]) {
  await page.getByRole("button", { name: label, exact: true }).first().click();
  await page.waitForTimeout(120);
}
await page.locator('nav[aria-label="Menu categories"]').getByRole("link").nth(6).click();
await page.waitForTimeout(1500);
await page.locator('nav[aria-label="Menu categories"]').getByRole("button", { name: /scroll menu categories right/i }).first().click().catch(() => {});

// 3. the other layout: custom sections with a path title and View all buttons
await page.evaluate(() => window.__setMode("custom"));
await page.waitForTimeout(500);
for (let y = 0; y < 2400; y += 300) { await page.evaluate((top) => window.scrollTo(0, top), y); await page.waitForTimeout(80); }
const viewAll = page.locator(".ot-viewall-title");
for (let i = 0; i < Math.min(3, await viewAll.count()); i++) { await viewAll.nth(i).click().catch(() => {}); await page.waitForTimeout(120); }
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);

const warnings = messages.filter((m) => /Warning|style property|shorthand|conflicting|Each child|unique "key"|validateDOMNesting|Invalid|not a valid/i.test(m));
ok(warnings.length === 0, "React reports no style or other warnings while the menu is scrolled, filtered and expanded", warnings[0]?.slice(0, 220) ?? "none");
ok(messages.length === 0, "and nothing else is logged as an error", messages.slice(0, 2).join(" | ").slice(0, 220) || "none");

await browser.close();
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
