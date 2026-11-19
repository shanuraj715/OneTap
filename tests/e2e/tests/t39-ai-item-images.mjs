// T39 — AI dish pictures, in Chrome: the platform admin adds Gemini keys in the console, opens a store's dashboard, presses the
// sparkles button on a dish, picks the shape and how many, and the pictures land on the dish. A store owner never sees the button.
// Google is a STAND-IN started by the bench (:3190) — nothing real is called or billed.
import { BENCH } from "../bench/watch.mjs";
import * as ui from "../bench/ui.mjs";

export const meta = {
  id: "t39-ai-item-images",
  title: "AI dish pictures — keys added in the platform console, a sparkles button on the dish row (super admin only), shape and count chosen in a pop-up, pictures saved to the dish",
  area: "menu",
  fresh: true,
  summary: "In Chrome as the platform admin: the console has an 'AI pictures' page where two Gemini keys are added (one named Primary, one 'quota-…' that the stand-in Google will say has used up its limit); each shows only a masked hint and a Ready state, Test says Google accepted the key, and the model is switched to Nano Banana 2 Lite. Then Stores → Acme Momos → Open store dashboard → Menu → Steamed Momos: every dish row has a ✦ button. Pressing it on 'Veg Steamed Momos' opens a pop-up with the five shapes (1:1, 4:3, 3:2, 16:9, 3:4) and 1–4 pictures; 16:9 and 3 are chosen and 'Make 3 pictures' pressed — a 'Making…' message shows, then three new pictures appear in the pop-up, and the dish now has them. The stand-in Google was asked three times for 16:9 with the chosen model and a description naming the dish and saying it's vegetarian; the quota key was tried once and is now Resting in the console with its reason, and all three pictures came from the Primary key. The pop-up stops at the room left on a dish (6 pictures). Signed in as the store's owner: the same Menu page has NO sparkles button on any dish, the console's AI page isn't theirs, and the API refuses their request. Finally the keys can be removed.",
  expect: [
    "The console has an AI pictures page: keys are added with a name, shown only as a masked hint with a state, can be tested, and the model can be chosen.",
    "Only when the platform admin has opened a store's dashboard does every dish row have a sparkles button.",
    "The pop-up asks for the shape (five choices) and how many pictures (1–4, never more than the dish has room for) before anything is made; the chosen shape and count are what Google is asked for.",
    "The new pictures show in the pop-up and on the dish; a key that reports its limit is rested in the console and the pictures are made on the other key.",
    "A store owner never sees the sparkles button and can't use the API.",
  ],
  expectNot: [
    "A store owner or their team must NOT see the AI button, the AI page, or a key.",
    "An API key must NOT be visible anywhere after it is saved (only its first and last characters).",
    "The pop-up must NOT offer more pictures than the dish has room for.",
    "The browser must NOT log JavaScript errors.",
  ],
};

const GOOGLE = "http://127.0.0.1:3190";
const KEY_OK = "AIzaSyBENCHprimary_aaaaaaaaaaaaaaaa";
const KEY_QUOTA = "quota-AIzaSyBENCHbackup_bbbbbbbbbbbb";

