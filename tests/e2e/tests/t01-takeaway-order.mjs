// T01 — a complete takeaway order of at least ₹999, from the customer's first click to "customer leaves with the food".
// One full-size Chrome window, two tabs: the CUSTOMER's website and the restaurant's STAFF dashboard.
import { adminLogin, BENCH } from "../bench/watch.mjs";

export const meta = {
  id: "t01-takeaway-order",
  title: "Takeaway order of at least ₹999 — customer places it, staff take it all the way to Completed",
  area: "orders",
  fresh: true,
  summary: "A brand-new customer signs up on the Acme Momos storefront, orders 8 items (₹1,030) for takeaway paying cash at the counter; the staff dashboard receives it live and moves it Accepted → Preparing → Ready → Completed; the day's numbers and the customer's coins update.",
  expect: [
    "The customer can pick Takeaway, add items with sizes and quantities, and sees a cart total of at least ₹999.",
    "A new customer is asked for name + mobile, a 6-digit code (123456 on test stores), then gender and age once.",
    "Checkout lists exactly the picked items, offers 'Cash / pay at counter', and the amount to pay equals the cart.",
    "After placing, the customer sees 'Order #… placed', 'The kitchen has it.', Takeaway, cash at the counter, the same total and a ready time.",
    "The order shows on the staff Orders screen by itself (live), with customer, phone, type, item count, total and 'Placed'.",
    "Each status change (Accepted, Preparing, Ready, Completed) asks for confirmation; Enter confirms.",
    "Completing a cash order records the payment as paid; the status history lists all five steps.",
    "Dashboard home shows Revenue today = the order total and Orders today = 1.",
    "Loyalty coins are credited only when the order is Completed (₹1,030 → 103 coins).",
  ],
  expectNot: [
    "The order must NOT be marked paid before the staff complete it (cash is collected at the counter).",
    "No coins may be credited when the order is merely placed.",
    "A takeaway order must NOT carry a delivery fee or a delivery address.",
    "A signed-in owner of ANOTHER store (Beta Bites) must NOT be able to list or read this order.",
    "The browser must NOT log JavaScript errors during the flow.",
  ],
};

const money = (s) => Number(String(s ?? "").replace(/[^\d.]/g, ""));

