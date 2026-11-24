// T26 — The sign-in screen's "Resend code" timer, and proof that the SERVER keeps the wait — in Chrome.
// The store is Acme Momos with nothing chosen under Message sending, so the code is shown on screen ("dev code") and the test can use it.
import { BENCH } from "../bench/watch.mjs";
import * as ui from "../bench/ui.mjs";

export const meta = {
  id: "t26-signin-resend-timer",
  title: "Sign-in code — resend timer on the screen (30 s first), kept by the server: Back, reload and direct API calls can't skip it",
  area: "security",
  fresh: true,
  summary: "In Chrome as a new customer on the Acme Momos storefront. Asking for a code starts a 30-second countdown on 'Resend code' (the button is off while it runs). Pressing Back and 'Send code' again for the same number does NOT reset it — the server refuses (429), and the screen goes straight back to typing the code already sent, with a note, and the countdown continues from where it was. A page reload does the same. A script calling the API directly for the same number — plain, as +91…, with spaces — is refused every time with a Retry-After header, while another number is not. When the 30 seconds really have passed the button comes back, a new code is sent, and the next wait is 1 minute. The new code signs the customer in. The on-screen hint no longer talks about an SMS provider.",
  expect: [
    "After 'Send code' the next screen counts down from 30 s on a disabled 'Resend code (…)' button and the number ticks down.",
    "The hint under the boxes says codes aren't being sent for this store yet (not 'No SMS provider configured').",
    "Back, then 'Send code' again for the same number: the API answers 429; the screen shows the code step with the note 'A code was already sent to …', and the countdown has NOT gone back to 30.",
    "After a reload the same thing happens.",
    "Direct calls for the same number — plain, +91…, with spaces — all get 429 'Please wait …' and a Retry-After header; a different number gets a code.",
    "After the 30 s the button is enabled; pressing it sends a new code (200) and the next wait is 1 minute.",
    "The new code signs the customer in (the 'a couple more details' step opens).",
  ],
  expectNot: [
    "Going Back or reloading must NOT give a fresh 30 seconds, or a second code.",
    "The 'Resend code' button must NOT be usable while the timer runs.",
    "The screen must NOT show a raw error for an early request when the earlier code is still good.",
    "The browser must NOT log JavaScript errors.",
  ],
};

const PHONE = "9811400001";
const left = (label) => {
  const m = String(label).match(/Resend code \((?:(\d+):)?(\d+)(?:s)?\)/);
  if (!m) return null;
  return m[1] !== undefined ? Number(m[1]) * 60 + Number(m[2]) : Number(m[2]);
};

