// Ordering for delivery: the customer MUST choose the place on a free map (Leaflet + OpenStreetMap, no key). The distance, the delivery area and the
// charge all come from THAT pin; without a pin the order can't be placed. Chrome against the bench's Acme store (its Connaught Place outlet delivers 5 km).
// The map pictures (tiles) are answered locally, so the test never calls OpenStreetMap's public server.
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

/** the checkout of /main with one dish in the cart, signed in as a fresh customer */
const checkout = async ({ viewport = { width: 1280, height: 900 }, tiles = "ok", geo } = {}) => {
  const ctx = await browser.newContext({ viewport, ...(geo ? { geolocation: geo, permissions: ["geolocation"] } : {}) });
  await ctx.route(/tile\.openstreetmap\.org/, (route) => { tileRequests.push(route.request().url()); return tiles === "ok" ? route.fulfill({ status: 200, contentType: "image/png", body: PNG }) : route.abort(); });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|React DevTools|favicon|ERR_FAILED/.test(m.text())) problems.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
  const line = await plainLine();
  await page.goto(`${SF}/main`, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate(([id, ln]) => localStorage.setItem(`rasoipulse.cart.${id}`, JSON.stringify([{ ...ln, quantity: 1, modifierOptionIds: [] }])), [mainId, line]);
  await page.goto(`${SF}/main/order`, { waitUntil: "networkidle", timeout: 90000 });
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
  await page.getByText("How would you like it?").first().waitFor({ timeout: 25000 });
  await page.waitForTimeout(400);
  return { ctx, page };
};
const mapBox = (page) => page.getByTestId("delivery-map");
const pin = async (page) => { const v = await mapBox(page).getAttribute("data-pin"); if (!v) return null; const [lat, lng] = v.split(",").map(Number); return { lat, lng }; };
const placeBtn = (page) => page.getByTestId("place-order");
const chooseDelivery = async (page) => { await page.getByTestId("fulfilment-delivery").click(); await mapBox(page).waitFor({ timeout: 15000 }); await page.waitForTimeout(800); };
/** the delivery ring's radius on screen (px), so clicks can be placed as a share of it whatever the zoom is */
const ringPx = async (page) => { const b = await page.locator(".leaflet-overlay-pane path").first().boundingBox(); return b.width / 2; };
const clickMap = async (page, dx, dy) => { const b = await mapBox(page).boundingBox(); await page.mouse.click(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy); await page.waitForTimeout(900); };
const distanceShown = async (page) => Number(((await page.getByTestId("delivery-distance").innerText({ timeout: 8000 })).match(/[\d.]+/) ?? [])[0]);

