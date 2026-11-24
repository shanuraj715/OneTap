// T46 — Add-on groups in the dashboard: the tick-list in the dish editor runs in several columns, and a group can be edited after it is made.
import { BENCH } from "../bench/watch.mjs";
import * as ui from "../bench/ui.mjs";

export const meta = {
  id: "t46-addon-groups",
  title: "Add-on groups — the list is multi-column (dish editor and the groups list) and a group can be edited after creation (name, option names and prices, add/remove options)",
  area: "menu",
  fresh: false,
  summary: "Through the bench API it makes ~16 groups called 'T46 …' (a four-option dip group, a pick-one group, a required group, a 2-option group that is grown, a one-option group, and a dozen fillers). In Chrome as the owner of Acme Momos: (1) Menu → Veg Steamed Momos → Edit — the 'Add-on groups' tick-list runs across several columns (not one long column), nothing crosses the box's edge, stays inside the window on a phone width, says '1 option' / '4 options', and ticking two groups then saving attaches them to the dish. (2) The Add-on groups card at the bottom of the Menu page also lists the groups in columns. (3) ✎ on 'T46 Dips' opens an editor across the full width showing the name and its four options with their prices; rename it, change a price, rename an option, remove one, add one, Save — the group (same id) has the new name, the right options and prices, the options that were kept still have their ORIGINAL ids, the new one has a fresh id, the dish still has the group, and the list shows the new text. (4) Mistakes are refused with a message and change nothing: empty name, empty option name, negative price, no options at all; Cancel discards typing. (5) Rules stay right: a pick-one group stays pick-one after an option is added; a 'required, choose 1' group stays required after a rename; an 'any number' group keeps allowing any number as options are added and removed (down to one). (6) On the storefront the dish's pop-up shows the renamed group and the new prices, not the removed option. Everything made is deleted and the dish's own add-on groups are put back.",
  expect: [
    "The dish editor's Add-on groups list uses several columns, stays inside its box and the window, and says '1 option' for one.",
    "The groups list under the menu is multi-column too.",
    "Every group has an edit (✎) button; the editor shows the group's name and options with prices and spans the full width.",
    "After Save the group has the new name, options and prices; kept options keep their ids, a new one gets a new id; items that use the group still do.",
    "Empty name / empty option name / negative price / no options are refused with a message and nothing is saved; Cancel discards.",
    "Pick-one stays pick-one, required stays required, 'any number' follows the number of options.",
    "The storefront pop-up shows the edited group.",
  ],
  expectNot: [
    "An edit must NOT change the group's id or the ids of options that were kept.",
    "A refused save must NOT change the group.",
    "Editing must NOT detach the group from the dishes that use it.",
    "The tick-list must NOT be one long column on a wide screen.",
    "The browser must NOT log JavaScript errors.",
  ],
};

