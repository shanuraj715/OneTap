// The veg / egg / non-veg mark: the dot must sit exactly in the middle of its frame — on the storefront menu (at every size
// the cards use) and in the dashboard's Take order screen. Measured in Chrome: dot centre vs frame centre.
import { chromium } from "playwright";
const SF = "http://localhost:3170";
const AD = "http://localhost:3171";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];

// for every mark on the page: frame (the svg) vs. its inner dot — centre difference, squareness, dot inside the frame
const measure = (page, selector) => page.evaluate((sel) => [...document.querySelectorAll(sel)].map((svg) => {
  const f = svg.getBoundingClientRect();
  const shapes = [...svg.querySelectorAll("circle, rect")];
  const dot = shapes[shapes.length - 1].getBoundingClientRect();
  return {
    label: svg.getAttribute("aria-label"), w: f.width, h: f.height,
    dx: Math.abs((f.left + f.width / 2) - (dot.left + dot.width / 2)),
    dy: Math.abs((f.top + f.height / 2) - (dot.top + dot.height / 2)),
    inside: dot.left >= f.left && dot.right <= f.right && dot.top >= f.top && dot.bottom <= f.bottom,
    visible: f.width > 0 && f.height > 0,
  };
}), selector);
const verdict = (rows) => ({
  n: rows.length,
  worst: Math.max(0, ...rows.map((r) => Math.max(r.dx, r.dy))),
  square: rows.every((r) => Math.abs(r.w - r.h) < 0.01),
  inside: rows.every((r) => r.inside),
  kinds: [...new Set(rows.map((r) => r.label))].sort().join(","),
  sizes: [...new Set(rows.map((r) => Math.round(r.w)))].sort((a, b) => a - b).join(","),
});

const browser = await chromium.launch();
try {
  for (const dsf of [1, 2]) { // normal and retina screens
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: dsf });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => problems.push(String(e).slice(0, 200)));
    console.log(`== Storefront menu (${dsf}× screen)`);
    await page.goto(SF + "/main", { waitUntil: "networkidle" });
    await page.waitForSelector('svg[role="img"][aria-label]');
    const v = verdict(await measure(page, 'svg[role="img"][aria-label="Vegetarian"], svg[role="img"][aria-label="Non-vegetarian"], svg[role="img"][aria-label="Contains egg"]'));
    ok(v.n >= 3, "the menu shows several veg / non-veg marks", `${v.n} marks (${v.kinds}) at sizes ${v.sizes}px`);
    ok(v.worst < 0.05, "the dot is exactly in the middle of its frame, on every mark", `worst off-centre ${v.worst.toFixed(3)}px`);
    ok(v.square && v.inside, "every mark is a true square and the dot stays inside its frame");
    if (dsf === 2) await page.locator('svg[role="img"][aria-label="Vegetarian"]').first().screenshot({ path: "food-mark.png" }).catch(() => {});
    await ctx.close();
  }

  console.log("== Dashboard → Take order");
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(String(e).slice(0, 200)));
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', "o@acme.test"); await page.fill('input[type="password"]', "Owner123!");
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector("text=Orders");
  await page.goto(AD + "/take-order", { waitUntil: "load" });
  await page.getByText("T1", { exact: true }).first().click(); // pick a table to reach the menu
  await page.waitForSelector('svg[role="img"][aria-label]', { timeout: 15000 });
  const v = verdict(await measure(page, 'svg[role="img"][aria-label]'));
  ok(v.n >= 3, "Take order shows veg / non-veg marks", `${v.n} marks (${v.kinds})`);
  ok(v.worst < 0.05 && v.square && v.inside, "…each with its dot exactly centred in a square frame", `worst off-centre ${v.worst.toFixed(3)}px`);
  await ctx.close();
} finally {
  await browser.close();
}
ok(problems.length === 0, "no errors in the browser", problems.slice(0, 2).join(" | "));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
