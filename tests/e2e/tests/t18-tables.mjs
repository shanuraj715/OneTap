// T18 — Tables: creating, listing, grouping and removing tables in the dashboard, each table's QR panel, who may manage them, and that
// tables belong to one outlet of one store. All in Chrome as Acme Momos (Pro plan, two outlets; Main already has T1–T5) — the diner's
// side of a table (scanning, ordering, sessions) is T19.
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as ui from "../bench/ui.mjs";
import { BENCH } from "../bench/watch.mjs";

export const meta = {
  id: "t18-tables",
  title: "Tables — add a table (number, zone, seats), zones, limits and duplicates, QR panel, remove, per-outlet and per-store, who can manage",
  area: "tables",
  fresh: true,
  summary: "In Chrome as the owner of Acme Momos. The Tables & QR page lists the seeded tables grouped by zone, all Free, with their seats. Adding a table with a number, zone and seats puts it in its zone (a new zone gets its own group), a table without a zone lands in 'Main' with the default 4 seats, spaces around the number are trimmed, and the form empties. A duplicate number is refused, an empty number can't be sent, a 21-character number or 51 seats are refused, 50 seats is fine. Each table's QR panel shows its zone, seats and status, a QR image, the address the code opens (…/t/<id>?k=<code>, different for every table) and a PNG that downloads; a free table can be removed and its code then stops working. Tables belong to one outlet (the same number can exist in the other outlet) and to one store (another store sees only its own). The kitchen can look but not add, rotate or remove; a role without table access sees a notice.",
  expect: [
    "The Tables & QR page lists Ground floor (T1 4 seats, T2 2 seats, T3 6 seats) and Terrace (T4, T5 4 seats each), all 'Free'.",
    "Adding T9 / Rooftop / 6 seats shows a new 'Rooftop' group with 'T9 Free 6 seats' and empties the form (seats back to 4).",
    "A table added with no zone and no seats is in the 'Main' group with 4 seats; '  T11  ' is saved as 'T11'.",
    "A number already in use is refused with 'Table T9 already exists' and no second tile; an empty number is not submitted; 21 characters and 51 seats are refused; 50 seats is accepted.",
    "A table's panel shows 'Rooftop · 6 seats · Free', a QR image, an address of the form /t/<24 hex>?k=<24 characters> that differs for every table, a 'Download PNG' that really downloads a PNG, 'Rotate code', 'Remove table' and a link to the card designer.",
    "Removing a free table makes its tile disappear and its old code say 'That table code isn't valid'.",
    "The other outlet starts with no tables and can have its own T1 without clashing with Main's T1.",
    "The other store (Beta Bites) lists only its own T1 and T2.",
    "The kitchen sees the tables but has no 'Add a table', no 'Rotate code' and no 'Remove table'; the manager and cashier can add tables; an accountant sees 'Your role can't view tables' and no Tables item.",
  ],
  expectNot: [
    "A table number must NOT be saved twice in the same outlet.",
    "An empty number must NOT create a table.",
    "More than 50 seats, or a number over 20 characters, must NOT be accepted.",
    "A failed add must NOT empty the form or change the list.",
    "Tables of one store or outlet must NOT show in another.",
    "A role that can only look at tables must NOT be offered adding, rotating or removing.",
    "The browser must NOT log JavaScript errors.",
  ],
};

const OWNER = ["o@acme.test", "Owner123!"];
const DL_DIR = fileURLToPath(new URL("../.bench/downloads/", import.meta.url));
const norm = (t) => t.replace(/\s+/g, " ").trim();