export async function run(d, h) {
  await d.tab("customer", "Customer · Acme Momos storefront");
  const calls = []; // every code request the page makes, with what the server answered
  d.page.on("response", async (r) => {
    if (!r.url().endsWith("/api/customer/otp/request")) return;
    calls.push({ status: r.status(), retry: r.headers()["retry-after"] ?? null, body: await r.json().catch(() => null), at: Date.now() });
  });

  // a new customer on the order page, details typed, 'Send code' pressed
  const openSignIn = async () => {
    await d.context.clearCookies({ name: "rasoipulse_customer" });
    await d.goto(BENCH.storefront + "/main", 300);
    const group = d.page.getByRole("group", { name: "Order type" });
    if (await group.isVisible().catch(() => false)) await d.click(group.getByRole("button", { name: "Takeaway" }), { after: 300 });
    await ui.addToCart(d, "Veg Steamed Momos", {});
    await d.click(d.page.getByRole("link", { name: /View cart/ }), { after: 600 });
    await d.page.waitForURL(/\/order/);
    await d.page.getByText("Sign in to order").first().waitFor({ timeout: 15000 });
  };
  const fillDetails = async () => {
    const name = d.page.getByRole("textbox", { name: "Your name" });
    const mobile = d.page.getByRole("textbox", { name: "Mobile number" });
    if (!(await name.inputValue())) await d.type(name, "Timer Tester", { after: 150, delay: 15 });
    if (!(await mobile.inputValue())) await d.type(mobile, PHONE, { after: 150, delay: 15 });
  };
  const sendCode = async () => {
    await d.click(d.page.getByRole("button", { name: "Send code" }), { after: 700 });
    await d.page.getByText("Enter the code").first().waitFor({ timeout: 15000 });
  };
  const resendLabel = async () => (await d.page.getByRole("button", { name: /^Resend code/ }).innerText()).trim();
  const devCode = async () => (await ui.text(d)).match(/dev code: (\d{6})/)?.[1];

  await d.step("A new customer asks for a sign-in code", 500);
  await openSignIn();
  await fillDetails();
  await sendCode();
  const firstAt = Date.now();
  let page = await ui.text(d);
  const resend = d.page.getByRole("button", { name: /^Resend code/ });
  const first = await resendLabel();
  d.check("the code step opens, and 'Resend code' counts down from about 30 seconds", left(first) !== null && left(first) <= 30 && left(first) >= 27, first);
  d.check("the Resend button is switched off while it counts", await resend.isDisabled());
  d.check("the hint says codes aren't being sent for this store yet — not 'No SMS provider'", /Codes aren't being sent for this store yet/.test(page) && !/No SMS provider/.test(page));
  await d.page.waitForTimeout(3000); // real time: the countdown follows the clock
  const later = left(await resendLabel());
  d.check("the number ticks down", later !== null && later <= left(first) - 2, `${left(first)} → ${later}`);
  d.check("the page made one request and the server said OK", calls.length === 1 && calls[0].status === 200 && calls[0].body?.resendAfterSec === 30, JSON.stringify({ n: calls.length, s: calls[0]?.status, wait: calls[0]?.body?.resendAfterSec }));
  await d.shot("signin-resend-timer");

  await d.step("Going Back and asking again does not reset the wait", 500);
  await d.click(d.page.getByRole("button", { name: "Back", exact: true }), { after: 500 });
  d.check("we are back on the details step", /Sign in to order/.test(await ui.text(d)));
  await d.click(d.page.getByRole("button", { name: "Send code" }), { after: 900 });
  await d.page.getByText("Enter the code").first().waitFor({ timeout: 15000 });
  page = await ui.text(d);
  const afterBack = left(await resendLabel());
  d.check("the server refused the second request (429, 'Please wait …', with a Retry-After)", calls.length === 2 && calls[1].status === 429 && /Please wait \d+ seconds? before asking/.test(calls[1].body?.error ?? "") && Number(calls[1].retry) > 0, JSON.stringify({ s: calls[1]?.status, e: calls[1]?.body?.error, h: calls[1]?.retry }));
  d.check("…and the screen went straight back to typing the code that was already sent", /Enter the code/.test(page) && (await d.page.getByTestId("otp-notice").innerText()).includes(`A code was already sent to ${PHONE}`), (await d.page.getByTestId("otp-notice").innerText().catch(() => "")).slice(0, 90));
  d.check("the countdown carried on (it did not go back to 30)", afterBack !== null && afterBack < 30 && afterBack <= later, `${later} → ${afterBack}`);
  d.check("there is no red error for it", (await d.page.locator("p", { hasText: /Please wait/ }).count()) === 0);

  await d.step("A page reload does not reset it either", 500);
  await openSignIn();
  await fillDetails();
  await d.click(d.page.getByRole("button", { name: "Send code" }), { after: 900 });
  await d.page.getByText("Enter the code").first().waitFor({ timeout: 15000 });
  const afterReload = left(await resendLabel());
  d.check("a fresh page, same number: refused (429) and taken to the code step with the countdown still running", calls.length === 3 && calls[2].status === 429 && afterReload !== null && afterReload < 30, `${calls[2]?.status} · ${afterReload}s`);

  await d.step("Calling the API directly can't get round it", 400);
  const post = (destination) => fetch(`${BENCH.api}/api/customer/otp/request`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outletId: h.ids.main, destination }) });
  const spellings = [PHONE, `+91${PHONE}`, `+91 ${PHONE.slice(0, 5)} ${PHONE.slice(5)}`, `0091${PHONE}`, `${PHONE.slice(0, 5)}-${PHONE.slice(5)}`];
  const answers = [];
  for (const s of spellings) answers.push(await post(s));
  d.check("the same number, however it is written, is refused every time", answers.every((r) => r.status === 429), answers.map((r) => r.status).join(","));
  d.check("each refusal carries a Retry-After header", answers.every((r) => Number(r.headers.get("retry-after")) > 0 && Number(r.headers.get("retry-after")) <= 30), answers.map((r) => r.headers.get("retry-after")).join(","));
  const other = await post("9811400002");
  d.check("a different number is not held back", other.status === 200, `${other.status}`);

  await d.step("When the 30 seconds are really over, Resend works — and the next wait is longer", 500);
  const waited = Math.ceil((30_000 - (Date.now() - firstAt)) / 1000);
  d.check("(still waiting for the timer)", true, `${Math.max(0, waited)} s to go`);
  const enabled = await ui.until(async () => !(await resend.isDisabled()), 45000);
  d.check("the button comes back when the timer ends", enabled && (await resendLabel()) === "Resend code", await resendLabel());
  const before = calls.length;
  await d.click(resend, { after: 900 });
  await ui.until(async () => calls.length > before, 8000);
  const last = calls.at(-1);
  d.check("pressing it sends a new code (200) — the second one", last?.status === 200 && last.body?.resendAfterSec === 60, `${last?.status} · next wait ${last?.body?.resendAfterSec}s`);
  const second = left(await resendLabel());
  d.check("the button now counts down from 1 minute", second !== null && second > 50 && second <= 60, `${second}`);
  const code2 = await devCode();
  d.check("the new code is on screen", /^\d{6}$/.test(code2 ?? ""), code2);
  await d.shot("signin-resend-second-wait");

  await d.step("The new code signs the customer in", 400);
  await d.click(d.page.getByLabel("Digit 1 of 6"), { after: 150 });
  await d.page.keyboard.type(code2, { delay: 60 });
  await d.click(d.page.getByRole("button", { name: "Verify code" }), { after: 1000 });
  d.check("a new customer lands on the 'a couple more details' step", await d.page.getByText("Just a couple more details").first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false));
}
