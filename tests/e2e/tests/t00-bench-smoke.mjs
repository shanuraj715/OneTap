// T00 — is the test bench itself healthy? Run this first: if it fails, every other result is meaningless.
import { BENCH, adminLogin } from "../bench/watch.mjs";

export const meta = {
  id: "t00-bench-smoke",
  title: "Bench smoke test — API, dashboard and storefronts are alive with the fake stores",
  area: "bench",
  fresh: true, // it checks the pristine fake data — a bench left over from an earlier test must be reset first
  summary: "Checks the throwaway environment (in-memory API, dashboard, storefront) answers, the two fake stores resolve by address, and every seeded login works.",
  expect: [
    "The API answers and reports healthy.",
    "Acme Momos' two outlets open at /main and /second; Beta Bites opens at beta.localhost:3170/only.",
    "Each seeded login (super admin, Acme owner, Beta owner) reaches its own dashboard.",
    "Any phone number can request a customer sign-in code on the test stores.",
  ],
  expectNot: [
    "An address nobody owns must not render a store (it must be a 404).",
    "A wrong password must not sign anyone in.",
    "The browser must not log JavaScript errors on the pages opened.",
  ],
};

export async function run(d, h) {
  await d.step("Ask the API if it is healthy", 800);
  const health = await d.api("GET", "/health");
  d.check("API health endpoint answers", health.status === 200, `HTTP ${health.status}`);

  await d.step("Open the storefronts by their addresses", 800);
  for (const [label, url, needle] of [
    ["Acme Momos — Main outlet", BENCH.storefront + "/main", "Acme Momos"],
    ["Acme Momos — Second outlet", BENCH.storefront + "/second", "Acme Momos"],
    ["Beta Bites — Only outlet", BENCH.betaStorefront + "/only", "Beta Bites"],
  ]) {
    const res = await d.page.goto(url, { waitUntil: "load", timeout: 60000 });
    const text = await d.page.locator("body").innerText();
    d.check(`${label} opens`, res?.status() === 200 && text.includes(needle), `HTTP ${res?.status()}`);
  }
  const ghost = await d.page.goto(BENCH.storefront + "/no-such-outlet", { waitUntil: "load" });
  d.never("an address nobody owns renders a store", ghost?.status() !== 404, `HTTP ${ghost?.status()}`);

  await d.step("Sign in to the dashboard with each seeded login", 800);
  for (const [who, landing] of [["super", /Stores/], ["owner", /Orders/], ["betaOwner", /Orders/]]) {
    await d.context.clearCookies();
    await adminLogin(d, who);
    const text = await d.page.locator("body").innerText();
    d.check(`${who} login reaches the dashboard`, landing.test(text), BENCH.logins[who][0]);
  }
  await d.context.clearCookies();
  await d.goto(BENCH.admin + "/", 300);
  await d.type('input[type="email"]', BENCH.logins.owner[0], { after: 100 });
  await d.type('input[type="password"]', "wrong-password", { after: 100 });
  await d.click(d.page.getByRole("button", { name: /sign in|log in/i }), { after: 1500 });
  d.never("a wrong password signs someone in", !(await d.page.locator('input[type="password"]').isVisible().catch(() => false)), d.page.url());

  await d.step("Ask for a customer sign-in code with an arbitrary phone number", 800);
  const code = await d.api("POST", "/api/customer/otp/request", { body: { outletId: h.ids.main, destination: "9000000099" } });
  d.check("the code request is accepted (the test stores accept any phone)", code.status < 400, `HTTP ${code.status} ${JSON.stringify(code.json).slice(0, 120)}`);

  d.never("the browser logged JavaScript errors", d.problems.length > 0, d.problems.join(" | "));
}
