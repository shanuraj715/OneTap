// T19 — Dine-in from a table: staff create tables, a diner scans a table's code, signs in and sends orders to the kitchen on one running
// tab, staff see who is seated and move / settle / void the party, another visitor is turned away from an occupied table, codes can be
// rotated, and the whole thing can be switched off. All in Chrome: the dashboard (owner of Acme Momos) and the storefront (the diner).
import * as ui from "../bench/ui.mjs";
import { BENCH } from "../bench/watch.mjs";

export const meta = {
  id: "t19-dine-in",
  title: "Dine-in at a table — create tables, scan the QR, order onto a running tab, staff move / settle / void, occupied tables, rotated codes, switch-off",
  area: "tables",
  fresh: true,
  summary: "In Chrome. The owner of Acme Momos adds three tables (D1, D2, D3) and copies D1's code. A diner opens it: the menu says 'Ordering to Table D1' with no takeaway/delivery choice, the order page asks them to sign in, never asks for a table number, and sends the order 'to the kitchen' as a dine-in order on a running tab (₹70). Back on the menu the same diner still can order (₹60 more, tab ₹130) while a stranger scanning the same code is told another party is seated and can't order. The dashboard shows the party under 'Seated now' with its orders and tab; staff move the party to D2 (the orders follow, D1 needs cleaning), can't close a table that still owes money (a message says how much), confirm payment, mark the table vacant and cleaned. A second diner at D3 is voided by staff (orders cancelled, table freed) and a seated table can't be removed until then. Rotating a table's code kills the printed one, forged and unknown codes are refused, and switching Dine-in QR ordering off in Settings makes every code say table ordering is off until it is switched back on.",
  expect: [
    "Scanning D1 shows 'Table D1', 'Ordering to Table D1' and the menu, with no Takeaway/Delivery choice.",
    "Checking out from a table asks the diner to sign in, shows 'Table D1 — joins your running tab', never asks for a table number, and the button says 'Send to kitchen'.",
    "The order is 'Order #… placed', 'Sent to the kitchen for Table D1', type 'Dine-in · Table D1', 'Running tab ₹70'.",
    "Back on the menu the same diner sees 'Running tab ₹70' and can order again: the second order brings the tab to ₹130, on the same table session.",
    "A stranger scanning D1 while it is occupied sees 'Another party is currently seated at this table' and no menu to order from; the order page says 'Another party is seated here'.",
    "Tables page: 'Seated now — 1', 'Table D1 … 2 orders · tab ₹130', D1 'Seated'. Orders page: both orders 'DI Table D1' for the diner. The table overview shows the diner, 'Running tab ₹130' and '₹130 unpaid'.",
    "Moving the party to D2: 'moved: D1 → D2', D1 'Needs cleaning', D2 'Seated', and the orders now say Table D2.",
    "Closing a table that still owes money is refused with 'Confirm payment before marking this table vacant — ₹130 still unpaid.'; the overview's 'Mark table as vacant' stays disabled until 'Confirm payment' ('Fully paid'); then D2 'Needs cleaning', and 'Mark cleaned' makes it 'Free'.",
    "A seated table can't be removed ('Close the open session before removing this table'); 'Cancel / void' cancels its orders and frees the table, after which it can be removed and its code says 'isn't valid'.",
    "Rotating D2's code: the old address says 'That table code has expired', the new one works; a forged code and an unknown table are refused.",
    "With Dine-in QR ordering switched off in Settings, a table's code says 'Table ordering is off right now … order at the counter'; switched on again it works.",
  ],
  expectNot: [
    "A diner seated at a table must NOT be told that another party is seated there.",
    "A stranger must NOT be able to order onto an occupied table's tab.",
    "A table order must NOT ask for a table number or an order type.",
    "A table that still owes money must NOT be marked vacant.",
    "A voided table's orders must NOT stay open in the kitchen.",
    "A rotated, forged or deleted table's code must NOT open the menu.",
    "Dine-in must NOT work while Dine-in QR ordering is off.",
    "The browser must NOT log JavaScript errors.",
  ],
};

