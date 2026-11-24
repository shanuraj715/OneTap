// T27 — The "Sign-in codes" switch on WhatsApp → Numbers: turn on sending the sign-in code from the linked numbers (a random one each time).
// All in Chrome. Acme Momos has two numbers; a stand-in "connected number" for each (bench control port 3095) records who sent what.
import { BENCH } from "../bench/watch.mjs";
import * as ui from "../bench/ui.mjs";

export const meta = {
  id: "t27-signin-codes-switch",
  title: "WhatsApp → Numbers has a 'Send sign-in codes from my WhatsApp numbers' switch; with several numbers each code leaves from a random one",
  area: "notifications",
  fresh: true,
  summary: "In Chrome as the owner of Acme Momos with two WhatsApp numbers connected but nothing chosen yet: a new customer is still shown the code on screen. On WhatsApp → Numbers a 'Sign-in codes' card says so and offers a switch right under the list of numbers. Ticking it saves at once ('On. Each code is sent from one of your 2 connected numbers, picked at random.'), survives a reload and shows as chosen under Settings → Message sending; the next customer gets the code on WhatsApp instead of on screen. Fourteen customers asking at once get their codes from both numbers. Unticking asks first (anyone could then sign in as anyone) — 'Keep sending' changes nothing, 'Stop sending' brings the on-screen code back. With no number connected the switch can't be turned on and says why; with it on and every number offline the card warns that customers can't get a code.",
  expect: [
    "WhatsApp → Numbers shows a 'Sign-in codes' card with the switch, off, saying customers are shown the code on screen.",
    "Before the switch is turned on a new customer is shown the code on screen.",
    "Ticking the switch saves immediately and says it is on, with the number of connected numbers and 'picked at random'; after a reload it is still on and Settings → Message sending has 'Your linked WhatsApp number' chosen.",
    "After that a new customer is told the code was sent on WhatsApp, sees no code on screen, and the code arrives from one of the store's numbers.",
    "Fourteen customers asking at the same moment are all sent a code and BOTH connected numbers are used.",
    "Unticking asks for confirmation; 'Keep sending' leaves it on; 'Stop sending' turns it off and the on-screen code returns.",
    "With no number connected the switch is disabled and says what to do; switched on with every number offline, the card warns that customers can't get a code.",
  ],
  expectNot: [
    "Turning the switch on must NOT need a visit to another page.",
    "With it on, the code must NOT be shown on screen.",
    "Unticking must NOT happen without the confirmation.",
    "The switch must NOT be usable when no number is connected.",
    "The browser must NOT log JavaScript errors.",
  ],
};

const WA = "http://127.0.0.1:3095";
const waDo = (path, query = "") => fetch(`${WA}${path}?${query}`, { method: "POST" }).then((r) => r.json());
const waSent = async () => (await fetch(`${WA}/wa/sent`)).json();

