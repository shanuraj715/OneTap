// The marketing website's header, footer and homepage: Product / Pricing / Apps / FAQ in the header (About and Contact moved to the footer), a short
// "We have apps too" note with an animated picture (no app cards, no downloads — /apps has those), the hero's backdrop fading out instead of ending
// in a line, the richer Features and "moments" sections, no thin border on the dark stats band, the motion (and its "reduce motion" switch-off),
// and no text selection / text cursor. Driven in Chrome against the bench API (:3097) and the website (:3173, built from the current code by
// `bench website`). The bench has no website pages, so this suite creates its own (home, pricing, faq, about, contact) and removes them at the end.
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
const until = async (fn, ms = 25000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await fn()) return true; } catch { /* retry */ } await sleep(400); } return false; };

execFileSync(process.execPath, [BENCH, "website"], { stdio: "inherit" }); // builds it from the current code when it is out of date

const login = async (email, password) => (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const sup = await login("super@sandbox.test", "Super123!");
const sa = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { cookie: sup, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

/* ---------------------------------------------------------------- the pages this suite publishes */
const FEATURES = [
  ["qr-code", "QR table ordering"], ["concierge-bell", "Take orders on any phone"], ["globe", "Your own ordering website"],
  ["printer", "Kitchen tickets that print themselves"], ["coins", "Coins that bring regulars back"], ["message-circle", "WhatsApp and SMS updates"],
];
const MOMENTS = [
  ["clock", "When the queue is out the door"], ["receipt", "When orders go missing between floor and kitchen"],
  ["bike", "When marketplace commissions eat your margin"], ["coins", "Waiters who never sleep"], // the last one has no "When": it must be shown as written
];
const simple = (heading) => [{ type: "hero", id: "h1", heading, subheading: "Test page" }];
const pages = [
  {
    slug: "home", title: "Home", status: "published", nav: { show: true, label: "Home", order: 0 },
    sections: [
      { type: "hero", id: "hero", eyebrow: "Test", heading: "Orders from the *table* to the kitchen", subheading: "Guests scan, waiters tap, the kitchen prints.", primary: { label: "Book a demo", href: "/contact" }, secondary: { label: "See pricing", href: "/pricing" }, note: "Set up for you · No commission", stats: [{ value: "0%", label: "commission" }, { value: "3 ways", label: "to order" }] },
      { type: "productTabs", id: "tabs", eyebrow: "Product", heading: "One product", items: [{ label: "QR", icon: "qr-code", heading: "QR ordering", text: "Scan and order.", points: ["No app"], visual: "qr" }, { label: "Kitchen", icon: "printer", heading: "Kitchen", text: "Prints itself.", points: [], visual: "kitchen" }] },
      { type: "stats", id: "stats", heading: "Built for the rush", items: [{ value: "0%", label: "commission" }, { value: "3 ways", label: "to order" }, { value: "1 screen", label: "for every order" }] },
      { type: "features", id: "feat", eyebrow: "Why", heading: "Everything between order and ticket", intro: "One system.", items: FEATURES.map(([icon, title]) => ({ icon, title, text: `${title} — a line about it.` })) },
      { type: "useCases", id: "uses", eyebrow: "When", heading: "The moments it pays for itself", items: MOMENTS.map(([icon, when]) => ({ icon, when, text: "What happens next." })) },
    ],
  },
  { slug: "pricing", title: "Pricing", status: "published", nav: { show: true, label: "Pricing", order: 10 }, sections: simple("Pricing") },
  { slug: "faq", title: "FAQ", status: "published", nav: { show: true, label: "FAQ", order: 20 }, sections: simple("FAQ") },
  { slug: "about", title: "About", status: "published", nav: { show: true, label: "About", order: 30 }, sections: simple("About") },
  { slug: "contact", title: "Contact", status: "published", nav: { show: true, label: "Contact", order: 40 }, sections: simple("Contact") },
];

const created = [];
let browser;
try {
  for (const p of (await sa("GET", "/api/platform/site/pages")).json.pages ?? []) await sa("DELETE", `/api/platform/site/pages/${p.id ?? p._id}`);
  for (const p of pages) {
    const r = await sa("POST", "/api/platform/site/pages", p);
    if (r.status !== 201) console.log("could not create", p.slug, r.status, JSON.stringify(r.json).slice(0, 200));
    else created.push(r.json.page.id ?? r.json.page._id);
  }
  ok(created.length === pages.length, "the suite's five website pages were created", `${created.length}/${pages.length}`);

  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|favicon|status of 4\d\d|status of 5\d\d/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  const home = async (p = page) => { await p.goto(WEB + "/", { waitUntil: "load" }); };
  await until(async () => { await home(); return (await page.locator(".feature").count()) === FEATURES.length; });

  /* ------------------------------------------------------------------ 1 */
  say("1. Header: Product, Pricing, Apps, FAQ and Talk to us — About and Contact are in the footer");
  const links = (await page.locator(".site-header .nav > a").allTextContents()).map((t) => t.trim());
  ok(JSON.stringify(links) === JSON.stringify(["Pricing", "Apps", "FAQ"]), "the header's links are Pricing, Apps, FAQ (in that order)", links.join(" | "));
  ok(/^Product/.test((await page.locator(".site-header .dd-btn").innerText()).trim()), "…after the Product dropdown");
  ok((await page.locator('.site-header .nav > a[href="/apps"]').count()) === 1, "Apps goes to /apps");
  ok((await page.locator(".site-header .header-cta").innerText()).trim() === "Talk to us", "the Talk to us button is still there");
  ok(!/\bAbout\b|\bContact\b/.test(await page.locator(".site-header .nav").innerText()), "no About and no Contact in the header");
  const foot = page.locator(".site-footer");
  ok((await foot.locator('a[href="/about"]').count()) === 1 && (await foot.locator('a[href="/contact"]').count()) === 1, "the footer has About and Contact");
  ok((await foot.locator('a[href="/apps"]').count()) === 1, "…and Apps");
  await page.setViewportSize({ width: 390, height: 800 });
  await home();
  await page.locator(".menu summary").click();
  const phoneLinks = (await page.locator(".menu-panel a").allTextContents()).map((t) => t.trim());
  ok(phoneLinks.includes("Apps") && phoneLinks.includes("Pricing") && phoneLinks.includes("FAQ"), "the phone menu lists Apps, Pricing and FAQ", phoneLinks.join(" | "));
  ok(!phoneLinks.includes("About") && !phoneLinks.includes("Contact"), "…and no About or Contact");
  await page.setViewportSize({ width: 1360, height: 900 });
  await home();

  /* ------------------------------------------------------------------ 2 */
  say("2. The homepage's apps note: a few words and an animated picture — no cards, no downloads");
  const apps = page.locator("#apps");
  ok(await apps.count() === 1, "the homepage has an apps section");
  ok(/We have apps too/.test(await apps.locator("h2").innerText()), "it says 'We have apps too'");
  ok((await apps.innerText()).length < 520, "…in a few words, not a long description", `${(await apps.innerText()).length} characters`);
  const order = await page.evaluate(() => {
    const el = document.querySelector("#apps");
    const before = document.querySelector(".product");
    const after = document.querySelector(".statband")?.closest("section");
    return { afterTabs: !!before && !!(before.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING), beforeStats: !after || !!(el.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING) };
  });
  ok(order.afterTabs && order.beforeStats, "it sits right after the product tabs, before the stats band");
  ok((await apps.locator(".apps-card").count()) === 0, "no app cards on the homepage");
  ok((await apps.locator("a[download]").count()) === 0 && !/Download/.test(await apps.innerText()), "no download buttons on the homepage");
  const more = apps.locator('a[href="/apps"]');
  ok((await more.count()) === 1 && /See the apps/.test(await more.innerText()), "one link to the apps page: 'See the apps'");
  const stepText = (await apps.locator(".apps-flow-node b").allTextContents()).map((t) => t.trim());
  ok(JSON.stringify(stepText) === JSON.stringify(["Take the order", "Cook it", "Deliver it"]), "the picture shows the three apps in order of an order's journey", stepText.join(" | "));
  ok((await apps.locator(".apps-flow-node img").count()) === 3, "each with its own icon");
  ok(/Take the order/i.test((await apps.locator(".apps-flow").getAttribute("aria-label")) ?? ""), "the picture has a text description for screen readers");

  say("3. …and it moves");
  await apps.scrollIntoViewIfNeeded();
  const ticket = apps.locator(".apps-flow-ticket");
  const left1 = await ticket.evaluate((e) => parseFloat(getComputedStyle(e).left));
  await sleep(1300);
  const left2 = await ticket.evaluate((e) => parseFloat(getComputedStyle(e).left));
  ok(Math.abs(left2 - left1) > 20, "the order ticket slides along the line", `${left1.toFixed(0)}px → ${left2.toFixed(0)}px`);
  const anim = await page.evaluate(() => ({
    ticket: getComputedStyle(document.querySelector(".apps-flow-ticket")).animationName,
    line: getComputedStyle(document.querySelector(".apps-flow-line line")).animationName,
    ring: getComputedStyle(document.querySelector(".apps-flow-icon"), "::after").animationName,
    bob: getComputedStyle(document.querySelector(".apps-flow-icon")).animationName,
  }));
  ok(anim.ticket === "apps-ticket" && anim.line === "apps-march" && anim.ring === "apps-node-ping" && anim.bob === "apps-bob", "the dashed line marches, each app bobs and lights up when the ticket arrives", JSON.stringify(anim));

  /* ------------------------------------------------------------------ 4 */
  say("4. The hero's coloured backdrop fades out — it must not end in a line");
  for (const [w, h] of [[1360, 900], [390, 800]]) {
    await page.setViewportSize({ width: w, height: h });
    await home();
    await page.evaluate(() => scrollTo(0, 0));
    await until(async () => ((await page.locator(".hero-live").boundingBox())?.height ?? 0) > 100, 8000);
    const geo = await page.evaluate(() => {
      const hero = document.querySelector(".hero-live"), bg = hero.querySelector(".apps-bg");
      const hr = hero.getBoundingClientRect(), br = bg.getBoundingClientRect();
      const mask = getComputedStyle(bg).maskImage || getComputedStyle(bg).webkitMaskImage || "none";
      return { pos: getComputedStyle(hero).position, topGap: Math.round(br.top - hr.top), bottomGap: Math.round(br.bottom - hr.bottom), mask: mask.slice(0, 40), bottom: hr.bottom + scrollY };
    });
    ok(geo.pos === "relative" && Math.abs(geo.topGap) <= 1 && Math.abs(geo.bottomGap) <= 1, `${w}px: the backdrop is held inside the hero (not spilling over the next section)`, JSON.stringify(geo));
    ok(/linear-gradient/.test(geo.mask), `${w}px: it fades out towards the bottom (a mask, not a hard edge)`, geo.mask);
    await page.evaluate((y) => scrollTo(0, y - 600), geo.bottom);
    await sleep(500);
    const clipY = Math.round(await page.evaluate(() => document.querySelector(".hero-live").getBoundingClientRect().bottom)) - 3;
    const png = await page.screenshot({ clip: { x: 0, y: clipY, width: Math.min(w, 1200), height: 1 } });
    const px = await page.evaluate(async (b64) => {
      const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
      const c = document.createElement("canvas"); c.width = img.width; c.height = 1;
      const x = c.getContext("2d"); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, img.width, 1).data; let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      const page = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number);
      return { got: [r / n, g / n, b / n].map(Math.round), page };
    }, png.toString("base64"));
    ok(px.got.every((v, i) => Math.abs(v - px.page[i]) <= 6), `${w}px: the colour has faded to the page colour right at the hero's bottom edge`, `${px.got} vs page ${px.page}`);
  }
  await page.setViewportSize({ width: 1360, height: 900 });
  await home();

  /* ------------------------------------------------------------------ 5 */
  say("5. The stats band has no thin outline");
  const band = await page.evaluate(() => { const s = getComputedStyle(document.querySelector(".statband")); return { top: s.borderTopWidth, left: s.borderLeftWidth }; });
  ok(band.top === "0px" && band.left === "0px", "the dark 'Built for the rush' band has no border line", JSON.stringify(band));

  /* ------------------------------------------------------------------ 6 */
  say("6. Features: coloured icon tiles, a faint big icon in each card, a light that follows the pointer");
  const feats = page.locator(".features .feature");
  ok((await feats.count()) === FEATURES.length && (await page.locator(".feature-ghost").count()) === FEATURES.length, "every feature card has its icon, and a faint big copy of it");
  const tile = await feats.first().locator(".feature-icon").evaluate((e) => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; });
  ok(tile.w === 56 && tile.h === 56, "the icon tile is 56 px", JSON.stringify(tile));
  const fx = await page.evaluate(() => [...document.querySelectorAll(".features .feature")].slice(0, 4).map((e) => getComputedStyle(e).getPropertyValue("--fx").trim()));
  ok(new Set(fx).size === 4, "neighbouring cards take different colours", fx.join(" "));
  ok((await page.locator(".has-glow .sec-glow").count()) >= 2, "a soft drifting colour sits behind the features and the moments");
  const glowMask = await page.evaluate(() => { const g = document.querySelector(".sec-glow"); return getComputedStyle(g).maskImage || getComputedStyle(g).webkitMaskImage; });
  ok(/linear-gradient/.test(glowMask), "…and fades out top and bottom, so it never ends in a line");
  const card = feats.nth(1);
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.6);
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.62);
  await sleep(500);
  const hov = await card.evaluate((e) => ({ mx: e.style.getPropertyValue("--mx"), my: e.style.getPropertyValue("--my"), edge: getComputedStyle(e, "::after").opacity, wash: getComputedStyle(e, "::before").opacity, lift: getComputedStyle(e).transform }));
  ok(/^\d+px$/.test(hov.mx) && /^\d+px$/.test(hov.my), "hovering records where the pointer is inside the card", `${hov.mx}, ${hov.my}`);
  ok(hov.edge === "1" && hov.wash === "1", "the card's edge and wash light up under the pointer");
  ok(hov.lift !== "none", "the card lifts", hov.lift);
  await page.mouse.move(5, 5);

  say("7. 'The moments…': cards with a small WHEN label, a tinted round icon and a live dot");
  const moments = page.locator(".moments .moment");
  ok((await moments.count()) === MOMENTS.length, "all moments are shown");
  ok((await page.locator(".moment-when").count()) === 3, "the three that start with 'When' get the small label", String(await page.locator(".moment-when").count()));
  const heads = (await page.locator(".moment h3").allTextContents()).map((t) => t.trim());
  ok(heads[0] === "When The queue is out the door", "…and the rest of the sentence starts with a capital", heads[0]);
  ok(heads[3] === "Waiters who never sleep", "a title without 'When' is shown exactly as written", heads[3]);
  const dot = await page.evaluate(() => getComputedStyle(document.querySelector(".moment-icon"), "::before").animationName);
  ok(dot === "rp-beat", "each icon carries a small pulsing dot", dot);
  const rows = await page.evaluate(() => { const m = [...document.querySelectorAll(".moment")]; const t = (e) => Math.round(e.getBoundingClientRect().top); return { cols: new Set(m.map((e) => Math.round(e.getBoundingClientRect().left))).size, sameRow: t(m[0]) === t(m[1]) }; });
  ok(rows.cols === 2 && rows.sameRow, "two columns on a wide screen");

  /* ------------------------------------------------------------------ 8 */
  say("8. Scroll-reveal: blocks rise into place as they come into view, and nothing stays hidden");
  const supported = await page.evaluate(() => CSS.supports("animation-timeline: view()"));
  if (!supported) ok(true, "this Chrome has no scroll-linked animations: blocks are simply there (the fallback)");
  else {
    const fresh = await ctx.newPage();
    await fresh.goto(WEB + "/", { waitUntil: "load" });
    const lastOp = () => fresh.locator(".features > :last-child").evaluate((e) => Number(getComputedStyle(e).opacity));
    const before = await lastOp();
    await fresh.locator(".features > :last-child").evaluate((e) => e.scrollIntoView({ block: "center" }));
    await sleep(900);
    const after = await lastOp();
    ok(before < 1 && after === 1, "a card far down the page starts faded and is fully visible once scrolled into view", `${before.toFixed(2)} → ${after}`);
    const aboveTheFold = await fresh.locator(".hero-live .stat").first().evaluate((e) => Number(getComputedStyle(e).opacity)).catch(() => 1);
    ok(aboveTheFold === 1, "what is on screen at load is never left invisible");
    await fresh.close();
  }
  const hl = await page.locator(".hero-live h1 em").evaluate((e) => { const s = getComputedStyle(e); return { img: s.backgroundImage.slice(0, 30), anim: s.animationName }; });
  ok(/linear-gradient/.test(hl.img) && hl.anim === "rp-underline", "the hero's emphasised word gets a highlighter line that draws itself in", JSON.stringify(hl));
  const icon = await page.evaluate(() => getComputedStyle(document.querySelector(".feature-icon svg")).animationName);
  ok(icon === "rp-bob", "feature icons breathe gently", icon);

  say("9. 'Reduce motion': everything stands still and is fully visible");
  const calm = await browser.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: "reduce" });
  const cp = await calm.newPage();
  await cp.goto(WEB + "/", { waitUntil: "load" });
  const still = await cp.evaluate(() => {
    const an = (sel, pseudo) => getComputedStyle(document.querySelector(sel), pseudo).animationName;
    const op = (sel) => Number(getComputedStyle(document.querySelector(sel)).opacity);
    const left = (() => { const t = document.querySelector(".apps-flow-ticket"); return { name: getComputedStyle(t).animationName, left: getComputedStyle(t).left, opacity: getComputedStyle(t).opacity }; })();
    return {
      ticket: left, line: an(".apps-flow-line line"), icon: an(".feature-icon svg"), ghosts: an(".hero-live .apps-blob"), reveal: an(".features > :last-child"),
      lastFeature: op(".features > :last-child"), lastMoment: op(".moments > :last-child"), apps: op(".apps-flow"), em: an(".hero-live h1 em"), glow: an(".sec-glow i"),
    };
  });
  ok(still.ticket.name === "none" && still.line === "none" && still.icon === "none" && still.ghosts === "none" && still.reveal === "none" && still.em === "none" && still.glow === "none", "no animation runs anywhere on the page", JSON.stringify(still));
  ok(still.lastFeature === 1 && still.lastMoment === 1 && still.apps === 1, "the cards and the apps picture are fully visible without scrolling");
  ok(still.ticket.opacity === "1" && parseFloat(still.ticket.left) > 20, "the order ticket rests visibly between the first two apps", `${still.ticket.left}`);
  await calm.close();

  /* ------------------------------------------------------------------ 10 */
  say("10. Text can't be selected and the pointer is never the text I-beam");
  const cur = await page.evaluate(() => {
    const cs = (sel) => { const s = getComputedStyle(document.querySelector(sel)); return { sel: s.userSelect || s.webkitUserSelect, cursor: s.cursor }; };
    return { body: cs("body"), heading: cs(".hero-live h1"), para: cs(".feature p"), card: cs(".feature"), link: cs(".site-header .nav > a"), button: cs(".dd-btn"), cta: cs(".header-cta"), summary: cs(".faq summary, .menu summary") };
  });
  ok(["body", "heading", "para", "card"].every((k) => cur[k].sel === "none"), "body text, headings, paragraphs and cards are user-select: none", JSON.stringify(cur.para));
  ok(["body", "heading", "para", "card"].every((k) => cur[k].cursor === "default"), "over text the pointer is the ordinary arrow", JSON.stringify(cur.para));
  ok(cur.link.cursor === "pointer" && cur.button.cursor === "pointer" && cur.cta.cursor === "pointer", "over links and buttons it is the hand");
  // really try to select it: triple-click a paragraph, then drag across the heading, then Select All
  const para = page.locator(".features .feature p").first();
  await para.scrollIntoViewIfNeeded();
  await para.click({ clickCount: 3 });
  const sel1 = await page.evaluate(() => String(getSelection()));
  await page.evaluate(() => scrollTo(0, 0));
  const hb2 = await page.locator(".hero-live h1").boundingBox();
  await page.mouse.move(hb2.x + 4, hb2.y + 10);
  await page.mouse.down();
  await page.mouse.move(hb2.x + hb2.width - 10, hb2.y + hb2.height - 10, { steps: 8 });
  await page.mouse.up();
  const sel2 = await page.evaluate(() => String(getSelection()));
  await page.keyboard.press("ControlOrMeta+A");
  const sel3 = await page.evaluate(() => String(getSelection()).trim());
  ok(sel1 === "" && sel2 === "" && sel3 === "", "a triple-click, a drag across the heading and Select All select nothing", JSON.stringify([sel1, sel2, sel3.slice(0, 30)]));

  // …but a form still works (the Contact page has none in this bench, so build the test on the real thing: an input added to the page)
  await page.evaluate(() => { const i = document.createElement("input"); i.id = "zz-field"; i.type = "text"; i.style.cssText = "position:fixed;left:20px;top:200px;z-index:9999"; document.body.append(i); });
  await page.locator("#zz-field").fill("hello world");
  await page.locator("#zz-field").selectText();
  const typed = await page.evaluate(() => { const i = document.querySelector("#zz-field"); const s = getComputedStyle(i); return { picked: i.value.slice(i.selectionStart, i.selectionEnd), userSelect: s.userSelect || s.webkitUserSelect, cursor: s.cursor }; });
  ok(typed.picked === "hello world" && typed.userSelect === "text", "typing fields still allow selecting what you typed", JSON.stringify(typed));

  /* ------------------------------------------------------------------ 11 */
  say("11. The apps page still shows its cards (the homepage note shares nothing with them but the icons)");
  await page.goto(WEB + "/apps", { waitUntil: "load" });
  ok((await page.locator(".apps-card").count()) === 3, "/apps still has one card per app", String(await page.locator(".apps-card").count()));
  ok((await page.locator(".apps-card a", { hasText: "Details and versions" }).count()) === 3, "each card still links to its own page");
  const ver = await page.evaluate(() => {
    // an app's own page shows this box once a version is published; build the same markup here to read what the site's CSS does to it
    const d = document.createElement("details"); d.className = "app-verify"; d.open = true; d.innerHTML = "<summary>Check the file</summary><p>SHA-256 0123abcd</p>"; document.body.append(d);
    const s = getComputedStyle(d.querySelector("p")); return { sel: s.userSelect || s.webkitUserSelect, cursor: s.cursor };
  });
  ok(ver.sel === "text", "an app page's file checksum can still be selected and copied", JSON.stringify(ver));

  say("12. A phone: nothing sticks out sideways");
  await page.setViewportSize({ width: 390, height: 800 });
  await home();
  await sleep(500);
  const wide = await page.evaluate(() => ({
    over: document.documentElement.scrollWidth - innerWidth,
    who: [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest(".sec-glow, .apps-bg, .feature-ghost")).slice(0, 4).map((e) => `${e.tagName.toLowerCase()}.${String(e.className?.baseVal ?? e.className).slice(0, 30)}:${Math.round(e.getBoundingClientRect().right)}`),
  }));
  ok(wide.over <= 0, "the homepage fits a 390 px screen", `${wide.over}px over; ${wide.who.join(" ")}`);
  const fl = await page.evaluate(() => { const f = document.querySelector(".apps-flow").getBoundingClientRect(); return Math.round(f.right) <= innerWidth && Math.round(f.left) >= 0; });
  ok(fl, "…including the animated apps picture");
} finally {
  for (const id of created) await sa("DELETE", `/api/platform/site/pages/${id}`).catch(() => undefined);
  await browser?.close();
}
ok(problems.length === 0, "no errors in the browser", problems.slice(0, 3).join(" | "));
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
