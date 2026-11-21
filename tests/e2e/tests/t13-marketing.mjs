// T13 — Marketing: reach customers over linked WhatsApp, SMS or the WhatsApp Business API, to the right people. All in Chrome.
// The store is "Marketing Mart" (see bench/serve-bench.mjs): a handful of customers who differ in age, gender, last visit,
// items ordered, order types and delivery area, one of whom said STOP, one with no phone number, one who never ordered.
import http from "node:http";
import { BENCH } from "../bench/watch.mjs";
import * as ui from "../bench/ui.mjs";

export const meta = {
  id: "t13-marketing",
  title: "Marketing — channels, audience filters (last visit, items, age, gender, order type, area), imports, lists, sending and the sidebar",
  area: "marketing",
  fresh: true,
  summary: "In Chrome as the owner of Marketing Mart: the sidebar keeps running the store (take order, orders, menu…) above a divider and everything else below it; Marketing shows which of the three channels are ready; the live audience count and example people follow every filter exactly (hasn't ordered for N days/weeks/months — whole store or one outlet; ordered chosen items at least N times; age today (grows each year); gender; many takeaways; delivery area); pasted numbers, WhatsApp contacts and saved lists can be mixed in without anyone counted twice; people who said STOP, customers without a phone, and people who never ordered are left out correctly. Then the owner sets up an SMS gateway (a fake one the test runs), sends a personalised SMS campaign and the gateway receives exactly the right numbers; a linked-WhatsApp campaign is queued and cancelled.",
  expect: [
    "The sidebar lists Take order, Dashboard, Orders, Menu, Tables and Printing first; then a divider; then Customers, Marketing, WhatsApp and Coupons; then Storefront and Settings.",
    "Marketing shows linked WhatsApp as Ready, and SMS and the WhatsApp Business API as not available until set up (with the reason and a link to set them up).",
    "With no filters, 'My customers' is everyone with a phone number: 6 people; the page says one said STOP and one has no phone.",
    "'Hasn't ordered for 2 months' = Ravi and Karan; with 'also never ordered' + Dev; 30 days adds Sana; looking at one outlet only counts visits there.",
    "'Ordered these items' (Paneer Steamed + Paneer Gravy momos) = Ravi and Priya; 'at least 5 in total' = Ravi; 'all, at least 4 of each' = nobody; 'last month only' = Priya.",
    "Age uses today's age: 24 in 2020 is 30 in 2026 (Ravi); 19 in 2024 is 21 (Sana); a range finds everyone between.",
    "Gender, 'orders a lot of one type' (3+ takeaways = Ravi and Sana; 4+ = Sana; 2+ deliveries = Meena) and area ('Laxmi Nagar', or within 2 km of an outlet = Meena) each give exactly those people; filters combine (women AND 30 days = Sana).",
    "WhatsApp contacts add a person who isn't a customer; pasted numbers show how many are usable, repeated or unusable; the same person from two sources counts once.",
    "A saved contact list can be created, grown, viewed, used as an audience and deleted.",
    "An SMS campaign to the lapsed customers reaches the gateway for exactly Ravi's and Karan's numbers, each message with that person's own name and the store's name, and the Campaigns page says 2 sent, 0 failed, Done.",
    "A linked-WhatsApp campaign queues its messages (the sending worker is off in the bench) and can be cancelled; the report says Cancelled with nothing waiting.",
    "The Customers page shows each person's age as it is today.",
  ],
  expectNot: [
    "A channel that isn't set up must NOT be selectable.",
    "'Review and send' must NOT be possible with no message or nobody in the audience.",
    "A customer who said STOP must NOT be in any audience or receive any message.",
    "A customer with no phone number must NOT be counted as someone who can be messaged.",
    "People who never ordered must NOT appear in 'hasn't ordered for' unless that is switched on.",
    "The same person must NOT be counted or messaged twice because they are in two groups.",
    "The SMS gateway must NOT be called for anyone outside the audience.",
    "The browser must NOT log JavaScript errors.",
  ],
};

