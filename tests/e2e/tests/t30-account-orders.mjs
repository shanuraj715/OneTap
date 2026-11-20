// T30 — The storefront Account page ("My orders") and deleting an order from the dashboard. All in Chrome.
// Acme Momos has coins switched on. A new customer signs in from the header menu link, orders, and follows the order
// from Placed to Completed (paid, coins earned); a second order is cancelled; the owner deletes the first from the
// Orders page and it vanishes from the customer's account (their coins put right); a cashier isn't offered the option.
import { BENCH } from "../bench/watch.mjs";
import * as ui from "../bench/ui.mjs";

export const meta = {
  id: "t30-account-orders",
  title: "Storefront Account page — 'My orders' menu link, order history with status, payment mode & state, coins; Delete order on the dashboard",
  area: "storefront",
  fresh: true,
  summary: "In Chrome on the Acme Momos storefront. The header menu has a 'My orders' link. Signed out, it opens the Account page with a sign-in card ('Sign in to see your orders'); signing in shows 'Your account' with the customer's name and number, a 'Your coins' card (coins are on for this store) and an empty 'No orders yet'. After ordering for takeaway paying cash, the order appears with its number, date, status Placed with a one-line explanation, payment 'Pay at the counter · To pay', the total, its items, and 'View details' with the full bill. As the owner moves it to Accepted, Preparing, Ready and Completed the card follows (progress tracker while active; by itself within about 20 seconds, or on reload), the payment becomes Paid, the details say how many coins were earned and the coins card shows them. A second order that is cancelled shows Cancelled and 'Not charged'. On the dashboard Orders page the owner opens More actions → Delete order: a dialog explains it disappears from the list, the reports and the customer's history and that the coins it earned are taken back; confirming removes the row, and on the customer's Account page the order is gone and the coins are back to what they were. A cashier's and a manager's More-actions menu have no Delete option — deleting an order is for the owner (and the platform admin) only. Signing out of the Account page shows the sign-in card again.",
  expect: [
    "The storefront header menu has 'My orders'; it leads to /main/account.",
    "Signed out, the Account page shows the sign-in card titled 'Sign in to see your orders' (not 'Sign in to order').",
    "Signed in: 'Your account' with name and number; a 'Your coins' card; an empty state 'No orders yet' with a 'Browse the menu' link.",
    "A placed order shows: number, status Placed with its sentence, 'Pay at the counter' with 'To pay', the total in rupees, the items; 'View details' shows each line and the totals.",
    "As the owner changes the status the card follows (Accepted, Preparing, Ready, Completed); an active order shows a progress tracker; the page refreshes by itself.",
    "Completed: payment says Paid; the details say how many coins were earned; the coins card shows that balance.",
    "A cancelled order shows Cancelled and payment 'Not charged'.",
    "Owner: Orders → More actions → 'Delete order' → dialog (names the order, says it disappears and which coins are taken back) → confirm removes the row; the customer's page no longer lists it and the coins balance drops back.",
    "The customer's own 'Remove' on an order asks first (says the restaurant keeps its record), 'Keep it' changes nothing, 'Remove' takes only that order off their list — still gone after a reload.",
    "The store still sees the order the customer removed (Orders page), so a customer's removal never changes the store's records.",
    "A cashier's and a manager's More-actions menu have no 'Delete order' (only the owner's does).",
    "Sign out returns to the sign-in card.",
  ],
  expectNot: [
    "The Account page must NOT show anyone's orders while signed out.",
    "Deleting must NOT happen without pressing the red 'Delete order' button (Enter does nothing).",
    "A cashier or a manager must NOT be offered 'Delete order'.",
    "A customer removing an order from their account must NOT remove it from the store's Orders page.",
    "A deleted order must NOT stay on the customer's Account page, and the coins it earned must NOT stay.",
    "The browser must NOT log JavaScript errors.",
  ],
};

const PHONE = "9811800001";
const NAME = "Account Tester";
const text = (d) => ui.text(d);