export async function run(d, h) {
  await d.tab("owner", "Store dashboard · owner of Acme Momos");
  // the bench's seeded numbers look online for their first 90 seconds — start from "nothing connected"
  await waDo("/wa/reset", `brand=${h.ids.brandA}`);
  await waDo("/wa/clear");
  await ui.signIn(d, "owner");
  const accounts = (await d.api("GET", "/api/whatsapp/accounts", { outlet: h.ids.main })).json.accounts;
  const counter = accounts.find((a) => a.phone === "919000000001");
  const third = accounts.find((a) => a.phone === "919000000003");
  d.check("the store has two numbers to connect (the counter phone and number 3)", Boolean(counter && third), accounts.map((a) => a.label).join(", "));

  // a customer asking for a code on the storefront; returns the text of the screen they land on
  const customerAsks = async (phone) => {
    await d.tab("customer", "Customer · Acme Momos storefront");
    await d.context.clearCookies({ name: "rasoipulse_customer" });
    await d.goto(BENCH.storefront + "/main", 300);
    const group = d.page.getByRole("group", { name: "Order type" });
    if (await group.isVisible().catch(() => false)) await d.click(group.getByRole("button", { name: "Takeaway" }), { after: 300 });
    await ui.addToCart(d, "Veg Steamed Momos", {});
    await d.click(d.page.getByRole("link", { name: /View cart/ }), { after: 600 });
    await d.page.waitForURL(/\/order/);
    await d.page.getByText("Sign in to order").first().waitFor({ timeout: 15000 });
    await d.type(d.page.getByRole("textbox", { name: "Your name" }), "Switch Tester", { after: 150, delay: 15 });
    await d.type(d.page.getByRole("textbox", { name: "Mobile number" }), phone, { after: 150, delay: 15 });
    await d.click(d.page.getByRole("button", { name: "Send code" }), { after: 600 });
    await ui.until(async () => /Enter the code|can't send the code|Couldn't send/i.test(await ui.text(d)), 30000);
    return ui.text(d);
  };

  const box = () => d.page.getByRole("checkbox", { name: "Send sign-in codes from my WhatsApp numbers" });
  const status = () => d.page.getByTestId("signin-codes-status").innerText();
  const openNumbers = async () => {
    await d.tab("owner", "Store dashboard · owner of Acme Momos");
    await d.goto(BENCH.admin + "/whatsapp/numbers", 400);
    await d.page.getByTestId("signin-codes").waitFor({ timeout: 20000 });
  };

  await d.step("Nothing connected: the switch is there, but can't be turned on yet", 500);
  await openNumbers();
  d.check("WhatsApp → Numbers has a 'Sign-in codes' card with the switch, off", (await d.page.getByRole("heading", { name: "Sign-in codes" }).count()) > 0 && !(await box().isChecked()));
  d.check("with no number connected the switch is disabled, and the card says why", (await box().isDisabled()) && /No WhatsApp number is linked yet|isn't connected right now/.test(await ui.text(d)), (await status()).slice(0, 80));

  await d.step("Two numbers come online; the switch becomes available but the customer still sees the code on screen", 500);
  await waDo("/wa/online", `account=${counter.id}`);
  await waDo("/wa/online", `account=${third.id}`);
  await d.page.reload({ waitUntil: "load" });
  await d.page.getByTestId("signin-codes").waitFor({ timeout: 20000 });
  await ui.until(async () => !(await box().isDisabled()), 20000);
  d.check("the switch can now be used", await box().isEnabled());
  d.check("it says customers are shown the code on screen", /Off\. Customers are shown the code on the sign-in screen/.test(await status()), await status());
  await d.shot("signin-codes-off");
  const off = await customerAsks("9811500001");
  d.check("a new customer is shown the code on screen (a 'dev code')", /Enter the code/.test(off) && /dev code/i.test(off));

  await d.step("The owner ticks the switch", 500);
  await openNumbers();
  await ui.until(async () => !(await box().isDisabled()), 20000);
  await d.click(box(), { after: 900 });
  await ui.until(async () => /^On\./.test(await status()), 15000);
  d.check("it saves at once and says it is on, with how many numbers and 'at random'", /^On\. Each code is sent from one of your 2 connected numbers, picked at random\.$/.test(await status()), await status());
  d.check("the box is ticked", await box().isChecked());
  await d.shot("signin-codes-on");
  await d.page.reload({ waitUntil: "load" });
  await d.page.getByTestId("signin-codes").waitFor({ timeout: 20000 });
  d.check("after a reload it is still on", await box().isChecked());
  await d.goto(BENCH.admin + "/message-sending", 500);
  await d.page.getByRole("heading", { name: "Verification codes" }).waitFor({ timeout: 15000 });
  d.check("Settings → Message sending shows 'Your linked WhatsApp number' chosen — the same setting", await d.page.getByRole("radio", { name: "Your linked WhatsApp number" }).isChecked());

  await d.step("The next customer gets the code on WhatsApp", 500);
  await waDo("/wa/clear");
  const on = await customerAsks("9811500002");
  const got = (await waSent()).filter((m) => m.jid === "919811500002@s.whatsapp.net");
  d.check("the screen says the code was sent on WhatsApp, and shows no code", /We sent a 6-digit code to 9811500002 on WhatsApp/.test(on) && !/dev code/i.test(on), on.match(/We sent[^.]*\./)?.[0]);
  d.check("it arrived from one of the store's two numbers", got.length === 1 && ["919000000001", "919000000003"].includes(got[0].from) && /\d{6}/.test(got[0].text), JSON.stringify(got.map((m) => m.from)));

  await d.step("Fourteen customers ask at the same moment", 500);
  await waDo("/wa/clear");
  // (a number ending 0000 is the bench's "not on WhatsApp" — keep clear of those)
  const people = Array.from({ length: 14 }, (_, i) => `9811531${String(i + 1).padStart(3, "0")}`);
  const answers = await Promise.all(people.map((p) => fetch(`${BENCH.api}/api/customer/otp/request`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outletId: h.ids.main, destination: p }) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))));
  d.check("every one of them is sent a code, and none is shown on screen", answers.every((a) => a.status === 200 && a.body.sent === true && !a.body.devCode), answers.map((a) => a.status).join(","));
  const sentNow = (await waSent()).filter((m) => people.some((p) => m.jid === `91${p}@s.whatsapp.net`));
  const perNumber = sentNow.reduce((m, x) => ({ ...m, [x.from]: (m[x.from] ?? 0) + 1 }), {});
  d.check("both connected numbers were used (picked at random)", Object.keys(perNumber).length === 2 && sentNow.length === 14, JSON.stringify(perNumber));

  await d.step("Unticking asks first", 500);
  await openNumbers();
  await d.click(box(), { after: 600 });
  const confirm = d.page.getByRole("dialog", { name: "Stop sending sign-in codes?" });
  d.check("a confirmation explains that anyone could sign in as anyone", await confirm.isVisible() && /anyone could sign in as any phone number/.test(await confirm.innerText()), (await confirm.innerText().catch(() => "")).slice(0, 80));
  d.check("nothing has changed yet", await box().isChecked());
  await d.shot("signin-codes-confirm");
  await d.click(confirm.getByRole("button", { name: "Keep sending" }), { after: 500 });
  d.check("'Keep sending' leaves it on", (await box().isChecked()) && !(await confirm.isVisible().catch(() => false)));
  await d.click(box(), { after: 500 });
  await d.click(d.page.getByRole("dialog", { name: "Stop sending sign-in codes?" }).getByRole("button", { name: "Stop sending" }), { after: 900 });
  await ui.until(async () => /^Off\./.test(await status()), 15000);
  d.check("'Stop sending' turns it off", !(await box().isChecked()) && /^Off\. Customers are shown the code on the sign-in screen/.test(await status()), await status());
  const back = await customerAsks("9811500003");
  d.check("customers are shown the code on screen again", /dev code/i.test(back));

  await d.step("Every number goes offline while the switch is on", 500);
  await openNumbers();
  await d.click(box(), { after: 900 });
  await ui.until(async () => /^On\./.test(await status()), 15000);
  await waDo("/wa/offline", `account=${counter.id}`);
  await waDo("/wa/offline", `account=${third.id}`);
  await d.page.reload({ waitUntil: "load" });
  await d.page.getByTestId("signin-codes").waitFor({ timeout: 20000 });
  await ui.until(async () => /None of your numbers is connected right now/.test(await ui.text(d)), 20000);
  d.check("the card warns that customers can't get a code", /None of your numbers is connected right now, so customers can't get a code/.test(await ui.text(d)));
  const offline = await customerAsks("9811500004");
  d.check("a customer is asked to try again later — and is not shown a code", /can't send the code/i.test(offline) && !/dev code/i.test(offline), offline.match(/We can't[^.]*\./)?.[0]);
}
