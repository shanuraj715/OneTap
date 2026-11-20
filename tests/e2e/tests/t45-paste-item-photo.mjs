// T45 — Pasting a copied picture as a dish photo, in Chrome: Ctrl/⌘+V in the dish editor, and the "Paste photo" button.
import { BENCH } from "../bench/watch.mjs";
import * as ui from "../bench/ui.mjs";

export const meta = {
  id: "t45-paste-item-photo",
  title: "Dish photos — a picture copied to the clipboard can be pasted (Ctrl/⌘+V or the 'Paste photo' button) instead of choosing a file",
  area: "menu",
  fresh: false,
  summary: "In Chrome as the owner of Acme Momos, on Menu → a dish → Edit (✎): the Photos box offers 'Add photo' AND 'Paste photo' and says 'Press Ctrl+V (⌘V on a Mac) here, or use Paste'. A real picture (drawn on a canvas and put on the browser's clipboard) is pasted with the keyboard shortcut — it uploads like a chosen file and appears as a new photo; a second picture with the 'Paste photo' button; a big 2400×1600 picture is pasted and saved as a smaller WebP; pasting with the cursor in the Name box adds the picture and leaves the name alone, while pasting TEXT into the Name box still pastes the text and adds no photo; pressing 'Paste photo' with only text on the clipboard says there is no picture; once the dish has six photos the 'Add'/'Paste' tiles go and a paste says the dish already has six. Saving keeps the pasted photos (server-made WebP files that open). The dish's own photos are put back at the end.",
  expect: [
    "The Photos box has both 'Add photo' and 'Paste photo', and a line telling people they can press Ctrl+V / ⌘V.",
    "Ctrl/⌘+V with a picture on the clipboard adds it as a new photo (uploaded and compressed like any other); so does the 'Paste photo' button.",
    "A pasted picture works while the cursor is in a text box if the clipboard holds only a picture; pasting text into a text box still pastes the text and adds no photo.",
    "With no picture on the clipboard the button explains; at six photos a paste says the dish is full.",
    "After saving, the dish has the pasted photos as WebP files that open.",
  ],
  expectNot: [
    "Pasting text must NOT add a photo or be swallowed.",
    "A paste must NOT add more than six photos to a dish.",
    "The browser must NOT log JavaScript errors.",
  ],
};

