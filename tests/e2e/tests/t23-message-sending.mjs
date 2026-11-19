// T23 — Settings → Message sending: map how verification codes (sign-up / sign-in) go out — linked WhatsApp, WhatsApp Business or SMS. All in Chrome.
// The store is Acme Momos (Pro plan). A stand-in "connected WhatsApp number" (bench control port 3095), a pretend SMS gateway
// (:3098) and a pretend Meta (:3096) let the test see exactly what each way sends, to whom, and with which code.
import http from "node:http";
import { BENCH } from "../bench/watch.mjs";
import * as ui from "../bench/ui.mjs";

export const meta = {
  id: "t23-message-sending",
  title: "Message sending — codes by linked WhatsApp / WhatsApp Business / SMS, chosen by the owner",
  area: "notifications",
  fresh: true,
  summary: "In Chrome as the owner of Acme Momos: Settings → Message sending offers four ways to send the sign-in code (linked WhatsApp, WhatsApp Business, SMS, don't send) and says which are ready and why not. Before anything is set up the customer is shown the code on screen. After the owner links a number and chooses it, a new customer signing up on the storefront gets the code on WhatsApp from the store's own number, in the store's own words — it is never shown on screen, 123456 no longer works, and a wrong code is refused. A number that isn't on WhatsApp is told so; with the number offline the customer is asked to try later (and is not shown the code). Then the same for an SMS gateway and for WhatsApp Business (the template, language and Copy-code button arrive at Meta exactly). Choosing a way that isn't set up is refused, a store without the plan features doesn't get the page, and choosing 'Don't send' brings back the on-screen code.",
  expect: [
    "Settings has a 'Message sending' tab; it lists linked WhatsApp, WhatsApp Business, SMS and 'Don't send', with 'Ready' or 'Needs setting up' (and the reason) on each.",
    "Before the owner chooses anything, 'Don't send' is selected, a note says codes are not being sent yet, and a new customer is shown the code on screen.",
    "A way that isn't set up can't be chosen (its radio is disabled); the Save button stays off until something changes.",
    "Choosing linked WhatsApp with a connected number: the preview shows the store's own wording with a sample code; after saving and reloading it is still chosen.",
    "A new customer asks for a code: the screen says it was sent on WhatsApp, the store's number sends it to that customer's number in the store's own words, the code is NOT on screen, 123456 is refused, the real code signs them up.",
    "A number that isn't on WhatsApp is told so; with the store's number offline the customer is asked to try again later — and no code is shown or sent.",
    "SMS: once the gateway is set up it can be chosen; the gateway receives the code in the store's 'Code message' wording for the customer's number; the screen says by SMS.",
    "WhatsApp Business: a missing template name is refused with a clear message; with a template, Meta receives the template name, language, the code as {{1}} and (when ticked) in the Copy-code button, with the store's token.",
    "Staff asking a customer for a coin code use the same chosen way.",
    "'Don't send' brings back the on-screen code and 123456.",
  ],
  expectNot: [
    "A code must NOT be shown on screen, or accepted as 123456, once a real way of sending is chosen — even when that way is offline.",
    "A way that isn't ready must NOT be selectable.",
    "A code must NOT be sent over a way other than the chosen one.",
    "The browser must NOT log JavaScript errors.",
  ],
};

const WA = "http://127.0.0.1:3095"; // the bench's stand-in for a connected linked number
const waSent = async () => (await fetch(`${WA}/wa/sent`)).json();
const waDo = (path, query = "") => fetch(`${WA}${path}?${query}`, { method: "POST" }).then((r) => r.json());
const text = (d) => ui.text(d);

