// Menu cards and the picture shape: C07 (Image overlay) uses the WIDE 16:9 picture; Appearance has a "Picture shape" field under
// the menu card styles — it shows the chosen card's own shape, resets to the new card's own when another card is picked,
// can be overridden, and the storefront follows it. Chrome against the bench store (Acme, Main). Everything is put back.
import { chromium } from "playwright";
const AD = "http://localhost:3171";
const SF = "http://localhost:3170";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cookie = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "o@acme.test", password: "Owner123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const outlets = await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json();
const main = (outlets.outlets ?? outlets).find((o) => o.slug === "main");
const outletId = String(main._id ?? main.id);
const layoutBefore = main.config.layout;
const menuLayoutBefore = main.config.menuLayout;
const call = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie, "x-onetap-outlet": outletId }, body: body ? JSON.stringify(body) : undefined });
  let json = {}; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
const patchConfig = (body) => call("PATCH", `/api/outlets/${outletId}/config`, body);
const savedLayout = async () => (await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json()).outlets?.find((o) => o.slug === "main")?.config.layout
  ?? (await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json()).find((o) => o.slug === "main").config.layout;
const made = { items: [], categories: [] };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const page = await ctx.newPage();
page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon|WebSocket|img\.test/.test(m.text())) problems.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
const sf = await ctx.newPage();
sf.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));

