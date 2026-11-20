// The Takeaway / Delivery switch on the storefront menu page AND on the checkout page ("How would you like it?"): it
// ALWAYS shows both choices; one the outlet doesn't offer is shown greyed out (disabled), with a line saying so.
// Chrome against the bench's fake stores.
import { chromium } from "playwright";
const SF = "http://localhost:3170";
const BETA = "http://beta.localhost:3170";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];

/* ---- set an outlet's ordering switches through the API, and put them back afterwards */
const cookie = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "o@acme.test", password: "Owner123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const outlets = await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json();
const second = (outlets.outlets ?? outlets).find((o) => o.slug === "second");
const secondId = String(second._id ?? second.id);
const featuresBefore = second.config.features;
const paymentsBefore = second.config.payments;
const mainPayments = (outlets.outlets ?? outlets).find((o) => o.slug === "main").config.payments;
/** `onlinePay`: delivery counts as "on" on the storefront only when the outlet also takes online payment (delivery is prepaid) */
const setOrdering = async (ordering, onlinePay = false) => {
  const body = { features: { ...featuresBefore, ordering: { ...featuresBefore.ordering, ...ordering } }, payments: onlinePay ? { ...paymentsBefore, enabled: mainPayments.enabled } : paymentsBefore };
  const r = await fetch(`${API}/api/outlets/${secondId}/config`, { method: "PATCH", headers: { "content-type": "application/json", cookie, "x-onetap-outlet": secondId }, body: JSON.stringify(body) });
  if (!r.ok) { console.error("SETUP FAILED", r.status, (await r.text()).slice(0, 300)); process.exit(1); }
};
console.log("outlet 'second' starts as:", JSON.stringify(featuresBefore.ordering));

const browser = await chromium.launch();
const open = async (url, viewport = { width: 1280, height: 900 }, extra = {}) => {
  const ctx = await browser.newContext({ viewport, ...extra });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon/.test(m.text())) problems.push(`${url}: ${m.text().slice(0, 200)}`); });
  page.on("pageerror", (e) => problems.push(`${url} pageerror: ${String(e).slice(0, 200)}`));
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(500);
  return { ctx, page };
};
const group = (page) => page.getByRole("group", { name: "Order type" });
const btn = (page, name) => group(page).getByRole("button", { name });

