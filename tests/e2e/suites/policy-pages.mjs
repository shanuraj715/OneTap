// The pages a payment gateway wants to see (About, Contact, Pricing, Privacy, Terms, Refunds, Delivery):
//  1. the generator (apps/api/src/scripts/publish-policy-pages.js) writes valid pages from an outlet's own settings — checked
//     in-process for a delivering outlet and a non-delivering one;
//  2. on a store with several outlets the landing page (/) — the outlet picker — links to those pages, so a reviewer who opens
//     the bare address finds them. Chrome against the bench store (Acme Momos has two outlets); what it makes is removed again.
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { chromium } from "playwright";
const REPO = fileURLToPath(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const SF = "http://localhost:3170";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const say = (s) => console.log(`\n=== ${s}`);

/* ------------------------------------------------------------------ 1 */
say("1. the generated pages are valid and say what is true for the outlet");
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:1/unused";
const schema = await import(`${REPO}/packages/config-schema/src/index.js`);
const { policyPages } = await import(pathToFileURL(`${REPO}/apps/api/src/scripts/publish-policy-pages.js`).href);
const mk = (slug, name, address, delivery, extra = {}) => ({ slug, name, config: { identity: { name, phone: "98765 43210", email: "hello@shop.test", address }, features: { ordering: { delivery } }, operations: { hours: { enabled: true, opensAt: "09:00", closesAt: "23:00" }, limits: { deliveryFee: 3000, freeDeliveryAbove: 49900, minOrderValue: 10000, deliveryRadiusKm: 6, deliveryMinEtaMinutes: 25, ...extra } }, tax: { pricesIncludeTax: true } } });
const outlets = [mk("main", "Shop Main", "12 Janpath, New Delhi", true), mk("second", "Shop Second", "Sector 18, Noida", false)];
const all = outlets.map((o) => ({ o, pages: policyPages({ store: "Shop", outlet: o, outlets }) }));
const slugs = ["about", "contact", "pricing", "privacy-policy", "terms", "refund-policy", "shipping-policy"];
ok(all.every(({ pages }) => pages.map((p) => p.slug).join() === slugs.join()), "every outlet gets the seven pages: about, contact, pricing, privacy-policy, terms, refund-policy, shipping-policy");
ok(all.every(({ pages }) => pages.every((p) => schema.storePageSchema.safeParse({ ...p, status: "published" }).success)), "…and each one passes the page schema (so it can be saved)");
ok(all.every(({ pages }) => pages.every((p) => p.showInFooter)), "…and each is linked in the footer");
const body = (o, slug) => JSON.stringify(all.find((x) => x.o.slug === o).pages.find((p) => p.slug === slug).blocks);
ok(/₹30/.test(body("main", "pricing")) && /₹499/.test(body("main", "pricing")) && /₹100/.test(body("main", "pricing")), "the Pricing page quotes this outlet's real delivery fee (₹30), free-delivery limit (₹499) and minimum order (₹100)", body("main", "pricing").slice(0, 80));
ok(/does not offer delivery/.test(body("second", "pricing")) && /does not deliver/.test(body("second", "shipping-policy")), "an outlet that doesn't deliver says so, instead of promising delivery");
ok(/9:00 AM to 11:00 PM/.test(body("main", "contact")) && /98765 43210/.test(body("main", "contact")) && /hello@shop.test/.test(body("main", "contact")), "the Contact page has the outlet's phone, email and opening hours (9:00 AM to 11:00 PM)");
ok(/5–7 working days/.test(body("main", "refund-policy")) && /before the kitchen starts preparing/.test(body("main", "refund-policy")), "the Refunds page says when a cancel is possible and how long a refund takes");
ok(/Razorpay/.test(body("main", "privacy-policy")) && /never see or store your card/.test(body("main", "privacy-policy")), "the Privacy policy says who processes payments and that card details are never stored");
ok(!/starting template|not legal advice/i.test(JSON.stringify(all.map((x) => x.pages))), "none of them carries the 'this is only a template' note (they are meant to be published)");

/* ------------------------------------------------------------------ 2 */
say("2. the landing page of a store with several outlets links to them");
const cookie = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "o@acme.test", password: "Owner123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const outletsList = await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json();
const main = (outletsList.outlets ?? outletsList).find((o) => o.slug === "main");
const outletId = String(main._id ?? main.id);
const call = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie, "x-rasoipulse-outlet": outletId }, body: body ? JSON.stringify(body) : undefined });
  let json = {}; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
const mineBefore = (await call("GET", "/api/pages")).json.pages ?? [];
const made = [];
for (const [slug, title] of [["policy-test-about", "Zz About test"], ["policy-test-privacy", "Zz Privacy test"], ["policy-test-refund", "Zz Refunds test"]]) {
  if (mineBefore.some((p) => p.slug === slug)) continue;
  const r = await call("POST", "/api/pages", { slug, title, status: "published", showInFooter: true, showInHeader: false, blocks: [{ id: `b_${slug}`, type: "text", markdown: `Test page ${title}` }] });
  if (r.json.page?.id) made.push(r.json.page.id);
}
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${SF}/`, { waitUntil: "load", timeout: 60000 });
  await page.getByText("Which location?").waitFor({ timeout: 20000 });
  const nav = page.getByTestId("picker-pages");
  ok(await nav.isVisible(), "the outlet picker shows the store's pages at its foot");
  const links = await nav.locator("a").allInnerTexts();
  ok(links.includes("Zz Privacy test") && links.includes("Zz Refunds test") && links.includes("Zz About test"), "…including the About, Privacy and Refunds pages the test published", links.join(" | "));
  const href = await nav.getByRole("link", { name: "Zz Privacy test" }).getAttribute("href");
  ok(/^\/[a-z0-9-]+\/policy-test-privacy$/.test(href ?? ""), "…each pointing at the outlet's own page address", href ?? "");
  await nav.getByRole("link", { name: "Zz Privacy test" }).click();
  await page.waitForURL(/policy-test-privacy/, { timeout: 15000 });
  ok(/Test page Zz Privacy test/.test(await page.locator("body").innerText()), "…and the page opens");
} finally {
  for (const id of made) await call("DELETE", `/api/pages/${id}`);
  await browser.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