export async function run(d, h) {
  mkdirSync(DL_DIR, { recursive: true });
  const tiles = async () => ui.tableTiles(d);
  const tileOf = async (n) => (await tiles()).find((t) => t.number === n);
  const numbers = async () => (await tiles()).map((t) => t.number);
  const page = async () => ui.text(d);
  const addForm = (label) => ui.F(d, label);

  await d.tab("dashboard", "Store dashboard · owner of Acme Momos");
  await ui.signIn(d, OWNER);

  // ------------------------------------------------------------------------------------------------------------- 1
  await d.step("The Tables & QR page lists the seeded tables by zone");
  await ui.openTables(d);
  const start = await tiles();
  d.check("five tables: T1, T2, T3, T4, T5, all Free", start.length === 5 && start.every((t) => t.status === "Free") && start.map((t) => t.number).join() === "T1,T2,T3,T4,T5", start.map((t) => t.text).join(" | "));
  d.check("seats are shown on each (4, 2, 6, 4, 4)", start.map((t) => t.seats).join() === "4,2,6,4,4");
  const t0 = await page();
  d.check("they are grouped by zone: Ground floor (T1–T3) and Terrace (T4, T5)", /Ground floor T1 Free 4 seats T2 Free 2 seats T3 Free 6 seats/.test(t0) && /Terrace T4 Free 4 seats T5 Free 4 seats/.test(t0));
  d.check("the page has the 'Tables & QR' and 'Table cards' tabs and an 'Add a table' form with Number, Zone, Seats (4 by default)", /Tables & QR/.test(t0) && /Table cards/.test(t0) && (await addForm("Number")) && (await (await addForm("Seats")).inputValue()) === "4");
  await d.shot("tables");

  // ------------------------------------------------------------------------------------------------------------- 2
  await d.step("Add a table: number, zone and seats");
  await ui.addTable(d, { number: "T9", zone: "Rooftop", seats: 6 });
  const t9 = await tileOf("T9");
  d.check("T9 appears as 'T9 Free 6 seats'", t9?.status === "Free" && t9?.seats === 6, t9?.text);
  d.check("a new 'Rooftop' group holds it", /Rooftop T9 Free 6 seats/.test(await page()));
  const nowNumbers = await numbers();
  d.check("the other tables are unchanged (six in all)", nowNumbers.length === 6 && start.every((s) => nowNumbers.includes(s.number)), nowNumbers.join());
  d.check("the form is emptied after a successful add (Number and Zone empty, Seats back to 4)", (await (await addForm("Number")).inputValue()) === "" && (await (await addForm("Zone")).inputValue()) === "" && (await (await addForm("Seats")).inputValue()) === "4");
  await ui.addTable(d, { number: "T10" });
  const t10 = await tileOf("T10");
  d.check("a table with no zone and no seats typed is saved with the default 4 seats", t10?.seats === 4 && t10?.status === "Free", t10?.text);
  d.check("…and sits in the 'Main' group", /Main T10 Free 4 seats/.test(await page()));
  await ui.addTable(d, { number: "  T11  ", zone: "Rooftop", seats: 2 });
  d.check("spaces around a number are trimmed ('  T11  ' → T11)", (await numbers()).includes("T11") && !(await numbers()).some((n) => n !== n.trim()));
  d.check("T11 joins the Rooftop group", /Rooftop (T11 Free 2 seats T9|T9 Free 6 seats T11)/.test(await page()) || (/Rooftop/.test(await page()) && (await tileOf("T11"))?.seats === 2));

  // ------------------------------------------------------------------------------------------------------------- 3
  await d.step("Duplicates and limits");
  const before = (await tiles()).length;
  await ui.addTable(d, { number: "T9", zone: "Rooftop", seats: 6 });
  d.check("a number already in use is refused: 'Table T9 already exists'", /Table T9 already exists/.test(await page()));
  d.never("a second T9 was added", (await tiles()).filter((t) => t.number === "T9").length !== 1 || (await tiles()).length !== before);
  d.check("a refused add leaves what was typed in the form (nothing is lost)", (await (await addForm("Number")).inputValue()) === "T9");
  await ui.addTable(d, { number: "", zone: "", seats: 4 });
  d.never("an empty number created a table", (await tiles()).length !== before);
  d.check("the browser asks for the number ('Please fill out this field')", (await (await addForm("Number")).evaluate((e) => e.required && !e.validity.valid)));
  await ui.addTable(d, { number: "ABCDEFGHIJKLMNOPQRSTU", zone: "", seats: 4 });
  d.check("a number of 21 characters is refused", /Validation failed/.test(await page()) && (await tiles()).length === before, (await page()).match(/Validation failed/)?.[0]);
  d.never("the 21-character number was saved", (await numbers()).includes("ABCDEFGHIJKLMNOPQRSTU"));
  await ui.addTable(d, { number: "BIG", zone: "", seats: 51 });
  d.check("51 seats is refused", /Validation failed/.test(await page()) && !(await numbers()).includes("BIG"));
  await ui.addTable(d, { number: "BIG", zone: "Hall", seats: 50 });
  d.check("50 seats is accepted", (await tileOf("BIG"))?.seats === 50, (await tileOf("BIG"))?.text);
  d.finding("A refused table (too long a number, too many seats) says only 'Validation failed' — it doesn't say which box is wrong.");
  await ui.addTable(d, { number: "Z0", zone: "Hall", seats: 0 });
  const z0 = await tileOf("Z0");
  d.check("0 seats is not refused — it becomes the default 4", z0?.seats === 4, z0?.text);
  d.finding("Typing 0 (or nothing) as the seats quietly saves 4 seats instead of saying 0 isn't allowed.");
  await ui.addTable(d, { number: "t9", zone: "Rooftop", seats: 4 });
  d.check("numbers are case-sensitive: 't9' is accepted next to 'T9'", (await numbers()).includes("t9") && (await numbers()).includes("T9"));
  d.finding("'T9' and 't9' count as different tables — two tables that look alike to a person can both exist.");

  // ------------------------------------------------------------------------------------------------------------- 4
  await d.step("A table's panel: QR image, address, download, rotate, remove");
  const { dlg, url: urlT9 } = await ui.openTableQr(d, "T9");
  d.check("the panel says 'Table T9' and 'Rooftop · 6 seats · Free'", /Table T9/.test(await dlg.innerText()) && /Rooftop · 6 seats · Free/.test(norm(await dlg.innerText())), norm(await dlg.innerText()).slice(0, 80));
  const img = dlg.locator("img");
  d.check("it shows a QR image (a real 512-pixel picture, labelled for screen readers)", (await img.getAttribute("alt")) === "QR code for table T9" && (await img.evaluate((e) => e.complete && e.naturalWidth >= 256)));
  d.check("the address printed under it is /t/<id>?k=<code> on the store's own site", /^http:\/\/localhost:3170\/t\/[0-9a-f]{24}\?k=[\w-]{24}$/.test(urlT9), urlT9);
  const link = dlg.getByRole("link", { name: "Download PNG" });
  d.check("'Download PNG' is named table-T9-qr.png", (await link.getAttribute("download")) === "table-T9-qr.png");
  const [file] = await Promise.all([d.page.waitForEvent("download", { timeout: 15000 }), d.click(link, { after: 500 })]);
  const png = `${DL_DIR}${Date.now()}-${file.suggestedFilename()}`;
  await file.saveAs(png);
  const head = readFileSync(png).subarray(0, 8);
  d.check("…and the file that downloads is a real PNG", file.suggestedFilename() === "table-T9-qr.png" && head.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])));
  d.check("'Rotate code', 'Remove table', 'Done' and the link to the card designer are there", (await dlg.getByRole("button", { name: "Rotate code" }).count()) === 1 && (await dlg.getByRole("button", { name: "Remove table" }).count()) === 1 && (await dlg.getByRole("button", { name: "Done" }).count()) === 1 && (await dlg.getByRole("link", { name: /Design a printable card/ }).count()) === 1);
  await d.shot("qr-panel");
  await d.click(dlg.getByRole("button", { name: "Done" }), { after: 400 });
  const urlT10 = await ui.tableQrUrl(d, "T10");
  const urlT1 = await ui.tableQrUrl(d, "T1");
  const ids = [urlT9, urlT10, urlT1].map((u) => u.match(/\/t\/([0-9a-f]{24})/)[1]);
  const codes = [urlT9, urlT10, urlT1].map((u) => u.match(/k=([\w-]+)/)[1]);
  d.check("every table has its own address and its own code", new Set(ids).size === 3 && new Set(codes).size === 3, [urlT9, urlT10, urlT1].join(" | "));
  const { dlg: dlg2 } = await ui.openTableQr(d, "T9");
  await d.click(dlg2.getByRole("link", { name: /Design a printable card/ }), { after: 900 });
  d.check("'Design a printable card' opens the Table cards page", /\/table-cards/.test(d.page.url()));

  await d.step("Remove a table: it disappears and its printed code stops working");
  await ui.openTables(d);
  const urlT11 = await ui.tableQrUrl(d, "T11");
  d.check("before removing, T11's code opens its page (the storefront says 'Ordering to Table T11')", await (async () => { await d.tab("customer", "Customer · scanning a table code"); const r = await ui.visit(d, urlT11); return /Ordering to Table T11/.test(r.text); })());
  await d.tab("dashboard", "Store dashboard · owner of Acme Momos");
  const { dlg: dlg3 } = await ui.openTableQr(d, "T11");
  await d.click(dlg3.getByRole("button", { name: "Remove table" }), { after: 1200 });
  d.check("the panel closes and T11 is gone from the page", !(await numbers()).includes("T11") && (await dlg3.count()) === 0);
  d.check("the other tables are still there", (await numbers()).includes("T9") && (await numbers()).includes("T10"));
  await d.tab("customer", "Customer · scanning a table code");
  const gone = await ui.visit(d, urlT11);
  d.check("the removed table's code now says 'That table code isn't valid'", /This code didn't work/.test(gone.text) && /That table code isn't valid/.test(gone.text), gone.text.slice(0, 160));
  d.never("a removed table's code still opens the menu", /Ordering to Table T11/.test(gone.text));

  // ------------------------------------------------------------------------------------------------------------- 5
  await d.step("Tables belong to one outlet, and to one store");
  await d.tab("dashboard", "Store dashboard · owner of Acme Momos");
  await ui.openTables(d);
  const mainBefore = (await numbers()).length;
  const mainT1Url = await ui.tableQrUrl(d, "T1");
  await ui.switchOutlet(d, "Second");
  await ui.openTables(d);
  d.check("the other outlet, Second, starts with no tables", (await tiles()).length === 0, (await numbers()).join());
  await ui.addTable(d, { number: "T1", zone: "", seats: 8 });
  d.check("it can have its own T1 (the same number as Main's)", (await tileOf("T1"))?.seats === 8 && !/already exists/.test(await page()), (await tileOf("T1"))?.text);
  const secondT1Url = await ui.tableQrUrl(d, "T1");
  d.check("…with a different code from Main's T1", secondT1Url !== mainT1Url && secondT1Url.match(/\/t\/(\w+)/)[1] !== mainT1Url.match(/\/t\/(\w+)/)[1]);
  d.never("Second shows any of Main's tables", (await numbers()).some((n) => ["T2", "T3", "T9", "T10"].includes(n)));
  await ui.switchOutlet(d, "Main");
  await ui.openTables(d);
  d.check("back on Main, nothing changed: the same tables, T1 still 4 seats", (await tiles()).length === mainBefore && (await tileOf("T1"))?.seats === 4, `${(await tiles()).length} tables`);
  await ui.signIn(d, ["o@beta.test", "Owner123!"]);
  await ui.openTables(d);
  d.check("another store (Beta Bites) lists only its own tables: T1 and T2", (await numbers()).join() === "T1,T2", (await numbers()).join());
  d.never("another store sees Acme's tables (T3, T9, T10…)", (await numbers()).some((n) => !["T1", "T2"].includes(n)));
  const betaT1 = await ui.tableQrUrl(d, "T1");
  d.check("…and its T1 has a code of its own", ![mainT1Url, secondT1Url].includes(betaT1));

  // ------------------------------------------------------------------------------------------------------------- 6
  await d.step("Who may manage tables");
  await ui.signIn(d, ["k@acme.test", "Kitchen123!"]);
  await d.goto(`${BENCH.admin}/tables`, 800);
  await d.page.getByRole("button", { name: /^T1/ }).first().waitFor({ timeout: 15000 });
  d.check("the kitchen sees the tables (T1, T2, T3 …)", (await numbers()).includes("T1") && (await numbers()).includes("T3"));
  d.never("the kitchen is offered 'Add a table'", (await d.page.getByText("Add a table").count()) > 0 || (await d.page.getByRole("button", { name: "Add table" }).count()) > 0);
  const { dlg: kd } = await ui.openTableQr(d, "T1");
  d.check("…can open a table's QR and download it", (await kd.getByRole("link", { name: "Download PNG" }).count()) === 1);
  d.never("the kitchen is offered Rotate code or Remove table", (await kd.getByRole("button", { name: "Rotate code" }).count()) > 0 || (await kd.getByRole("button", { name: "Remove table" }).count()) > 0);
  await ui.signIn(d, ["m@acme.test", "Manager123!"]);
  await ui.openTables(d);
  await ui.addTable(d, { number: "M1", zone: "Hall", seats: 2 });
  d.check("the manager can add a table", (await tileOf("M1"))?.seats === 2);
  await ui.signIn(d, ["s@acme.test", "Staff1234!"]);
  await ui.openTables(d);
  await ui.addTable(d, { number: "C1", zone: "Hall", seats: 2 });
  d.check("the cashier can add a table", (await tileOf("C1"))?.seats === 2);
  await ui.signIn(d, ["a@mart.test", "Account123!"]);
  d.never("an accountant has a Tables item in the sidebar", (await ui.sidebarGroups(d)).some((g) => g.items.includes("Tables")));
  await d.goto(`${BENCH.admin}/tables`, 800);
  await d.page.getByText("Your role can't view tables.").waitFor({ timeout: 15000 });
  d.check("an accountant opening /tables is told 'Your role can't view tables.'", true);
  d.never("an accountant sees tables or the add form", (await d.page.locator("button.ot-press").count()) > 0 || (await d.page.getByText("Add a table").count()) > 0);

  d.never("the browser logged JavaScript errors", d.problems.length > 0, d.problems.join(" | "));
}
