// Ordering for delivery: a free map (Leaflet + OpenStreetMap, no key) with the PIN FIXED in the middle — the customer moves the MAP under it (one
// finger drags, two fingers pinch) — and the place is mandatory. It starts at the customer's saved place for this outlet, else their phone's
// location if already allowed, else the restaurant. The distance is measured from the pin. Chrome against the bench's Acme store (its Connaught
// Place outlet delivers 5 km). The map pictures (tiles) are answered locally, so the test never calls OpenStreetMap's public server.
import { chromium } from "playwright";
const SF = "http://localhost:3170";
const API = "http://localhost:3097";
let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };
const problems = [];
const login = async (email, password) => (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const owner = await login("o@acme.test", "Owner123!");
const outlets = await (await fetch(`${API}/api/outlets`, { headers: { cookie: owner } })).json();
const main = (outlets.outlets ?? outlets).find((o) => o.slug === "main");
const mainId = String(main._id ?? main.id);
const origin = await (await fetch(`${API}/api/delivery/origin?outletId=${mainId}`)).json();
const haversine = (a, b) => { const R = 6371, rad = (d) => (d * Math.PI) / 180; const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng); const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
console.log("outlet:", JSON.stringify(origin));

const browser = await chromium.launch();
let phoneSeq = 0;
const plainLine = async () => { const m = await (await fetch(`${API}/api/menu?outletId=${mainId}`)).json(); const it = (m.items ?? []).find((i) => i.isAvailable !== false && !(i.modifierGroupIds?.length)); return { itemId: it.id, variantId: it.variants?.[0]?.id }; };
const tileRequests = [];

/** the checkout of /main with one dish in the cart, signed in as a fresh customer (a phone context when `touch`) */
const checkout = async ({ viewport = { width: 1280, height: 900 }, tiles = "ok", geo, touch = false, into = null } = {}) => {
  const ctx = into?.ctx ?? await browser.newContext({ viewport, ...(touch ? { hasTouch: true, isMobile: true } : {}), ...(geo ? { geolocation: geo, permissions: ["geolocation"] } : {}) });
  await ctx.route(/tile\.openstreetmap\.org/, (route) => { tileRequests.push(route.request().url()); return tiles === "ok" ? route.fulfill({ status: 200, contentType: "image/png", body: PNG }) : route.abort(); });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon|ERR_FAILED/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  const line = await plainLine();
  await page.goto(`${SF}/main`, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate(([id, ln]) => localStorage.setItem(`rasoipulse.cart.${id}`, JSON.stringify([{ ...ln, quantity: 1, modifierOptionIds: [] }])), [mainId, line]);
  await page.goto(`${SF}/main/order`, { waitUntil: "networkidle", timeout: 90000 });
  if (!into) {
    await page.getByText("Sign in to order").first().waitFor({ timeout: 20000 });
    const phone = `96${String(Date.now()).slice(-6)}${String(++phoneSeq).padStart(2, "0")}`.slice(0, 10);
    await page.getByRole("textbox", { name: "Your name" }).fill("Map Tester");
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
  }
  await page.getByText("How would you like it?").first().waitFor({ timeout: 25000 });
  await page.waitForTimeout(400);
  return { ctx, page };
};
const mapBox = (page) => page.getByTestId("delivery-map");
const centerOf = async (page) => { const v = await mapBox(page).getAttribute("data-center"); if (!v) return null; const [lat, lng] = v.split(",").map(Number); return { lat, lng }; };
const zoomOf = async (page) => Number(await mapBox(page).getAttribute("data-zoom"));
const placeBtn = (page) => page.getByTestId("place-order");
const chooseDelivery = async (page) => { await page.getByTestId("fulfilment-delivery").click(); await mapBox(page).waitFor({ timeout: 15000 }); await page.waitForTimeout(1200); };
const pinBox = async (page) => page.getByTestId("delivery-pin").boundingBox();
/** where the pin is INSIDE the map (the page may scroll while a test drags, so screen positions can't be compared) */
const pinInMap = async (page) => { const p = await pinBox(page), m = await mapBox(page).boundingBox(); return { x: p.x - m.x, y: p.y - m.y }; };
/** drag the MAP (not the pin) with the mouse by dx, dy pixels from its middle */
const dragMap = async (page, dx, dy) => { await mapBox(page).evaluate((el) => el.scrollIntoView({ block: "center" })); await page.waitForTimeout(150); const b = await mapBox(page).boundingBox(); const x = b.x + b.width / 2 + 30, y = b.y + b.height / 2 + 30; await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(1100); };
const distanceShown = async (page) => Number(((await page.getByTestId("delivery-distance").innerText({ timeout: 8000 })).match(/[\d.]+/) ?? [])[0]);
/** where the ring is on screen: its radius in px, so drags can be sized as a share of it whatever the zoom is */
const ringPx = async (page) => { const b = await page.locator(".leaflet-overlay-pane path").first().boundingBox(); return b.width / 2; };
/** real touches, sent through the browser's own touch input (one point = one finger, two points = a pinch) */
const touchSession = async (page) => {
  const cdp = await page.context().newCDPSession(page);
  const send = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  return { send, end: () => cdp.detach() };
};

try {
  console.log("\n== 1. Choosing Delivery: a map with a FIXED pin");
  {
    const { ctx, page } = await checkout();
    await chooseDelivery(page);
    ok(await mapBox(page).isVisible() && (await page.locator(".leaflet-container").count()) === 1, "a map is drawn as soon as Delivery is chosen");
    ok(/Choose your location on the map/.test(await page.locator("body").innerText()) && /required/i.test(await page.getByTestId("address-picker").innerText()), "it is headed 'Choose your location on the map' and marked Required");
    const att = await page.locator(".leaflet-control-attribution").innerText();
    ok(/OpenStreetMap/.test(att) && !/Leaflet/.test(att), "the '© OpenStreetMap contributors' credit is there, without the extra 'Leaflet' label", att.replace(/\s+/g, " "));
    const fs = await page.locator(".leaflet-control-attribution").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    ok(fs <= 11, "the credit is set small", `${fs}px`);
    ok(tileRequests.length > 0 && tileRequests.every((u) => /tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png/.test(u)) && !/key=|apikey|googleapis/i.test(tileRequests.join(" ")), "the map pictures come from OpenStreetMap, with no key and no Google");
    const mb = await mapBox(page).boundingBox();
    const pb = await pinBox(page);
    ok(Math.abs(pb.x + pb.width / 2 - (mb.x + mb.width / 2)) < 2 && Math.abs(pb.y + pb.height - (mb.y + mb.height / 2)) < 3, "the pin is fixed in the middle of the map: its tip is the map's centre", `tip ${Math.round(pb.y + pb.height)} vs centre ${Math.round(mb.y + mb.height / 2)}`);
    const c0 = await centerOf(page);
    ok(c0 && haversine(c0, origin.point) < 1, "with nothing saved and no location allowed, the map starts at the RESTAURANT", `${haversine(c0, origin.point).toFixed(2)} km from it`);
    ok(await page.getByTestId("delivery-pin-missing").isVisible() && /Choose location on the map/.test(await placeBtn(page).innerText()) && await placeBtn(page).isDisabled(), "…and it is not chosen yet: the note says to move the map and the order button is locked");
    await page.getByTestId("delivery-address").fill("12 Janpath, near the metro, New Delhi");
    await page.getByTestId("delivery-landmark").fill("Gate 3");
    await page.waitForTimeout(300);
    ok(await placeBtn(page).isDisabled(), "a typed address alone does NOT unlock the order: the place on the map is mandatory");

    console.log("\n== 2. Moving the MAP moves the place; the pin stays put");
    await mapBox(page).click({ position: { x: 120, y: 80 } });
    await page.waitForTimeout(900);
    ok(await page.getByTestId("delivery-pin-missing").isVisible(), "clicking the map does NOT place a pin any more (the pin is fixed)");
    const z0 = await zoomOf(page);
    await page.locator(".leaflet-control-zoom-in").click();
    await page.waitForTimeout(900);
    ok((await zoomOf(page)) > z0 && await page.getByTestId("delivery-pin-missing").isVisible(), "zooming with + changes the zoom but is not a choice of place", `${z0} → ${await zoomOf(page)}`);
    await page.locator(".leaflet-control-zoom-out").click();
    await page.waitForTimeout(700);
    const R = await ringPx(page);
    const pinBefore = await pinInMap(page);
    await dragMap(page, -R * 0.45, -R * 0.3);
    const c1 = await centerOf(page);
    const pinAfter = await pinInMap(page);
    ok(c1 && haversine(c1, c0) > 0.2, "dragging the map moves what is under the pin", `${haversine(c1, c0).toFixed(2)} km`);
    ok(Math.abs(pinBefore.x - pinAfter.x) < 1 && Math.abs(pinBefore.y - pinAfter.y) < 1, "…while the pin itself did not move inside the map");
    await page.getByTestId("delivery-quote").waitFor({ timeout: 8000 });
    const d1 = await distanceShown(page);
    ok(/We deliver here/.test(await page.getByTestId("delivery-quote").innerText()) && Math.abs(d1 - haversine(origin.point, c1)) <= 0.06, "'We deliver here' with the distance from the PIN (the map's centre) to the restaurant", `shown ${d1} km, expected ${haversine(origin.point, c1).toFixed(2)} km`);
    ok(/Location chosen on the map/.test(await page.getByTestId("delivery-pin-set").innerText()), "the place is now chosen");
    ok(await placeBtn(page).isEnabled(), "with the place and the address the order button unlocks", (await placeBtn(page).innerText()).replace(/\s+/g, " "));
    // typing the address must not re-price the order: the price depends on the pin, not on the words
    const quotes = [];
    page.on("request", (r) => { if (r.url().includes("/api/orders/quote")) quotes.push(JSON.parse(r.postData() ?? "{}")); });
    await page.getByTestId("delivery-address").pressSequentially(", Block C, second floor", { delay: 40 });
    await page.getByTestId("delivery-landmark").pressSequentially(" opposite the bank", { delay: 40 });
    await page.waitForTimeout(900);
    ok(quotes.length === 0, "typing in the address and landmark boxes sends NO price request (it used to send one per letter)", `${quotes.length} requests`);
    const asked = [];
    page.on("request", (r) => { if (r.url().includes("/api/delivery/check")) asked.push(JSON.parse(r.postData() ?? "{}")); });
    await dragMap(page, R * 0.5, R * 0.25);
    await page.waitForTimeout(600);
    ok(quotes.length >= 1 && quotes.length <= 3 && quotes.at(-1).deliveryPoint && Math.abs(quotes.at(-1).deliveryPoint.lat - (await centerOf(page)).lat) < 1e-5, "moving the map DOES re-price (the delivery charge depends on the pin), with the pin's coordinates", `${quotes.length} request(s)`);
    const c2 = await centerOf(page);
    const d2 = await distanceShown(page);
    ok(Math.abs(d2 - haversine(origin.point, c2)) <= 0.06 && d2 !== d1, "moving the map again measures from the new place", `${d1} → ${d2} km`);
    ok(asked.length >= 1 && Math.abs(asked.at(-1).lat - c2.lat) < 1e-5 && Math.abs(asked.at(-1).lng - c2.lng) < 1e-5 && asked.at(-1).outletId === mainId, "the check sent to the server carries exactly the centre's coordinates", JSON.stringify(asked.at(-1)));
    // zoom with the wheel + Ctrl (a trackpad pinch arrives like that); a plain wheel scrolls the page and does not zoom
    const zb = await zoomOf(page);
    await mapBox(page).evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(200);
    const mb2 = await mapBox(page).boundingBox();
    await page.mouse.move(mb2.x + mb2.width / 2, mb2.y + mb2.height / 2);
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(500);
    ok((await zoomOf(page)) === zb, "a plain scroll over the map does not zoom it (the page can still be scrolled)");
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -120);
    await page.keyboard.up("Control");
    await page.waitForTimeout(900);
    ok((await zoomOf(page)) > zb, "Ctrl + scroll (or a trackpad pinch) zooms in", `${zb} → ${await zoomOf(page)}`);

    console.log("\n== 3. A place outside the delivery area");
    await page.locator(".leaflet-control-zoom-out").click(); await page.waitForTimeout(500);
    await page.locator(".leaflet-control-zoom-out").click(); await page.waitForTimeout(500);
    const R3 = await ringPx(page);
    await dragMap(page, R3 * 3.2, 0);
    const far = await centerOf(page);
    ok(far && haversine(origin.point, far) > origin.radiusKm, "dragging the map until the pin is beyond the ring puts the place outside the radius", `${haversine(origin.point, far).toFixed(1)} km of ${origin.radiusKm} km`);
    ok(/Delivery not available at this pin/.test(await page.getByTestId("delivery-quote").innerText()), "'Delivery not available at this pin', in words");
    ok(/Move the pin inside the delivery area/.test(await placeBtn(page).innerText()) && await placeBtn(page).isDisabled(), "the order button asks to move it, and is locked");

    console.log("\n== 4. Switching away and back starts clean");
    await page.getByRole("group", { name: "Order type" }).getByRole("button", { name: "Takeaway" }).click();
    await page.waitForTimeout(500);
    ok(await page.getByTestId("address-picker").count() === 0, "takeaway has no map");
    await page.getByTestId("fulfilment-delivery").click();
    await mapBox(page).waitFor();
    await page.waitForTimeout(1200);
    ok(await page.getByTestId("delivery-pin-missing").isVisible() && /Choose location on the map/.test(await placeBtn(page).innerText()) && await placeBtn(page).isDisabled(), "coming back to Delivery shows no chosen place and the order stays locked (an old place is never kept without being seen)");

    console.log("\n== 5. The map doesn't cover the page's own bars");
    await page.evaluate(() => document.querySelector('[data-testid="delivery-map"]').scrollIntoView({ block: "end" }));
    await page.waitForTimeout(300);
    const barPoint = await page.evaluate(() => { const bar = document.querySelector(".ot-fx-bar"); if (!bar) return null; const r = bar.getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { onTop: Boolean(el?.closest(".ot-fx-bar")) }; });
    ok(barPoint?.onTop === true, "the sticky 'To pay' bar stays above the map and its pin even when they overlap");
    await ctx.close();
  }

  console.log("\n== 6. A phone: one finger moves the map, two fingers pinch it");
  {
    const { ctx, page } = await checkout({ viewport: { width: 390, height: 800 }, touch: true });
    await chooseDelivery(page);
    ok(await mapBox(page).isVisible() && (await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)), "the map fits a phone screen with no sideways scrolling");
    const fs = await page.locator(".leaflet-control-attribution").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    ok(fs <= 9.5, "the OpenStreetMap credit is tiny on a phone", `${fs}px`);
    ok(/Pinch to zoom/.test(await page.getByTestId("address-picker").innerText()), "the hint says one finger drags and to pinch to zoom");
    await mapBox(page).scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const b = await mapBox(page).boundingBox();
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    const t = await touchSession(page);
    const c0 = await centerOf(page);
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await t.send("touchStart", [[cx, cy]]);
    for (let i = 1; i <= 12; i++) await t.send("touchMove", [[cx + i * 7, cy + i * 5]]);
    await t.send("touchEnd", []);
    await page.waitForTimeout(1100);
    const c1 = await centerOf(page);
    ok(c1 && haversine(c0, c1) > 0.05, "ONE finger dragging moves the map", `${haversine(c0, c1).toFixed(2)} km`);
    ok((await page.evaluate(() => window.scrollY)) === scrollBefore, "…and the page behind did not scroll");
    ok(await page.getByTestId("delivery-pin-set").isVisible(), "the place is chosen from that move");
    const z0 = await zoomOf(page);
    await t.send("touchStart", [[cx - 40, cy], [cx + 40, cy]]);
    for (let i = 1; i <= 10; i++) await t.send("touchMove", [[cx - 40 - i * 9, cy], [cx + 40 + i * 9, cy]]);
    await t.send("touchEnd", []);
    await page.waitForTimeout(1100);
    const z1 = await zoomOf(page);
    ok(z1 > z0, "pinching OUT (two fingers apart) zooms in", `${z0} → ${z1}`);
    await t.send("touchStart", [[cx - 130, cy], [cx + 130, cy]]);
    for (let i = 1; i <= 10; i++) await t.send("touchMove", [[cx - 130 + i * 11, cy], [cx + 130 - i * 11, cy]]);
    await t.send("touchEnd", []);
    await page.waitForTimeout(1100);
    ok((await zoomOf(page)) < z1, "pinching IN (two fingers together) zooms out", `${z1} → ${await zoomOf(page)}`);
    await t.end();
    await ctx.close();
  }

  console.log("\n== 7. Where the map starts: the phone's location, if already allowed");
  {
    const here = { latitude: origin.point.lat + 0.012, longitude: origin.point.lng + 0.01, accuracy: 25 };
    const { ctx, page } = await checkout({ geo: here });
    await chooseDelivery(page);
    await page.getByTestId("delivery-pin-set").waitFor({ timeout: 10000 });
    await page.waitForTimeout(800);
    const c = await centerOf(page);
    ok(c && Math.abs(c.lat - here.latitude) < 1e-4 && Math.abs(c.lng - here.longitude) < 1e-4, "with location already allowed, the map opens AT the phone's location, with no tap needed", JSON.stringify(c));
    ok(/Your current location/.test(await page.getByTestId("delivery-pin-set").innerText()) && /accurate to/.test(await page.getByTestId("delivery-pin-set").innerText()), "it says so, with the accuracy");
    ok(Math.abs((await distanceShown(page)) - haversine(origin.point, c)) <= 0.06, "the distance is measured from it");
    await dragMap(page, 60, 40);
    const c2 = await centerOf(page);
    ok(haversine(c, c2) > 0.005, "…and the customer can still move the map to correct it");
    await ctx.close();
  }
  {
    const { ctx, page } = await checkout(); // no permission given
    await chooseDelivery(page);
    await page.waitForTimeout(800);
    ok((await page.getByTestId("delivery-pin-missing").isVisible()) && haversine(await centerOf(page), origin.point) < 1, "without permission the map stays at the restaurant and asks nothing of the browser");
    await page.getByTestId("delivery-use-location").click();
    await page.waitForTimeout(1500);
    ok(/blocked|move the map/i.test(await page.getByTestId("address-picker").innerText()), "pressing 'Use my current location' without permission says how to carry on (move the map)");
    await ctx.close();
  }

  console.log("\n== 8. Where the map starts: the place saved for this outlet");
  {
    const seeded = await checkout();
    const { ctx } = seeded;
    const saved = { outletId: mainId, lat: origin.point.lat + 0.02, lng: origin.point.lng - 0.012, text: "Flat 9B, Tower 3, Green Park, New Delhi", landmark: "Behind the temple" };
    const put = await seeded.page.evaluate(async (b) => { const r = await fetch("/api/customer/address", { method: "PUT", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify(b) }); return { status: r.status, json: await r.json() }; }, saved);
    ok(put.status === 200 && put.json.address.text === saved.text, "(the customer's saved place for this outlet is in place, as a delivery order would have left it)");
    await seeded.page.close();
    const { page } = await checkout({ into: { ctx } }); // a fresh visit, same signed-in browser
    await chooseDelivery(page);
    await page.getByTestId("delivery-pin-set").waitFor({ timeout: 10000 });
    await page.waitForTimeout(800);
    const c = await centerOf(page);
    ok(c && Math.abs(c.lat - saved.lat) < 1e-4 && Math.abs(c.lng - saved.lng) < 1e-4, "the map opens with the pin already ON the saved place", JSON.stringify(c));
    ok(/Your saved place for this outlet/.test(await page.getByTestId("delivery-pin-set").innerText()), "it says it is the saved place");
    ok((await page.getByTestId("delivery-address").inputValue()) === saved.text && (await page.getByTestId("delivery-landmark").inputValue()) === saved.landmark, "the whole address (text and landmark) is filled in too");
    await page.getByTestId("delivery-quote").waitFor({ timeout: 8000 });
    ok(Math.abs((await distanceShown(page)) - haversine(origin.point, c)) <= 0.06, "the distance is measured from the saved pin");
    ok(await placeBtn(page).isEnabled(), "so the order can be placed straight away: nothing more to do");
    await dragMap(page, 50, 30);
    const c2 = await centerOf(page);
    ok(haversine(c, c2) > 0.005 && (await page.getByTestId("delivery-address").inputValue()) === saved.text, "the customer can still move the map, and the typed address stays");
    await page.getByTestId("delivery-forget-saved").click();
    await page.waitForTimeout(800);
    const gone = await page.evaluate(async (id) => (await (await fetch(`/api/customer/address?outletId=${id}`, { credentials: "include" })).json()).address, mainId);
    ok(gone === null && (await page.getByTestId("delivery-forget-saved").count()) === 0, "'Forget it' removes the saved place (nothing comes back next time)");
    await ctx.close();
  }

  console.log("\n== 9. Placing the order: the confirmation page shows the delivery code, and the place is saved");
  {
    const { ctx, page } = await checkout();
    await chooseDelivery(page);
    const R = await ringPx(page);
    await dragMap(page, R * 0.3, R * 0.2);
    const placeAt = await centerOf(page);
    await page.getByTestId("delivery-address").fill("Flat 12, Block D, Sector 18, Noida");
    await page.getByTestId("delivery-landmark").fill("Next to the bank");
    await page.waitForTimeout(500);
    const sent = [];
    page.on("request", (r) => { if (r.method() === "POST" && /\/api\/orders$/.test(new URL(r.url()).pathname)) sent.push(JSON.parse(r.postData() ?? "{}")); });
    await placeBtn(page).click();
    await page.getByTestId("done-delivery-code").waitFor({ timeout: 30000 });
    const codeBox = page.getByTestId("done-delivery-code");
    const digits = (await page.getByTestId("done-delivery-code-digits").innerText()).trim();
    const size = await page.getByTestId("done-delivery-code-digits").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const bg = await codeBox.evaluate((el) => getComputedStyle(el).backgroundColor);
    ok(sent.length === 1 && sent[0].gateway && sent[0].gateway !== "cod" && sent[0].channel === "delivery", "the delivery order is sent with an ONLINE payment method automatically (not the cash left over from the takeaway choice)", JSON.stringify({ channel: sent[0]?.channel, gateway: sent[0]?.gateway }));
    ok(/^\d{4}$/.test(digits), "the 'Order placed' page shows the 4-digit delivery code", digits);
    ok(size >= 44, "…in a big font", `${size}px`);
    ok(bg !== "rgba(0, 0, 0, 0)" && /Your delivery code/i.test(await codeBox.innerText()) && /Tell it to the rider/.test(await codeBox.innerText()), "…in a highlighted box that says what it is for", bg);
    ok(/Order #\d+ placed/.test(await page.locator("body").innerText()) && /Delivery/.test(await page.locator("body").innerText()), "(it is the delivery order's confirmation page)");
    await page.getByTestId("done-follow").click();
    await page.getByTestId("tracker-delivery-code").waitFor({ timeout: 15000 });
    ok((await page.getByTestId("tracker-delivery-code").innerText()).includes(digits), "the same code is on the order's tracking page, so it can be found again");
    const savedNow = await page.evaluate(async (id) => (await (await fetch(`/api/customer/address?outletId=${id}`, { credentials: "include" })).json()).address, mainId);
    ok(savedNow && Math.abs(savedNow.lat - placeAt.lat) < 1e-5 && Math.abs(savedNow.lng - placeAt.lng) < 1e-5 && savedNow.text === "Flat 12, Block D, Sector 18, Noida" && savedNow.landmark === "Next to the bank", "the pin and the whole address were saved for this outlet by the order", JSON.stringify(savedNow));
    await page.goto(`${SF}/main/order`, { waitUntil: "networkidle" });
    ok(true, "(back to the checkout)");
    await ctx.close();
  }

  console.log("\n== 10. The map pictures can't load");
  {
    const { ctx, page } = await checkout({ tiles: "fail", geo: { latitude: origin.point.lat + 0.005, longitude: origin.point.lng + 0.005 } });
    await chooseDelivery(page);
    await page.waitForTimeout(2500);
    ok(/map pictures couldn't load/i.test(await page.locator("body").innerText()), "a clear message says the pictures couldn't load");
    ok(await page.getByTestId("delivery-pin-set").isVisible(), "…and the place is still chosen from the phone's location");
    await ctx.close();
  }

  ok(problems.length === 0, "no errors or warnings in the browser console", problems.slice(0, 3).join(" | "));
} catch (e) {
  ok(false, "the test stopped with an error", String(e?.stack ?? e).split("\n").slice(0, 5).join(" | "));
}
await browser.close();
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