try {
  /* ------------------------------------------------------------ 1. takeaway only (a store with two outlets) */
  console.log("== takeaway-only outlet");
  {
    const { ctx, page } = await open(`${SF}/second`);
    ok((await group(page).count()) === 1 && (await group(page).getByRole("button").count()) === 2, "both choices are shown, Takeaway and Delivery", (await group(page).innerText()).replace(/\s+/g, " "));
    ok((await btn(page, "Takeaway").isEnabled()) && (await btn(page, "Takeaway").getAttribute("aria-pressed")) === "true", "Takeaway is available and selected");
    ok((await btn(page, "Delivery").isDisabled()) && (await btn(page, "Delivery").getAttribute("aria-pressed")) === "false", "Delivery is shown but disabled, and not selected");
    const look = await btn(page, "Delivery").evaluate((el) => ({ opacity: Number(getComputedStyle(el).opacity), cursor: getComputedStyle(el).cursor }));
    ok(look.opacity < 0.7 && look.cursor === "not-allowed", "…and looks switched off (faded, 'not allowed' pointer)", JSON.stringify(look));
    ok((await btn(page, "Delivery").getAttribute("title")) === "Delivery isn't available from this outlet", "hovering it explains why");
    ok(/Delivery isn't available from this outlet\./.test(await page.getByTestId("order-type-hint").innerText()), "a line under the switch says so (a phone has no hover)");
    await btn(page, "Delivery").click({ force: true }).catch(() => {});
    ok((await btn(page, "Takeaway").getAttribute("aria-pressed")) === "true" && (await btn(page, "Delivery").getAttribute("aria-pressed")) === "false", "pressing Delivery does nothing");
    await btn(page, "Takeaway").focus();
    await page.keyboard.press("Tab");
    ok(!(await page.evaluate(() => /Delivery/.test(document.activeElement?.textContent ?? ""))), "the keyboard Tab key skips the disabled Delivery");
    // a remembered "delivery" from another outlet must not select it here
    await page.evaluate(() => localStorage.setItem("onetap.orderType", "delivery"));
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const storageKey = await page.evaluate(() => Object.keys(localStorage).filter((k) => /order.?type/i.test(k)));
    ok((await btn(page, "Takeaway").getAttribute("aria-pressed")) === "true" && (await btn(page, "Delivery").getAttribute("aria-pressed")) === "false", "a remembered 'delivery' from another outlet does not select it here", storageKey.join());
    await ctx.close();
  }

  /* ------------------------------------------------------------ 2. both offered */
  console.log("== an outlet with both");
  {
    const { ctx, page } = await open(`${SF}/main`);
    ok((await btn(page, "Takeaway").isEnabled()) && (await btn(page, "Delivery").isEnabled()), "both are available");
    ok((await page.getByTestId("order-type-hint").count()) === 0, "…and there is no 'isn't available' line");
    await btn(page, "Delivery").click();
    ok((await btn(page, "Delivery").getAttribute("aria-pressed")) === "true" && (await btn(page, "Takeaway").getAttribute("aria-pressed")) === "false", "Delivery can be chosen");
    await btn(page, "Takeaway").click();
    ok((await btn(page, "Takeaway").getAttribute("aria-pressed")) === "true", "…and Takeaway again");
    await ctx.close();
  }

  /* ------------------------------------------------------------ 3. a store with ONE outlet and takeaway only */
  console.log("== Beta Bites: one outlet, no delivery");
  {
    const { ctx, page } = await open(`${BETA}/only`);
    ok((await group(page).count()) === 1 && (await btn(page, "Takeaway").isEnabled()) && (await btn(page, "Delivery").isDisabled()), "the switch is there too (it used to be hidden for a one-outlet, one-choice store): Takeaway on, Delivery off");
    await ctx.close();
  }

  /* ------------------------------------------------------------ 4. delivery only */
  console.log("== delivery-only outlet");
  {
    await setOrdering({ takeaway: false, delivery: true }, true);
    const { ctx, page } = await open(`${SF}/second`);
    ok((await btn(page, "Takeaway").isDisabled()) && (await btn(page, "Delivery").isEnabled()) && (await btn(page, "Delivery").getAttribute("aria-pressed")) === "true", "Takeaway is the greyed-out one, Delivery is available and selected");
    ok(/Takeaway isn't available from this outlet\./.test(await page.getByTestId("order-type-hint").innerText()), "and the line says Takeaway isn't available");
    await ctx.close();
  }

  /* ------------------------------------------------------------ 5. neither (dine-in only): nothing to order online */
  console.log("== no takeaway and no delivery");
  {
    await setOrdering({ takeaway: false, delivery: false });
    const { ctx, page } = await open(`${SF}/second`);
    ok((await group(page).count()) === 0, "no switch at all when the outlet takes no takeaway or delivery orders (nothing to choose)");
    await ctx.close();
    await setOrdering(featuresBefore.ordering);
  }

  /* ------------------------------------------------------------ 6. a phone */
  console.log("== phone");
  {
    const { ctx, page } = await open(`${SF}/second`, { width: 390, height: 844 }, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const g = await group(page).boundingBox();
    const hint = await page.getByTestId("order-type-hint").boundingBox();
    ok(g.x >= 0 && g.x + g.width <= 390 && hint.x + hint.width <= 390, "the switch and its line fit the screen", `${Math.round(g.x + g.width)}px of 390`);
    ok((await btn(page, "Delivery").isDisabled()) && (await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1, "Delivery is disabled on a phone too, and nothing scrolls sideways");
    await group(page).scrollIntoViewIfNeeded();
    await page.locator("section[aria-label='How would you like your order?']").screenshot({ path: "order-type-takeaway-only.png" });
    await ctx.close();
  }

  /* ------------------------------------------------------------ 7. the CHECKOUT page ("How would you like it?") */
  console.log("== checkout page");
  const mainOutlet = (outlets.outlets ?? outlets).find((o) => o.slug === "main");
  const mainId = String(mainOutlet._id ?? mainOutlet.id);
  const plainItem = async (outletId) => {
    const m = await (await fetch(`${API}/api/menu?outletId=${outletId}`)).json();
    const it = (m.items ?? []).find((i) => i.isAvailable !== false && !(i.modifierGroupIds?.length));
    if (!it) throw new Error("no orderable dish found on outlet " + outletId);
    return { itemId: it.id, variantId: it.variants?.[0]?.id }; // the first size, when the dish has sizes
  };
  let phoneSeq = 0;
  /** open the checkout of /<slug> with one dish in the cart, signed in as a fresh customer */
  const checkout = async (slug, outletId, viewport, { pickOnMenu } = {}) => {
    const line = await plainItem(outletId);
    const { ctx, page } = await open(`${SF}/${slug}`, viewport, viewport ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {});
    if (pickOnMenu) await btn(page, pickOnMenu).click(); // what the visitor chose on the menu page is remembered on this device
    await page.evaluate(([id, ln, keep]) => { localStorage.setItem(`onetap.cart.${id}`, JSON.stringify([{ ...ln, quantity: 1, modifierOptionIds: [] }])); if (!keep) localStorage.removeItem("onetap.orderType"); }, [outletId, line, Boolean(pickOnMenu)]);
    await page.goto(`${SF}/${slug}/order`, { waitUntil: "networkidle", timeout: 90000 });
    await page.getByText("Sign in to order").first().waitFor({ timeout: 20000 });
    const phone = `98${String(Date.now()).slice(-6)}${String(++phoneSeq).padStart(2, "0")}`.slice(0, 10);
    await page.getByRole("textbox", { name: "Your name" }).fill("Checkout Tester");
    await page.getByRole("textbox", { name: "Mobile number" }).fill(phone);
    await page.getByRole("button", { name: "Send code" }).click();
    await page.getByText("Enter the code").first().waitFor({ timeout: 15000 });
    await page.getByLabel("Digit 1 of 6").click();
    await page.keyboard.type("123456", { delay: 60 });
    await page.getByRole("button", { name: "Verify code" }).click();
    if (await page.getByText("Just a couple more details").first().waitFor({ timeout: 5000 }).then(() => true).catch(() => false)) {
      await page.getByRole("group", { name: "Gender" }).getByRole("button", { name: "Male", exact: true }).click();
      await page.getByRole("spinbutton", { name: "Age" }).fill("30");
      await page.getByRole("button", { name: "Save and continue" }).click();
    }
    await page.getByText("How would you like it?").first().waitFor({ timeout: 25000 });
    await page.waitForTimeout(500);
    return { ctx, page };
  };
  const hint = (page) => page.getByTestId("fulfilment-hint");

  console.log("-- takeaway-only outlet");
  {
    const { ctx, page } = await checkout("second", secondId);
    ok((await group(page).count()) === 1 && (await group(page).getByRole("button").count()) === 2, "the checkout shows both choices, Takeaway and Delivery (it used to show none)", (await group(page).innerText()).replace(/\s+/g, " "));
    ok((await btn(page, "Takeaway").isEnabled()) && (await btn(page, "Takeaway").getAttribute("aria-pressed")) === "true", "Takeaway is available and selected");
    ok((await btn(page, "Delivery").isDisabled()) && (await btn(page, "Delivery").getAttribute("aria-pressed")) === "false", "Delivery is shown but disabled, and not selected");
    const look = await btn(page, "Delivery").evaluate((el) => ({ opacity: Number(getComputedStyle(el).opacity), cursor: getComputedStyle(el).cursor }));
    ok(look.opacity < 0.7 && look.cursor === "not-allowed", "…and looks switched off (faded, 'not allowed' pointer)", JSON.stringify(look));
    ok((await btn(page, "Delivery").getAttribute("title")) === "Delivery isn't available from this outlet.", "hovering it explains why");
    ok(/Delivery isn't available from this outlet\./.test(await hint(page).innerText()), "a line under the buttons says so");
    await btn(page, "Delivery").click({ force: true }).catch(() => {});
    await page.waitForTimeout(250);
    const body = await page.locator("body").innerText();
    ok((await btn(page, "Delivery").getAttribute("aria-pressed")) === "false" && !/Delivery orders are paid online|Add delivery address/i.test(body), "pressing Delivery does nothing — no delivery address or 'paid online' note appears");
    ok(await page.getByRole("button", { name: /place order/i }).first().isEnabled(), "the order can still be placed as takeaway");
    await ctx.close();
  }

  console.log("-- outlet with both");
  {
    const { ctx, page } = await checkout("main", mainId);
    ok((await btn(page, "Takeaway").isEnabled()) && (await btn(page, "Delivery").isEnabled()) && (await hint(page).count()) === 0, "both are available and there is no 'isn't available' line");
    await btn(page, "Delivery").click();
    await page.waitForTimeout(300);
    ok((await btn(page, "Delivery").getAttribute("aria-pressed")) === "true" && /Delivery orders are paid online/.test(await page.locator("body").innerText()), "choosing Delivery works as before (selected, 'paid online' note and the address box appear)");
    await btn(page, "Takeaway").click();
    await page.waitForTimeout(300);
    ok((await btn(page, "Takeaway").getAttribute("aria-pressed")) === "true" && !/Delivery orders are paid online/.test(await page.locator("body").innerText()), "…and back to Takeaway");
    await ctx.close();
  }

  console.log("-- delivery switched on but no online payment (delivery is prepaid)");
  {
    await setOrdering({ takeaway: true, delivery: true }, false);
    const { ctx, page } = await checkout("second", secondId);
    ok((await btn(page, "Delivery").isDisabled()) && (await btn(page, "Takeaway").isEnabled()), "Delivery stays greyed out while the outlet takes no online payment");
    ok(/Delivery isn't available from this outlet\./.test(await hint(page).innerText()), "…with the same explanation");
    await ctx.close();
    await setOrdering(featuresBefore.ordering);
  }

  console.log("-- delivery-only outlet");
  {
    await setOrdering({ takeaway: false, delivery: true }, true);
    const { ctx, page } = await checkout("second", secondId);
    ok((await btn(page, "Takeaway").isDisabled()) && (await btn(page, "Delivery").isEnabled()) && (await btn(page, "Delivery").getAttribute("aria-pressed")) === "true", "Takeaway is the greyed-out one, Delivery is available and already selected");
    ok(/Takeaway isn't available from this outlet\./.test(await hint(page).innerText()), "and the line says Takeaway isn't available");
    ok(/Delivery orders are paid online/.test(await page.locator("body").innerText()), "the delivery address part is showing");
    await ctx.close();
    await setOrdering(featuresBefore.ordering);
  }

  console.log("-- the choice made on the menu page carries into checkout (unchanged)");
  {
    const { ctx, page } = await checkout("main", mainId, undefined, { pickOnMenu: "Delivery" });
    ok((await btn(page, "Delivery").getAttribute("aria-pressed")) === "true" && (await btn(page, "Takeaway").getAttribute("aria-pressed")) === "false", "Delivery chosen on the menu page is already selected in checkout");
    await ctx.close();
  }

  console.log("-- phone");
  {
    const { ctx, page } = await checkout("second", secondId, { width: 390, height: 844 });
    const g = await group(page).boundingBox();
    const h = await hint(page).boundingBox();
    ok(g.x >= 0 && g.x + g.width <= 390 && h.x + h.width <= 390, "the checkout buttons and their line fit the screen", `${Math.round(g.x + g.width)}px of 390`);
    ok((await btn(page, "Delivery").isDisabled()) && (await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1, "Delivery is disabled on a phone too, and nothing scrolls sideways");
    await group(page).scrollIntoViewIfNeeded();
    await page.screenshot({ path: "checkout-order-type-takeaway-only.png" });
    await ctx.close();
  }
} catch (e) {
  ok(false, "the test ran to the end", String(e?.message ?? e).split("\n").slice(0, 3).join(" | ").slice(0, 400));
} finally {
  await setOrdering(featuresBefore.ordering).catch(() => {});
  await browser.close();
}
console.log("console problems:", problems.length ? problems : "none");
ok(problems.length === 0, "the browser logged no errors or warnings");
console.log(`SUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
