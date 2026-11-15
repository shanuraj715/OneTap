// T15 — brute-force protection on sign-in, all in Chrome. An "attacker" at one network address keeps guessing; the owner at another
// address is unaffected. The bench makes blocks last seconds (6 → 12 → 24 s) and 3 wrong tries are enough.
import * as ui from "../bench/ui.mjs";
import { BENCH } from "../bench/watch.mjs";

export const meta = {
  id: "t15-login-protection",
  title: "Sign-in protection — wrong guesses block the network, blocks grow longer, a blocked network sees no login form, the platform can unblock",
  area: "security",
  fresh: true,
  summary: "In Chrome. Three wrong passwords on the dashboard login block the attacker's network address: the page swaps the form for 'Sign-in is paused' with a countdown, a reload still shows no form, and even the right password can't be tried. Another address signs in normally. When the first block ends the form comes back; a second round of wrong guesses blocks for longer (6 s then 12 s here; minutes to a day on a real server). The platform console's Security page lists the address with how many times it was blocked and an Unblock button that lifts it at once. The same happens on the storefront for wrong customer codes, without affecting other customers.",
  expect: [
    "Each wrong password says how many attempts are left; the last wrong one swaps the form for a 'Sign-in is paused' notice with a countdown.",
    "A blocked address sees the notice (no email/password boxes) even after a reload — the right password cannot even be tried.",
    "A different address signs in normally at the same time.",
    "When the countdown ends the sign-in form returns by itself.",
    "A second block lasts longer than the first.",
    "Platform console → Security lists the address (blocked, times blocked) and Unblock lifts it at once.",
    "On the storefront, wrong customer codes block that network the same way, others are unaffected, and the platform can unblock it.",
  ],
  expectNot: [
    "A blocked address must NOT be shown the sign-in form, and the correct password must NOT sign it in.",
    "One address being blocked must NOT block anyone else.",
    "A second block must NOT be the same length as (or shorter than) the first.",
    "A blocked dashboard address must NOT stop that same address's customers' codes, and the other way round (separate counters).",
    "The browser must NOT log JavaScript errors.",
  ],
};

const ATTACKER = "203.0.113.50";
const OWNER_AT = "203.0.113.51";

