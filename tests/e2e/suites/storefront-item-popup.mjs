// The item pop-up (what opens when a dish is chosen): the picture is set in from the pop-up's edges with rounded corners, there is a
// close button on it, the name has the veg / non-veg mark and the price, the choices are tiles that light up when chosen, and the
// quantity + Add button stay at the bottom while the choices scroll. Chrome against the bench store.
import { chromium } from "playwright";
const SF = "http://localhost:3170";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];

const cookie = (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "o@acme.test", password: "Owner123!" }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const outlets = await (await fetch(`${API}/api/outlets`, { headers: { cookie } })).json();
const main = (outlets.outlets ?? outlets).find((o) => o.slug === "main");
const outletId = String(main._id ?? main.id);
const call = async (method, path, body) => {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", cookie, "x-rasoipulse-outlet": outletId }, body: body ? JSON.stringify(body) : undefined });
  let json = {}; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
const menu = (await (await fetch(`${API}/api/menu?outletId=${outletId}`)).json());
const dish = menu.items.find((i) => i.name === "Veg Steamed Momos");
const groupsBefore = dish.modifierGroupIds;
// three add-on groups with several options, so the pop-up is tall enough to scroll on a short screen
const made = [];
for (const [name, opts] of [["Pop Dips", [["Mint Dip", 1000], ["Cheese Dip", 3000], ["Mayo", 1500], ["Free Chutney", 0]]], ["Pop Sides", [["Fries", 8000], ["Salad", 4000], ["Raita", 3500]]], ["Pop Drinks", [["Cola", 4000], ["Lime Soda", 5000], ["Water", 2000]]]]) {
  const g = (await call("POST", "/api/menu/modifier-groups", { name, maxSelect: opts.length, options: opts.map(([label, priceDelta]) => ({ label, priceDelta })) })).json.group;
  made.push(g.id);
}
await call("PATCH", `/api/menu/items/${dish.id}`, { modifierGroupIds: made });

const browser = await chromium.launch();
const open = async (opts) => {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon/.test(m.text())) problems.push(`${opts.viewport.width}: ${m.text().slice(0, 200)}`); });
  page.on("pageerror", (e) => problems.push(`${opts.viewport.width} pageerror: ${String(e).slice(0, 200)}`));
  await page.goto(`${SF}/main`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(500);
  return { ctx, page };
};
const dlg = (page) => page.getByTestId("item-modal");
const openPopup = async (page) => { await page.getByRole("button", { name: /^add Veg Steamed Momos$/i }).click(); await dlg(page).waitFor(); await page.waitForTimeout(450); };
const isClosed = async (page) => { await page.waitForTimeout(500); return (await dlg(page).count()) === 0; };