export async function run(d, h) {
  await d.tab("customer", "Customer · Acme Momos storefront");
  const card = (no) => d.page.locator(`[data-order="${no}"]`);
  const openAccount = async () => {
    await d.goto(BENCH.storefront + "/main", 300);
    await d.click(d.page.getByRole("link", { name: "My orders" }).first(), { after: 700 });
    await d.page.waitForURL(/\/main\/account/, { timeout: 15000 });
  };
  const coinsNow = async () => Number((await d.page.getByTestId("account-coins").innerText()).match(/Your coins\s*(\d+)/)?.[1] ?? NaN);

  await d.step("The header menu has a 'My orders' link", 400);
  await d.goto(BENCH.storefront + "/main", 400);
  const link = d.page.getByRole("link", { name: "My orders" }).first();
  d.check("the storefront's header menu has 'My orders'", await link.isVisible());
  await d.click(link, { after: 800 });
  await d.page.waitForURL(/\/main\/account/, { timeout: 15000 });
  d.check("it leads to the Account page", /\/main\/account$/.test(d.page.url()), d.page.url());

  await d.step("Signed out, the Account page asks the visitor to sign in", 400);
  await d.page.getByText("Sign in to see your orders").first().waitFor({ timeout: 15000 });
  let page = await text(d);
  d.check("the sign-in card is titled 'Sign in to see your orders'", /Sign in to see your orders/.test(page) && !/Sign in to order/.test(page));
  d.never("anyone's orders are listed", /Order #\d+/.test(page));
  d.check("it says the mobile number is all that's needed", /Use the mobile number you order with/.test(page));

  await d.step("The customer signs in and sees their account", 400);
  await d.type(d.page.getByRole("textbox", { name: "Your name" }), NAME, { after: 150, delay: 15 });
  await d.type(d.page.getByRole("textbox", { name: "Mobile number" }), PHONE, { after: 150, delay: 15 });
  await d.click(d.page.getByRole("button", { name: "Send code" }), { after: 700 });
  await d.page.getByText("Enter the code").first().waitFor({ timeout: 15000 });
  await d.click(d.page.getByLabel("Digit 1 of 6"), { after: 150 });
  await d.page.keyboard.type("123456", { delay: 80 });
  await d.click(d.page.getByRole("button", { name: "Verify code" }), { after: 900 });
  if (await d.page.getByText("Just a couple more details").first().waitFor({ timeout: 4000 }).then(() => true).catch(() => false)) {
    await d.click(d.page.getByRole("group", { name: "Gender" }).getByRole("button", { name: "Female", exact: true }));
    await d.type(d.page.getByRole("spinbutton", { name: "Age" }), "31", { after: 150, delay: 20 });
    await d.click(d.page.getByRole("button", { name: "Save and continue" }), { after: 1000 });
  }
  await d.page.getByRole("heading", { name: "Your account" }).waitFor({ timeout: 20000 });
  d.check("'Your account' shows the customer's name and number", new RegExp(`${NAME} · ${PHONE}`).test(await d.page.getByTestId("account-who").innerText()));
  d.check("a 'Your coins' card is there (coins are on for this store), at 0", (await d.page.getByTestId("account-coins").isVisible()) && (await coinsNow()) === 0);
  d.check("with no orders it says so, and offers the menu", (await d.page.getByTestId("account-empty").isVisible()) && /No orders yet/.test(await text(d)) && (await d.page.getByRole("link", { name: "Browse the menu" }).isVisible()));
  await d.shot("account-empty");

  await d.step("The customer orders for takeaway, paying at the counter", 400);
  const no1 = await ui.placeTakeaway(d, BENCH.storefront + "/main", [{ name: "Veg Steamed Momos", qty: 2 }], { name: NAME, phone: PHONE });
  await openAccount();
  await card(no1).waitFor({ timeout: 15000 });
  d.check(`order #${no1} is on the Account page, Placed`, /Placed/.test(await card(no1).getByTestId("order-status").innerText()));
  d.check("a sentence says what happens next", /waiting for the restaurant to accept/.test(await card(no1).getByTestId("order-status-line").innerText()));
  const pay1 = await card(no1).getByTestId("order-payment").innerText();
  d.check("the payment shows how it is paid (at the counter) and that it still has to be", /Pay at the counter/.test(pay1) && /To pay/.test(pay1), pay1.replace(/\s+/g, " "));
  d.check("the total is shown in rupees", /₹\s?[\d,]+/.test(await card(no1).getByTestId("order-total").innerText()), await card(no1).getByTestId("order-total").innerText());
  d.check("the progress tracker is shown while the order is active", (await card(no1).getByRole("list", { name: "Order progress" }).count()) === 1);
  await d.click(card(no1).getByRole("button", { name: /View details/ }), { after: 400 });
  const details = await card(no1).getByTestId("order-details").innerText();
  d.check("'View details' lists the items and the bill", /2 × Veg Steamed Momos/.test(details) && /Total/.test(details), details.replace(/\s+/g, " ").slice(0, 110));
  await d.shot("account-placed");

  await d.step("The owner moves the order along; the customer's card follows", 400);
  const owner = await d.apiAs("owner");
  const orderIdOf = async (no) => (await owner.call("GET", "/api/orders", { outlet: h.ids.main })).json.orders.find((o) => o.orderNumber === no)?.id;
  const id1 = await orderIdOf(no1);
  d.check("(the order is on the dashboard)", Boolean(id1), id1);
  await owner.call("PATCH", `/api/orders/${id1}/status`, { body: { status: "accepted" }, outlet: h.ids.main });
  // the open page refreshes by itself while an order is active (every ~20 s)
  const followed = await ui.until(async () => /Accepted/.test(await card(no1).getByTestId("order-status").innerText()), 45000);
  d.check("without reloading, the page picks up 'Accepted' by itself", followed);
  await owner.call("PATCH", `/api/orders/${id1}/status`, { body: { status: "preparing" }, outlet: h.ids.main });
  await owner.call("PATCH", `/api/orders/${id1}/status`, { body: { status: "ready" }, outlet: h.ids.main });
  await d.page.reload({ waitUntil: "load" });
  await card(no1).waitFor({ timeout: 15000 });
  d.check("after a reload it says Ready, with the pickup sentence", /Ready/.test(await card(no1).getByTestId("order-status").innerText()) && /you can collect it now/.test(await card(no1).getByTestId("order-status-line").innerText()));
  await owner.call("PATCH", `/api/orders/${id1}/status`, { body: { status: "completed" }, outlet: h.ids.main });
  await d.page.reload({ waitUntil: "load" });
  await card(no1).waitFor({ timeout: 15000 });
  d.check("Completed", /Completed/.test(await card(no1).getByTestId("order-status").innerText()));
  const pay2 = await card(no1).getByTestId("order-payment").innerText();
  d.check("the payment now says Paid (cash taken at the counter)", /Paid/.test(pay2) && !/To pay/.test(pay2), pay2.replace(/\s+/g, " "));
  d.check("no progress tracker any more", (await card(no1).getByRole("list", { name: "Order progress" }).count()) === 0);
  await d.click(card(no1).getByRole("button", { name: /View details/ }), { after: 400 });
  const earned = Number((await card(no1).getByTestId("order-details").innerText()).match(/earned (\d+) coins/)?.[1] ?? NaN);
  d.check("the details say how many coins the order earned", earned > 0, `${earned}`);
  d.check("the coins card shows exactly those coins", (await coinsNow()) === earned, `${await coinsNow()} vs ${earned}`);
  await d.shot("account-completed");

  await d.step("A second order is cancelled", 400);
  const no2 = await ui.placeTakeaway(d, BENCH.storefront + "/main", [{ name: "Veg Steamed Momos", qty: 1 }], { name: NAME, phone: PHONE });
  await d.tab("owner", "Store dashboard · owner of Acme Momos");
  await ui.signIn(d, "owner");
  await d.goto(BENCH.admin + "/orders", 500);
  await ui.cancelOrder(d, no2);
  await d.tab("customer", "Customer · Acme Momos storefront");
  await openAccount(); // (the customer's tab is still on the 'order placed' screen)
  await card(no2).waitFor({ timeout: 15000 });
  d.check("the cancelled order says Cancelled", /Cancelled/.test(await card(no2).getByTestId("order-status").innerText()));
  d.check("…and the payment says it was not charged", /Not charged/.test(await card(no2).getByTestId("order-payment").innerText()));

  await d.step("The owner deletes the first order from the Orders page", 400);
  await d.tab("owner", "Store dashboard · owner of Acme Momos");
  await d.goto(BENCH.admin + "/orders", 600);
  const row = d.page.locator("tr", { hasText: `#${no1}` }).first();
  await row.waitFor({ timeout: 20000 });
  await d.click(row.getByRole("button", { name: "More actions" }), { after: 400 });
  d.check("'More actions' offers 'Delete order'", await d.page.getByText("Delete order", { exact: true }).first().isVisible());
  await d.click(d.page.getByText("Delete order", { exact: true }).first(), { after: 500 });
  const dlg = d.page.getByRole("dialog", { name: "Delete order" });
  await dlg.waitFor({ timeout: 8000 });
  const dtext = await dlg.innerText();
  d.check("the dialog names the order and says what happens", new RegExp(`Delete order #${no1}\\?`).test(dtext) && /disappears from the orders list, your reports and the customer's order history/.test(dtext), dtext.replace(/\s+/g, " ").slice(0, 150));
  d.check("it says the coins it earned are taken back", new RegExp(`The ${earned} coins it earned are taken back`).test(await dlg.getByTestId("delete-coins-note").innerText()));
  await d.shot("order-delete-dialog");
  await d.press("Enter", 500);
  d.check("Enter does NOT delete it (only the red button does)", (await dlg.isVisible()) && (await row.isVisible()));
  await d.click(dlg.getByRole("button", { name: "Delete order" }), { after: 900 });
  await dlg.waitFor({ state: "hidden", timeout: 8000 });
  const gone = await ui.until(async () => (await d.page.locator("tr", { hasText: `#${no1}` }).count()) === 0, 15000);
  d.check("the row is gone from the Orders page", gone);
  d.check("the other order is still there", (await d.page.locator("tr", { hasText: `#${no2}` }).count()) > 0);

  await d.step("On the customer's Account page the order — and its coins — are gone", 400);
  await d.tab("customer", "Customer · Acme Momos storefront");
  await d.page.reload({ waitUntil: "load" });
  await card(no2).waitFor({ timeout: 15000 });
  d.check("the deleted order is no longer listed", (await card(no1).count()) === 0);
  d.check("the cancelled one still is", (await card(no2).count()) === 1);
  d.check("the coins it earned are taken back (0 again)", (await coinsNow()) === 0, `${await coinsNow()}`);

  await d.step("The customer removes the cancelled order from their own account", 400);
  await d.click(card(no2).getByTestId("order-remove"), { after: 400 });
  const ask = card(no2).getByTestId("order-remove-ask");
  d.check("it asks first, and says the restaurant keeps its own record", (await ask.isVisible()) && /the restaurant keeps its own record of it/.test(await ask.innerText()), (await ask.innerText()).replace(/\s+/g, " ").slice(0, 120));
  await d.shot("account-remove-ask");
  await d.click(ask.getByRole("button", { name: "Keep it" }), { after: 300 });
  d.check("'Keep it' changes nothing", !(await ask.isVisible().catch(() => false)) && (await card(no2).count()) === 1);
  await d.click(card(no2).getByTestId("order-remove"), { after: 300 });
  await d.click(card(no2).getByTestId("order-remove-ask").getByRole("button", { name: "Remove", exact: true }), { after: 900 });
  d.check("the card disappears from the customer's list", await ui.until(async () => (await card(no2).count()) === 0, 8000));
  d.check("with nothing left, the page says 'No orders yet'", await d.page.getByTestId("account-empty").isVisible());
  await d.page.reload({ waitUntil: "load" });
  await d.page.getByRole("heading", { name: "Your account" }).waitFor({ timeout: 15000 });
  const emptyAgain = await ui.until(async () => d.page.getByTestId("account-empty").isVisible(), 10000); // (the list loads after the heading)
  d.check("and it is still gone after a reload", emptyAgain && (await card(no2).count()) === 0);

  await d.step("A cashier is not offered 'Delete order' — and the store still has the order the customer removed", 400);
  await d.tab("owner", "Store dashboard · owner of Acme Momos");
  await ui.signIn(d, "cashier");
  await d.goto(BENCH.admin + "/orders", 600);
  const crow = d.page.locator("tr", { hasText: `#${no2}` }).first();
  await crow.waitFor({ timeout: 20000 });
  await d.click(crow.getByRole("button", { name: "More actions" }), { after: 400 });
  d.check("the store still sees the order the customer removed from their account", (await crow.count()) > 0);
  const opts = await d.page.locator("body").innerText();
  d.check("the cashier's menu has Edit and Cancel but no 'Delete order'", /Edit order/.test(opts) && !/Delete order/.test(opts));

  await d.step("A manager is not offered 'Delete order' either — only the owner (and the platform admin) is", 400);
  await ui.signIn(d, "manager");
  await d.goto(BENCH.admin + "/orders", 600);
  const mrow = d.page.locator("tr", { hasText: `#${no2}` }).first();
  await mrow.waitFor({ timeout: 20000 });
  await d.click(mrow.getByRole("button", { name: "More actions" }), { after: 400 });
  const mopts = await d.page.locator("body").innerText();
  d.check("the manager's menu has Edit order but no 'Delete order'", /Edit order/.test(mopts) && !/Delete order/.test(mopts));

  await d.step("Signing out of the Account page", 400);
  await d.tab("customer", "Customer · Acme Momos storefront");
  await d.click(d.page.getByRole("button", { name: "Sign out" }), { after: 900 });
  await d.page.getByText("Sign in to see your orders").first().waitFor({ timeout: 15000 });
  page = await text(d);
  d.check("the sign-in card is back, with no orders on screen", !/Order #\d+/.test(page));
}