export async function run(d) {
  // the owner's session, for reading and restoring data through the API
  const login = async (email, pw) => (await fetch(`${BENCH.api}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: pw }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const ownerCookie = await login(...BENCH.logins.owner);
  const outlets = await (await fetch(`${BENCH.api}/api/outlets`, { headers: { cookie: ownerCookie } })).json();
  const main = (outlets.outlets ?? outlets).find((o) => o.slug === "main");
  const outletId = String(main._id ?? main.id);
  const menuNow = async () => (await (await fetch(`${BENCH.api}/api/menu?outletId=${outletId}`)).json());
  const dish = (await menuNow()).items.find((i) => i.name === "Veg Steamed Momos");
  const originalImages = dish.images;
  await fetch(`${GOOGLE}/__reset`);

  /* ------------------------------------------------------------------ the console */
  await d.tab("platform", "Platform console · super admin");
  await ui.signIn(d, "super");
  await ui.openPlatform(d, "/ai");
  await d.page.getByRole("heading", { name: "AI pictures" }).first().waitFor({ timeout: 15000 });

  await d.step("The platform admin adds two Gemini keys", 400);
  d.check("with no key yet, the page says so", /No key yet/.test(await ui.text(d)));
  await d.type(d.page.getByPlaceholder("e.g. Project 2"), "Primary", { after: 100, delay: 15 });
  await d.type(d.page.getByLabel("Gemini API key"), KEY_OK, { after: 100, delay: 5 });
  await d.click(d.page.getByRole("button", { name: "Add key" }), { after: 800 });
  await d.page.getByTestId("ai-key").first().waitFor({ timeout: 10000 });
  await d.type(d.page.getByPlaceholder("e.g. Project 2"), "Backup", { after: 100, delay: 15 });
  await d.type(d.page.getByLabel("Gemini API key"), KEY_QUOTA, { after: 100, delay: 5 });
  await d.click(d.page.getByRole("button", { name: "Add key" }), { after: 800 });
  await ui.until(async () => (await d.page.getByTestId("ai-key").count()) === 2, 10000);
  const body = await ui.text(d);
  d.check("both keys are listed, each Ready", (await d.page.getByTestId("ai-key").count()) === 2 && (await d.page.locator('[data-testid="ai-key"][data-status="ready"]').count()) === 2 && /Primary/.test(body) && /Backup/.test(body));
  d.check("a key is shown only as its first and last characters, never in full", !body.includes(KEY_OK) && !body.includes(KEY_QUOTA) && /AIza••••aaaa/.test(body), (body.match(/AIza••••\w{4}/) ?? [""])[0]);
  d.check("the key box is empty again after adding", (await d.page.getByLabel("Gemini API key").inputValue()) === "");
  await d.click(d.page.getByTestId("ai-key").first().getByRole("button", { name: /Test/ }), { after: 800 });
  d.check("Test says Google accepted the key", await ui.until(async () => /Google accepted this key/.test(await ui.text(d)), 8000));
  const lite = await d.page.getByLabel("Model", { exact: true }).locator("option").evaluateAll((os) => os.find((o) => /Nano Banana 2 Lite/.test(o.textContent))?.value);
  await d.page.getByLabel("Model", { exact: true }).selectOption(lite);
  d.check("the model can be chosen", await ui.until(async () => /Currently: gemini-3\.1-flash-lite-image/.test(await ui.text(d)), 8000));
  await d.shot("ai-pictures-console");

  /* ------------------------------------------------------------------ the store dashboard, as the platform admin */
  await d.step("Opening Acme Momos' dashboard as the platform admin: every dish has a ✦ button", 400);
  await ui.openStore(d, "Acme Momos");
  await d.click(d.page.getByText("Open store dashboard").first(), { after: 1200 });
  await d.click(d.page.getByRole("link", { name: "Menu", exact: true }).first(), { after: 900 });
  await d.click(d.page.locator('[data-testid="cat-row"][data-category="Steamed Momos"] button', { hasText: "Steamed Momos" }).first(), { after: 600 });
  const row = d.page.locator('[data-testid="item-row"][data-item="Veg Steamed Momos"]');
  await row.waitFor({ timeout: 10000 });
  const rows = await d.page.locator('[data-testid="item-row"]').count();
  d.check("every dish row has the sparkles button", rows > 0 && (await d.page.getByTestId("ai-button").count()) === rows, `${await d.page.getByTestId("ai-button").count()} buttons on ${rows} rows`);

  await d.step("The pop-up asks for the shape and how many pictures", 400);
  await d.click(row.getByTestId("ai-button"), { after: 600 });
  const dlg = d.page.getByRole("dialog", { name: "Make pictures with AI" });
  await dlg.waitFor({ timeout: 8000 });
  d.check("it names the dish and how many of its six pictures are used", /Veg Steamed Momos/.test(await dlg.innerText()) && new RegExp(`${originalImages.length} of 6 pictures used`).test(await dlg.innerText()));
  const shapes = await dlg.getByRole("radiogroup", { name: "Aspect ratio" }).getByRole("radio").allInnerTexts();
  d.check("five shapes are offered", ["1:1", "4:3", "3:2", "16:9", "3:4"].every((s) => shapes.some((t) => t.includes(s))) && shapes.length === 5, shapes.map((t) => t.split("\n")[0]).join(" "));
  const counts = await dlg.getByRole("radiogroup", { name: "How many pictures" }).getByRole("radio").allInnerTexts();
  d.check("1 to 4 pictures can be chosen", counts.join() === "1,2,3,4", counts.join());
  d.check("nothing is made yet (Google has not been asked)", (await (await fetch(`${GOOGLE}/__calls`)).json()).length === 0);
  await d.shot("ai-pictures-popup");

  await d.step("16:9, three pictures", 400);
  await d.click(dlg.getByRole("radio", { name: /16:9/ }), { after: 200 });
  await d.click(dlg.getByRole("radiogroup", { name: "How many pictures" }).getByRole("radio", { name: "3" }), { after: 200 });
  d.check("the button says what it will make", await dlg.getByRole("button", { name: "Make 3 pictures" }).isVisible());
  await d.click(dlg.getByRole("button", { name: "Make 3 pictures" }), { after: 100 });
  d.check("while it works, the pop-up says so and can't be cancelled", (await dlg.getByTestId("ai-working").waitFor({ timeout: 8000 }).then(() => true).catch(() => false)) && (await dlg.getByRole("button", { name: "Cancel" }).isDisabled()));
  await dlg.getByTestId("ai-result").waitFor({ timeout: 90000 });
  d.check("three new pictures are shown", (await dlg.getByTestId("ai-new-picture").count()) === 3 && /3 pictures were added/.test(await dlg.innerText()));
  d.check("each picture really loads", await dlg.getByTestId("ai-new-picture").evaluateAll((imgs) => imgs.every((i) => i.complete && i.naturalWidth > 100)));
  d.check("it says which key made them", /Made with Primary/.test(await dlg.getByTestId("ai-used-keys").innerText()));
  d.check("and that the Backup key reached its limit so another key was used automatically", /Backup/.test(await dlg.getByTestId("ai-switched").innerText()) && /automatically/.test(await dlg.getByTestId("ai-switched").innerText()));
  await d.shot("ai-pictures-result");
  await d.click(dlg.getByRole("button", { name: "Done" }), { after: 800 });
  await dlg.waitFor({ state: "hidden", timeout: 5000 });

  await d.step("What Google was asked, and what the dish has now", 400);
  const asked = await (await fetch(`${GOOGLE}/__calls`)).json();
  const good = asked.filter((c) => c.outcome === "ok");
  d.check("Google was asked for three pictures, all 16:9, with the chosen model", good.length === 3 && good.every((c) => c.aspectRatio === "16:9" && c.model === "gemini-3.1-flash-lite-image"), JSON.stringify(good.map((c) => [c.aspectRatio, c.model])));
  d.check("each description names the dish and says it is vegetarian", good.every((c) => /Veg Steamed Momos/.test(c.prompt) && /vegetarian/.test(c.prompt)));
  d.check("all three pictures came from the Primary key", good.every((c) => c.key === KEY_OK));
  const quotaTries = asked.filter((c) => c.key === KEY_QUOTA).length;
  d.check("the Backup key was tried once, said its limit was used up, and was left alone after that", quotaTries === 1, `${quotaTries} try`);
  const after = (await menuNow()).items.find((i) => i.name === "Veg Steamed Momos");
  d.check("the dish now has three more pictures", after.images.length === originalImages.length + 3, `${after.images.length}`);
  d.check("they are WebP files on this server, and open", await (async () => { const f = await fetch(after.images.at(-1).url); return f.ok && f.headers.get("content-type") === "image/webp"; })());
  d.check("the dish row now shows a picture", (await row.locator("img").count()) >= 1);
  await d.step("The pop-up stops at the room left on a dish", 400);
  await d.click(row.getByTestId("ai-button"), { after: 600 });
  const dlg2 = d.page.getByRole("dialog", { name: "Make pictures with AI" });
  await dlg2.waitFor({ timeout: 8000 });
  const room = 6 - after.images.length;
  const enabled = await dlg2.getByRole("radiogroup", { name: "How many pictures" }).getByRole("radio").evaluateAll((bs) => bs.filter((b) => !b.disabled).length);
  d.check(`with ${after.images.length} pictures, only ${room} more can be chosen`, enabled === room, `${enabled} enabled`);
  await d.click(dlg2.getByRole("button", { name: "Cancel" }), { after: 400 });

  /* ------------------------------------------------------------------ back in the console: the key that hit its limit */
  await d.step("The key that hit its limit is resting", 400);
  await ui.openPlatform(d, "/ai");
  await d.page.getByTestId("ai-key").first().waitFor({ timeout: 10000 });
  const backup = d.page.getByTestId("ai-key").filter({ hasText: "Backup" });
  const primary = d.page.getByTestId("ai-key").filter({ hasText: "Primary" });
  d.check("Backup shows Resting, with Google's reason", (await backup.getAttribute("data-status")) === "cooling" && /quota|limit/i.test(await backup.innerText()), (await backup.innerText()).replace(/\s+/g, " ").slice(0, 120));
  d.check("Primary shows the three pictures it made and is Ready", (await primary.getAttribute("data-status")) === "ready" && /3 pictures made/.test(await primary.innerText()));

  /* ------------------------------------------------------------------ a store owner */
  await d.step("A store owner never sees any of it", 400);
  await d.tab("owner", "Store dashboard · owner of Acme Momos");
  await ui.signIn(d, "owner");
  await d.goto(BENCH.admin + "/menu", 800);
  await d.click(d.page.locator('[data-testid="cat-row"][data-category="Steamed Momos"] button', { hasText: "Steamed Momos" }).first(), { after: 600 });
  await d.page.locator('[data-testid="item-row"][data-item="Veg Steamed Momos"]').waitFor({ timeout: 10000 });
  d.check("the owner sees the dishes but no sparkles button on any of them", (await d.page.locator('[data-testid="item-row"]').count()) > 0 && (await d.page.getByTestId("ai-button").count()) === 0);
  d.check("…and no AI pop-up trigger anywhere on the page", !/Make pictures with AI/.test(await ui.text(d)));
  const refused = await fetch(`${BENCH.api}/api/menu/items/${dish.id}/generate-images`, { method: "POST", headers: { "content-type": "application/json", cookie: ownerCookie, "x-onetap-outlet": outletId }, body: JSON.stringify({ aspectRatio: "4:3", count: 1 }) });
  const keysRefused = await fetch(`${BENCH.api}/api/platform/ai`, { headers: { cookie: ownerCookie } });
  d.check("the API refuses the owner too (403 for making pictures and for the key list)", refused.status === 403 && keysRefused.status === 403, `${refused.status}/${keysRefused.status}`);
  d.check("Google was not asked again", (await (await fetch(`${GOOGLE}/__calls`)).json()).length === asked.length);

  /* ------------------------------------------------------------------ tidy up: remove the keys and the new pictures */
  await d.step("Removing the keys again", 400);
  await d.tab("platform");
  await ui.signIn(d, "super"); // the owner's sign-in replaced the platform admin's session (one browser, one cookie)
  await ui.openPlatform(d, "/ai");
  await d.page.getByTestId("ai-key").first().waitFor({ timeout: 10000 });
  for (const label of ["Backup", "Primary"]) {
    await d.click(d.page.getByTestId("ai-key").filter({ hasText: label }).getByRole("button", { name: /Remove/ }), { after: 700 });
  }
  d.check("both keys can be removed", await ui.until(async () => (await d.page.getByTestId("ai-key").count()) === 0 && /No key yet/.test(await ui.text(d)), 10000));
  await fetch(`${BENCH.api}/api/menu/items/${dish.id}`, { method: "PATCH", headers: { "content-type": "application/json", cookie: ownerCookie, "x-onetap-outlet": outletId }, body: JSON.stringify({ images: originalImages }) });
}