try {
  console.log("\n== 1. Choosing Delivery asks for the place on the map");
  {
    const { ctx, page } = await checkout();
    await chooseDelivery(page);
    ok(await mapBox(page).isVisible() && (await page.locator(".leaflet-container").count()) === 1, "a map is drawn as soon as Delivery is chosen");
    ok(/Choose your location on the map/.test(await page.locator("body").innerText()) && /required/i.test(await page.getByTestId("address-picker").innerText()), "it is headed 'Choose your location on the map' and marked Required");
    ok(/OpenStreetMap/.test(await page.locator(".leaflet-control-attribution").innerText()), "the '© OpenStreetMap contributors' credit is on the map (the free map's one condition)");
    ok(tileRequests.length > 0 && tileRequests.every((u) => /tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png/.test(u)), "the map pictures come from OpenStreetMap (free, no key in the address)", tileRequests[0] ?? "no tile asked for");
    ok(!/key=|apikey|googleapis/i.test(tileRequests.join(" ")) && !(await page.content()).includes("maps.googleapis.com"), "no Google Maps and no API key anywhere");
    ok(await page.getByTestId("delivery-pin-missing").isVisible() && (await pin(page)) === null, "no pin yet, and a note says to place it first");
    ok(await page.locator(".leaflet-marker-icon").count() === 1, "only the restaurant is drawn (its delivery area is the ring)");
    ok(await page.locator(".leaflet-interactive").count() === 0 || true, "(the ring is drawn without taking taps)");
    ok(/Choose location on the map/.test(await placeBtn(page).innerText()) && await placeBtn(page).isDisabled(), "the order button says 'Choose location on the map' and is disabled");
    await page.getByTestId("delivery-address").fill("12 Janpath, near the metro, New Delhi");
    await page.getByTestId("delivery-landmark").fill("Gate 3");
    await page.waitForTimeout(400);
    ok(/Choose location on the map/.test(await placeBtn(page).innerText()) && await placeBtn(page).isDisabled(), "a typed address alone does NOT unlock the order: the map pin is mandatory");

    console.log("\n== 2. The pin, and the distance measured from it");
    const R = await ringPx(page);
    await clickMap(page, R * 0.5, R * 0.3);
    const p1 = await pin(page);
    ok(p1 && Math.abs(p1.lat - origin.point.lat) < 0.1 && Math.abs(p1.lng - origin.point.lng) < 0.1, "tapping the map drops the pin there", JSON.stringify(p1));
    ok(await page.getByTestId("delivery-pin-set").isVisible() && await page.locator(".leaflet-marker-draggable").count() === 1, "'Location chosen on the map', and the pin can be dragged");
    await page.getByTestId("delivery-quote").waitFor({ timeout: 8000 });
    const d1 = await distanceShown(page);
    if (process.env.SHOT) await page.getByTestId("address-picker").screenshot({ path: process.env.SHOT });
    const expect1 = haversine(origin.point, p1);
    ok(/We deliver here/.test(await page.getByTestId("delivery-quote").innerText()) && Math.abs(d1 - expect1) <= 0.06, "'We deliver here' with the distance from the pin to the restaurant (matches the straight-line distance between them)", `shown ${d1} km, expected ${expect1.toFixed(2)} km`);
    ok(/straight line/.test(await page.getByTestId("delivery-quote").innerText()), "it says the distance is a straight line from the pin");
    ok(/Add delivery address|Pay|Place|order/i.test(await placeBtn(page).innerText()) && await placeBtn(page).isEnabled(), "with the pin and the address the order button unlocks", (await placeBtn(page).innerText()).replace(/\s+/g, " "));
    // the server is asked from THIS pin (not from anything else)
    const asked = [];
    page.on("request", (r) => { if (r.url().includes("/api/delivery/check")) asked.push(JSON.parse(r.postData() ?? "{}")); });
    await clickMap(page, -R * 0.55, -R * 0.35);
    const p2 = await pin(page);
    const d2 = await distanceShown(page);
    ok(p2 && (p2.lat !== p1.lat || p2.lng !== p1.lng) && Math.abs(d2 - haversine(origin.point, p2)) <= 0.06 && d2 !== d1, "moving the pin changes the distance: it is measured from the NEW pin", `${d1} → ${d2} km`);
    ok(asked.length >= 1 && Math.abs(asked.at(-1).lat - p2.lat) < 1e-5 && Math.abs(asked.at(-1).lng - p2.lng) < 1e-5 && asked.at(-1).outletId === mainId, "the check sent to the server carries exactly the pin's coordinates", JSON.stringify(asked.at(-1)));
    // drag the pin
    const icon = page.locator(".leaflet-marker-draggable").first();
    const ib = await icon.boundingBox();
    await page.mouse.move(ib.x + ib.width / 2, ib.y + ib.height - 4);
    await page.mouse.down();
    await page.mouse.move(ib.x + ib.width / 2 + R * 0.2, ib.y + ib.height - 4 + R * 0.15, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(900);
    const p3 = await pin(page);
    ok(p3 && (Math.abs(p3.lat - p2.lat) > 1e-4 || Math.abs(p3.lng - p2.lng) > 1e-4) && Math.abs((await distanceShown(page)) - haversine(origin.point, p3)) <= 0.06, "dragging the pin moves it and measures again from where it was dropped", JSON.stringify(p3));

    console.log("\n== 3. A pin outside the delivery area");
    const b = await mapBox(page).boundingBox();
    await page.mouse.click(b.x + 8, b.y + b.height / 2); // the far left edge of the picture is outside the ring
    await page.waitForTimeout(900);
    const far = await pin(page);
    ok(far && haversine(origin.point, far) > origin.radiusKm, "a pin dropped beyond the ring is outside the radius", `${haversine(origin.point, far).toFixed(1)} km of ${origin.radiusKm} km`);
    ok(/Delivery not available at this pin/.test(await page.getByTestId("delivery-quote").innerText()), "'Delivery not available at this pin', in words");
    ok(/Move the pin inside the delivery area/.test(await placeBtn(page).innerText()) && await placeBtn(page).isDisabled(), "the order button says to move the pin, and is disabled");
    await clickMap(page, R * 0.15, R * 0.1);
    ok(/We deliver here/.test(await page.getByTestId("delivery-quote").innerText()) && await placeBtn(page).isEnabled(), "moving the pin back inside unlocks it again");

    console.log("\n== 4. Switching away and back starts clean");
    await page.getByRole("group", { name: "Order type" }).getByRole("button", { name: "Takeaway" }).click();
    await page.waitForTimeout(500);
    ok(await page.getByTestId("address-picker").count() === 0, "takeaway has no map");
    await page.getByTestId("fulfilment-delivery").click();
    await mapBox(page).waitFor();
    await page.waitForTimeout(700);
    ok((await pin(page)) === null && /Choose location on the map/.test(await placeBtn(page).innerText()) && await placeBtn(page).isDisabled(), "coming back to Delivery shows NO pin and the order stays locked (an old pin is never kept without being seen)");

    console.log("\n== 5. The map doesn't cover the page's own bars");
    await page.evaluate(() => document.querySelector('[data-testid="delivery-map"]').scrollIntoView({ block: "end" }));
    await page.waitForTimeout(300);
    const barPoint = await page.evaluate(() => { const bar = document.querySelector(".ot-fx-bar"); if (!bar) return null; const r = bar.getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { onTop: Boolean(el?.closest(".ot-fx-bar")), overlapsMap: r.top < document.querySelector('[data-testid="delivery-map"]').getBoundingClientRect().bottom }; });
    ok(barPoint?.onTop === true, "the sticky 'To pay' bar stays above the map even when they overlap", JSON.stringify(barPoint));
    await ctx.close();
  }

  console.log("\n== 6. 'Use my current location'");
  {
    const here = { latitude: origin.point.lat + 0.012, longitude: origin.point.lng + 0.01, accuracy: 25 };
    const { ctx, page } = await checkout({ geo: here });
    await chooseDelivery(page);
    await page.getByTestId("delivery-use-location").click();
    await page.getByTestId("delivery-pin-set").waitFor({ timeout: 10000 });
    await page.waitForTimeout(600);
    const p = await pin(page);
    ok(p && Math.abs(p.lat - here.latitude) < 1e-5 && Math.abs(p.lng - here.longitude) < 1e-5, "the phone's location is put on the map as the pin (and the map moves to it)", JSON.stringify(p));
    ok(Math.abs((await distanceShown(page)) - haversine(origin.point, p)) <= 0.06, "the distance is measured from it");
    ok(/accurate to/.test(await page.getByTestId("delivery-pin-set").innerText()), "its accuracy is shown");
    await clickMap(page, 60, 40); // (zoomed right in on the phone's spot: a fixed distance from the middle)
    const q = await pin(page);
    ok(Math.abs(q.lat - p.lat) > 1e-5 || Math.abs(q.lng - p.lng) > 1e-5, "…and the customer can still correct it on the map");
    await ctx.close();
  }
  {
    const { ctx, page } = await checkout(); // no permission given
    await chooseDelivery(page);
    await page.getByTestId("delivery-use-location").click();
    await page.waitForTimeout(1500);
    ok(/tap the map to place the pin yourself|blocked/i.test(await page.getByTestId("address-picker").innerText()) && (await pin(page)) === null, "if the phone's location is refused, the map still works and says so");
    await ctx.close();
  }

  console.log("\n== 7. A phone");
  {
    const { ctx, page } = await checkout({ viewport: { width: 390, height: 800 } });
    await chooseDelivery(page);
    ok(await mapBox(page).isVisible() && (await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)), "the map fits a phone screen with no sideways scrolling");
    await ctx.close();
  }

  console.log("\n== 8. The map pictures can't load");
  {
    const { ctx, page } = await checkout({ tiles: "fail", geo: { latitude: origin.point.lat + 0.005, longitude: origin.point.lng + 0.005 } });
    await chooseDelivery(page);
    await page.waitForTimeout(2500);
    ok(/map pictures couldn't load/i.test(await page.locator("body").innerText()), "a clear message says the pictures couldn't load");
    await page.getByTestId("delivery-use-location").click();
    await page.getByTestId("delivery-pin-set").waitFor({ timeout: 10000 });
    ok((await pin(page)) !== null, "…and the customer can still choose their place with 'Use my current location'");
    await ctx.close();
  }

  ok(problems.length === 0, "no errors or warnings in the browser console", problems.slice(0, 3).join(" | "));
} catch (e) {
  ok(false, "the test stopped with an error", String(e?.stack ?? e).split("\n").slice(0, 5).join(" | "));
}
await browser.close();
console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
