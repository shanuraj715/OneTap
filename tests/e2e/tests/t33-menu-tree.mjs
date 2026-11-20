// T33 — Menu categories inside categories, a picture for a category, and ticking several categories / items to delete them
// together. All in Chrome: the owner builds South Indian → Dosa → Rava Dosa and South Indian → Idli & Vada on the dashboard's
// Menu page; the customer's storefront shows it as headings and sub-headings with chips; then the owner deletes in bulk.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BENCH } from "../bench/watch.mjs";
import * as ui from "../bench/ui.mjs";

export const meta = {
  id: "t33-menu-tree",
  title: "Menu — categories inside categories, category pictures, and multi-select delete for categories and items",
  area: "menu",
  fresh: true,
  summary: "In Chrome as the owner of Acme Momos, on Menu: 'South Indian' is added as a category; from its ⋯ menu 'Add sub-category' makes Dosa and Idli & Vada inside it, and from Dosa's menu Rava Dosa inside that — the tree is indented, folds and unfolds, and Move up puts Idli & Vada above Dosa. Edit… on Dosa adds a picture (it appears on the row) and its 'Inside' list won't offer Dosa or Rava Dosa itself. Dishes are added at every level — South Indian Thali directly in South Indian, Masala Dosa and Paneer Dosa in Dosa, Plain Idli in Idli & Vada, Rava Masala in Rava Dosa (the item form has a Category picker showing the tree). Selecting South Indian lists its own dish and, with 'Also show dishes from the categories inside', the others marked 'in South Indian › Dosa'. On the storefront the menu has a 'South Indian' heading with 'Dosa' and 'Idli & Vada' under it ('Rava Dosa' under Dosa), the Dosa picture beside its heading, 'South Indian' as the chip with a second row of chips for what is inside; switching South Indian off hides all of it. Then two categories are ticked: the bulk bar says '2 selected', 'Delete selected' warns they hold dishes and stays off until 'Also delete the items' is ticked, and afterwards the categories, everything inside them and their dishes are gone from the dashboard and the storefront. Finally two dishes are ticked and deleted together. Last, 'Add several categories…' opens a window with ONE name box that grows with 'Add another category' (or Enter): each box has its own picture button — Soups and Fresh Juices get a picture, Salads none; a repeated name or a picture with no name is flagged; removing a box or Cancel throws away an unused upload; 'Add 3 categories' makes them in order at the top level, and the sub-category window does the same inside South Indian (Pongal with a picture). The category panel is wider, and the quick box adds exactly what is typed (no comma splitting).",
  expect: [
    "'Add sub-category' puts a category inside another, as many levels as wanted; the tree is indented (levels 1, 2, 3), folds and unfolds, and Move up/Move down changes the order.",
    "The tree is drawn with connecting lines and a node per category (an elbow into each sub-category, a line down from each parent, a fold node on parents).",
    "Dragging a category: onto the middle of a row = inside it; onto a row's top/bottom edge = before/after it; onto the strip under the tree = top level; a line or outline shows where it would land; dropping into its own branch does nothing; it is saved.",
    "Edit… offers a picture; it shows on the category's row. The 'Inside' list disables the category itself and everything inside it.",
    "Dishes can be added to any level; the item form's Category picker shows the tree; a parent's list shows its own dishes and (optionally) those of the categories inside, each marked with where it is.",
    "Storefront: headings and sub-headings in tree order, the picture beside its heading, top-level chips with a second row for what is inside; a switched-off parent hides everything inside it.",
    "Ticking several categories shows 'N selected' and 'Delete selected'; categories holding dishes need 'Also delete the items' ticked; then the categories, all inside them and the dishes are gone everywhere.",
    "Ticking several dishes shows 'N selected' and 'Delete selected'; confirming deletes exactly those.",
    "The category panel is wider than before.",
    "Add category has one box at first; 'Add another category' (or Enter) adds more; each box has its own name and its own picture button; the button counts them ('Add 3 categories'); they are made in order, each with its own picture, at the top level or inside the chosen category; empty boxes are ignored.",
    "A name used twice, or a picture on a box with no name, is flagged and can't be added; removing a box (or Cancel) deletes pictures that were uploaded but not kept.",
  ],
  expectNot: [
    "A category must NOT be offered as its own parent, or inside its own sub-categories, and must NOT be droppable into its own branch.",
    "Delete must NOT be possible for categories that hold dishes until the 'also delete the items' box is ticked.",
    "A sub-category must NOT appear as a top-level chip on the storefront.",
    "A category must NOT get another box's picture, and several names typed with commas in the quick box must NOT be split into several categories.",
    "The browser must NOT log JavaScript errors.",
  ],
};