const OWNER = ["o@acme.test", "Owner123!"];
const DINA = { name: "Dina Diner", phone: "9877712345" };
const ROHAN = { name: "Rohan Other", phone: "9877799999" };
const norm = (t) => t.replace(/\s+/g, " ").trim();
const CUSTOMER_COOKIE = "onetap_customer";

export async function run(d, h) {
  const page = () => ui.text(d);
  const asOwner = async () => { await d.tab("dashboard", "Store dashboard · owner of Acme Momos"); await ui.signIn(d, OWNER); };
  const asDiner = async (label = "Customer · at the table") => d.tab("customer", label);
  const signedOut = () => d.context.clearCookies({ name: CUSTOMER_COOKIE }); // a different person on their own phone
  const overview = () => d.page.getByRole("dialog", { name: "Table overview" });
  const row = (no) => d.page.locator("tr", { hasText: `#${no}` }).first();

  /** the diner puts items in the cart from the table's menu and sends the order; signs in if asked. Returns { no, text } of the placed screen. */
  const orderAtTable = async (url, items, who) => {
    if (url) await ui.visit(d, url);
    for (const it of items) await ui.addToCart(d, it.name, it);
    await d.click(d.page.getByRole("link", { name: /View cart/ }), { after: 700 });
    await d.page.waitForURL(/\/t\/[0-9a-f]+\/order/, { timeout: 15000 });
    if (await d.page.getByText("Sign in to order").first().isVisible({ timeout: 3000 }).catch(() => false)) await ui.customerSignIn(d, who);
    const send = d.page.getByRole("button", { name: /send to kitchen/i });
    await send.waitFor({ timeout: 20000 });
    await d.click(send, { after: 700 });
    await d.page.waitForSelector("text=/Order #\\d+ placed/", { timeout: 25000 });
    const text = await page();
    return { no: text.match(/Order #(\d+) placed/)[1], text };
  };

  // ------------------------------------------------------------------------------------------------------------- 1
  await d.step("Staff add three tables and copy the code of the first");
  await asOwner();
  await ui.openTables(d);
  for (const [number, seats] of [["D1", 2], ["D2", 4], ["D3", 4]]) await ui.addTable(d, { number, zone: "Garden", seats });
  d.check("D1, D2 and D3 are in a 'Garden' group, Free", /Garden D1 Free 2 seats D2 Free 4 seats D3 Free 4 seats/.test(await page()), (await ui.tableTiles(d)).map((t) => t.text).join(" | "));
  const urlD1 = await ui.tableQrUrl(d, "D1");
  const urlD2 = await ui.tableQrUrl(d, "D2");
  const urlD3 = await ui.tableQrUrl(d, "D3");
  d.check("each table has its own address", new Set([urlD1, urlD2, urlD3]).size === 3 && [urlD1, urlD2, urlD3].every((u) => /\/t\/[0-9a-f]{24}\?k=/.test(u)));

  // ------------------------------------------------------------------------------------------------------------- 2
  await d.step("A diner scans D1, signs in and sends an order to the kitchen");
  await asDiner();
  const scan = await ui.visit(d, urlD1);
  d.check("the code opens the menu for 'Table D1' ('Ordering to Table D1')", /Table D1/.test(scan.text) && /Ordering to Table D1/.test(scan.text), scan.text.slice(0, 160));
  d.never("a Takeaway / Delivery choice is shown to someone at a table", (await d.page.getByRole("group", { name: "Order type" }).count()) > 0);
  d.check("the menu has the items to add", (await d.page.getByRole("button", { name: /^add cold coffee$/i }).count()) === 1);
  await ui.addToCart(d, "Cold Coffee");
  await d.click(d.page.getByRole("link", { name: /View cart/ }), { after: 700 });
  await d.page.waitForURL(/\/t\/[0-9a-f]+\/order/, { timeout: 15000 });
  d.check("checkout asks the diner to sign in first (name and mobile number)", await d.page.getByText("Sign in to order").first().isVisible({ timeout: 8000 }));
  await ui.customerSignIn(d, DINA);
  const review = await page();
  d.check("the order page says 'Table D1' and that it joins the running tab", /Table D1/.test(review) && /This joins your running tab/.test(review));
  d.never("the diner is asked for a table number, or how they want it (takeaway / delivery)", /Select your table|Your table number/.test(review) || /How would you like it/.test(review) || /Delivery address/.test(review));
  d.check("the button says 'Send to kitchen' (not 'Place order')", (await d.page.getByRole("button", { name: /send to kitchen/i }).count()) === 1 && (await d.page.getByRole("button", { name: /place order/i }).count()) === 0);
  await d.shot("order-page");
  await d.click(d.page.getByRole("button", { name: /send to kitchen/i }), { after: 700 });
  await d.page.waitForSelector("text=/Order #\\d+ placed/", { timeout: 25000 });
  const placed1 = await page();
  const no1 = placed1.match(/Order #(\d+) placed/)[1];
  d.check("'Order #… placed' — 'Sent to the kitchen for Table D1.'", /Sent to the kitchen for Table D1/.test(placed1), placed1.slice(0, 200));
  d.check("it is a dine-in order for the table: 'Dine-in · Table D1', total ₹70, 'Running tab ₹70'", /Dine-in · Table D1/.test(placed1) && /Total ₹70/.test(placed1) && /Running tab ₹70/.test(placed1), placed1.slice(0, 260));
  await d.shot("placed");

  // ------------------------------------------------------------------------------------------------------------- 3
  await d.step("The same diner orders again: one table, one running tab");
  await d.click(d.page.getByRole("link", { name: /Back to menu/ }).or(d.page.getByRole("button", { name: /Back to menu/ })).first(), { after: 1500 });
  const menuAgain = await page();
  d.never("the diner who is seated here is told another party is seated here", /Another party is currently seated/.test(menuAgain));
  d.check("the menu shows the running tab: 'Ordering to Table D1 · Running tab ₹70'", /Running tab ₹70/.test(menuAgain), menuAgain.slice(150, 330));
  const second = await orderAtTable(null, [{ name: "Veg Steamed Momos", size: "5 pcs" }], DINA);
  d.check("the second order is ₹60 and the running tab becomes ₹130", /Total ₹60/.test(second.text) && /Running tab ₹130/.test(second.text), second.text.slice(0, 260));
  d.check("it is a new order number", second.no !== no1, `${no1} → ${second.no}`);

  // ------------------------------------------------------------------------------------------------------------- 4
  await d.step("A stranger scanning the same code is turned away");
  await signedOut();
  const stranger = await ui.visit(d, urlD1);
  d.check("they see 'Another party is currently seated at this table. Please ask a member of staff.'", /Another party is currently seated at this table/.test(stranger.text) && /Please ask a member of staff/.test(stranger.text));
  d.never("a stranger can add items to an occupied table's tab", (await d.page.getByRole("button", { name: /^add /i }).count()) > 0);
  const strangerOrder = await ui.visit(d, urlD1.replace(/\/t\/([0-9a-f]+)\?/, "/t/$1/order?"));
  d.check("going straight to its order page says 'Another party is seated here'", /Another party is seated here/.test(strangerOrder.text));
  await d.shot("occupied");

  // ------------------------------------------------------------------------------------------------------------- 5
  await d.step("Staff see the party: seated now, orders, tab");
  await asOwner();
  await ui.openTables(d);
  const seatedNow = await page();
  d.check("'Seated now — 1' with 'Table D1 … 2 orders · tab ₹130'", /Seated now — 1/.test(seatedNow) && /Table D1 since .{3,12} · 2 orders · tab ₹130/.test(seatedNow), seatedNow.match(/Seated now.{0,120}/)?.[0]);
  d.check("D1 shows as Seated, D2 and D3 Free", (await ui.tableTiles(d)).find((t) => t.number === "D1")?.status === "Seated" && (await ui.tableTiles(d)).filter((t) => ["D2", "D3"].includes(t.number)).every((t) => t.status === "Free"));
  await d.goto(`${BENCH.admin}/orders`, 1500);
  await row(no1).waitFor({ timeout: 15000 });
  const r1 = norm(await row(no1).innerText());
  const r2 = norm(await row(second.no).innerText());
  d.check(`the Orders page lists both: '#${no1} … Dina Diner 9877712345 DI Table D1 … ₹70 Placed' and '#${second.no} … ₹60'`, /Dina Diner/.test(r1) && /9877712345/.test(r1) && /DI Table D1/.test(r1) && /₹70/.test(r1) && /Placed/.test(r1) && /DI Table D1/.test(r2) && /₹60/.test(r2), `${r1} || ${r2}`);
  await d.click(d.page.getByRole("button", { name: /Tables/ }).first(), { after: 1200 });
  d.check("the table overview shows D1 Seated with '₹130 · unpaid'", /D1 Seated 2 seats ₹130 · unpaid/.test(norm(await overview().innerText())), norm(await overview().innerText()).slice(0, 200));
  await d.click(overview().getByRole("button", { name: /^D1 / }), { after: 900 });
  const detail = norm(await overview().innerText());
  d.check("its detail: Diner Dina Diner (9877712345), Running tab ₹130, ₹130 unpaid, both orders", /Dina Diner/.test(detail) && /9877712345/.test(detail) && /RUNNING TAB ₹130/i.test(detail) && /₹130 unpaid/.test(detail) && new RegExp(`#${no1} · 1× Cold Coffee`).test(detail) && new RegExp(`#${second.no} · 1× Veg Steamed Momos`).test(detail), detail.slice(0, 380));
  await d.shot("overview");
  await d.press("Escape", 500);

  // ------------------------------------------------------------------------------------------------------------- 6
  await d.step("Staff move the party from D1 to D2");
  await ui.openTables(d);
  await d.choose(d.page.getByLabel("Move to table"), { label: "Table D2" }, { after: 300 });
  await d.click(d.page.getByRole("button", { name: "Move", exact: true }), { after: 1500 });
  const moved = await page();
  d.check("'Seated now' says 'Table D2 … moved: D1 → D2'", /Table D2\s*moved: D1 → D2/.test(moved), moved.match(/Seated now.{0,160}/)?.[0]);
  const tilesMoved = await ui.tableTiles(d);
  d.check("D1 'Needs cleaning', D2 'Seated', D3 still Free", tilesMoved.find((t) => t.number === "D1")?.status === "Needs cleaning" && tilesMoved.find((t) => t.number === "D2")?.status === "Seated" && tilesMoved.find((t) => t.number === "D3")?.status === "Free", tilesMoved.filter((t) => /^D/.test(t.number)).map((t) => t.text).join(" | "));
  d.check("the tab moved with them: still 2 orders · ₹130", /Table D2 since .{3,12} · 2 orders · tab ₹130/.test(moved) || /2 orders · tab ₹130/.test(moved));
  await d.goto(`${BENCH.admin}/orders`, 1500);
  await row(no1).waitFor({ timeout: 15000 });
  d.check("both orders on the Orders page now say Table D2", /DI Table D2/.test(norm(await row(no1).innerText())) && /DI Table D2/.test(norm(await row(second.no).innerText())));

  // ------------------------------------------------------------------------------------------------------------- 7
  await d.step("A table that still owes money can't be closed; confirm payment, mark vacant, mark cleaned");
  await ui.openTables(d);
  await d.click(d.page.getByRole("button", { name: "Close", exact: true }).first(), { after: 1500 });
  d.check("Close is refused: 'Confirm payment before marking this table vacant — ₹130 still unpaid.'", /Confirm payment before marking this table vacant — ₹130 still unpaid/.test(await page()), (await page()).match(/Confirm payment.{0,80}/)?.[0]);
  d.never("the table was freed although ₹130 is unpaid", (await ui.tableTiles(d)).find((t) => t.number === "D2")?.status !== "Seated" || !/Seated now — 1/.test(await page()));
  await d.goto(`${BENCH.admin}/orders`, 1200);
  await d.click(d.page.getByRole("button", { name: /Tables/ }).first(), { after: 1200 });
  await d.click(overview().getByRole("button", { name: /^D2 / }), { after: 900 });
  d.check("in the overview 'Mark table as vacant' is disabled while it is unpaid", await d.page.getByRole("button", { name: "Mark table as vacant" }).isDisabled());
  await d.click(d.page.getByRole("button", { name: "Confirm payment" }), { after: 1300 });
  d.check("'Confirm payment' → the tab says 'Fully paid' and 'Confirm payment' is now disabled", /Fully paid/.test(norm(await overview().innerText())) && (await d.page.getByRole("button", { name: "Confirm payment" }).isDisabled()));
  await d.click(d.page.getByRole("button", { name: "Mark table as vacant" }), { after: 1500 });
  await d.click(overview().getByRole("button", { name: /^D2 / }), { after: 800 });
  d.check("D2 is now 'Needs cleaning' and offers 'Mark cleaned'", /Needs cleaning/.test(norm(await overview().innerText())) && (await d.page.getByRole("button", { name: "Mark cleaned" }).count()) === 1);
  await d.click(d.page.getByRole("button", { name: "Mark cleaned" }), { after: 1000 });
  d.check("'Mark cleaned' → D2 is Free again", /Free and ready/.test(norm(await overview().innerText())));
  await d.click(overview().getByRole("button", { name: "Back to tables" }), { after: 600 });
  await d.click(overview().getByRole("button", { name: /^D1 / }), { after: 800 });
  await d.click(d.page.getByRole("button", { name: "Mark cleaned" }), { after: 1000 });
  await d.press("Escape", 500);
  await ui.openTables(d);
  const cleaned = await ui.tableTiles(d);
  d.check("the Tables page has no one seated and D1, D2, D3 all Free", !/Seated now/.test(await page()) && ["D1", "D2", "D3"].every((n) => cleaned.find((t) => t.number === n)?.status === "Free"), cleaned.filter((t) => /^D/.test(t.number)).map((t) => t.text).join(" | "));

  // ------------------------------------------------------------------------------------------------------------- 8
  await d.step("A second diner at D3; staff void the party; a seated table can't be removed");
  await asDiner();
  const rohan = await orderAtTable(urlD3, [{ name: "Cold Coffee" }], ROHAN);
  d.check("the new diner's order goes to D3 ('Sent to the kitchen for Table D3', 'Running tab ₹70')", /Sent to the kitchen for Table D3/.test(rohan.text) && /Running tab ₹70/.test(rohan.text), rohan.text.slice(0, 200));
  await asOwner();
  await ui.openTables(d);
  d.check("D3 is Seated and listed under 'Seated now'", /Seated now — 1/.test(await page()) && (await ui.tableTiles(d)).find((t) => t.number === "D3")?.status === "Seated");
  const { dlg } = await ui.openTableQr(d, "D3");
  await d.click(dlg.getByRole("button", { name: "Remove table" }), { after: 1200 });
  d.check("removing a seated table is refused: 'Close the open session before removing this table'", /Close the open session before removing this table/.test(await dlg.innerText()));
  d.never("a seated table was removed", !(await ui.tableTiles(d)).some((t) => t.number === "D3"));
  await d.click(dlg.getByRole("button", { name: "Done" }), { after: 400 });
  await d.goto(`${BENCH.admin}/orders`, 1200);
  await row(rohan.no).waitFor({ timeout: 15000 });
  await d.click(d.page.getByRole("button", { name: /Tables/ }).first(), { after: 1200 });
  await d.click(overview().getByRole("button", { name: /^D3 / }), { after: 900 });
  await d.click(d.page.getByRole("button", { name: "Cancel / void" }), { after: 1600 });
  await d.press("Escape", 500);
  const voided = norm(await row(rohan.no).innerText());
  d.check(`after 'Cancel / void' the order #${rohan.no} is Cancelled`, /Cancelled/.test(voided), voided);
  d.never("the voided order is still open for the kitchen", /Placed|Preparing|Ready/.test(voided) && !/Cancelled/.test(voided));
  await ui.openTables(d);
  d.check("D3 is freed ('Needs cleaning') and nobody is seated", (await ui.tableTiles(d)).find((t) => t.number === "D3")?.status === "Needs cleaning" && !/Seated now/.test(await page()));
  const rm = await ui.openTableQr(d, "D3");
  await d.click(rm.dlg.getByRole("button", { name: "Remove table" }), { after: 1200 });
  d.check("now that it is free, D3 can be removed", !(await ui.tableTiles(d)).some((t) => t.number === "D3"));
  await asDiner();
  const removed = await ui.visit(d, urlD3);
  d.check("the removed table's code says 'That table code isn't valid'", /This code didn't work/.test(removed.text) && /That table code isn't valid/.test(removed.text), removed.text.slice(0, 160));

  // ------------------------------------------------------------------------------------------------------------- 9
  await d.step("Rotating a code kills the printed one; forged and unknown codes are refused");
  await asOwner();
  await ui.openTables(d);
  const { dlg: d2dlg } = await ui.openTableQr(d, "D2");
  await d.click(d2dlg.getByRole("button", { name: "Rotate code" }), { after: 1600 });
  const newUrlD2 = (await d2dlg.innerText()).match(/http\S+/)[0];
  d.check("the panel shows a new code for the same table", newUrlD2 !== urlD2 && newUrlD2.split("?")[0] === urlD2.split("?")[0], `${urlD2} → ${newUrlD2}`);
  await asDiner();
  const oldCode = await ui.visit(d, urlD2);
  d.check("the old printed code says 'That table code has expired — please ask staff for a fresh one'", /This code didn't work/.test(oldCode.text) && /has expired/.test(oldCode.text), oldCode.text.slice(0, 180));
  d.never("the old code still opens the menu", /Ordering to Table D2/.test(oldCode.text));
  const newCode = await ui.visit(d, newUrlD2);
  d.check("the new code opens the menu for D2", /Ordering to Table D2/.test(newCode.text));
  const forged = await ui.visit(d, urlD2.replace(/k=.*$/, "k=abcdefghijklmnopqrstuvwx"));
  d.check("a made-up code for a real table is refused", /This code didn't work/.test(forged.text) && !/Ordering to Table/.test(forged.text));
  const unknown = await ui.visit(d, `${BENCH.storefront}/t/000000000000000000000000?k=whatever`);
  d.check("a code for a table that doesn't exist says 'That table code isn't valid'", /That table code isn't valid/.test(unknown.text));
  const bareId = await ui.visit(d, urlD2.split("?")[0]);
  d.never("the table's address without its code opens the menu", /Ordering to Table/.test(bareId.text));

  // ------------------------------------------------------------------------------------------------------------- 10
  await d.step("Dine-in QR ordering switched off in Settings, and on again");
  await asOwner();
  await ui.applySettings(d, [{ tab: "Features", ticks: { "Dine-in QR ordering": false } }]);
  await asDiner();
  const off = await ui.visit(d, newUrlD2);
  d.check("a table's code says 'Table ordering is off right now' and 'Please order at the counter.'", /Table ordering is off right now/.test(off.text) && /Please order at the counter/.test(off.text), off.text.slice(0, 200));
  d.never("the menu opens while dine-in is off", /Ordering to Table D2/.test(off.text) || (await d.page.getByRole("button", { name: /^add /i }).count()) > 0);
  const offOrder = await ui.visit(d, newUrlD2.replace(/\/t\/([0-9a-f]+)\?/, "/t/$1/order?"));
  d.check("the order page of the table says the same", /Table ordering is off right now/.test(offOrder.text));
  await d.shot("off");
  await asOwner();
  await ui.applySettings(d, [{ tab: "Features", ticks: { "Dine-in QR ordering": true } }]);
  await asDiner();
  const on = await ui.visit(d, newUrlD2);
  d.check("switched back on, the same code works again", /Ordering to Table D2/.test(on.text));

  d.never("the browser logged JavaScript errors", d.problems.length > 0, d.problems.join(" | "));
}