export async function run(d, h) {
  // a pretend SMS gateway (it notes every request) and a pretend Meta (it notes every WhatsApp Business message)
  const sms = [];
  const gateway = http.createServer((req, res) => { sms.push(new URL(req.url, "http://x")); res.end(`MSG-${sms.length}`); });
  await new Promise((r) => gateway.listen(3098, "127.0.0.1", r));
  const meta = [];
  const fakeMeta = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try { meta.push({ path: req.url, auth: req.headers.authorization, body: JSON.parse(body || "{}") }); } catch { meta.push({ path: req.url, auth: req.headers.authorization, body: {} }); }
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ messages: [{ id: `wamid.${meta.length}` }] }));
    });
  });
  await new Promise((r) => fakeMeta.listen(3096, "127.0.0.1", r));

  try {
    await d.tab("owner", "Store dashboard · owner of Acme Momos");
    // the bench's seeded numbers look online for their first 90 seconds — start from "no number linked"
    await waDo("/wa/reset", `brand=${h.ids.brandA}`);
    await waDo("/wa/clear");
    await ui.signIn(d, "owner");

    /* ------------------------------------------------------------- one customer asking for a code */
    // a fresh customer on the storefront: opens the menu, adds an item, and arrives at "Sign in to order"
    const customerAsks = async ({ name, phone }) => {
      await d.tab("customer", "Customer · Acme Momos storefront");
      await d.context.clearCookies({ name: "onetap_customer" });
      await d.goto(BENCH.storefront + "/main", 300);
      const group = d.page.getByRole("group", { name: "Order type" });
      if (await group.isVisible().catch(() => false)) await d.click(group.getByRole("button", { name: "Takeaway" }), { after: 300 });
      await ui.addToCart(d, "Veg Steamed Momos", {});
      await d.click(d.page.getByRole("link", { name: /View cart/ }), { after: 600 });
      await d.page.waitForURL(/\/order/);
      await d.page.getByText("Sign in to order").first().waitFor({ timeout: 15000 });
      await d.type(d.page.getByRole("textbox", { name: "Your name" }), name, { after: 150, delay: 15 });
      await d.type(d.page.getByRole("textbox", { name: "Mobile number" }), phone, { after: 150, delay: 15 });
      await d.click(d.page.getByRole("button", { name: "Send code" }), { after: 600 });
      // either the code step opens, or a message says why not
      await ui.until(async () => /Enter the code|isn't on WhatsApp|can't send the code|Couldn't send|valid mobile/i.test(await text(d)), 30000);
      return text(d);
    };
    // the six boxes: empty them first (a wrong try leaves its digits there), then type the code and verify
    const typeCode = async (code) => {
      await d.page.getByLabel("Digit 6 of 6").click();
      for (let i = 0; i < 14; i++) await d.page.keyboard.press("Backspace");
      await d.click(d.page.getByLabel("Digit 1 of 6"), { after: 150 });
      await d.page.keyboard.type(code, { delay: 60 });
      await d.click(d.page.getByRole("button", { name: "Verify code" }), { after: 1000 });
    };
    const signedUp = async () => d.page.getByText("Just a couple more details").first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
    const codeFrom = (list, phone) => list.filter((m) => m.jid === `91${phone}@s.whatsapp.net`).map((m) => m.text.match(/\d{6}/)?.[0]).filter(Boolean).pop();

    /* ------------------------------------------------------------- the page, before anything is chosen */
    await d.step("The owner opens Settings → Message sending", 700);
    await d.goto(BENCH.admin + "/settings", 400);
    d.check("Settings has a 'Message sending' tab", (await d.page.getByRole("link", { name: "Message sending" }).count()) > 0);
    await d.click(d.page.getByRole("link", { name: "Message sending" }).first(), { after: 700 });
    await d.page.getByRole("heading", { name: "Verification codes" }).waitFor({ timeout: 15000 });
    let page = await text(d);
    const radio = (label) => d.page.getByRole("radio", { name: label });
    const save = () => d.page.getByRole("button", { name: "Save", exact: true });
    d.check("it offers all four ways", ["Your linked WhatsApp number", "WhatsApp Business (Meta)", "SMS", "Don't send"].every((n) => page.includes(n)), "linked · business · SMS · don't send");
    d.check("'Don't send' is chosen, and a note says codes are not being sent yet", (await radio("Don't send (show the code on screen)").isChecked()) && /Codes are not being sent yet/.test(page));
    const linkedText = (await d.page.locator('[data-method="linked"]').innerText()).replace(/\s+/g, " ");
    d.check("linked WhatsApp says why: no number is linked yet", /No WhatsApp number is linked yet/.test(linkedText), linkedText.slice(0, 140));
    d.check("SMS and WhatsApp Business say what to set up", /SMS gateway isn't set up yet/.test(await d.page.locator('[data-method="sms"]').innerText()) && /WhatsApp Business isn't set up yet/.test(await d.page.locator('[data-method="whatsapp"]').innerText()));
    d.check("linked, WhatsApp Business and SMS are all disabled (none set up)", (await radio("Your linked WhatsApp number").isDisabled()) && (await radio("WhatsApp Business (Meta)").isDisabled()) && (await radio("SMS").isDisabled()));
    d.check("each of them shows 'Needs setting up'", (await d.page.getByText("Needs setting up").count()) === 3);
    d.check("Save is off until something changes", await save().isDisabled());
    await d.page.getByText(/^Loading Message sending/).waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
    await d.pause(500);
    await d.shot("message-sending-start");

    await d.step("Before any setup a new customer is shown the code on screen (as before)", 400);
    const before = await customerAsks({ name: "Before Setup", phone: "9811200001" });
    d.check("the code step opens and shows a 'dev code'", /Enter the code/.test(before) && /dev code/i.test(before));
    d.check("it does not claim to have sent anything", !/on WhatsApp|by SMS/.test(before.match(/We sent[^.]*\./)?.[0] ?? ""), before.match(/We sent[^.]*\./)?.[0] ?? "");

    /* ------------------------------------------------------------- link a number, choose it */
    await d.step("The owner links a WhatsApp number and its connection comes online", 500);
    await d.tab("owner", "Store dashboard · owner of Acme Momos");
    const accounts = await d.api("GET", "/api/whatsapp/accounts", { outlet: h.ids.main });
    const accId = accounts.json.accounts[0]?.id;
    d.check("the store has a linked number to switch on", Boolean(accId), `${accounts.json.accounts.length} number(s)`);
    await waDo("/wa/online", `account=${accId}`);
    await d.page.reload({ waitUntil: "load" });
    await d.page.getByRole("heading", { name: "Verification codes" }).waitFor({ timeout: 15000 });
    const linkedCard = d.page.locator('[data-method="linked"]');
    await ui.until(async () => /Ready/.test(await linkedCard.innerText()), 15000);
    d.check("linked WhatsApp now says Ready and can be chosen", /Ready/.test(await linkedCard.innerText()) && !(await radio("Your linked WhatsApp number").isDisabled()));
    d.check("SMS and WhatsApp Business still say they need setting up", (await d.page.getByText("Needs setting up").count()) === 2);

    await d.click(radio("Your linked WhatsApp number"), { after: 500 });
    d.check("choosing it shows the wording, a preview, and the number list", (await d.page.getByLabel("Message sent with the code").isVisible()) && /Preview:/.test(await text(d)) && /online/.test(await linkedCard.innerText()));
    d.check("the standard preview uses the store's name and a sample code", /Acme Momos verification code/.test(await d.page.getByTestId("code-preview").innerText()) && /\d{6} is your/.test(await d.page.getByTestId("code-preview").innerText()), (await d.page.getByTestId("code-preview").innerText()).slice(0, 80));
    d.check("Save is now on", await save().isEnabled());
    await d.shot("message-sending-linked");
    await ui.fill(d, "What the message says", "Acme code {{code}} — valid 10 minutes");
    d.check("the preview follows what is typed", /Acme code 482915 — valid 10 minutes/.test(await d.page.getByTestId("code-preview").innerText()), await d.page.getByTestId("code-preview").innerText());
    await ui.fill(d, "What the message says", "No code in this one");
    await d.click(save(), { after: 700 });
    d.check("a message without {{code}} is refused with a clear reason", /must contain \{\{code\}\}/.test(await text(d)));
    await ui.fill(d, "What the message says", "Acme code {{code}} — valid 10 minutes");
    await d.click(save(), { after: 900 });
    d.check("saving works", /Saved\. New sign-in codes now go out this way\./.test(await text(d)));
    await d.page.reload({ waitUntil: "load" });
    await d.page.getByRole("heading", { name: "Verification codes" }).waitFor({ timeout: 15000 });
    d.check("after a reload it is still the chosen way, with the same wording", (await radio("Your linked WhatsApp number").isChecked()) && (await d.page.getByLabel("Message sent with the code").inputValue()) === "Acme code {{code}} — valid 10 minutes");

    /* ------------------------------------------------------------- a customer, over linked WhatsApp */
    await d.step("A new customer asks for a code: it arrives on WhatsApp from the store's number", 400);
    await waDo("/wa/clear");
    const linkedScreen = await customerAsks({ name: "Linked Customer", phone: "9811200002" });
    d.check("the screen says the code was sent on WhatsApp", /We sent a 6-digit code to 9811200002 on WhatsApp/.test(linkedScreen), linkedScreen.match(/We sent[^.]*\./)?.[0] ?? linkedScreen.slice(0, 120));
    d.never("the code is shown on screen ('dev code')", /dev code/i.test(linkedScreen));
    const gotLinked = await ui.until(async () => codeFrom(await waSent(), "9811200002"), 15000);
    const sentNow = await waSent();
    const linkedCode = codeFrom(sentNow, "9811200002");
    d.check("the store's number sent exactly one message, to the customer's number", sentNow.length === 1 && sentNow[0].jid === "919811200002@s.whatsapp.net", JSON.stringify(sentNow.map((m) => m.jid)));
    d.check("…in the store's own words, with a 6-digit code", /^Acme code \d{6} — valid 10 minutes$/.test(sentNow[0]?.text ?? ""), sentNow[0]?.text);
    await typeCode("123456");
    d.check("the test code 123456 is refused", /That code isn't right/.test(await text(d)));
    await typeCode(linkedCode ?? "000000");
    d.check("the real code signs the customer up", await signedUp());

    await d.step("The customer who only got a code doesn't clutter the owner's WhatsApp inbox", 300);
    await d.tab("owner", "Store dashboard · owner of Acme Momos");
    const chats = await d.api("GET", "/api/whatsapp/chats", { outlet: h.ids.main });
    d.check("the owner's chat list does not contain that customer", chats.ok && !chats.json.chats.some((c) => c.phone === "919811200002"), `${chats.json.chats.length} chats`);

    await d.step("A number that isn't on WhatsApp is told so", 300);
    const notOn = await customerAsks({ name: "Not On Whatsapp", phone: "9811230000" });
    d.check("the customer is told the number isn't on WhatsApp", /isn't on WhatsApp/.test(notOn));
    d.never("a code step opened, or a code was shown", /Enter the code|dev code/i.test(notOn));

    await d.step("With the store's number offline the customer is asked to try later — and is not shown the code", 300);
    await waDo("/wa/offline", `account=${accId}`);
    await waDo("/wa/clear");
    const offlineScreen = await customerAsks({ name: "Offline Case", phone: "9811200003" });
    d.check("the customer is asked to try again in a few minutes", /can't send the code right now/.test(offlineScreen), offlineScreen.match(/We can't[^.]*\./)?.[0] ?? "");
    d.never("a code is shown on screen, or the code step opened", /dev code|Enter the code/i.test(offlineScreen));
    d.check("nothing was sent", (await waSent()).length === 0);
    await d.tab("owner", "Store dashboard · owner of Acme Momos");
    await d.page.reload({ waitUntil: "load" });
    await d.page.getByRole("heading", { name: "Verification codes" }).waitFor({ timeout: 15000 });
    page = await d.page.locator('[data-method="linked"]').innerText();
    d.check("the owner's page warns that the chosen number isn't connected", /Needs setting up/.test(page) && /isn't connected right now/.test(page), page.replace(/\s+/g, " ").slice(0, 160));
    d.check("…and linked WhatsApp stays the chosen way (nothing was switched behind their back)", await radio("Your linked WhatsApp number").isChecked());
    await waDo("/wa/online", `account=${accId}`);

    await d.step("Staff asking for a coin code use the same chosen way", 300);
    await waDo("/wa/clear");
    const cashier = await d.apiAs("cashier");
    const coins = await cashier.call("POST", "/api/orders/staff/coins-code", { body: { phone: "9876543210" }, outlet: h.ids.main });
    d.check("the coin code request is accepted", coins.ok && coins.json.sent === true, `${coins.status} ${JSON.stringify(coins.json).slice(0, 80)}`);
    await ui.until(async () => codeFrom(await waSent(), "9876543210"), 15000);
    const coinCode = codeFrom(await waSent(), "9876543210");
    d.check("the customer (Asha) got the code on WhatsApp from the store's number", /^\d{6}$/.test(coinCode ?? ""), coinCode);
    const wrong = await cashier.call("POST", "/api/orders/staff/coins-code/verify", { body: { phone: "9876543210", code: "123456" }, outlet: h.ids.main });
    d.check("123456 is refused for coins too", wrong.status === 400, `${wrong.status}`);
    const right = await cashier.call("POST", "/api/orders/staff/coins-code/verify", { body: { phone: "9876543210", code: coinCode }, outlet: h.ids.main });
    d.check("the code that was sent is accepted", right.ok, `${right.status}`);

    /* ------------------------------------------------------------- SMS */
    await d.step("SMS: set up the gateway, then choose it", 500);
    await d.tab("owner", "Store dashboard · owner of Acme Momos");
    await d.page.reload({ waitUntil: "load" });
    await d.page.getByRole("heading", { name: "Verification codes" }).waitFor({ timeout: 15000 });
    await ui.configureSms(d, { requestUrl: "http://127.0.0.1:3098/sms?key={{apiKey}}&to={{to}}&msg={{message}}", apiKey: "K123" });
    d.never("the SMS settings still offer the old 'Send login & coin codes by SMS' switch", /Send login & coin codes by SMS/.test(await text(d)));
    await ui.fill(d, "Code message", "Code {{code}} for {{store}}");
    await d.click(d.page.getByRole("button", { name: "Save", exact: true }).first(), { after: 900 });
    await d.goto(BENCH.admin + "/message-sending", 600);
    await d.page.getByRole("heading", { name: "Verification codes" }).waitFor({ timeout: 15000 });
    d.check("SMS is now Ready and can be chosen", /Ready/.test(await d.page.locator('[data-method="sms"]').innerText()) && !(await radio("SMS").isDisabled()));
    await d.click(radio("SMS"), { after: 400 });
    d.check("its preview uses the 'Code message' set under Notifications → SMS", /Code 482915 for Acme Momos/.test(await text(d)));
    await d.click(save(), { after: 900 });
    d.check("saved", /Saved\./.test(await text(d)));

    const smsScreen = await customerAsks({ name: "Sms Customer", phone: "9811200004" });
    d.check("the screen says the code was sent by SMS", /We sent a 6-digit code to 9811200004 by SMS/.test(smsScreen), smsScreen.match(/We sent[^.]*\./)?.[0] ?? "");
    d.never("the code is shown on screen", /dev code/i.test(smsScreen));
    const smsHit = sms.at(-1);
    const smsCode = smsHit?.searchParams.get("msg")?.match(/\d{6}/)?.[0];
    d.check("the gateway was asked to text exactly that customer, with the store's key", sms.length === 1 && smsHit?.searchParams.get("to") === "9811200004" && smsHit?.searchParams.get("key") === "K123", `${sms.length} request(s)`);
    d.check("…in the 'Code message' wording", /^Code \d{6} for Acme Momos$/.test(smsHit?.searchParams.get("msg") ?? ""), smsHit?.searchParams.get("msg"));
    d.check("nothing went out over WhatsApp", (await waSent()).filter((m) => m.jid === "919811200004@s.whatsapp.net").length === 0);
    await typeCode("123456");
    d.check("123456 is refused", /That code isn't right/.test(await text(d)));
    await typeCode(smsCode ?? "000000");
    d.check("the code from the SMS signs them up", await signedUp());

    /* ------------------------------------------------------------- WhatsApp Business */
    await d.step("WhatsApp Business: connection details, then a template for the code", 500);
    await d.tab("owner", "Store dashboard · owner of Acme Momos");
    await d.goto(BENCH.admin + "/notifications", 500);
    await d.click(d.page.getByRole("tab", { name: "WhatsApp", exact: true }), { after: 400 });
    await ui.fill(d, "Phone number ID", "109876543");
    await ui.fill(d, "Permanent access token", "tok_abc123");
    await d.click(d.page.getByRole("button", { name: "Save", exact: true }).first(), { after: 900 });
    await d.goto(BENCH.admin + "/message-sending", 600);
    await d.page.getByRole("heading", { name: "Verification codes" }).waitFor({ timeout: 15000 });
    d.check("WhatsApp Business is now Ready", /Ready/.test(await d.page.locator('[data-method="whatsapp"]').innerText()));
    await d.click(radio("WhatsApp Business (Meta)"), { after: 500 });
    await d.click(save(), { after: 800 });
    d.check("without a template name it is refused with a clear reason", /Enter the name of your approved WhatsApp template/.test(await text(d)), (await text(d)).match(/Enter the name[^.]*\./)?.[0] ?? "");
    await ui.fill(d, "Template name", "login_code");
    await ui.tick(d, "My template has a “Copy code” button", true);
    await d.click(save(), { after: 900 });
    d.check("saved", /Saved\./.test(await text(d)));

    const bizScreen = await customerAsks({ name: "Business Customer", phone: "9811200005" });
    d.check("the screen says the code was sent on WhatsApp", /We sent a 6-digit code to 9811200005 on WhatsApp/.test(bizScreen), bizScreen.match(/We sent[^.]*\./)?.[0] ?? "");
    d.never("the code is shown on screen", /dev code/i.test(bizScreen));
    const msg = meta.at(-1);
    const bizCode = msg?.body?.template?.components?.[0]?.parameters?.[0]?.text;
    d.check("Meta was called once, on the store's phone-number ID, with the store's token", meta.length === 1 && msg?.path === "/v20.0/109876543/messages" && msg?.auth === "Bearer tok_abc123", `${meta.length} call(s) ${msg?.path}`);
    d.check("…to the customer's number, with the approved template and language", msg?.body?.to === "919811200005" && msg?.body?.template?.name === "login_code" && msg?.body?.template?.language?.code === "en", JSON.stringify(msg?.body?.to));
    d.check("…the code fills {{1}}", /^\d{6}$/.test(bizCode ?? ""), bizCode);
    const button = msg?.body?.template?.components?.find((c) => c.type === "button");
    d.check("…and also goes to the Copy-code button", button?.sub_type === "url" && button?.parameters?.[0]?.text === bizCode, JSON.stringify(button));
    d.check("nothing went out over SMS or the linked number for this customer", sms.length === 1 && (await waSent()).filter((m) => m.jid === "919811200005@s.whatsapp.net").length === 0);
    await typeCode(bizCode ?? "000000");
    d.check("the code sent through Meta signs them up", await signedUp());

    /* ------------------------------------------------------------- plan rules */
    await d.step("A store whose plan has neither WhatsApp chat nor WhatsApp & SMS alerts", 400);
    const beta = await d.apiAs("betaOwner");
    const betaPut = await beta.call("PUT", "/api/notify/messaging", { body: { codes: { method: "linked", linkedMessage: "", whatsappTemplate: { name: "", language: "en", copyButton: false } } }, outlet: h.ids.only });
    d.check("the API refuses linked WhatsApp for that store", betaPut.status === 409 && /isn't in this store's plan/.test(betaPut.json?.error ?? ""), `${betaPut.status} ${betaPut.json?.error ?? ""}`);
    const betaSms = await beta.call("PUT", "/api/notify/messaging", { body: { codes: { method: "sms", linkedMessage: "", whatsappTemplate: { name: "", language: "en", copyButton: false } } }, outlet: h.ids.only });
    d.check("…and SMS", betaSms.status === 409, `${betaSms.status}`);
    await d.tab("owner", "Store dashboard · owner of Beta Bites");
    await ui.signIn(d, "betaOwner");
    await d.goto(BENCH.admin + "/settings", 500);
    d.never("Beta Bites' Settings tabs include 'Message sending'", (await d.page.getByRole("link", { name: "Message sending" }).count()) > 0);

    /* ------------------------------------------------------------- back to nothing */
    await d.step("Back to 'Don't send': the on-screen code and 123456 return", 400);
    await d.tab("owner", "Store dashboard · owner of Acme Momos");
    await ui.signIn(d, "owner");
    await d.goto(BENCH.admin + "/message-sending", 600);
    await d.page.getByRole("heading", { name: "Verification codes" }).waitFor({ timeout: 15000 });
    await d.click(radio("Don't send (show the code on screen)"), { after: 400 });
    d.check("a warning explains what 'Don't send' means", /123456/.test(await text(d)) && /Anyone can sign in as any phone number/.test(await text(d)));
    await d.click(save(), { after: 900 });
    d.check("saved", /Saved\./.test(await text(d)));
    const back = await customerAsks({ name: "Back To Screen", phone: "9811200006" });
    d.check("the customer is shown the code on screen again", /Enter the code/.test(back) && /dev code/i.test(back));
    await typeCode("123456");
    d.check("123456 signs them up again", await signedUp());
  } finally {
    gateway.close();
    fakeMeta.close();
    await waDo("/wa/clear").catch(() => {});
  }
}