/** a small solid-colour PNG, made here so the test needs no image file */
function makePng(path, w = 96, h = 96, rgb = [214, 82, 38]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(body)); return Buffer.concat([len, body, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => rgb).flat())]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
  return path;
}

export async function run(d) {
  const png = makePng(join(tmpdir(), "onetap-test-category.png"));
  await d.tab("owner", "Store dashboard · owner of Acme Momos");
  await ui.signIn(d, "owner");
  await d.goto(BENCH.admin + "/menu", 600);

  const row = (name) => d.page.locator(`[data-testid="cat-row"][data-category="${name}"]`);
  const level = async (name) => Number(await row(name).getAttribute("aria-level"));
  const rowNames = async () => d.page.locator('[data-testid="cat-row"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-category")));
  const openActions = async (name, option) => {
    await d.click(row(name).getByRole("button", { name: `Actions for ${name}` }), { after: 300 });
    await d.click(d.page.getByText(option, { exact: true }).first(), { after: 500 });
  };
  const addSub = async (parent, name) => {
    await openActions(parent, "Add sub-category");
    const dlg = d.page.getByRole("dialog", { name: "Add category" });
    await dlg.waitFor({ timeout: 8000 });
    await d.type(dlg.getByPlaceholder("e.g. Dosa"), name, { after: 150, delay: 15 });
    await d.click(dlg.getByRole("button", { name: "Add category" }), { after: 800 });
    await dlg.waitFor({ state: "hidden", timeout: 8000 });
    await row(name).waitFor({ timeout: 8000 });
  };
  const selectCat = async (name) => d.click(row(name).locator("button", { hasText: name }).first(), { after: 500 });
  const addDish = async (inCategory, dish, price, placeIn) => {
    await selectCat(inCategory);
    await d.click(d.page.getByRole("button", { name: "Add item" }).first(), { after: 400 });
    await ui.fill(d, "Name", dish);
    if (placeIn) {
      // the item form's Category picker shows the whole tree — choose by the name at the end of the option
      const picker = d.page.getByLabel("Category", { exact: true });
      const value = await picker.locator("option").evaluateAll((os, want) => os.find((o) => o.textContent.replace(/\s+/g, " ").trim().endsWith(want))?.value, placeIn);
      await picker.selectOption(value);
    }
    await ui.fill(d, "Price", price);
    await d.click(d.page.getByRole("button", { name: "Create item" }), { after: 900 });
  };

  await d.step("The owner makes South Indian, and categories inside it", 400);
  await d.type(d.page.getByPlaceholder("New category"), "South Indian", { after: 200, delay: 15 });
  await d.press("Enter", 900);
  await row("South Indian").waitFor({ timeout: 10000 });
  d.check("'South Indian' is a top-level category (level 1)", (await level("South Indian")) === 1);
  await addSub("South Indian", "Dosa");
  await addSub("South Indian", "Idli & Vada");
  await addSub("Dosa", "Rava Dosa");
  d.check("Dosa and Idli & Vada are level 2; Rava Dosa (inside Dosa) is level 3", (await level("Dosa")) === 2 && (await level("Idli & Vada")) === 2 && (await level("Rava Dosa")) === 3, `${await level("Dosa")}/${await level("Idli & Vada")}/${await level("Rava Dosa")}`);
  let names = await rowNames();
  d.check("the tree is in order: South Indian, Dosa, Rava Dosa, Idli & Vada (after the existing categories)", names.slice(-4).join() === "South Indian,Dosa,Rava Dosa,Idli & Vada", names.join(", "));

  const elbow = (n) => row(n).getByTestId("cat-elbow");
  d.check("the tree is drawn with lines: a sub-category hangs off its parent by an elbow; the last one's line stops there", (await elbow("Dosa").getAttribute("data-last")) === "false" && (await elbow("Idli & Vada").getAttribute("data-last")) === "true" && (await elbow("Rava Dosa").getAttribute("data-last")) === "true" && (await elbow("South Indian").count()) === 0);
  d.check("a parent has a line running down to its children; a leaf doesn't", (await row("South Indian").locator('[data-line="stem"]').count()) === 1 && (await row("Dosa").locator('[data-line="stem"]').count()) === 1 && (await row("Idli & Vada").locator('[data-line="stem"]').count()) === 0);
  d.check("South Indian's line carries on past Dosa's branch (through Rava Dosa's row) to reach Idli & Vada", (await row("Rava Dosa").locator('[data-line="through"]').count()) === 1);
  d.check("every category has a node; parents' nodes are fold buttons, leaves' are dots", (await d.page.getByTestId("cat-node").count()) === (await rowNames()).length && (await row("South Indian").getByTestId("cat-node").evaluate((n) => n.tagName)) === "BUTTON" && (await row("Idli & Vada").getByTestId("cat-node").evaluate((n) => n.tagName)) === "SPAN");
  await d.shot("category-tree-lines");

  await d.step("The tree folds and unfolds", 400);
  await d.click(row("South Indian").getByRole("button", { name: "Fold South Indian" }), { after: 400 });
  d.check("folded: its sub-categories are hidden", (await row("Dosa").count()) === 0 && (await row("Idli & Vada").count()) === 0);
  await d.click(row("South Indian").getByRole("button", { name: "Unfold South Indian" }), { after: 400 });
  d.check("unfolded: they are back", (await row("Dosa").count()) === 1 && (await row("Rava Dosa").count()) === 1);

  await d.step("Move up puts Idli & Vada above Dosa", 400);
  await openActions("Idli & Vada", "Move up");
  await ui.until(async () => { const n = await rowNames(); return n.indexOf("Idli & Vada") < n.indexOf("Dosa"); }, 8000);
  names = await rowNames();
  d.check("Idli & Vada is now first inside South Indian", names.indexOf("Idli & Vada") < names.indexOf("Dosa"), names.slice(-4).join(", "));
  await openActions("Idli & Vada", "Move down");
  await ui.until(async () => { const n = await rowNames(); return n.indexOf("Dosa") < n.indexOf("Idli & Vada"); }, 8000);
  d.check("Move down puts it back", true);

  await d.step("A picture for Dosa", 400);
  await openActions("Dosa", "Edit…");
  const edit = d.page.getByRole("dialog", { name: "Edit category" });
  await edit.waitFor({ timeout: 8000 });
  const inside = await edit.getByLabel("Inside").locator("option").evaluateAll((os) => os.map((o) => ({ t: o.textContent.replace(/\s+/g, " ").trim(), disabled: o.disabled })));
  d.check("the 'Inside' list can't offer Dosa itself or Rava Dosa (inside it)", inside.find((o) => /Dosa$/.test(o.t) && !/Rava/.test(o.t))?.disabled === true && inside.find((o) => /Rava Dosa/.test(o.t))?.disabled === true && inside.find((o) => /Idli/.test(o.t))?.disabled === false, inside.filter((o) => /Dosa|Idli|South/.test(o.t)).map((o) => `${o.t}${o.disabled ? " ✗" : ""}`).join(" | "));
  await edit.getByLabel("Category picture").setInputFiles(png);
  await edit.locator("img").first().waitFor({ timeout: 20000 });
  d.check("the picture shows in the dialog once uploaded", await edit.locator("img").first().isVisible());
  await d.shot("category-edit-dialog");
  await d.click(edit.getByRole("button", { name: "Save" }), { after: 900 });
  await edit.waitFor({ state: "hidden", timeout: 8000 });
  await ui.until(async () => (await row("Dosa").locator("img").count()) === 1, 10000);
  d.check("Dosa's row now shows its picture", (await row("Dosa").locator("img").count()) === 1);

  await d.step("Dishes at every level", 400);
  await addDish("South Indian", "South Indian Thali", "150");
  await addDish("Dosa", "Masala Dosa", "90");
  await addDish("Dosa", "Paneer Dosa", "110");
  await addDish("Idli & Vada", "Plain Idli", "50");
  await addDish("South Indian", "Rava Masala", "100", "Rava Dosa");
  // (the picker shows the tree — the last one was placed with it, from the South Indian page)
  await selectCat("Rava Dosa");
  d.check("the dish placed with the item form's Category picker is inside Rava Dosa", (await d.page.locator('[data-testid="item-row"][data-item="Rava Masala"]').count()) === 1);
  await selectCat("South Indian");
  let list = await d.page.locator('[data-testid="item-row"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-item")));
  d.check("South Indian lists its own dish AND those inside it", list.includes("South Indian Thali") && list.includes("Masala Dosa") && list.includes("Plain Idli") && list.includes("Rava Masala"), list.join(", "));
  d.check("dishes from further down say where they are", /in South Indian › Dosa/.test(await d.page.locator('[data-item="Masala Dosa"]').innerText()) && /in South Indian › Dosa › Rava Dosa/.test(await d.page.locator('[data-item="Rava Masala"]').innerText()));
  await d.click(d.page.getByLabel("Also show dishes from the categories inside this one"), { after: 400 });
  list = await d.page.locator('[data-testid="item-row"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-item")));
  d.check("unticking that shows only its own dish", list.join() === "South Indian Thali", list.join(", "));
  await d.click(d.page.getByLabel("Also show dishes from the categories inside this one"), { after: 300 });
  await d.shot("menu-tree");

  await d.step("The Add-on groups part of the page still works (it shares the page with the tree)", 400);
  await ui.fill(d, "Group name", "Extras");
  await ui.fill(d, "Options", "Cheese Dip + 30, Extra Mayo + 15");
  await d.click(d.page.getByRole("button", { name: "Add group" }), { after: 900 });
  const groupRow = d.page.locator("div", { hasText: /^Extras/ }).filter({ hasText: "Cheese Dip" }).first();
  await groupRow.waitFor({ timeout: 10000 });
  d.check("an add-on group can be added and is listed with its options (the page didn't crash)", /Cheese Dip \+₹30/.test(await ui.text(d)) && /Extra Mayo \+₹15/.test(await ui.text(d)));
  // (the bench accepts the browser's "Delete …?" prompt by itself)
  await d.click(groupRow.getByRole("button", { name: "×" }).or(groupRow.locator('button[title="Delete"]')).first(), { after: 900 });
  // (the form's own hint also says "Cheese Dip + 30", so look for the listed option instead)
  const gone = await ui.until(async () => !/Cheese Dip \+₹/.test(await ui.text(d)), 8000);
  d.check("…and deleted again", gone, gone ? "" : ((await ui.text(d)).match(/Add-on groups[\s\S]{0,220}/)?.[0] ?? "").replace(/\s+/g, " "));

  await d.step("The customer's storefront shows the tree", 400);
  await d.tab("customer", "Customer · Acme Momos storefront");
  await d.goto(BENCH.storefront + "/main", 900);
  const section = (t) => d.page.locator("section[data-depth]").filter({ has: d.page.locator(`h2, h3, h4`, { hasText: new RegExp(`^${t}$`) }) }).first();
  const depthOf = async (t) => Number(await section(t).getAttribute("data-depth"));
  await section("South Indian").waitFor({ timeout: 15000 });
  d.check("'South Indian' is a heading; 'Dosa' and 'Idli & Vada' sit under it; 'Rava Dosa' under Dosa", (await depthOf("South Indian")) === 0 && (await depthOf("Dosa")) === 1 && (await depthOf("Idli & Vada")) === 1 && (await depthOf("Rava Dosa")) === 2);
  const order = await d.page.locator("section[data-depth] h2, section[data-depth] h3, section[data-depth] h4").evaluateAll((els) => els.map((e) => e.textContent.trim()));
  d.check("in tree order", order.indexOf("South Indian") < order.indexOf("Dosa") && order.indexOf("Dosa") < order.indexOf("Rava Dosa") && order.indexOf("Rava Dosa") < order.indexOf("Idli & Vada"), order.slice(-6).join(" › "));
  d.check("a sub-heading says what it is inside", /South Indian/.test(await section("Dosa").innerText()) && /South Indian › Dosa/.test(await section("Rava Dosa").innerText()));
  d.check("Dosa's picture is beside its heading", (await section("Dosa").locator("img").count()) >= 1 && (await section("Dosa").locator("img").first().evaluate((im) => im.complete && im.naturalWidth > 0)));
  d.check("the parent shows its own dish (South Indian Thali) under its heading", /South Indian Thali/.test(await section("South Indian").innerText()));
  const chips = d.page.getByRole("navigation", { name: "Menu categories" });
  const chipNames = (await chips.locator("a").allInnerTexts()).map((t) => t.trim());
  d.check("the top row of chips has 'South Indian' and not its sub-categories", chipNames.includes("South Indian") && !chipNames.includes("Dosa") && !chipNames.includes("Idli & Vada"), chipNames.join(", "));
  await d.click(chips.getByRole("link", { name: "South Indian" }), { after: 1400 });
  const sub = d.page.getByRole("navigation", { name: "Inside this category" });
  await sub.waitFor({ timeout: 8000 });
  const subNames = (await sub.locator("a").allInnerTexts()).map((t) => t.trim());
  d.check("a second row of chips lists what is inside South Indian", ["Dosa", "Rava Dosa", "Idli & Vada"].every((n) => subNames.includes(n)), subNames.join(", "));
  await d.shot("storefront-tree");

  await d.step("Switching South Indian off hides everything inside it", 400);
  await d.tab("owner", "Store dashboard · owner of Acme Momos");
  await openActions("South Indian", "Edit…");
  const off = d.page.getByRole("dialog", { name: "Edit category" });
  await off.getByRole("checkbox", { name: /Show on the menu/ }).uncheck();
  await d.click(off.getByRole("button", { name: "Save" }), { after: 900 });
  await off.waitFor({ state: "hidden", timeout: 8000 });
  await d.tab("customer", "Customer · Acme Momos storefront");
  await d.page.reload({ waitUntil: "load" });
  await d.page.waitForTimeout(800);
  const t = await ui.text(d);
  d.check("the storefront shows none of South Indian, Dosa, Rava Dosa, Idli & Vada or their dishes", !/South Indian|Rava Masala|Plain Idli|Masala Dosa/.test(t));
  await d.tab("owner", "Store dashboard · owner of Acme Momos");
  await openActions("South Indian", "Edit…");
  await d.page.getByRole("dialog", { name: "Edit category" }).getByRole("checkbox", { name: /Show on the menu/ }).check();
  await d.click(d.page.getByRole("dialog", { name: "Edit category" }).getByRole("button", { name: "Save" }), { after: 900 });
  await d.page.getByRole("dialog", { name: "Edit category" }).waitFor({ state: "hidden", timeout: 8000 });

  await d.step("Ticking two categories and deleting them together", 400);
  await d.click(d.page.getByLabel("Select category Rava Dosa"), { after: 250 });
  await d.click(d.page.getByLabel("Select category Idli & Vada"), { after: 250 });
  const bulk = d.page.getByTestId("cat-bulk");
  d.check("a bar says '2 selected' and offers 'Delete selected'", (await bulk.isVisible()) && /2 selected/.test(await bulk.innerText()) && (await bulk.getByRole("button", { name: /Delete selected/ }).isVisible()));
  await d.click(bulk.getByRole("button", { name: /Delete selected/ }), { after: 500 });
  const del = d.page.getByRole("dialog", { name: "Delete categories" });
  await del.waitFor({ timeout: 8000 });
  const dtext = (await del.innerText()).replace(/\s+/g, " ");
  d.check("the dialog lists both and says they hold dishes (2 items)", /Rava Dosa/.test(dtext) && /Idli & Vada/.test(dtext) && /2 items/.test(dtext), dtext.slice(0, 160));
  const go = del.getByRole("button", { name: "Delete", exact: true });
  d.check("'Delete' is switched off until 'Also delete the items' is ticked", await go.isDisabled());
  await d.shot("categories-delete-dialog");
  await d.click(del.getByRole("checkbox", { name: /Also delete the 2 items/ }), { after: 300 });
  d.check("…then it can be pressed", await go.isEnabled());
  await d.click(go, { after: 1000 });
  await del.waitFor({ state: "hidden", timeout: 10000 });
  await ui.until(async () => (await row("Idli & Vada").count()) === 0, 10000);
  d.check("both categories are gone from the tree (Dosa and South Indian stay)", (await row("Idli & Vada").count()) === 0 && (await row("Rava Dosa").count()) === 0 && (await row("Dosa").count()) === 1 && (await row("South Indian").count()) === 1);
  await selectCat("South Indian");
  list = await d.page.locator('[data-testid="item-row"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-item")));
  d.check("and their dishes are gone with them (Plain Idli, Rava Masala)", !list.includes("Plain Idli") && !list.includes("Rava Masala") && list.includes("Masala Dosa") && list.includes("South Indian Thali"), list.join(", "));
  d.check("the bulk bar went away", (await bulk.count()) === 0);
  await d.tab("customer", "Customer · Acme Momos storefront");
  await d.page.reload({ waitUntil: "load" });
  await d.page.waitForTimeout(600);
  const t2 = await ui.text(d);
  d.check("the storefront no longer shows them, but still shows Dosa", !/Idli & Vada|Rava Masala|Plain Idli/.test(t2) && /Masala Dosa/.test(t2));

  await d.step("Ticking two dishes and deleting them together", 400);
  await d.tab("owner", "Store dashboard · owner of Acme Momos");
  await selectCat("Dosa");
  await d.click(d.page.getByLabel("Select item Masala Dosa"), { after: 250 });
  await d.click(d.page.getByLabel("Select item Paneer Dosa"), { after: 250 });
  const ibulk = d.page.getByTestId("item-bulk");
  d.check("the items' bar says '2 selected'", (await ibulk.isVisible()) && /2 selected/.test(await ibulk.innerText()));
  await d.click(ibulk.getByRole("button", { name: /Delete selected/ }), { after: 500 });
  const idel = d.page.getByRole("dialog", { name: "Delete items" });
  await idel.waitFor({ timeout: 8000 });
  d.check("the dialog lists the two dishes", /Masala Dosa/.test(await idel.innerText()) && /Paneer Dosa/.test(await idel.innerText()));
  await d.click(idel.getByRole("button", { name: "Delete", exact: true }), { after: 1000 });
  await idel.waitFor({ state: "hidden", timeout: 8000 });
  await ui.until(async () => (await d.page.locator('[data-testid="item-row"]').count()) === 0, 10000);
  d.check("both dishes are gone; the category is empty", (await d.page.locator('[data-testid="item-row"]').count()) === 0 && /No items yet/.test(await ui.text(d)));
  await d.click(row("South Indian").locator("button", { hasText: "South Indian" }).first(), { after: 500 });
  list = await d.page.locator('[data-testid="item-row"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-item")));
  d.check("a dish that wasn't ticked is still there (South Indian Thali)", list.includes("South Indian Thali"), list.join(", "));

  await d.step("Dragging and dropping categories", 400);
  for (const n of ["North Indian", "Desserts"]) {
    await d.type(d.page.getByPlaceholder("New category"), n, { after: 200, delay: 15 });
    await d.press("Enter", 800);
    await row(n).waitFor({ timeout: 8000 });
  }
  const grip = (n) => row(n).locator('[title="Drag to move"]');
  const dragOnto = async (src, dst, where) => {
    const box = await row(dst).boundingBox();
    const y = where === "top" ? 3 : where === "bottom" ? box.height - 3 : box.height / 2;
    await grip(src).dragTo(row(dst), { targetPosition: { x: 150, y } });
    await d.page.waitForTimeout(900);
  };
  const indexOf = async (n) => (await rowNames()).indexOf(n);

  await dragOnto("Desserts", "North Indian", "middle");
  d.check("dropping Desserts on the middle of North Indian puts it INSIDE it (level 2, right under)", (await level("Desserts")) === 2 && (await indexOf("Desserts")) === (await indexOf("North Indian")) + 1, `${await level("Desserts")} · ${(await rowNames()).slice(-4).join(", ")}`);
  d.check("North Indian became a parent (a fold node with a line down)", (await row("North Indian").locator('[data-line="stem"]').count()) === 1);

  await dragOnto("Desserts", "South Indian", "top");
  d.check("dropping it on the TOP edge of South Indian puts it before South Indian, at the top level", (await level("Desserts")) === 1 && (await indexOf("Desserts")) === (await indexOf("South Indian")) - 1, (await rowNames()).slice(-5).join(", "));

  await dragOnto("Dosa", "North Indian", "middle");
  d.check("Dosa dragged out of South Indian into North Indian: now level 2 under North Indian", (await level("Dosa")) === 2 && (await indexOf("Dosa")) === (await indexOf("North Indian")) + 1);
  d.check("South Indian lost its children: its node is a plain dot again", (await row("South Indian").getByTestId("cat-node").evaluate((n) => n.tagName)) === "SPAN" && (await row("South Indian").locator('[data-line="stem"]').count()) === 0);

  const shape = async () => (await rowNames()).map((n) => `${n}:${0}`).join();
  const before = (await rowNames()).join("|") + "|" + (await level("North Indian")) + (await level("Dosa"));
  await dragOnto("North Indian", "Dosa", "middle");
  d.check("dropping a category into its own sub-category does nothing", (await rowNames()).join("|") + "|" + (await level("North Indian")) + (await level("Dosa")) === before);
  void shape;

  // a slow drag, to see the indicators on the way
  const g = await grip("Dosa").boundingBox();
  await d.page.mouse.move(g.x + 8, g.y + 10);
  await d.page.mouse.down();
  await d.page.mouse.move(g.x + 30, g.y + 50, { steps: 6 });
  d.check("while dragging, a strip appears for making it top-level", await d.page.getByTestId("drop-top-level").isVisible());
  const dess = await row("Desserts").boundingBox();
  await d.page.mouse.move(dess.x + 160, dess.y + 3, { steps: 8 });
  d.check("over a row's top edge a line shows where it would land", (await d.page.getByTestId("drop-line").count()) === 1);
  await d.page.mouse.move(dess.x + 160, dess.y + dess.height / 2, { steps: 5 });
  d.check("over a row's middle that row is outlined — 'inside'", (await row("Desserts").evaluate((e) => getComputedStyle(e).outlineStyle)) === "dashed" && (await d.page.getByTestId("drop-line").count()) === 0);
  await d.shot("category-drag-inside");
  await d.page.mouse.up();
  await d.page.waitForTimeout(900);
  d.check("letting go there puts Dosa inside Desserts", (await level("Dosa")) === 2 && (await indexOf("Dosa")) === (await indexOf("Desserts")) + 1);
  d.check("the strip and the indicators are gone", (await d.page.getByTestId("drop-top-level").count()) === 0 && (await d.page.getByTestId("drop-line").count()) === 0);

  // to the top level, by the strip below the tree
  const g2 = await grip("Dosa").boundingBox();
  await d.page.mouse.move(g2.x + 8, g2.y + 10);
  await d.page.mouse.down();
  await d.page.mouse.move(g2.x + 30, g2.y + 50, { steps: 6 });
  const strip = await d.page.getByTestId("drop-top-level").boundingBox();
  await d.page.mouse.move(strip.x + strip.width / 2, strip.y + strip.height / 2, { steps: 8 });
  await d.page.mouse.up();
  await d.page.waitForTimeout(900);
  names = await rowNames();
  d.check("dropping on the strip makes Dosa a top-level category, last", (await level("Dosa")) === 1 && names.at(-1) === "Dosa", names.slice(-4).join(", "));

  await d.page.reload({ waitUntil: "load" });
  await row("Dosa").waitFor({ timeout: 15000 });
  d.check("after a reload it is all where it was dropped (saved)", (await level("Dosa")) === 1 && (await level("Desserts")) === 1 && (await level("North Indian")) === 1 && (await indexOf("Desserts")) < (await indexOf("South Indian")));

  await d.step("Adding several categories at once — a box for each, with its own picture button", 400);
  const tree = await d.page.getByTestId("cat-tree").boundingBox();
  d.check("the category panel is wider than the old 300px column", tree.width > 300, `${Math.round(tree.width)}px`);
  await d.click(d.page.getByTestId("add-several"), { after: 500 });
  const dlg = d.page.getByRole("dialog", { name: "Add category" });
  await dlg.waitFor({ timeout: 8000 });
  const boxes = () => dlg.getByTestId("new-cat-row");
  const add = dlg.getByRole("button", { name: /^Add (\d+ categories|category)$/ });
  d.check("it opens with ONE box (and a picture button on it); nothing can be added until it has a name", (await boxes().count()) === 1 && (await boxes().first().getByRole("button", { name: /picture/i }).count()) === 1 && (await add.isDisabled()));
  await d.type(boxes().nth(0).getByRole("textbox"), "Soups", { after: 150, delay: 15 });
  await d.click(dlg.getByTestId("add-another"), { after: 300 });
  d.check("'Add another category' adds a second box, with the cursor in it", (await boxes().count()) === 2 && (await boxes().nth(1).getByRole("textbox").evaluate((e) => e === document.activeElement)));
  await d.type(boxes().nth(1).getByRole("textbox"), "Salads", { after: 150, delay: 15 });
  await d.press("Enter", 300);
  d.check("Enter in the last box (with a name) makes the next box and moves into it", (await boxes().count()) === 3 && (await boxes().nth(2).getByRole("textbox").evaluate((e) => e === document.activeElement)));
  await d.type(boxes().nth(2).getByRole("textbox"), "Fresh Juices", { after: 150, delay: 15 });
  d.check("the button counts them: 'Add 3 categories'", (await add.count()) === 1 && /Add 3 categories/.test(await add.innerText()));

  await boxes().nth(0).locator('input[type="file"]').setInputFiles(png);
  await boxes().nth(0).locator("img").first().waitFor({ timeout: 20000 });
  await boxes().nth(2).locator('input[type="file"]').setInputFiles(png);
  await boxes().nth(2).locator("img").first().waitFor({ timeout: 20000 });
  d.check("each box has its own picture: Soups and Fresh Juices show one, Salads doesn't", (await boxes().nth(0).locator("img").count()) === 1 && (await boxes().nth(1).locator("img").count()) === 0 && (await boxes().nth(2).locator("img").count()) === 1);
  d.check("the picture button of a box with a picture now says 'Change'", /Change/.test(await boxes().nth(0).innerText()) && /Picture/.test(await boxes().nth(1).innerText()));
  await d.shot("add-several-categories");

  await boxes().nth(1).getByRole("textbox").fill("soups ");
  d.check("the same name twice (any capitals) is flagged and can't be added", /in the list twice/.test(await dlg.innerText()) && (await add.isDisabled()));
  await boxes().nth(1).getByRole("textbox").fill("Salads");
  d.check("fixing it clears the message", !/in the list twice/.test(await dlg.innerText()) && (await add.isEnabled()));

  const deletes = [];
  d.page.on("request", (rq) => { if (rq.method() === "DELETE" && /storage\/object/.test(rq.url())) deletes.push(rq.postData() ?? ""); });
  await d.click(dlg.getByTestId("add-another"), { after: 300 });
  await boxes().nth(3).locator('input[type="file"]').setInputFiles(png);
  await boxes().nth(3).locator("img").first().waitFor({ timeout: 20000 });
  d.check("a picture on a box with no name is refused ('give each picture's category a name') and can't be added", /Give each picture/.test(await dlg.innerText()) && (await add.isDisabled()));
  await d.click(boxes().nth(3).getByRole("button", { name: /Remove .* from the list/ }), { after: 600 });
  d.check("removing that box clears the message, deletes the unused upload, and leaves three boxes", (await boxes().count()) === 3 && !/Give each picture/.test(await dlg.innerText()) && (await add.isEnabled()) && deletes.length === 1, `${await boxes().count()} boxes, ${deletes.length} delete request(s)`);

  await d.click(add, { after: 1200 });
  await dlg.waitFor({ state: "hidden", timeout: 8000 });
  for (const n of ["Soups", "Salads", "Fresh Juices"]) await row(n).waitFor({ timeout: 8000 });
  d.check("three top-level categories were made, in the order of the boxes", (await level("Soups")) === 1 && (await level("Salads")) === 1 && (await level("Fresh Juices")) === 1 && (await indexOf("Soups")) < (await indexOf("Salads")) && (await indexOf("Salads")) < (await indexOf("Fresh Juices")), (await rowNames()).slice(-3).join(", "));
  d.check("Soups and Fresh Juices show their own picture on the tree; Salads has none", (await row("Soups").locator("img").count()) === 1 && (await row("Salads").locator("img").count()) === 0 && (await row("Fresh Juices").locator("img").count()) === 1);
  await d.shot("several-categories-added");

  await d.step("Several sub-categories inside one, and cancelling throws away an unsaved picture", 400);
  await openActions("South Indian", "Add sub-category");
  const subDlg = d.page.getByRole("dialog", { name: "Add category" });
  await subDlg.waitFor({ timeout: 8000 });
  d.check("the window says where they will go, and 'Inside' is already South Indian", /inside .South Indian./.test(await subDlg.locator("h2").innerText()) && /South Indian/.test(await subDlg.getByLabel("Inside", { exact: true }).evaluate((e) => e.options[e.selectedIndex].textContent)));
  await d.type(subDlg.getByTestId("new-cat-row").nth(0).getByRole("textbox"), "Uttapam", { after: 100, delay: 15 });
  await d.click(subDlg.getByTestId("add-another"), { after: 300 });
  await d.type(subDlg.getByTestId("new-cat-row").nth(1).getByRole("textbox"), "Pongal", { after: 100, delay: 15 });
  await subDlg.getByTestId("new-cat-row").nth(1).locator('input[type="file"]').setInputFiles(png);
  await subDlg.getByTestId("new-cat-row").nth(1).locator("img").first().waitFor({ timeout: 20000 });
  const deletesBefore = deletes.length;
  await d.click(subDlg.getByRole("button", { name: "Cancel" }), { after: 900 });
  await subDlg.waitFor({ state: "hidden", timeout: 8000 });
  d.check("Cancel adds nothing and deletes the picture that was uploaded for it", (await row("Uttapam").count()) === 0 && (await row("Pongal").count()) === 0 && deletes.length === deletesBefore + 1, `${deletes.length - deletesBefore} delete request(s)`);

  await openActions("South Indian", "Add sub-category");
  await subDlg.waitFor({ timeout: 8000 });
  await d.type(subDlg.getByTestId("new-cat-row").nth(0).getByRole("textbox"), "Uttapam", { after: 100, delay: 15 });
  await d.click(subDlg.getByTestId("add-another"), { after: 300 });
  await d.type(subDlg.getByTestId("new-cat-row").nth(1).getByRole("textbox"), "Pongal", { after: 100, delay: 15 });
  await subDlg.getByTestId("new-cat-row").nth(1).locator('input[type="file"]').setInputFiles(png);
  await subDlg.getByTestId("new-cat-row").nth(1).locator("img").first().waitFor({ timeout: 20000 });
  await d.click(subDlg.getByRole("button", { name: "Add 2 categories" }), { after: 1200 });
  await subDlg.waitFor({ state: "hidden", timeout: 8000 });
  await row("Pongal").waitFor({ timeout: 8000 });
  d.check("this time both are made inside South Indian (level 2); Pongal has its picture, Uttapam none", (await level("Uttapam")) === 2 && (await level("Pongal")) === 2 && (await row("Pongal").locator("img").count()) === 1 && (await row("Uttapam").locator("img").count()) === 0);

  await d.page.reload({ waitUntil: "load" });
  await row("Pongal").waitFor({ timeout: 15000 });
  d.check("after a reload all five are still there with their pictures (saved)", (await row("Soups").locator("img").count()) === 1 && (await row("Pongal").locator("img").count()) === 1 && (await level("Soups")) === 1 && (await level("Uttapam")) === 2);
  d.check("the old comma-separated box is gone: the quick 'New category' box adds exactly what is typed", await (async () => {
    await d.type(d.page.getByPlaceholder("New category"), "Tea, Coffee", { after: 150, delay: 15 });
    await d.press("Enter", 900);
    await row("Tea, Coffee").waitFor({ timeout: 8000 });
    return (await row("Tea").count()) === 0 && (await row("Coffee").count()) === 0;
  })());
}