try {
  const cat = (await call("POST", "/api/menu/categories", { name: "Card shape test" })).json.category;
  made.categories.push(cat.id);
  const img = (name, ratio) => ({ url: `https://img.test/${name}.png`, key: `menu-items/${name}.png`, ratio, width: 800, height: 800 });
  const full = (await call("POST", "/api/menu/items", { categoryId: cat.id, name: "Card Shape Full", basePrice: 10000, images: [img("cs-sq", "1:1"), img("cs-land", "4:3"), img("cs-wide", "16:9"), img("cs-tall", "3:4")] })).json.item;
  made.items.push(full.id);
  const setCard = (v) => patchConfig({ layout: { ...layoutBefore, itemCardVariant: `card.${v}`, itemImageRatio: "" }, menuLayout: { ...menuLayoutBefore, defaultCardVariant: `card.${v}`, defaultImageRatio: "" } });
  const shown = async () => {
    await sf.goto(`${SF}/main`, { waitUntil: "load" });
    const card = sf.locator("article", { hasText: "Card Shape Full" }).first();
    await card.waitFor({ timeout: 25000 });
    return { src: await card.locator("img").first().getAttribute("src"), card };
  };

  console.log("== C07 uses the wide 16:9 picture");
  await setCard("image-overlay");
  let r = await shown();
  ok(r.src === "https://img.test/cs-wide.png", "C07 shows the wide (16:9) picture of a dish that has all four shapes", r.src);
  const aspect = await r.card.evaluate((e) => getComputedStyle(e).aspectRatio);
  ok(/^16\s*\/\s*9$/.test(aspect), "…and the card itself is a 16:9 box", aspect);

  console.log("== Appearance: Picture shape field");
  await page.goto(AD + "/", { waitUntil: "load" });
  await page.fill('input[type="email"]', "o@acme.test"); await page.fill('input[type="password"]', "Owner123!");
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForSelector("text=Orders");
  await page.goto(AD + "/appearance", { waitUntil: "load" });
  const pickCard = (code) => page.locator("button", { has: page.locator(`span:text-is("${code}")`), hasText: /card\./ }).first().click();
  const shape = page.getByTestId("picture-shape");
  await shape.waitFor({ timeout: 15000 });
  ok(await shape.inputValue() === "16:9", "with C07 selected, Picture shape shows Wide (16:9)", await shape.inputValue());
  ok(/this card's own/.test(await shape.locator("option:checked").innerText()), "…marked as the card's own");
  const widthOf = async () => Math.round((await shape.boundingBox()).width);
  const w0 = await widthOf();
  ok(await page.getByTestId("picture-shape-reset").count() === 0, "there is no 'back to the card's own' link (the dropdown itself shows which one is the card's own)");
  const options = await shape.locator("option").allInnerTexts();
  ok(options.length === 4 && options.some((o) => /Square/.test(o)) && options.some((o) => /Portrait/.test(o)), "all four shapes can be chosen", options.join(" | "));

  await pickCard("C08");
  const widths = [await widthOf()];
  ok(await shape.inputValue() === "3:4", "picking another card (C08) changes the field to that card's own shape — Portrait (3:4)", await shape.inputValue());
  await pickCard("C04");
  ok(await shape.inputValue() === "4:3", "…C04 → Landscape (4:3)", await shape.inputValue());
  await pickCard("C09");
  ok(await shape.inputValue() === "1:1", "…C09 → Square (1:1)", await shape.inputValue());
  widths.push(await widthOf());
  await pickCard("C07");
  ok(await shape.inputValue() === "16:9", "…back to C07 → Wide (16:9)");
  await shape.selectOption("1:1"); widths.push(await widthOf()); await shape.selectOption("3:4"); widths.push(await widthOf()); await shape.selectOption("16:9"); widths.push(await widthOf());
  ok([w0, ...widths].every((w) => w === w0) && w0 >= 300, "the dropdown keeps the same width whichever card or shape is chosen", [w0, ...widths].join(", "));

  console.log("== Overriding it");
  await shape.selectOption("4:3");
  ok(await shape.inputValue() === "4:3" && await page.getByTestId("picture-shape-reset").count() === 0, "an override is just the dropdown set to another shape — no extra message");
  await page.getByRole("button", { name: "Save appearance" }).click();
  await page.getByText(/Saved\./).waitFor({ timeout: 10000 });
  let saved = await savedLayout();
  ok(saved.itemCardVariant === "card.image-overlay" && saved.itemImageRatio === "4:3", "saved: C07 with picture shape 4:3", `${saved.itemCardVariant} / ${saved.itemImageRatio}`);
  r = await shown();
  ok(r.src === "https://img.test/cs-land.png", "the storefront's C07 card now shows the landscape picture", r.src);
  const aspect2 = await r.card.evaluate((e) => getComputedStyle(e).aspectRatio);
  ok(/^4\s*\/\s*3$/.test(aspect2), "…in a 4:3 box", aspect2);

  await page.reload({ waitUntil: "load" });
  await page.getByTestId("picture-shape").waitFor();
  ok(await page.getByTestId("picture-shape").inputValue() === "4:3", "after reloading Appearance the override is still 4:3");

  await page.getByTestId("picture-shape").selectOption("1:1");
  await page.getByRole("button", { name: "Save appearance" }).click();
  await page.getByText(/Saved\./).waitFor({ timeout: 10000 });
  r = await shown();
  ok(r.src === "https://img.test/cs-sq.png", "overriding to Square shows the square picture", r.src);

  console.log("== Another card resets it");
  await pickCard("C08");
  ok(await page.getByTestId("picture-shape").inputValue() === "3:4", "choosing C08 after an override resets the field to C08's own (Portrait), with no override left");
  await page.getByRole("button", { name: "Save appearance" }).click();
  await page.getByText(/Saved\./).waitFor({ timeout: 10000 });
  saved = await savedLayout();
  ok(saved.itemCardVariant === "card.portrait" && saved.itemImageRatio === "", "saved: C08 with no override (empty = its own)", `${saved.itemCardVariant} / "${saved.itemImageRatio}"`);
  await page.getByTestId("picture-shape").selectOption("16:9");
  await page.getByTestId("picture-shape").selectOption("3:4");
  ok(await page.getByTestId("picture-shape").inputValue() === "3:4", "choosing the card's own shape again puts it back");

  console.log("== Menu layout: the same field for the default card and for each section");
  await setCard("image-overlay");
  await page.goto(AD + "/menu-layout", { waitUntil: "load" });
  const dshape = page.getByTestId("default-picture-shape");
  await dshape.waitFor({ timeout: 15000 });
  ok(await dshape.inputValue() === "16:9", "Menu layout → Default card style C07 shows Picture shape Wide (16:9)", await dshape.inputValue());
  await page.locator("select").filter({ has: page.locator("option", { hasText: "C04 ·" }) }).first().selectOption("card.image-top");
  ok(await dshape.inputValue() === "4:3", "choosing C04 as the default card changes it to Landscape (4:3)", await dshape.inputValue());
  await dshape.selectOption("16:9");
  ok(await dshape.inputValue() === "16:9", "…and it can be overridden");
  await page.getByRole("button", { name: /Save layout/ }).click();
  await page.getByText(/Saved\./).first().waitFor({ timeout: 10000 });
  r = await shown();
  ok(r.src === "https://img.test/cs-wide.png", "the storefront's C04 cards now show the wide picture (override on the default card)", r.src);
  const aspect3 = await r.card.locator("img").first().evaluate((e) => getComputedStyle(e.parentElement.matches("article") ? e : e.closest("[style*='aspect-ratio']") ?? e).aspectRatio);
  ok(/16\s*\/\s*9/.test(aspect3), "…in a 16:9 photo box", aspect3);
  // one custom section with its own override
  await patchConfig({ menuLayout: { ...menuLayoutBefore, mode: "custom", defaultCardVariant: "card.image-top", sections: [{ id: "sec_cs", title: "Cards", source: "category", categoryId: cat.id, cardVariant: "card.image-top", imageRatio: "3:4", columns: 0 }] } });
  r = await shown();
  ok(r.src === "https://img.test/cs-tall.png", "a custom section can override its own picture shape (C04 + Portrait → the portrait picture)", r.src);
  await page.goto(AD + "/menu-layout", { waitUntil: "load" });
  const sshape = page.getByTestId("section-picture-shape");
  await sshape.waitFor({ timeout: 15000 });
  ok(await sshape.inputValue() === "3:4", "the section's Picture shape field shows 3:4", await sshape.inputValue());
  await page.locator("select").filter({ has: page.locator("option", { hasText: "C07 ·" }) }).nth(1).selectOption("card.image-overlay");
  ok(await sshape.inputValue() === "16:9", "changing that section's card to C07 resets its shape to Wide (16:9)", await sshape.inputValue());

  console.log("== A card with no picture");
  await page.goto(AD + "/appearance", { waitUntil: "load" });
  await page.getByTestId("picture-shape").waitFor({ timeout: 15000 });
  await pickCard("C01");
  ok(await page.getByTestId("picture-shape-none").isVisible() && await page.getByTestId("picture-shape").count() === 0, "C01 (no picture) says there is no picture shape to choose");
  await page.screenshot({ path: "card-picture-shape.png" });
} finally {
  for (const id of made.items) await call("DELETE", `/api/menu/items/${id}`);
  for (const id of made.categories) await call("DELETE", `/api/menu/categories/${id}`);
  await patchConfig({ layout: layoutBefore, menuLayout: menuLayoutBefore });
  await browser.close();
}
ok(problems.length === 0, "no errors in the browser", problems.slice(0, 3).join(" | "));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