export async function run(d, h) {
  // the address Chrome presents to OUR servers only (not to Google Fonts and the like, which would reject the extra header)
  let presented = null;
  await d.context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    const ours = /^(localhost|127\.0\.0\.1|.*\.localhost)$/.test(u.hostname);
    return route.continue(ours && presented ? { headers: { ...route.request().headers(), "x-forwarded-for": presented } } : {});
  });
  const as = async (ip) => { presented = ip; };
  // every tab shares one Chrome, so switching person means switching the address Chrome presents too
  const be = async (tab, label, ip) => { await d.tab(tab, label); await as(ip); };
  const blockedNotice = () => d.page.locator("[data-blocked]");
  const secondsLeft = async () => Number(await blockedNotice().first().getAttribute("data-retry-seconds"));
  const formShown = async () => (await d.page.locator('input[type="password"]').count()) > 0;
  const wrongPassword = async () => {
    await d.type('input[type="email"]', "o@acme.test", { after: 100, delay: 15 });
    await d.type('input[type="password"]', "not-the-password", { after: 100, delay: 15 });
    await d.click(d.page.getByRole("button", { name: /sign in/i }), { after: 900 });
  };

  await be("attacker", "Someone guessing passwords · address " + ATTACKER, ATTACKER);

  await d.step("The attacker guesses wrong passwords on the dashboard login");
  await d.goto(BENCH.admin + "/", 600);
  await d.page.locator('input[type="password"]').waitFor({ timeout: 15000 });
  d.check("a fresh address sees the normal sign-in form", await formShown());
  await wrongPassword();
  d.check("1st wrong password: 'Incorrect email or password' and 2 attempts left", /Incorrect email or password/.test(await ui.text(d)) && /2 attempts left/.test(await ui.text(d)), (await ui.text(d)).match(/\d attempts? left[^.]*/)?.[0]);
  await wrongPassword();
  d.check("2nd wrong password: 1 attempt left", /1 attempt left/.test(await ui.text(d)));
  await wrongPassword();
  await blockedNotice().first().waitFor({ timeout: 10000 });
  const first = await secondsLeft();
  d.check("3rd wrong password: the form is replaced by 'Sign-in is paused' with a countdown", /Sign-in is paused/.test(await ui.text(d)) && first > 0, `${first} s left`);
  d.never("the sign-in form is still shown to the blocked address", await formShown());
  await d.shot("blocked");

  await d.step("A blocked address can't get back to the form by reloading, or sign in with the right password");
  await d.page.reload({ waitUntil: "load" });
  await blockedNotice().first().waitFor({ timeout: 15000 });
  d.never("after a reload the blocked address sees the sign-in form", await formShown());
  d.check("…the notice and countdown are still there", /Sign-in is paused/.test(await ui.text(d)) && (await secondsLeft()) > 0);
  await d.goto(BENCH.admin + "/orders", 500);
  await blockedNotice().first().waitFor({ timeout: 15000 });
  d.never("going straight to a dashboard page gets the attacker a sign-in form", await formShown());

  await d.step("Someone at a different address signs in normally at the same time");
  await be("owner", "The real owner · address " + OWNER_AT, OWNER_AT);
  await d.goto(BENCH.admin + "/", 600);
  await d.page.locator('input[type="password"]').waitFor({ timeout: 15000 });
  d.check("another address still sees the normal form", await formShown());
  await ui.signIn(d, "owner");
  d.check("…and the owner signs in with the right password", /Orders/.test(await ui.text(d)) && !(await formShown()));
  await d.click(d.page.getByRole("button", { name: "Sign out" }).first(), { after: 700 });

  await d.step("When the block ends the form comes back by itself, and the next block is longer");
  await be("attacker", "Someone guessing passwords · address " + ATTACKER, ATTACKER);
  d.check("the form comes back once the countdown reaches zero", await ui.until(async () => formShown(), 20000));
  await wrongPassword();
  await wrongPassword();
  await wrongPassword();
  await blockedNotice().first().waitFor({ timeout: 10000 });
  const second = await secondsLeft();
  d.check(`the second block is longer than the first (${first} s → ${second} s)`, second > first && second >= 10, `${first} → ${second}`);
  d.never("the second block is the same length as the first", second <= first);
  await d.shot("blocked-longer");

  await d.step("The platform console lists the blocked address and can unblock it");
  await be("platform", "Platform console · super admin · address " + OWNER_AT, OWNER_AT);
  await ui.signIn(d, "super");
  await ui.openPlatform(d, "/security");
  const row = d.page.locator(`tr[data-ip="${ATTACKER}"]`);
  await row.waitFor({ timeout: 15000 });
  const rowText = (await row.innerText()).replace(/\s+/g, " ");
  d.check("Security lists the address as Blocked, for Dashboards, blocked twice", /Blocked/.test(rowText) && /Dashboards/.test(rowText) && /\b2\b/.test(rowText), rowText);
  d.check("…and explains the rules (3 wrong tries, longer each time)", /3 wrong passwords or codes/.test(await ui.text(d)) && /6 seconds → 12 seconds → 24 seconds/.test(await ui.text(d)), (await ui.text(d)).match(/After [^.]*\./)?.[0]);
  await d.shot("security");
  await d.click(row.getByRole("button", { name: `Unblock ${ATTACKER}` }), { after: 1200 });
  d.never("the address is still listed as blocked after Unblock", await ui.until(async () => (await d.page.locator(`tr[data-ip="${ATTACKER}"]`).count()) > 0, 3000));
  await d.click(d.page.getByRole("button", { name: "Sign out" }).first(), { after: 800 }); // the tabs share one browser session
  await be("attacker", "Someone guessing passwords · address " + ATTACKER, ATTACKER);
  await d.page.reload({ waitUntil: "load" });
  const back = await ui.until(async () => formShown(), 8000);
  d.check("the unblocked address sees the sign-in form again at once", back, (await ui.text(d)).slice(0, 160));

  await d.step("On the storefront: wrong customer codes block that network, and only that network");
  await d.goto(BENCH.storefront + "/main", 600);
  await ui.addToCart(d, "Cold Coffee");
  await d.click(d.page.getByRole("link", { name: /View cart/ }), { after: 600 });
  await d.page.waitForURL(/\/order/);
  await d.page.getByText("Sign in to order").first().waitFor({ timeout: 15000 });
  await d.type(d.page.getByRole("textbox", { name: "Your name" }), "Code Guesser", { after: 100, delay: 15 });
  await d.type(d.page.getByRole("textbox", { name: "Mobile number" }), "9877700001", { after: 100, delay: 15 });
  await d.click(d.page.getByRole("button", { name: "Send code" }), { after: 900 });
  await d.page.getByText("Enter the code").first().waitFor({ timeout: 15000 });
  for (let i = 0; i < 3; i++) {
    await d.click(d.page.getByLabel("Digit 1 of 6"), { after: 100 });
    await d.page.keyboard.type("000000", { delay: 40 });
    await d.click(d.page.getByRole("button", { name: "Verify code" }), { after: 900 });
    if (i < 2) d.check(`wrong code ${i + 1}: 'That code isn't right'`, /That code isn't right/.test(await ui.text(d)));
  }
  await blockedNotice().first().waitFor({ timeout: 10000 });
  d.check("the 3rd wrong code swaps the sign-in form for 'Sign-in is paused'", /Sign-in is paused/.test(await ui.text(d)) && (await secondsLeft()) > 0);
  d.never("the code boxes are still shown to the blocked address", (await d.page.getByLabel("Digit 1 of 6").count()) > 0);
  await d.shot("storefront-blocked");
  await d.page.reload({ waitUntil: "load" });
  await d.page.getByText("Sign-in is paused").first().waitFor({ timeout: 15000 });
  d.never("after a reload the blocked address can type another code", (await d.page.getByLabel("Digit 1 of 6").count()) > 0);

  await be("owner", "Another customer · address " + OWNER_AT, OWNER_AT);
  await d.goto(BENCH.storefront + "/main", 500);
  await ui.addToCart(d, "Cold Coffee");
  await d.click(d.page.getByRole("link", { name: /View cart/ }), { after: 600 });
  await d.page.waitForURL(/\/order/);
  d.check("another customer's address still gets the normal sign-in form", await d.page.getByText("Sign in to order").first().isVisible({ timeout: 15000 }));
  d.never("another customer's address is shown the paused notice", await d.page.getByText("Sign-in is paused").first().isVisible({ timeout: 1500 }).catch(() => false));

  await d.step("Dashboard and customer blocks are separate, and the platform can lift the customer block too");
  await be("platform", "Platform console · super admin · address " + OWNER_AT, OWNER_AT);
  await ui.signIn(d, "super");
  await ui.openPlatform(d, "/security");
  const cRow = d.page.locator(`tr[data-ip="${ATTACKER}"]`).filter({ hasText: "Customer codes" });
  await cRow.waitFor({ timeout: 15000 });
  d.check("Security lists the storefront block as 'Customer codes'", /Blocked/.test(await cRow.innerText()));
  d.never("the dashboard login of that address was blocked by the customer-code guesses", (await d.page.locator(`tr[data-ip="${ATTACKER}"]`).filter({ hasText: "Dashboards" }).filter({ hasText: "Blocked" }).count()) > 0);
  await d.click(d.page.getByRole("button", { name: "Unblock everyone" }), { after: 1200 });
  d.check("'Unblock everyone' clears the list", await ui.until(async () => /Nothing to show/.test(await ui.text(d)), 8000));

  await as(null);
  d.never("the browser logged JavaScript errors", d.problems.length > 0, d.problems.join(" | "));
}