export async function run(d) {
  const login = async (email, pw) => (await fetch(`${BENCH.api}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: pw }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const ownerCookie = await login(...BENCH.logins.owner);
  const outlets = await (await fetch(`${BENCH.api}/api/outlets`, { headers: { cookie: ownerCookie } })).json();
  const main = (outlets.outlets ?? outlets).find((o) => o.slug === "main");
  const outletId = String(main._id ?? main.id);
  const menuNow = async () => (await (await fetch(`${BENCH.api}/api/menu?outletId=${outletId}`)).json());
  const dish = (await menuNow()).items.find((i) => i.name === "Veg Steamed Momos");
  const originalImages = dish.images;
  const hdr = { "content-type": "application/json", cookie: ownerCookie, "x-onetap-outlet": outletId };
  // the dish's own photos are put back at the end; the checks below count relative to however many it starts with
  if (originalImages.length > 2) await fetch(`${BENCH.api}/api/menu/items/${dish.id}`, { method: "PATCH", headers: hdr, body: JSON.stringify({ images: originalImages.slice(0, 2) }) });

  await d.page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const PASTE = process.platform === "darwin" ? "Meta+V" : "Control+V";

  /** put a picture on the browser's clipboard (drawn on a canvas, so it is a real PNG) */
  const copyPicture = (color, w = 600, h = 400, noisy = false) =>
    d.page.evaluate(async ([color, w, h, noisy]) => {
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const g = c.getContext("2d");
      const grad = g.createLinearGradient(0, 0, w, h); grad.addColorStop(0, color); grad.addColorStop(1, "#ffffff");
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      g.fillStyle = "#222"; g.font = `bold ${Math.round(h / 6)}px sans-serif`; g.fillText("pasted", w / 8, h / 2);
      if (noisy) for (let i = 0; i < 40000; i++) { g.fillStyle = `rgb(${(Math.random() * 255) | 0},${(Math.random() * 255) | 0},${(Math.random() * 255) | 0})`; g.fillRect((Math.random() * w) | 0, (Math.random() * h) | 0, 3, 3); }
      const blob = await new Promise((r) => c.toBlob(r, "image/png"));
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      return blob.size;
    }, [color, w, h, noisy]);
  const copyText = (t) => d.page.evaluate((t) => navigator.clipboard.writeText(t), t);
  const photos = () => d.page.getByTestId("item-photo");
  const photoCount = async () => photos().count();
  const waitPhotos = (n, ms = 20000) => ui.until(async () => (await photoCount()) === n, ms);

  /* ------------------------------------------------------------------ open the editor */
  await d.step("Opening the dish editor", 400);
  await ui.signIn(d, "owner");
  await d.goto(BENCH.admin + "/menu", 800);
  await d.click(d.page.locator('[data-testid="cat-row"][data-category="Steamed Momos"] button', { hasText: "Steamed Momos" }).first(), { after: 600 });
  const row = d.page.locator('[data-testid="item-row"][data-item="Veg Steamed Momos"]');
  await row.waitFor({ timeout: 10000 });
  await d.click(row.getByTitle("Edit"), { after: 700 });
  await d.page.getByText(/^Photos/).first().waitFor({ timeout: 8000 });
  const n0 = await photoCount();
  d.check("the dish has room for the pastes below (at most 2 photos to start with)", n0 <= 2, `${n0} photos`);
  d.check("the Photos box offers 'Add photo' and 'Paste photo'", (await d.page.getByTestId("add-photo").isVisible()) && (await d.page.getByTestId("paste-photo").isVisible()));
  d.check("a line says Ctrl+V / ⌘V works", /Press Ctrl\+V \(⌘V on a Mac\) here, or use Paste/.test(await ui.text(d)));
  await d.shot("paste-photo-box");

  /* ------------------------------------------------------------------ the keyboard shortcut */
  await d.step("A copied picture is pasted with Ctrl/⌘+V", 400);
  await copyPicture("#c8372d");
  await d.page.getByText(/^Photos/).first().click(); // somewhere neutral on the page
  await d.page.keyboard.press(PASTE);
  d.check("it is added as a new photo", await waitPhotos(n0 + 1), `${await photoCount()} photos`);
  d.check("the new photo really loads", await ui.until(async () => photos().last().locator("img").evaluate((i) => i.complete && i.naturalWidth > 100), 8000));
  d.check("it is a stored picture (not a data: link)", !/^data:|^blob:/.test((await photos().last().locator("img").getAttribute("src")) ?? "x"), ((await photos().last().locator("img").getAttribute("src")) ?? "").slice(0, 80));
  await d.shot("paste-photo-keyboard");

  /* ------------------------------------------------------------------ the button */
  await d.step("The 'Paste photo' button", 400);
  await copyPicture("#2d7ac8");
  await d.click(d.page.getByTestId("paste-photo"), { after: 400 });
  d.check("it adds the copied picture as another photo", await waitPhotos(n0 + 2), `${await photoCount()} photos`);

  /* ------------------------------------------------------------------ text boxes */
  await d.step("Pasting while the cursor is in a text box", 400);
  const name = d.page.getByRole("textbox").first();
  const nameBefore = await name.inputValue();
  await copyPicture("#2dc87a");
  await name.focus();
  await d.page.keyboard.press(PASTE);
  d.check("a copied picture is still taken as a photo (the clipboard holds no text)", await waitPhotos(n0 + 3), `${await photoCount()} photos`);
  d.check("…and the name box is untouched", (await name.inputValue()) === nameBefore, await name.inputValue());
  await copyText("Zzz-pasted-words");
  await name.focus();
  await d.page.keyboard.press("End");
  await d.page.keyboard.press(PASTE);
  await d.page.waitForTimeout(300);
  d.check("pasted TEXT still goes into the box", (await name.inputValue()) === nameBefore + "Zzz-pasted-words", await name.inputValue());
  d.never("pasting text adds a photo", (await photoCount()) !== n0 + 3, `${await photoCount()} photos`);
  await name.fill(nameBefore); // put the name back before saving

  /* ------------------------------------------------------------------ nothing to paste */
  await d.step("Nothing but text on the clipboard", 400);
  await d.click(d.page.getByTestId("paste-photo"), { after: 600 });
  d.check("the button says there is no picture on the clipboard", /no picture on your clipboard/i.test(await ui.text(d)));
  d.check("no photo was added", (await photoCount()) === n0 + 3);

  /* ------------------------------------------------------------------ the limit */
  await d.step("Up to the sixth photo, then the limit", 400);
  // small pictures fill the dish up to five photos, then a big one is the sixth
  for (let have = n0 + 3; have < 5; have++) {
    await copyPicture(["#8a2dc8", "#2dc8c0", "#c82d8a"][have % 3]);
    await d.page.getByText(/^Photos/).first().click();
    await d.page.keyboard.press(PASTE);
    await waitPhotos(have + 1);
  }
  d.check("the dish is up to five photos", (await photoCount()) === 5, `${await photoCount()}`);
  await copyPicture("#c89a2d", 2400, 1600, true);
  await d.page.getByText(/^Photos/).first().click();
  await d.page.keyboard.press(PASTE);
  d.check("a big 2400×1600 picture is accepted as the sixth photo", await waitPhotos(6, 40000), `${await photoCount()} photos`);
  d.check("at six photos the Add and Paste tiles are gone", (await d.page.getByTestId("add-photo").count()) === 0 && (await d.page.getByTestId("paste-photo").count()) === 0);
  await copyPicture("#7a2dc8");
  await d.page.getByText(/^Photos/).first().click();
  await d.page.keyboard.press(PASTE);
  d.check("pasting a seventh says the dish already has six", await ui.until(async () => /already has 6 square photos/.test(await ui.text(d)), 6000));
  d.never("a seventh photo was added", (await photoCount()) > 6, `${await photoCount()}`);
  await d.shot("paste-photo-six");

  /* ------------------------------------------------------------------ saved */
  await d.step("Saving the dish", 400);
  await d.click(d.page.getByRole("button", { name: "Save changes" }), { after: 1200 });
  const saved = (await menuNow()).items.find((i) => i.id === dish.id);
  d.check("the dish now has six photos", saved.images.length === 6, `${saved.images.length}`);
  const fetched = await Promise.all(saved.images.slice(n0).map(async (im) => { const r = await fetch(im.url); return { ok: r.ok, type: r.headers.get("content-type"), w: im.width, key: im.key }; }));
  d.check("the pasted photos are WebP files that open", fetched.every((f) => f.ok && f.type === "image/webp"), JSON.stringify(fetched.map((f) => f.type)));
  d.check("the 2400px picture was made smaller (at most 1600px wide)", fetched.every((f) => !f.w || f.w <= 1600), fetched.map((f) => f.w).join(","));

  /* ------------------------------------------------------------------ tidy up */
  await fetch(`${BENCH.api}/api/menu/items/${dish.id}`, { method: "PATCH", headers: hdr, body: JSON.stringify({ images: originalImages }) });
  for (const f of fetched) if (f.key) await fetch(`${BENCH.api}/api/storage/object`, { method: "DELETE", headers: hdr, body: JSON.stringify({ key: f.key }) }).catch(() => {});
}