const yr = new Date().getFullYear();
const ageOf = { ravi: 24 + (yr - 2020), sana: 19 + (yr - 2024) };
const OWNER = ["o@mart.test", "Owner123!"];
const eq = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

export async function run(d, h) {
  // a pretend SMS gateway on this computer: it just notes every request it is asked to send
  const received = [];
  const gateway = http.createServer((req, res) => { received.push(new URL(req.url, "http://x")); res.end(`MSG-${received.length}`); });
  await new Promise((r) => gateway.listen(3098, "127.0.0.1", r));
  try {
    await d.tab("dashboard", "Store dashboard · owner of Marketing Mart");
    await ui.signIn(d, OWNER);

    /* ----------------------------------------------------------------- sidebar */
    await d.step("The sidebar: running the store above a divider, everything else below it");
    const groups = await ui.sidebarGroups(d);
    d.check("first group 'Store & orders': Take order, Dashboard, Orders, Kitchen display, Bookings, Menu, Tables, Printing", groups[0]?.group === "Store & orders" && JSON.stringify(groups[0].items) === JSON.stringify(["Take order", "Dashboard", "Orders", "Kitchen display", "Bookings", "Menu", "Tables", "Printing"].filter((n) => groups[0].items.includes(n))) && ["Take order", "Dashboard", "Orders", "Menu", "Tables"].every((n) => groups[0].items.includes(n)), JSON.stringify(groups[0]));
    d.check("a divider comes before the second group", groups[1]?.divider === true && groups[0]?.divider === false, JSON.stringify(groups.map((g) => [g.group, g.divider])));
    d.check("second group 'Customers & growth': Customers, Marketing, WhatsApp, Coupons", ["Customers", "Marketing", "WhatsApp", "Coupons"].every((n) => groups[1]?.items.includes(n)), JSON.stringify(groups[1]));
    d.check("third group 'Setup': Storefront and Settings", groups[2]?.group === "Setup" && groups[2].items.includes("Storefront") && groups[2].items.includes("Settings"), JSON.stringify(groups[2]));
    d.never("Marketing or WhatsApp is mixed in with the store-and-orders group", groups[0].items.some((n) => ["Marketing", "WhatsApp", "Customers", "Coupons", "Settings", "Storefront"].includes(n)), groups[0].items.join(", "));
    await d.shot("sidebar");

    /* ---------------------------------------------------------------- channels */
    await d.step("Marketing: which ways of reaching customers are ready?");
    await ui.openMarketing(d);
    await d.page.getByText("How do you want to reach them?").waitFor({ timeout: 15000 });
    const radio = (n) => d.page.getByRole("radio", { name: n });
    await radio("WhatsApp (linked numbers)").waitFor();
    await d.pause(900);
    d.check("linked WhatsApp is Ready and can be chosen", await radio("WhatsApp (linked numbers)").isEnabled());
    d.never("SMS can be chosen before it is set up", await radio("SMS").isEnabled());
    d.never("the WhatsApp Business API can be chosen before it is set up", await radio("WhatsApp Business API").isEnabled());
    const cards = await ui.text(d);
    d.check("SMS and the Business API say why, with a way to set them up", /Your SMS gateway isn't set up yet/.test(cards) && /Your WhatsApp Business API isn't set up yet/.test(cards) && (await d.page.getByRole("link", { name: "Set it up →" }).count()) === 2);
    await d.shot("channels");

    /* ---------------------------------------------------------------- audience */
    await d.step("Who gets it — with no filters");
    await ui.tick(d, "My customers", true);
    const baseline = await ui.audienceCount(d);
    d.check("My customers, no filters: 6 people have a phone number", baseline === 6, `${baseline}`);
    const page0 = await ui.text(d);
    d.check("…and the page says who was left out: 1 said STOP, 1 has no phone number", /1 said STOP/.test(page0) && /1 customer without a phone number/.test(page0), page0.match(/Left out:[^.]*\./)?.[0]);
    d.never("the person who said STOP is in the example list", (await ui.audienceNames(d)).includes("Stop Sam"));
    d.never("the customer with no phone number is in the example list", (await ui.audienceNames(d)).includes("Mail Only"));

    await d.step("Filter: hasn't ordered for …");
    await ui.tick(d, "Hasn't ordered for", true);
    await ui.fill(d, "For more than", 2);
    await ui.pick(d, "Unit", "months");
    const lapsed = await ui.whoGetsIt(d);
    d.check("not ordered for 2 months → Ravi and Karan", eq(lapsed, ["Karan Singh", "Ravi Kumar"]), lapsed.join(", "));
    d.never("Dev (signed up, never ordered) is counted as a lapsed customer", lapsed.includes("Dev Patel"));
    await ui.tick(d, "Also include people who signed up but never ordered", true);
    d.check("…with 'also people who never ordered' → Dev joins", eq(await ui.whoGetsIt(d), ["Dev Patel", "Karan Singh", "Ravi Kumar"]));
    await ui.tick(d, "Also include people who signed up but never ordered", false);
    await ui.pick(d, "Unit", "days");
    await ui.fill(d, "For more than", 30);
    await ui.audienceCount(d);
    d.check("not ordered for 30 days → Karan, Ravi and Sana", eq(await ui.audienceNames(d), ["Karan Singh", "Ravi Kumar", "Sana Khan"]), (await ui.audienceNames(d)).join(", "));
    await ui.pick(d, "Unit", "weeks");
    await ui.fill(d, "For more than", 4);
    await ui.audienceCount(d);
    d.check("4 weeks is understood the same way", eq(await ui.audienceNames(d), ["Karan Singh", "Ravi Kumar", "Sana Khan"]));
    await ui.pick(d, "Unit", "days");
    await ui.fill(d, "For more than", 30);
    await ui.tick(d, "Marketing Mart — Second", true);
    await ui.audienceCount(d);
    d.check("looking at the Second outlet only → Karan and Sana (Ravi never ordered there)", eq(await ui.audienceNames(d), ["Karan Singh", "Sana Khan"]), (await ui.audienceNames(d)).join(", "));
    await ui.tick(d, "Whole store (every outlet)", true);
    await ui.tick(d, "Hasn't ordered for", false);

    await d.step("Filter: ordered these items");
    await ui.tick(d, "Ordered these items", true);
    await ui.fill(d, "Search menu items", "paneer");
    await d.click(d.page.getByRole("button", { name: "Paneer Steamed Momos", exact: true }), { after: 300 });
    await ui.fill(d, "Search menu items", "paneer");
    await d.click(d.page.getByRole("button", { name: "Paneer Gravy Momos", exact: true }), { after: 300 });
    await ui.audienceCount(d);
    d.check("ordered Paneer Steamed or Paneer Gravy momos → Ravi and Priya", eq(await ui.audienceNames(d), ["Priya Nair", "Ravi Kumar"]), (await ui.audienceNames(d)).join(", "));
    await ui.fill(d, "At least (quantity)", 5);
    await ui.audienceCount(d);
    d.check("…at least 5 in total → Ravi only", eq(await ui.audienceNames(d), ["Ravi Kumar"]));
    await ui.pick(d, "Must have ordered", "All of these items");
    await ui.fill(d, "At least (quantity)", 4);
    d.check("…ALL of them, at least 4 of each → nobody (Ravi had only 3 gravy)", (await ui.audienceCount(d)) === 0);
    await ui.fill(d, "At least (quantity)", 2);
    await ui.audienceCount(d);
    d.check("…ALL of them, at least 2 of each → Ravi", eq(await ui.audienceNames(d), ["Ravi Kumar"]));
    await ui.pick(d, "Must have ordered", "Any of these items");
    await ui.fill(d, "At least (quantity)", 1);
    await ui.tick(d, "Only count recent orders", true);
    await ui.fill(d, "From the last", 1);
    await ui.pick(d, "Window unit", "months");
    await ui.audienceCount(d);
    d.check("…only orders from the last month → Priya", eq(await ui.audienceNames(d), ["Priya Nair"]), (await ui.audienceNames(d)).join(", "));
    await ui.tick(d, "Only count recent orders", false);
    await ui.tick(d, "Ordered these items", false);

    await d.step("Filter: age today (it grows each year)");
    await ui.tick(d, "Age", true);
    await ui.fill(d, "Age today", ageOf.ravi);
    await ui.audienceCount(d);
    d.check(`age ${ageOf.ravi} → Ravi (he said 24 in 2020)`, eq(await ui.audienceNames(d), ["Ravi Kumar"]), (await ui.audienceNames(d)).join(", "));
    d.check(`…and the example row shows his age as ${ageOf.ravi}`, (await d.page.locator("tbody tr", { hasText: "Ravi Kumar" }).innerText()).includes(String(ageOf.ravi)));
    await ui.fill(d, "Age today", ageOf.sana);
    await ui.audienceCount(d);
    d.check(`age ${ageOf.sana} → Sana (she said 19 in 2024)`, eq(await ui.audienceNames(d), ["Sana Khan"]), (await ui.audienceNames(d)).join(", "));
    d.never(`someone who said 19 in 2024 is still counted as 19`, (await ui.audienceCount(d)) > 0 && (await d.page.locator("tbody tr", { hasText: "Sana Khan" }).innerText()).split(/\s+/).includes("19"));
    await ui.pick(d, "Match", "An age range");
    await ui.fill(d, "From age", ageOf.sana);
    await ui.fill(d, "To age", ageOf.ravi);
    await ui.audienceCount(d);
    d.check(`ages ${ageOf.sana} to ${ageOf.ravi} → Sana, Meena and Ravi`, eq(await ui.audienceNames(d), ["Meena Iyer", "Ravi Kumar", "Sana Khan"]), (await ui.audienceNames(d)).join(", "));
    await ui.tick(d, "Age", false);

    await d.step("Filter: gender, and filters working together");
    await ui.tick(d, "Gender", true);
    await ui.tick(d, "Female", true);
    await ui.audienceCount(d);
    d.check("women → Meena, Priya and Sana (Mail Only has no phone)", eq(await ui.audienceNames(d), ["Meena Iyer", "Priya Nair", "Sana Khan"]), (await ui.audienceNames(d)).join(", "));
    await ui.tick(d, "Hasn't ordered for", true);
    await ui.fill(d, "For more than", 30);
    await ui.audienceCount(d);
    d.check("women AND not ordered for 30 days → Sana", eq(await ui.audienceNames(d), ["Sana Khan"]), (await ui.audienceNames(d)).join(", "));
    await ui.tick(d, "Hasn't ordered for", false);
    await ui.tick(d, "Female", false);
    await ui.tick(d, "Gender", false);

    await d.step("Filter: more takeaways, and area");
    await ui.tick(d, "Orders a lot of one type", true);
    await ui.fill(d, "At least (orders)", 3);
    await ui.audienceCount(d);
    d.check("3 or more takeaway orders → Ravi and Sana", eq(await ui.audienceNames(d), ["Ravi Kumar", "Sana Khan"]), (await ui.audienceNames(d)).join(", "));
    await ui.fill(d, "At least (orders)", 4);
    await ui.audienceCount(d);
    d.check("4 or more → Sana", eq(await ui.audienceNames(d), ["Sana Khan"]));
    await ui.pick(d, "Order type", "Delivery");
    await ui.fill(d, "At least (orders)", 2);
    await ui.audienceCount(d);
    d.check("2 or more deliveries → Meena", eq(await ui.audienceNames(d), ["Meena Iyer"]));
    await ui.tick(d, "Orders a lot of one type", false);
    await ui.tick(d, "Lives in an area", true);
    await ui.fill(d, "Delivery address contains", "laxmi nagar");
    await ui.audienceCount(d);
    d.check("delivered to an address in 'Laxmi Nagar' → Meena", eq(await ui.audienceNames(d), ["Meena Iyer"]));
    await ui.fill(d, "Delivery address contains", "Noida");
    d.check("an area nobody was delivered to → nobody", (await ui.audienceCount(d)) === 0);
    await ui.fill(d, "Delivery address contains", "");
    await ui.tick(d, "Also only people within a distance of an outlet", true);
    await ui.pick(d, "Of this outlet", "Marketing Mart — Main");
    await ui.fill(d, "Within (km)", 2);
    await ui.audienceCount(d);
    d.check("within 2 km of the Main outlet → Meena", eq(await ui.audienceNames(d), ["Meena Iyer"]), (await ui.audienceNames(d)).join(", "));
    await ui.tick(d, "Lives in an area", false);

    await d.step("Other groups: WhatsApp contacts and pasted numbers");
    await ui.tick(d, "My customers", false);
    await ui.tick(d, "People who messaged us on WhatsApp", true);
    d.check("people who messaged on WhatsApp → Chat Only Chandni (a contact who isn't a customer)", eq(await ui.whoGetsIt(d), ["Chat Only Chandni"]));
    d.never("Stop Sam (who said STOP) is among the WhatsApp contacts", (await ui.audienceNames(d)).includes("Stop Sam"));
    await ui.tick(d, "People who messaged us on WhatsApp", false);
    await ui.tick(d, "Numbers I paste or upload", true);
    await ui.fillBox(d, "Phone numbers", "Asha, 98765 43210\n9876543210\ncall me 123\n+91 90000 00001");
    d.check("pasted numbers → 2 people (a repeat merged, one line unusable)", (await ui.audienceCount(d)) === 2);
    const pasted = await ui.text(d);
    d.check("…and the page says 2 usable, 1 can't be used, 1 repeated", /2 usable/.test(pasted) && /1 can't be used/.test(pasted) && /1 repeated/.test(pasted), pasted.match(/\d+ usable[^|]{0,60}/)?.[0]);
    await ui.tick(d, "My customers", true);
    await ui.tick(d, "Gender", true);
    await ui.tick(d, "Male", true);
    await ui.fillBox(d, "Phone numbers", "9000000001\n9111111111");
    d.check("men from the customer list + 2 typed numbers = 3 (Ravi is in both, counted once)", (await ui.audienceCount(d)) === 3 && (await ui.audienceNames(d)).filter((n) => n === "Ravi Kumar").length === 1, (await ui.audienceNames(d)).join(", "));
    await ui.tick(d, "Male", false);
    await ui.tick(d, "Gender", false);
    await ui.tick(d, "Numbers I paste or upload", false);
    await d.shot("audience");

    /* -------------------------------------------------------------- contact lists */
    await d.step("Contact lists: create one, grow it, use it, delete one");
    await ui.openMarketing(d, "lists");
    await ui.fill(d, "List name", "VIP guests");
    await d.type(d.page.getByLabel("Numbers for the new list"), "Zed, 9111111111\n9222222222", { after: 200, delay: 10 });
    await d.click(d.page.getByRole("button", { name: "Save list" }), { after: 1000 });
    d.check("the list is saved with 2 people", /“VIP guests” saved with 2 people/.test(await ui.text(d)));
    const row = d.page.locator("[data-list='VIP guests']");
    d.check("it is listed with its count", /2 people/.test(await row.innerText()));
    d.check("viewing it shows Zed and the other number", /Zed/.test(await row.innerText()) && /\+91 92222 22222/.test(await row.innerText()));
    await ui.fillBox(d, "Add more numbers", "9333333333\n9111111111");
    await d.click(row.getByRole("button", { name: "Add", exact: true }), { after: 900 });
    d.check("adding more puts the new one in and skips the repeat", /1 added, 1 already there/.test(await ui.text(d)) && /3 people/.test(await row.innerText()));
    await ui.fill(d, "List name", "Temp list");
    await d.type(d.page.getByLabel("Numbers for the new list"), "9444444444", { after: 200, delay: 10 });
    await d.click(d.page.getByRole("button", { name: "Save list" }), { after: 900 });
    await d.click(d.page.getByRole("button", { name: "Delete Temp list" }), { after: 900 });
    d.never("the deleted list is still listed", /Temp list/.test(await d.page.locator("[data-list]").allInnerTexts().then((t) => t.join(" "))));
    await ui.openMarketing(d);
    await ui.tick(d, "My customers", false);
    await ui.tick(d, "Saved contact lists", true);
    d.check("the saved list works as an audience: 3 people", (await ui.audienceCount(d)) === 3, (await ui.audienceNames(d)).join(", "));
    await d.shot("lists");

    /* --------------------------------------------------------- send nothing yet */
    await d.step("Guard rails: nothing can be sent without a channel, a message and people");
    await ui.tick(d, "Saved contact lists", false);
    const review = d.page.getByRole("button", { name: "Review and send" });
    d.never("'Review and send' is possible with nobody in the audience, no channel and no message", await review.isEnabled());

    /* --------------------------------------------------------------- SMS set up */
    await d.step("Set up SMS in Notifications, then it becomes available");
    await ui.configureSms(d, { requestUrl: "http://127.0.0.1:3098/sms?key={{apiKey}}&to={{to}}&msg={{message}}", apiKey: "K123", method: "GET" });
    await ui.openMarketing(d);
    await d.page.getByRole("radio", { name: "SMS" }).waitFor();
    await d.pause(900);
    d.check("SMS now shows as Ready and can be chosen", await d.page.getByRole("radio", { name: "SMS" }).isEnabled());
    d.check("the Business API still isn't set up", !(await d.page.getByRole("radio", { name: "WhatsApp Business API" }).isEnabled()));

    /* ------------------------------------------------------------ send over SMS */
    await d.step("Send an SMS campaign to customers who haven't ordered for 2 months");
    await d.click(d.page.getByRole("radio", { name: "SMS" }), { after: 300 });
    await ui.tick(d, "Hasn't ordered for", true);
    await ui.fill(d, "For more than", 2);
    await ui.pick(d, "Unit", "months");
    d.check("the audience is Ravi and Karan", (await ui.audienceCount(d)) === 2 && eq(await ui.audienceNames(d), ["Karan Singh", "Ravi Kumar"]));
    d.never("'Review and send' works before a message is written", await review.isEnabled());
    await d.type(d.page.getByLabel("Message", { exact: true }), "Hi {{customerName}}, we miss you at {{storeName}}! Show this SMS for 20% off.", { after: 300, delay: 8 });
    d.check("a preview shows the message with a sample name", /How it looks for/.test(await ui.text(d)));
    await ui.fill(d, "Campaign name", "Win-back SMS");
    await d.click(review, { after: 600 });
    const dlg = d.page.getByRole("dialog", { name: "Send campaign" });
    d.check("the confirmation says who and over what", /Send to 2 people\?/.test(await dlg.innerText()) && /SMS/.test(await dlg.innerText()), (await dlg.innerText()).slice(0, 120));
    await d.shot("confirm");
    await d.click(dlg.getByRole("button", { name: "Send now" }), { after: 1200 });
    d.check("the page says the campaign is on its way", /“Win-back SMS” is on its way/.test(await ui.text(d)));
    await ui.openMarketing(d, "campaigns");
    const camp = d.page.locator("[data-campaign='Win-back SMS']");
    d.check("Campaigns: it finishes with 2 sent, 0 waiting, 0 failed", await ui.until(async () => /2 sent · 0 waiting · 0 failed/.test(await camp.innerText()) && /Done/.test(await camp.innerText()), 25000), (await camp.innerText().catch(() => "")).replace(/\s+/g, " "));
    await d.shot("campaign-done");
    const numbers = received.map((u) => u.searchParams.get("to")).sort();
    d.check("the SMS gateway was asked to send to exactly Ravi's and Karan's numbers", eq(numbers, ["9000000001", "9000000003"]), numbers.join(", "));
    d.never("the gateway was asked to message anyone else (Stop Sam, Dev, Meena, Sana, Priya…)", numbers.some((n) => !["9000000001", "9000000003"].includes(n)));
    d.never("someone got the same message twice", new Set(numbers).size !== numbers.length);
    const texts = received.map((u) => u.searchParams.get("msg"));
    d.check("each text starts with that person's own name and has the store's name", texts.some((t) => t.startsWith("Hi Ravi Kumar, we miss you at Marketing Mart!")) && texts.some((t) => t.startsWith("Hi Karan Singh, we miss you at Marketing Mart!")), texts[0]);
    d.check("the gateway key from Notifications was used", received.every((u) => u.searchParams.get("key") === "K123"));

    /* ----------------------------------------------------------- linked WhatsApp */
    await d.step("Send over linked WhatsApp, then cancel it before it goes out");
    await ui.openMarketing(d);
    await d.click(d.page.getByRole("radio", { name: "WhatsApp (linked numbers)" }), { after: 300 });
    await ui.tick(d, "Gender", true);
    await ui.tick(d, "Female", true);
    d.check("women → 3 people", (await ui.audienceCount(d)) === 3);
    await d.type(d.page.getByLabel("Message", { exact: true }), "Hi {{customerName}}! Fresh momos at {{storeName}} today.", { after: 300, delay: 8 });
    await ui.fill(d, "Campaign name", "Ladies offer");
    d.check("the page tells her about the STOP line that is added", /Reply STOP to stop offers/.test(await ui.text(d)));
    await d.click(d.page.getByRole("button", { name: "Review and send" }), { after: 600 });
    d.check("the confirmation explains the slow, careful pace for new contacts", /a day per linked number/.test(await d.page.getByRole("dialog", { name: "Send campaign" }).innerText()));
    await d.click(d.page.getByRole("dialog", { name: "Send campaign" }).getByRole("button", { name: "Send now" }), { after: 1200 });
    await ui.openMarketing(d, "campaigns");
    const wa = d.page.locator("[data-campaign='Ladies offer']");
    d.check("it is queued: 3 waiting, still Sending (the sending worker is off here)", await ui.until(async () => /0 sent · 3 waiting/.test(await wa.innerText()) && /Sending/.test(await wa.innerText()), 15000), (await wa.innerText().catch(() => "")).replace(/\s+/g, " "));
    await d.click(wa.getByRole("button", { name: "Cancel" }), { after: 1200 });
    d.check("cancelling stops it: Cancelled, nothing waiting", await ui.until(async () => /Cancelled/.test(await wa.innerText()) && /0 waiting/.test(await wa.innerText()), 12000), (await wa.innerText()).replace(/\s+/g, " "));
    await d.shot("campaigns");

    /* --------------------------------------------------------- ages on the list */
    await d.step("The Customers page shows ages as they are today");
    await d.goto(`${BENCH.admin}/customers`, 600);
    const ravi = d.page.locator("tr", { hasText: "Ravi Kumar" });
    await ravi.waitFor({ timeout: 15000 });
    d.check(`Ravi (24 in 2020) shows ${ageOf.ravi}`, (await ravi.innerText()).split(/\s+/).includes(String(ageOf.ravi)), (await ravi.innerText()).replace(/\s+/g, " "));
    d.check(`Sana (19 in 2024) shows ${ageOf.sana}`, (await d.page.locator("tr", { hasText: "Sana Khan" }).innerText()).split(/\s+/).includes(String(ageOf.sana)));

    d.never("the browser logged JavaScript errors", d.problems.length > 0, d.problems.join(" | "));
  } finally {
    gateway.close();
  }
}