export async function run(d) {
  const login = async (email, pw) => (await fetch(`${BENCH.api}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: pw }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const ownerCookie = await login(...BENCH.logins.owner);
  const outlets = await (await fetch(`${BENCH.api}/api/outlets`, { headers: { cookie: ownerCookie } })).json();
  const main = (outlets.outlets ?? outlets).find((o) => o.slug === "main");
  const outletId = String(main._id ?? main.id);
  const hdr = { "content-type": "application/json", cookie: ownerCookie, "x-rasoipulse-outlet": outletId };
  const menuNow = async () => (await (await fetch(`${BENCH.api}/api/menu?outletId=${outletId}`)).json());
  const groupNamed = async (name) => (await menuNow()).modifierGroups.find((g) => g.name === name);
  const makeGroup = async (body) => (await (await fetch(`${BENCH.api}/api/menu/modifier-groups`, { method: "POST", headers: hdr, body: JSON.stringify(body) })).json()).group;
  const dropGroup = (id) => fetch(`${BENCH.api}/api/menu/modifier-groups/${id}`, { method: "DELETE", headers: hdr });
  const dishNow = async () => (await menuNow()).items.find((i) => i.name === "Veg Steamed Momos");
  const rupee = (r) => Math.round(r * 100);

  /* ------------------------------------------------------------------ set up the groups */
  for (const g of (await menuNow()).modifierGroups.filter((g) => g.name.startsWith("T46 "))) await dropGroup(g.id); // leftovers of an aborted run
  const dish0 = await dishNow();
  const originalGroupIds = dish0.modifierGroupIds;
  const opts = (...pairs) => pairs.map(([label, price]) => ({ label, priceDelta: rupee(price) }));
  await makeGroup({ name: "T46 Dips", maxSelect: 4, options: opts(["Mint Dip", 10], ["Cheese Dip", 30], ["Mayo", 15], ["Schezwan", 20]) });
  await makeGroup({ name: "T46 Pick one", maxSelect: 1, options: opts(["Mild", 0], ["Medium", 0]) });
  await makeGroup({ name: "T46 Required", required: true, minSelect: 1, maxSelect: 1, options: opts(["Veg", 0], ["Non-veg", 20]) });
  await makeGroup({ name: "T46 Grow", maxSelect: 2, options: opts(["One", 5], ["Two", 6]) });
  await makeGroup({ name: "T46 One", maxSelect: 1, options: opts(["Only choice", 0]) });
  for (let i = 1; i <= 11; i++) await makeGroup({ name: `T46 Filler ${String(i).padStart(2, "0")}`, maxSelect: 2, options: opts([`Extra ${i}`, i], [`More ${i}`, i + 1]) });
  const allGroups = (await menuNow()).modifierGroups;
  const dips0 = await groupNamed("T46 Dips");

  const layout = (testid) => d.page.evaluate((tid) => {
    const box = document.querySelector(`[data-testid="${tid}"]`);
    const kids = [...box.children];
    const b = box.getBoundingClientRect();
    const r = kids.map((k) => k.getBoundingClientRect());
    return {
      n: kids.length,
      cols: new Set(r.map((x) => Math.round(x.left))).size,
      rows: new Set(r.map((x) => Math.round(x.top))).size,
      crossing: r.filter((x) => x.right > b.right + 1 || x.left < b.left - 1).length,
      width: Math.round(b.width),
      sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  }, testid);
  const put = async (loc, v) => { await d.click(loc, { after: 80 }); await loc.fill(String(v)); };
  const editor = () => d.page.getByTestId("group-editor");
  const openEditor = async (name) => {
    await d.click(d.page.locator(`[data-testid="group-row"][data-group="${name}"]`).getByTestId("group-edit"), { after: 400 });
    await editor().waitFor({ timeout: 8000 });
  };
  const optionRows = () => editor().getByTestId("group-option");
  const read = async () => {
    const rows = await optionRows().all();
    return Promise.all(rows.map(async (r) => [await r.getByTestId("group-option-label").inputValue(), await r.getByTestId("group-option-price").inputValue()]));
  };
  const closed = () => ui.until(async () => (await editor().count()) === 0, 8000);
  const sameGroup = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  /* ------------------------------------------------------------------ the dish editor's tick-list */
  await d.step("The dish editor's Add-on groups list runs across several columns", 400);
  await ui.signIn(d, "owner");
  await d.goto(BENCH.admin + "/menu", 800);
  await d.click(d.page.locator('[data-testid="cat-row"][data-category="Steamed Momos"] button', { hasText: "Steamed Momos" }).first(), { after: 600 });
  const row = d.page.locator('[data-testid="item-row"][data-item="Veg Steamed Momos"]');
  await row.waitFor({ timeout: 10000 });
  await d.click(row.getByTitle("Edit"), { after: 700 });
  await d.page.getByTestId("item-addon-groups").waitFor({ timeout: 8000 });
  const L = await layout("item-addon-groups");
  d.check("every group is listed", L.n === allGroups.length, `${L.n} of ${allGroups.length}`);
  d.check("the list uses several columns on a wide screen", L.cols >= 2, `${L.cols} columns, ${L.rows} rows, ${L.n} groups`);
  d.never("the list is one long column on a wide screen", L.cols < 2 || L.rows >= L.n, `${L.cols} columns`);
  d.check("nothing crosses the edge of its box", L.crossing === 0, `${L.crossing} crossing`);
  const one = d.page.locator('[data-testid="item-addon-group"][data-group="T46 One"]');
  const dipsBox = d.page.locator('[data-testid="item-addon-group"][data-group="T46 Dips"]');
  d.check("one option reads '1 option'", /1 option(?!s)/.test(await one.innerText()), (await one.innerText()).replace(/\s+/g, " "));
  d.check("four options read '4 options'", /4 options/.test(await dipsBox.innerText()));
  await d.shot("addon-groups-checklist");
  await d.page.setViewportSize({ width: 420, height: 900 });
  await d.pause(300);
  const P = await layout("item-addon-groups");
  d.check("on a phone-width window the list stays inside its box and the window", P.crossing === 0 && !P.sideways, `${P.cols} column(s), crossing ${P.crossing}, sideways ${P.sideways}`);
  await d.page.setViewportSize({ width: 1440, height: 900 });
  await d.pause(300);

  await d.step("Ticking groups and saving still attaches them", 400);
  await ui.tick(d, "T46 Dips", true);
  await ui.tick(d, "T46 Required", true);
  await d.click(d.page.getByRole("button", { name: "Save changes" }), { after: 1200 });
  const dishA = await dishNow();
  d.check("the dish now has both ticked groups", dishA.modifierGroupIds.includes(dips0.id) && dishA.modifierGroupIds.includes((await groupNamed("T46 Required")).id), `${dishA.modifierGroupIds.length} groups`);

  /* ------------------------------------------------------------------ the groups list under the menu */
  await d.step("The groups list at the bottom of the Menu page is multi-column too", 400);
  await d.page.getByTestId("group-list").scrollIntoViewIfNeeded();
  const G = await layout("group-list");
  d.check("every group has a row", G.n === allGroups.length, `${G.n} of ${allGroups.length}`);
  d.check("the rows run across several columns", G.cols >= 2 && G.rows < G.n, `${G.cols} columns, ${G.rows} rows`);
  d.check("each row has an edit button", (await d.page.getByTestId("group-edit").count()) === allGroups.length, `${await d.page.getByTestId("group-edit").count()} buttons`);
  await d.shot("addon-groups-list");

  /* ------------------------------------------------------------------ editing */
  await d.step("Editing a group: rename it, change a price, rename an option, remove one, add one", 400);
  await openEditor("T46 Dips");
  const listWidth = (await layout("group-list")).width;
  const edBox = await editor().boundingBox();
  d.check("the editor spans the full width of the list", edBox.width >= listWidth - 2, `${Math.round(edBox.width)} of ${listWidth}`);
  d.check("it shows the group's name", (await d.page.getByTestId("group-name").inputValue()) === "T46 Dips");
  d.check("it shows the four options with their prices", sameGroup(await read(), [["Mint Dip", "10"], ["Cheese Dip", "30"], ["Mayo", "15"], ["Schezwan", "20"]]), JSON.stringify(await read()));
  d.check("it says any number can be picked", /pick any number/i.test(await d.page.getByTestId("group-rule").innerText()));
  await d.shot("addon-group-editor");
  await put(d.page.getByTestId("group-name"), "T46 Dips & Sauces");
  await put(optionRows().nth(1).getByTestId("group-option-price"), "35");
  await put(optionRows().nth(2).getByTestId("group-option-label"), "Mayonnaise");
  await d.click(optionRows().nth(3).getByTestId("group-option-remove"), { after: 200 });
  d.check("removing a row takes it out of the editor", (await optionRows().count()) === 3);
  await d.click(d.page.getByTestId("group-option-add"), { after: 200 });
  await put(optionRows().nth(3).getByTestId("group-option-label"), "Garlic Dip");
  await put(optionRows().nth(3).getByTestId("group-option-price"), "25");
  await d.click(d.page.getByTestId("group-save"), { after: 900 });
  d.check("the editor closes after saving", await closed());
  const dips1 = await groupNamed("T46 Dips & Sauces");
  d.check("the group has the new name", Boolean(dips1));
  d.check("it is the same group (same id)", dips1?.id === dips0.id);
  d.check("it has the four options in the new order", sameGroup(dips1?.options.map((o) => o.label), ["Mint Dip", "Cheese Dip", "Mayonnaise", "Garlic Dip"]), JSON.stringify(dips1?.options.map((o) => o.label)));
  d.check("the prices are right (₹10, ₹35, ₹15, ₹25)", sameGroup(dips1?.options.map((o) => o.priceDelta), [1000, 3500, 1500, 2500]), JSON.stringify(dips1?.options.map((o) => o.priceDelta)));
  d.never("a kept option got a different id", !sameGroup(dips1.options.slice(0, 3).map((o) => o.id), dips0.options.slice(0, 3).map((o) => o.id)), "ids of Mint Dip / Cheese Dip / Mayonnaise");
  d.check("the new option has an id of its own", Boolean(dips1.options[3].id) && !dips0.options.some((o) => o.id === dips1.options[3].id));
  d.check("it still allows any number to be picked (max follows the 4 options)", dips1.maxSelect === 4 && dips1.minSelect === 0, `${dips1.minSelect}–${dips1.maxSelect}`);
  d.never("editing detached the group from the dish", !(await dishNow()).modifierGroupIds.includes(dips0.id));
  const rowText = await d.page.locator('[data-testid="group-row"][data-group="T46 Dips & Sauces"]').innerText();
  d.check("the list shows the new name and options", /Mayonnaise \+₹15/.test(rowText) && /Garlic Dip \+₹25/.test(rowText) && !/Schezwan/.test(rowText), rowText.replace(/\s+/g, " "));

  /* ------------------------------------------------------------------ mistakes */
  await d.step("Mistakes are refused and change nothing; Cancel discards", 400);
  const pick0 = await groupNamed("T46 Pick one");
  const untouched = async () => sameGroup(await groupNamed("T46 Pick one"), pick0);
  await openEditor("T46 Pick one");
  await put(d.page.getByTestId("group-name"), "");
  await d.click(d.page.getByTestId("group-save"), { after: 500 });
  d.check("an empty name is refused with a message", /Give the group a name/.test(await ui.text(d)));
  d.check("…and the editor stays open", (await editor().count()) === 1);
  await put(d.page.getByTestId("group-name"), "T46 Pick one");
  await put(optionRows().nth(0).getByTestId("group-option-label"), "");
  await d.click(d.page.getByTestId("group-save"), { after: 500 });
  d.check("an option without a name is refused", /Every option needs a name/.test(await ui.text(d)));
  await put(optionRows().nth(0).getByTestId("group-option-label"), "Mild");
  await put(optionRows().nth(1).getByTestId("group-option-price"), "-5");
  await d.click(d.page.getByTestId("group-save"), { after: 500 });
  d.check("a negative price is refused", /extra price must be 0 or more/.test(await ui.text(d)));
  await put(optionRows().nth(1).getByTestId("group-option-price"), "0");
  await d.click(optionRows().nth(1).getByTestId("group-option-remove"), { after: 150 });
  await d.click(optionRows().nth(0).getByTestId("group-option-remove"), { after: 150 });
  d.check("all options can be taken out of the editor…", (await optionRows().count()) === 0);
  await d.click(d.page.getByTestId("group-save"), { after: 500 });
  d.check("…but a group with no options is refused", /needs at least one option/.test(await ui.text(d)));
  d.never("a refused save changed the group", !(await untouched()));
  await put(d.page.getByTestId("group-name"), "T46 Typed and thrown away");
  await d.click(d.page.getByTestId("group-cancel"), { after: 500 });
  d.check("Cancel closes the editor", await closed());
  d.check("…and the typing is gone", (await d.page.locator('[data-testid="group-row"][data-group="T46 Pick one"]').count()) === 1 && (await d.page.getByText("T46 Typed and thrown away").count()) === 0);
  d.never("Cancel changed the group", !(await untouched()));

  /* ------------------------------------------------------------------ rules */
  await d.step("Rules stay right after an edit", 400);
  await openEditor("T46 Pick one");
  d.check("a pick-one group says so", /Choose up to 1/.test(await d.page.getByTestId("group-rule").innerText()), await d.page.getByTestId("group-rule").innerText());
  await d.click(d.page.getByTestId("group-option-add"), { after: 200 });
  await put(optionRows().nth(2).getByTestId("group-option-label"), "Hot");
  await d.click(d.page.getByTestId("group-save"), { after: 900 });
  await closed();
  const pick1 = await groupNamed("T46 Pick one");
  d.check("a third option was added", pick1.options.length === 3 && pick1.options[2].label === "Hot", JSON.stringify(pick1.options.map((o) => o.label)));
  d.check("a pick-one group is still pick-one", pick1.maxSelect === 1, `max ${pick1.maxSelect}`);

  await openEditor("T46 Required");
  d.check("a required group says 'Required · choose 1'", /Required · choose 1/.test(await d.page.getByTestId("group-rule").innerText()), await d.page.getByTestId("group-rule").innerText());
  await put(d.page.getByTestId("group-name"), "T46 Required Choice");
  await d.click(d.page.getByTestId("group-save"), { after: 900 });
  await closed();
  const req1 = await groupNamed("T46 Required Choice");
  d.check("it was renamed and is still required, choose 1", Boolean(req1) && req1.required === true && req1.minSelect === 1 && req1.maxSelect === 1, JSON.stringify(req1 && { r: req1.required, min: req1.minSelect, max: req1.maxSelect }));
  d.check("it is still on the dish", (await dishNow()).modifierGroupIds.includes(req1.id));

  await openEditor("T46 Grow");
  await d.click(d.page.getByTestId("group-option-add"), { after: 150 });
  await put(optionRows().nth(2).getByTestId("group-option-label"), "Three");
  await d.click(d.page.getByTestId("group-option-add"), { after: 150 });
  await put(optionRows().nth(3).getByTestId("group-option-label"), "Four");
  await d.click(d.page.getByTestId("group-save"), { after: 900 });
  await closed();
  const grow1 = await groupNamed("T46 Grow");
  d.check("an any-number group allows any number of its four options", grow1.options.length === 4 && grow1.maxSelect === 4, `${grow1.options.length} options, max ${grow1.maxSelect}`);
  await openEditor("T46 Grow");
  for (let i = 0; i < 3; i++) await d.click(optionRows().nth(0).getByTestId("group-option-remove"), { after: 120 });
  await d.click(d.page.getByTestId("group-save"), { after: 900 });
  await closed();
  const grow2 = await groupNamed("T46 Grow");
  d.check("taken down to one option it allows exactly one pick", grow2.options.length === 1 && grow2.maxSelect === 1 && grow2.minSelect === 0, `${grow2.options.length} option, ${grow2.minSelect}–${grow2.maxSelect}`);
  d.check("the original last option kept its id", grow2.options[0].id === grow1.options[3].id);

  /* ------------------------------------------------------------------ storefront */
  await d.step("The storefront shows the edited group", 400);
  await d.goto(BENCH.storefront + "/main", 900);
  const sees = async () => {
    await d.click(d.page.getByRole("button", { name: /^add Veg Steamed Momos$/i }), { after: 500 });
    const dlg = d.page.getByRole("dialog", { name: "Veg Steamed Momos" });
    await dlg.waitFor({ timeout: 8000 });
    const t = (await dlg.innerText()).replace(/\s+/g, " ");
    await d.page.keyboard.press("Escape");
    await d.pause(500);
    return t;
  };
  let popup = "";
  const ok = await ui.reloadUntil(d, async () => { popup = await sees(); return /T46 Dips & Sauces/i.test(popup); }, 45000);
  d.check("the pop-up shows the renamed group", ok, popup.slice(0, 200));
  d.check("…with the new prices and options", /Cheese Dip\s*\+₹35/i.test(popup) && /Garlic Dip\s*\+₹25/i.test(popup) && /Mayonnaise/i.test(popup), popup.slice(0, 300));
  d.never("the removed option is still offered", /Schezwan/i.test(popup));
  d.never("the old group name is still shown", /T46 Dips(?! &)/i.test(popup));
  await d.shot("addon-group-storefront");

  /* ------------------------------------------------------------------ tidy up */
  await fetch(`${BENCH.api}/api/menu/items/${dish0.id}`, { method: "PATCH", headers: hdr, body: JSON.stringify({ modifierGroupIds: originalGroupIds }) });
  for (const g of (await menuNow()).modifierGroups.filter((g) => g.name.startsWith("T46 "))) await dropGroup(g.id);
  const left = (await menuNow()).modifierGroups.filter((g) => g.name.startsWith("T46 ")).length;
  d.check("everything the test made was removed", left === 0 && sameGroup((await dishNow()).modifierGroupIds, originalGroupIds), `${left} left`);
}