export async function run(d, h) {
  let orderNo = "";
  let orderId = "";
  let toPay = 0;
  let cartTotal = 0;

  const ADD = async (name, { size, qty = 1 } = {}) => {
    await d.click(d.page.getByRole("button", { name: new RegExp(`^add ${name}$`, "i") }));
    const dlg = d.page.getByRole("dialog", { name });
    await dlg.waitFor();
    await d.pause(500);
    if (size) await d.click(dlg.locator("label", { hasText: size }), { after: 300 });
    for (let i = 1; i < qty; i++) await d.click(dlg.getByRole("button", { name: "One more" }), { after: 250 });
    const price = (await dlg.getByRole("button", { name: /^Add ·/ }).innerText()).replace(/\s+/g, " ");
    await d.click(dlg.getByRole("button", { name: /^Add ·/ }), { after: 1100 });
    console.log(`      added ${qty} × ${name}${size ? ` (${size})` : ""}  → ${price}`);
  };

  /** jump to a menu category the way this screen size does it: chips on a wide screen, a "Categories" sheet on a narrow one */
  const JUMP = async (name) => {
    const chips = d.page.locator(".ot-cat-chips");
    if (await chips.isVisible().catch(() => false)) await d.click(chips.getByRole("link", { name }), { after: 1900 });
    else {
      await d.click(d.page.getByRole("button", { name: "Categories" }));
      await d.click(d.page.getByRole("dialog", { name: "Menu categories" }).getByRole("button", { name: new RegExp(`^${name}`) }), { after: 1900 });
    }
  };

  const [w, hh, ow, oh, aw, ah] = await d.size();
  console.log(`  window: page ${w}×${hh}, outer ${ow}×${oh}, screen available ${aw}×${ah}`);

  /* ───────────────────────────── before: the counter's dashboard is open */
  await d.tab("staff", "Restaurant staff · dashboard");
  await d.step("Setting the scene: at the restaurant counter the staff dashboard is open on the Orders screen", 1800);
  await adminLogin(d, "owner");
  await d.click(d.page.getByRole("link", { name: "Orders", exact: true }).first());
  await d.page.waitForURL(/\/orders/);
  await d.pause(1500);
  d.check("Orders screen shows the live connection", await d.page.getByText(/^Live$/).first().isVisible().catch(() => false));
  d.check("no orders yet", (await d.page.locator("body").innerText()).includes("#0001") === false);
  await d.shot("0-orders-empty");

  /* ───────────────────────────── the customer */
  await d.tab("customer", "Customer · restaurant website");
  await d.step("A customer opens the restaurant's website", 1600);
  await d.goto(BENCH.storefront + "/main", 1400);
  d.check("the storefront opens with the restaurant's offer bar", await d.page.getByRole("region", { name: "Announcement" }).isVisible());

  await d.step("They choose how they want their food: Takeaway", 1300);
  const group = d.page.getByRole("group", { name: "Order type" });
  await d.spot(group, 900);
  await d.click(group.getByRole("button", { name: "Takeaway" }));
  d.check("Takeaway is selected", (await group.getByRole("button", { name: "Takeaway" }).getAttribute("aria-pressed")) === "true");

  await d.step("They browse the menu and pick items — the goal is an order of at least ₹999", 1900);
  await JUMP("Tandoori Momos");
  await ADD("Chicken Tandoori Momos", { size: "8 pcs", qty: 2 });
  await ADD("Afghani Malai Momos", { size: "8 pcs", qty: 2 });
  await JUMP("Gravy Momos");
  await ADD("Peri Peri Chicken Gravy");
  await JUMP("Beverages");
  await ADD("Cold Coffee", { qty: 2 });
  await ADD("Sweet Lassi");

  const bar = d.page.getByRole("link", { name: /View cart/ });
  await bar.waitFor();
  await d.page.waitForFunction(() => /₹\s*\d/.test(document.querySelector('a[href$="/order"]')?.textContent ?? ""), null, { timeout: 15000 }).catch(() => {});
  await d.spot(bar, 1800);
  const barText = (await bar.innerText()).replace(/\s+/g, " ");
  const cartItems = Number(barText.match(/(\d+) items?/)?.[1]);
  cartTotal = money(barText.match(/₹\s*([\d,]+(?:\.\d+)?)/)?.[1]);
  await d.say(`The cart bar says: ${barText.replace(" View cart →", "")}`, 1500);
  d.check("the cart holds 8 items", cartItems === 8, barText);
  d.check("the cart total is at least ₹999", cartTotal >= 999, `₹${cartTotal}`);
  await d.shot("1-menu-cart");

  await d.step("They open the cart to check out", 1300);
  await d.click(bar);
  await d.page.waitForURL(/\/main\/order/);
  await d.page.getByText("Sign in to order").first().waitFor({ timeout: 15000 });
  await d.pause(900);

  /* ───────────────────────────── sign up (a brand-new customer) */
  await d.step("A new customer signs up: name and mobile number, then the 6-digit code", 2000);
  await d.shot("2-signin");
  await d.type(d.page.getByRole("textbox", { name: "Your name" }), "Rohan Mehta");
  await d.type(d.page.getByRole("textbox", { name: "Mobile number" }), "9811122233");
  await d.click(d.page.getByRole("button", { name: "Send code" }), { after: 900 });
  await d.page.getByText("Enter the code").first().waitFor({ timeout: 15000 });
  await d.say("A 6-digit code is sent to the phone (on the test store the code is always 123456).", 1800);
  await d.click(d.page.getByLabel("Digit 1 of 6"), { after: 200 });
  await d.page.keyboard.type("123456", { delay: 260 });
  await d.pause(600);
  await d.click(d.page.getByRole("button", { name: "Verify code" }), { after: 1000 });
  await d.page.getByText("Just a couple more details").first().waitFor({ timeout: 15000 });
  d.check("a brand-new customer is asked for the extra details (gender, age)", true);
  await d.say("A new customer is asked for a few more details once: gender and age (email is optional).", 1800);
  await d.click(d.page.getByRole("group", { name: "Gender" }).getByRole("button", { name: "Male", exact: true }));
  await d.type(d.page.getByRole("spinbutton", { name: "Age" }), "31");
  await d.type(d.page.getByRole("textbox", { name: "Email" }), "rohan.mehta@example.com");
  await d.click(d.page.getByRole("button", { name: "Save and continue" }), { after: 1200 });

  /* ───────────────────────────── checkout */
  await d.page.getByText("Pay with").first().waitFor({ timeout: 20000 });
  await d.step("Signed in — the checkout page shows the order, the way to get it, and the total", 1900);
  let body = await d.page.locator("body").innerText();
  const wanted = ["Chicken Tandoori Momos", "Afghani Malai Momos", "Peri Peri Chicken Gravy", "Cold Coffee", "Sweet Lassi"];
  d.check("checkout lists everything the customer picked", wanted.every((n) => body.includes(n)));
  if (body.includes("How would you like it?")) {
    await d.click(d.page.getByRole("button", { name: /Takeaway/ }));
    d.check("checkout is on Takeaway", (await d.page.getByRole("button", { name: /Takeaway/ }).getAttribute("aria-pressed")) === "true");
  }
  d.never("checkout asks for a delivery address on a takeaway order", /delivery address|Deliver to/i.test(body) && (await d.page.getByLabel(/address/i).first().isVisible().catch(() => false)));

  await d.step("Payment: they will pay in cash at the counter when they collect", 1500);
  await d.click(d.page.locator("label", { hasText: "Cash / pay at counter" }));
  d.check("'Cash / pay at counter' is selected", await d.page.getByRole("radio", { name: /Cash \/ pay at counter/ }).isChecked());
  body = await d.page.locator("body").innerText();
  toPay = money(body.match(/To pay\s*₹\s*([\d,]+(?:\.\d+)?)/)?.[1]);
  await d.spot(d.page.getByText("To pay").first(), 1400);
  d.check("the amount to pay is at least ₹999 and equals the cart", toPay >= 999 && toPay === cartTotal, `₹${toPay} (cart bar said ₹${cartTotal})`);
  await d.shot("3-checkout");

  await d.step("They place the order", 1300);
  await d.click(d.page.getByRole("button", { name: /place order/i }), { after: 600 });
  await d.page.waitForSelector("text=/Order #\\d+ placed/", { timeout: 25000 });
  await d.pause(1200);
  orderNo = (await d.page.locator("h2", { hasText: /placed/ }).innerText()).match(/#(\d+)/)[1];
  body = await d.page.locator("body").innerText();
  await d.say(`Order #${orderNo} is placed. The customer sees a confirmation with the type, ready time, total and payment.`, 2200);
  d.check("confirmation says the kitchen has it", body.includes("The kitchen has it."));
  d.check("confirmation says Takeaway and cash at the counter", body.includes("Takeaway") && body.includes("Cash / pay at counter"));
  d.check("confirmation shows the same total", money(body.match(/Total\s*₹\s*([\d,]+(?:\.\d+)?)/)?.[1]) === toPay);
  d.check("confirmation quotes a ready time", /Ready in\s*about \d+ minutes/.test(body.replace(/\n/g, " ")));
  await d.shot("4-placed");

  /* what the server recorded at placement (asked through the API as the store's owner) */
  const owner = await d.apiAs("owner");
  const listed = await owner.call("GET", "/api/orders?limit=50", { outlet: h.ids.main });
  const placed = (listed.json?.orders ?? []).find((o) => String(o.orderNumber).replace(/\D/g, "") === orderNo.replace(/\D/g, "") || String(o.orderNumber) === orderNo);
  orderId = placed?.id ?? "";
  d.check("the server has exactly this one order for the store", listed.status === 200 && (listed.json?.orders ?? []).length === 1 && Boolean(placed), `${(listed.json?.orders ?? []).length} order(s)`);
  d.never("the order is already marked paid at placement", placed?.payment?.status === "paid", `payment: ${JSON.stringify(placed?.payment)}`);
  d.never("the takeaway order carries a delivery fee", Number(placed?.totals?.deliveryFee ?? 0) > 0, JSON.stringify(placed?.totals));
  d.never("the takeaway order carries a delivery address", Boolean(placed?.deliveryAddress), JSON.stringify(placed?.deliveryAddress));
  const custList = await owner.call("GET", "/api/customers?q=9811122233", { outlet: h.ids.main });
  const cust = custList.json?.customers?.[0];
  d.check("the new customer was saved with the details they gave", cust?.name === "Rohan Mehta" && cust?.email === "rohan.mehta@example.com" && cust?.gender === "male" && Number(cust?.age) === 31, JSON.stringify(cust));
  d.never("coins are credited before the order is completed", Number(cust?.walletBalance ?? 0) > 0, `wallet: ${cust?.walletBalance}`);

  /* ───────────────────────────── the staff side */
  await d.tab("staff", "Restaurant staff · dashboard");
  await d.step("At the counter: the new order has arrived on the dashboard — nobody refreshed the page", 2000);
  const row = d.page.locator("tr", { hasText: `#${orderNo}` }).first();
  const arrived = await row.waitFor({ timeout: 4000 }).then(() => true).catch(() => false);
  if (!arrived) await row.waitFor({ timeout: 20000 });
  d.check("the order appeared on the dashboard by itself, instantly (live connection)", arrived);
  await d.spot(row, 1800);
  const rowText = (await row.innerText()).replace(/\s+/g, " ");
  d.check("the row shows the customer, phone, type, item count, total and 'Placed'", /Rohan Mehta/.test(rowText) && /9811122233/.test(rowText) && /\bTA\b/.test(rowText) && /\b8\b/.test(rowText) && rowText.includes(String(toPay).replace(/\B(?=(\d{3})+(?!\d))/g, ",")) && /Placed/.test(rowText), rowText);
  await d.shot("5-orders-new");

  await d.step("The staff open the order to see everything in it", 1400);
  await d.click(row.getByRole("button", { name: /Show items in order/ }), { after: 1400 });
  const detail = (await d.page.locator("body").innerText()).replace(/\n+/g, " | ");
  d.check("details show the customer's name, phone and email", /Rohan Mehta/.test(detail) && /9811122233/.test(detail) && /rohan\.mehta@example\.com/.test(detail));
  d.check("details show Takeaway, placed by Customer, cash at counter, payment pending", /Takeaway/.test(detail) && /Customer/.test(detail) && /Cash on delivery \/ at counter/.test(detail) && /pending/.test(detail));
  d.check("details list the exact items and sizes", /2×\s*\|?\s*Chicken Tandoori Momos · 8 pcs/.test(detail) && /2×\s*\|?\s*Afghani Malai Momos · 8 pcs/.test(detail) && /2×\s*\|?\s*Cold Coffee/.test(detail));
  await d.scroll(300, 900);
  await d.shot("6-order-open");

  const advance = async (label, caption, how) => {
    await d.step(caption, 1700);
    await d.click(row.getByRole("button", { name: label, exact: true }));
    const dlg = d.page.getByRole("dialog", { name: "Confirm status change" });
    await dlg.waitFor();
    d.check(`asks to confirm: "Mark order #${orderNo} as ${label}?"`, (await dlg.innerText()).includes(`Mark order #${orderNo} as ${label}`));
    await d.pause(1200);
    if (how === "enter") {
      await d.say("Pressing Enter confirms (Esc would cancel).", 900);
      await d.press("Enter", 900);
    } else {
      await d.click(dlg.getByRole("button", { name: "Confirm" }), { after: 900 });
    }
    await dlg.waitFor({ state: "hidden", timeout: 8000 });
  };
  const waitPill = (label) => d.page.waitForFunction(([no, text]) => { const tr = [...document.querySelectorAll("tr")].find((r) => r.textContent.includes(`#${no}`)); return tr && new RegExp(`\\b${text}\\b`).test(tr.querySelector("td:nth-child(8)")?.textContent ?? tr.textContent); }, [orderNo, label], { timeout: 8000 }).then(() => true).catch(() => false);

  await advance("Accepted", "The staff confirm the order: “Accepted”", "click");
  d.check("status is now Accepted", await waitPill("Accepted"));
  await advance("Preparing", "The kitchen starts cooking: “Preparing”", "enter");
  d.check("status is now Preparing", await waitPill("Preparing"));
  await d.shot("7-preparing");
  await advance("Ready", "The food is packed: “Ready” for pick-up", "click");
  d.check("status is now Ready", await waitPill("Ready"));
  await d.shot("8-ready");

  /* ───────────────────────────── the customer collects */
  await d.tab("customer", "Customer · restaurant website");
  await d.say("Meanwhile the customer's screen: it says the order was placed, and has a button to follow it.", 2200);
  body = await d.page.locator("body").innerText();
  d.check("the confirmation screen has a 'Follow your order' button — an order page that moves by itself (T68 checks it)", (await d.page.getByTestId("done-follow").count()) === 1);

  await d.tab("staff", "Restaurant staff · dashboard");
  await d.say("The customer arrives, pays ₹" + toPay.toLocaleString("en-IN") + " in cash and takes the food.", 2000);
  await advance("Completed", "The staff mark it “Completed” — completing also records the cash as received", "enter");
  d.check("status is now Completed", await waitPill("Completed"));
  await d.pause(800);
  const detail2 = (await d.page.locator("body").innerText()).replace(/\n+/g, " | ");
  d.check("payment is now recorded as paid (cash collected)", /Status\s*\|?\s*paid/i.test(detail2) || /paid/.test(detail2.split("Payment")[1] ?? ""));
  const hist = await d.page.locator("body").innerText();
  d.check("status history lists every step: Placed, Accepted, Preparing, Ready, Completed", ["Placed", "Accepted", "Preparing", "Ready", "Completed"].every((s) => hist.includes(s)));
  await d.scroll(400, 900);
  await d.spot(d.page.getByText("Status history").first(), 1600);
  await d.shot("9-completed");

  await d.step("The customer leaves with the food — the order is done and stays in the list for the records", 2200);
  const after = await owner.call("GET", `/api/customers?q=9811122233`, { outlet: h.ids.main });
  const earned = Number(after.json?.customers?.[0]?.walletBalance ?? 0);
  d.check("the customer earned loyalty coins only now, at completion (₹1,030 → 103 coins)", earned === Math.floor(toPay / 10), `${earned} coins`);

  /* ───────────────────────────── the day's numbers */
  await d.click(d.page.getByRole("link", { name: "Dashboard", exact: true }).first());
  await d.pause(2200);
  const home = (await d.page.locator("body").innerText()).replace(/\n+/g, " | ");
  const inr = toPay.toLocaleString("en-IN");
  d.check(`the Dashboard home shows Revenue today ₹${inr}, 1 order today`, new RegExp(`Revenue today\\s*\\|?\\s*₹\\s*${inr}`).test(home) && /Orders today\s*\|?\s*1\b/.test(home));
  await d.shot("10-dashboard-home");

  /* ───────────────────────────── another store must not see it */
  await d.step("Privacy: the owner of a DIFFERENT store (Beta Bites) tries to reach this order", 1200);
  const beta = await d.apiAs("betaOwner");
  const peek = await beta.call("GET", "/api/orders?limit=50", { outlet: h.ids.main });
  d.never("Beta's owner lists Acme's orders", peek.status === 200 && (peek.json?.orders ?? []).length > 0, `HTTP ${peek.status}`);
  const own = await beta.call("GET", "/api/orders?limit=50", { outlet: h.ids.only });
  d.never("Beta's own order list shows Acme's order", (own.json?.orders ?? []).some((o) => o.id === orderId), `${(own.json?.orders ?? []).length} order(s) in Beta's list`);
  const read = await beta.call("GET", `/api/orders/${orderId}?outletId=${h.ids.main}`);
  const ownRead = await owner.call("GET", `/api/orders/${orderId}?outletId=${h.ids.main}`);
  d.check("(control) Acme's own owner can still read the order by its id", ownRead.status === 200 && ownRead.json?.order?.id === orderId, `HTTP ${ownRead.status}`);
  const leaked = read.status === 200 && Boolean(read.json?.order);
  d.never("Beta's owner reads Acme's order by its id", leaked, `HTTP ${read.status}`);
  if (leaked) d.finding(`SECURITY: GET /api/orders/:id?outletId=… returns ANY store's order — including the customer's name, phone and email — to ANY signed-in dashboard user, because the "signed-in staff" branch of that route (apps/api/src/modules/orders/orders.routes.js, ordersRouter.get("/:id")) builds its context from the client-supplied outletId and never checks the user's membership of that outlet's store. Needs the order's id (not guessable, but it appears in links/logs). Fix: use requireOutletContext (or check membershipFor) in that branch.`);
  const patch = await beta.call("PATCH", `/api/orders/${orderId}/status`, { outlet: h.ids.main, body: { status: "cancelled" } });
  d.never("Beta's owner changes the status of Acme's order", patch.status === 200, `HTTP ${patch.status}`);

  d.never("the browser logged JavaScript errors during the flow", d.problems.length > 0, d.problems.join(" | "));
  await d.say("Test finished.", 0);
}