try {
  for (const [label, opts] of [["desktop", { viewport: { width: 1440, height: 900 } }], ["phone", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
    console.log(`== the item pop-up: ${label}`);
    const { ctx, page } = await open(opts);
    await openPopup(page);

    // the picture is set in from every edge, with rounded corners
    const geo = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="item-modal"]');
      const m = modal.getBoundingClientRect();
      // modal > scrolling body > [picture + close button] > the picture's own box
      const box = modal.firstElementChild.firstElementChild.firstElementChild;
      const b = box.getBoundingClientRect();
      return { left: Math.round(b.left - m.left), right: Math.round(m.right - b.right), top: Math.round(b.top - m.top), radius: parseFloat(getComputedStyle(box).borderTopLeftRadius), vh: innerHeight, mTop: m.top, mBottom: m.bottom };
    });
    ok(geo.left >= 12 && geo.right >= 12 && geo.top >= 12, `${label}: the picture does not touch the pop-up's edges (${geo.left}px left, ${geo.right}px right, ${geo.top}px top)`, JSON.stringify(geo));
    ok(geo.radius >= 12, `${label}: the picture has rounded corners`, `${geo.radius}px`);
    ok(geo.mTop >= 0 && geo.mBottom <= geo.vh, `${label}: the pop-up fits inside the screen`, `${Math.round(geo.mTop)}–${Math.round(geo.mBottom)} of ${geo.vh}`);

    // title: the veg mark, the name and the price
    const head = await page.evaluate(() => { const m = document.querySelector('[data-testid="item-modal"]'); const h = m.querySelector("h3"); return { mark: Boolean(h.querySelector('[role="img"]')), name: h.textContent.trim(), text: m.innerText.replace(/\s+/g, " ") }; });
    ok(head.mark && /Veg Steamed Momos/.test(head.name), `${label}: the name has the veg / non-veg mark in front`, head.name);
    ok(/from ₹60/.test(head.text), `${label}: the price shows beside the name ("from ₹60" for a dish with sizes)`, head.text.slice(0, 120));
    ok(/Choose a size\s*Required/i.test(head.text) && /Pop Dips\s*Optional/i.test(head.text), `${label}: each choice section says whether it is required or optional`);
    ok(/\+₹30/.test(head.text) && /Free Chutney\s*Free/.test(head.text), `${label}: extras show "+₹30"; a free one says "Free"`);

    // a close button on the picture
    const close = page.getByTestId("item-modal-close");
    const cb = await close.boundingBox(), mb = await dlg(page).boundingBox();
    ok(cb && cb.x > mb.x + mb.width * 0.7 && cb.y < mb.y + 80 && cb.width >= 32, `${label}: a round close button sits at the top right of the picture`, JSON.stringify(cb));
    await close.click();
    ok(await isClosed(page), `${label}: it closes the pop-up`);

    // the other ways out still work
    await openPopup(page); await page.keyboard.press("Escape");
    ok(await isClosed(page), `${label}: Escape closes it`);
    await openPopup(page); await page.mouse.click(8, 8);
    ok(await isClosed(page), `${label}: pressing outside closes it`);
    await openPopup(page); await dlg(page).getByRole("button", { name: "Cancel" }).click();
    ok(await isClosed(page), `${label}: Cancel closes it`);

    // choices are tiles that light up
    await openPopup(page);
    const tileStyle = (text) => page.evaluate((t) => { const l = [...document.querySelectorAll('[data-testid="item-modal"] label')].find((x) => x.textContent.includes(t)); const cs = getComputedStyle(l); return { border: cs.borderTopColor, bg: cs.backgroundColor, on: l.querySelector("input").checked }; }, text);
    const sizeOn = await tileStyle("5 pcs"), sizeOff = await tileStyle("8 pcs");
    ok(sizeOn.on && !sizeOff.on && sizeOn.border !== sizeOff.border && sizeOn.bg !== sizeOff.bg, `${label}: the chosen size's tile is highlighted, the other is not`, JSON.stringify([sizeOn, sizeOff]));
    await dlg(page).locator("label", { hasText: "8 pcs" }).click();
    await page.waitForTimeout(350); // the tile's colour fades in
    const sizeOn2 = await tileStyle("8 pcs"), sizeOff2 = await tileStyle("5 pcs");
    ok(sizeOn2.on && !sizeOff2.on && sizeOn2.border === sizeOn.border && sizeOff2.border === sizeOff.border, `${label}: choosing the other size moves the highlight`, JSON.stringify([sizeOn, sizeOff, sizeOn2, sizeOff2]));
    const add = dlg(page).getByRole("button", { name: /^Add ·/ });
    ok(/₹90/.test(await add.innerText()), `${label}: the Add button shows the price of the chosen size`, await add.innerText());
    await dlg(page).locator("label", { hasText: "Cheese Dip" }).click();
    await page.waitForTimeout(350);
    const extraOn = await tileStyle("Cheese Dip");
    ok(extraOn.on && extraOn.border === sizeOn.border, `${label}: a ticked extra lights up the same way`);
    ok(/₹120/.test(await add.innerText()), `${label}: …and its price is added to the Add button (₹90 + ₹30)`, await add.innerText());
    await dlg(page).getByRole("button", { name: "One more" }).click();
    ok(/₹240/.test(await add.innerText()), `${label}: a second portion doubles it`, await add.innerText());
    await page.screenshot({ path: `item-popup-${label}.png` });

    // adding still works
    await add.click();
    await page.waitForTimeout(700);
    ok((await dlg(page).count()) === 0 && /2 items?|₹240|View cart|Review/i.test(await page.locator("body").innerText()), `${label}: Add puts it in the cart and closes the pop-up`);
    await ctx.close();
  }

  /* a short screen: the choices scroll and the Add row stays put */
  console.log("== a short screen: the choices scroll, the Add button stays in view");
  {
    const { ctx, page } = await open({ viewport: { width: 390, height: 560 }, isMobile: true, hasTouch: true });
    await openPopup(page);
    const r = await page.evaluate(() => {
      const m = document.querySelector('[data-testid="item-modal"]');
      const body = m.firstElementChild;
      const add = [...m.querySelectorAll("button")].find((b) => /^Add ·/.test(b.textContent));
      const before = add.getBoundingClientRect();
      body.scrollTop = body.scrollHeight;
      const after = add.getBoundingClientRect();
      return { scrolls: body.scrollHeight > body.clientHeight + 4, addTop: Math.round(before.top), addTopAfter: Math.round(after.top), addBottom: Math.round(after.bottom), vh: innerHeight, lastVisible: (() => { const last = [...body.querySelectorAll("label")].pop().getBoundingClientRect(); const bb = body.getBoundingClientRect(); return last.bottom <= bb.bottom + 1; })() };
    });
    ok(r.scrolls, "the choices are taller than the pop-up, so they scroll inside it", JSON.stringify(r));
    ok(r.addTop === r.addTopAfter && r.addBottom <= r.vh, "the Add button does not move while scrolling and is fully on the screen", JSON.stringify(r));
    ok(r.lastVisible, "scrolled to the end, the last choice is fully visible above the Add row", JSON.stringify(r));
    await page.screenshot({ path: "item-popup-short.png" });
    await ctx.close();
  }
} finally {
  await call("PATCH", `/api/menu/items/${dish.id}`, { modifierGroupIds: groupsBefore });
  for (const id of made) await call("DELETE", `/api/menu/modifier-groups/${id}`);
  await browser.close();
}
console.log("console problems:", problems.length ? problems : "none");
ok(problems.length === 0, "the browser logged no errors or warnings");
console.log(`SUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
