// The screenshots on an app's website page, managed in the console: copied in once from the pictures that ship with the website, then owned by the console —
// add a screenshot, put a picture in each of its slots (3 devices × light / dark), edit the words, hide, reorder, remove; the section's heading / intro / first device
// and an on/off switch; what the public page data carries (and what it does not). A private API on an in-memory database, files in a temporary folder; no browser.
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { startApi } from "./_api-harness.mjs";

const t = await startApi(3119, { UPLOADS_DIR: ".uploads-t146", WEBSITE_URL: "https://site.example.test" });
const uploads = path.join(process.cwd(), ".uploads-t146");
fs.rmSync(uploads, { recursive: true, force: true });
const filesIn = () => (fs.existsSync(uploads) ? fs.readdirSync(uploads, { recursive: true }).filter((f) => /\.(webp|png|jpe?g|avif)$/.test(String(f))) : []);
const { call, ok, say } = t;
const sharp = createRequire(`${t.API}/package.json`)("sharp");
const schema = await import(`${t.REPO}/packages/config-schema/src/index.js`);
/** a real picture of the given size (the colour tells pictures apart) */
const picture = (w, h, rgb = [64, 77, 182]) => sharp({ create: { width: w, height: h, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } }).png().toBuffer();

// what ships with the website: two screens of OMA, one picture each (stand-ins for the real list the capture tool writes)
const real = (await import(`${t.API}/src/modules/app-releases/app-shots-builtin.js`)).BUILTIN_APP_SHOTS;
const builtinBefore = { ...real };
real.oma = [
  { name: "tables", title: "Every table at a glance", caption: "See which tables are free.", alt: "The tables grouped by area.", images: { "tablet-landscape": { light: { src: "/app-screens/oma-tables.tablet-landscape.light.webp", width: 1600, height: 1000 }, dark: { src: "/app-screens/oma-tables.tablet-landscape.dark.webp", width: 1600, height: 1000 } }, phone: { light: { src: "/app-screens/oma-tables.phone.light.webp", width: 738, height: 1600 } } } },
  { name: "orders", title: "Every order in one list", caption: "Follow each order.", alt: "The orders list.", images: { "tablet-landscape": { light: { src: "/app-screens/oma-orders.tablet-landscape.light.webp", width: 1600, height: 1000 } } } },
];

await t.run(async () => {
  const s = await t.makeStore();
  const brandHdr = { "x-rasoipulse-brand": s.brand };
  await call("POST", "/api/users", { cookie: s.owner, headers: brandHdr, body: { email: "w@acme.test", name: "Waiter", password: "Staff123!", role: "staff" } });
  const waiter = await t.cookieLogin("w@acme.test", "Staff123!");
  const A = "/api/platform/app-releases";
  const admin = (method, p, body) => call(method, A + p, { cookie: s.su, body });
  const upload = async (id, device, theme, buf, { cookie = s.su, type = "image/png" } = {}) => {
    const r = await fetch(`${t.base}${A}/screenshots/item/${id}/image?device=${device}&theme=${theme}`, { method: "PUT", headers: { cookie, "content-type": type, "x-forwarded-for": "198.51.100.88" }, body: buf });
    return { status: r.status, json: await r.json().catch(() => ({})) };
  };
  const pub = async (app) => (await call("GET", `/api/app-updates/releases?app=${app}`)).json.screens;
  const list = async (app) => (await admin("GET", `/screenshots/${app}`)).json;

  say("1. The pictures that ship with the website are copied in once");
  const first = await list("oma");
  ok(first.shots.length === 2 && first.shots.map((x) => x.title).join("|") === "Every table at a glance|Every order in one list", "OMA starts with the two screens that ship with the website, in order", first.shots.map((x) => x.title).join("|"));
  ok(first.shots.every((x) => x.builtIn && x.enabled), "…marked as coming with the website, and shown");
  ok(first.shots[0].images["tablet-landscape"].light.src === "https://site.example.test/app-screens/oma-tables.tablet-landscape.light.webp", "the console gets the picture's full address (it is on another site)", first.shots[0].images["tablet-landscape"].light.src);
  ok(first.shots[0].images["tablet-landscape"].light.uploaded === false, "…and knows these are not uploaded files");
  ok((await list("oma")).shots.length === 2 && (await t.raw("appshots").countDocuments({ app: "oma" })) === 2, "reading it again does not copy them again");
  const p0 = await pub("oma");
  ok(p0?.shots.length === 2 && p0.shots[0].images["tablet-landscape"].light.src === "/app-screens/oma-tables.tablet-landscape.light.webp", "the public page data has them, with the picture's path on the website", p0?.shots[0].images["tablet-landscape"].light.src);
  ok(JSON.stringify(p0.devices) === JSON.stringify(["tablet-landscape", "phone"]), "…and lists only the devices that have a picture", JSON.stringify(p0.devices));
  ok(p0.heading === "OMA on every screen" && /light and dark/.test(p0.intro) && p0.defaultDevice === "tablet-landscape", "…with the usual heading and intro, and the wide tablet first", `${p0.heading} / ${p0.defaultDevice}`);
  ok(!JSON.stringify(p0).includes("createdBy") && !JSON.stringify(p0).includes('"key"') && !/builtInName|updatedBy/.test(JSON.stringify(p0)), "…and no internal field or storage key");
  ok((await pub("admin")) === null && (await pub("business")) === null, "an app with no screenshots has no section (null)");
  ok((await call("GET", "/api/app-updates/releases?app=oma")).json.app.slug === "oma", "(the app's own words are still in the same answer)");

  say("2. Only the platform admin manages them");
  const shotId = first.shots[0].id;
  for (const [who, cookie] of [["a store owner", s.owner], ["a waiter", waiter], ["nobody signed in", undefined]]) {
    ok([401, 403].includes((await call("GET", `${A}/screenshots/oma`, { cookie })).status), `${who} cannot read the list`);
    ok([401, 403].includes((await call("POST", `${A}/screenshots/oma`, { cookie, body: { title: "Sneaky" } })).status), `${who} cannot add one`);
  }
  ok([401, 403].includes((await upload(shotId, "phone", "dark", await picture(300, 600), { cookie: s.owner })).status), "a store owner cannot upload a picture");
  ok([401, 403].includes((await call("DELETE", `${A}/screenshots/item/${shotId}`, { cookie: waiter })).status), "a waiter cannot remove one");
  ok((await list("oma")).shots.length === 2, "…and nothing changed");

  say("3. The section: switch, words, first device");
  const sec = await admin("PUT", "/screenshots/oma/section", { heading: "OMA at the table", intro: "Waiters love it.", defaultDevice: "phone" });
  ok(sec.status === 200 && sec.json.section.heading === "OMA at the table" && sec.json.section.defaultDevice === "phone", "heading, intro and first device are saved");
  const p1 = await pub("oma");
  ok(p1.heading === "OMA at the table" && p1.intro === "Waiters love it." && p1.defaultDevice === "phone", "…and the website's data follows at once");
  ok((await admin("PUT", "/screenshots/oma/section", { heading: "" })).json.section.heading === "" && (await pub("oma")).heading === "OMA on every screen", "an empty heading means the usual one");
  ok((await admin("PUT", "/screenshots/oma/section", { heading: "x".repeat(81) })).status === 400, "a heading over 80 characters: 400");
  ok((await admin("PUT", "/screenshots/oma/section", { defaultDevice: "watch" })).status === 400, "an unknown device: 400");
  ok((await admin("PUT", "/screenshots/oma/section", {})).status === 400, "nothing to change: 400");
  ok((await admin("PUT", "/screenshots/nope/section", { enabled: false })).status === 404, "an app that doesn't exist: 404");
  await admin("PUT", "/screenshots/oma/section", { defaultDevice: "tablet-portrait" });
  ok((await pub("oma")).defaultDevice === "tablet-landscape", "a first device with no picture falls back to one that has");
  await admin("PUT", "/screenshots/oma/section", { enabled: false });
  ok((await pub("oma")) === null && (await list("oma")).shots.length === 2, "switched off: no section on the website, the screenshots are kept");
  await admin("PUT", "/screenshots/oma/section", { enabled: true, defaultDevice: "tablet-landscape" });
  ok((await pub("oma"))?.shots.length === 2, "switched on again: they are back");

  say("4. Add a screenshot and put pictures in its slots");
  ok((await admin("POST", "/screenshots/oma", {})).status === 400 && (await admin("POST", "/screenshots/oma", { title: "x" })).status === 400, "a screenshot needs a title (2 characters at least): 400");
  ok((await admin("POST", "/screenshots/oma", { title: "T".repeat(61) })).status === 400, "a title over 60 characters: 400");
  const mk = await admin("POST", "/screenshots/oma", { title: "Menu with photos", caption: "Pick dishes.", alt: "The menu." });
  const mine = mk.json.shot;
  ok(mk.status === 201 && mine?.title === "Menu with photos" && mine.builtIn === false && mine.enabled === true && Object.keys(mine.images).length === 0, "added: shown, not built in, no pictures yet");
  ok((await pub("oma")).shots.length === 2, "a screenshot with no picture is not shown on the website");
  const up = await upload(mine.id, "tablet-landscape", "light", await picture(2560, 1600));
  ok(up.status === 200 && up.json.shot.images["tablet-landscape"].light.uploaded === true, "a picture goes into a slot", `${up.status}`);
  const im = up.json.shot.images["tablet-landscape"].light;
  ok(im.width > 0 && im.height > 0 && Math.abs(im.width / im.height - 1.6) < 0.02, "…its real size is kept in shape (16:10), after the usual resizing", `${im.width}×${im.height}`);
  ok(filesIn().length === 1, "…and the file is in the platform's storage", `${filesIn().length} file`);
  const p2 = await pub("oma");
  ok(p2.shots.length === 3 && p2.shots[2].title === "Menu with photos" && /^https?:\/\/.+\/uploads\//.test(p2.shots[2].images["tablet-landscape"].light.src), "the website now shows it, last, with the file's address", p2.shots[2].images["tablet-landscape"].light.src);
  ok((await upload(mine.id, "tablet-landscape", "dark", await picture(2560, 1600, [20, 20, 40]))).status === 200 && (await upload(mine.id, "phone", "light", await picture(1440, 3120))).status === 200 && (await upload(mine.id, "tablet-portrait", "dark", await picture(1600, 2560))).status === 200, "pictures go into other slots too (dark, a phone, a tall tablet)");
  ok(filesIn().length === 4, "…four files now", `${filesIn().length}`);
  const p3 = await pub("oma");
  ok(JSON.stringify(p3.devices) === JSON.stringify(["tablet-landscape", "tablet-portrait", "phone"]), "all three devices are offered now", JSON.stringify(p3.devices));
  ok(Object.keys(p3.shots[2].images["tablet-landscape"]).sort().join() === "dark,light", "…and a slot has its light and dark pictures");
  const replaced = await upload(mine.id, "tablet-landscape", "light", await picture(2560, 1600, [200, 50, 50]));
  ok(replaced.status === 200 && replaced.json.shot.images["tablet-landscape"].light.src !== im.src, "putting another picture in the same slot replaces it");
  ok(filesIn().length === 4, "…and the old file is removed from storage (still four files)", `${filesIn().length}`);
  const odd = await upload(mine.id, "tablet-landscape", "light", Buffer.from("this is not a picture"));
  ok(odd.status === 415 && /isn't an image/.test(odd.json.error ?? ""), "something that is not a picture is refused with a reason (415)", odd.json.error);
  ok(filesIn().length === 4, "…and nothing was stored");
  ok((await upload(mine.id, "watch", "light", await picture(100, 100))).status === 400 && (await upload(mine.id, "phone", "sepia", await picture(100, 100))).status === 400, "an unknown device or look: 400");
  ok((await upload("000000000000000000000000", "phone", "light", await picture(100, 100))).status === 404 && (await upload("nope", "phone", "light", await picture(100, 100))).status === 404, "a screenshot that doesn't exist: 404");
  const empty = await fetch(`${t.base}${A}/screenshots/item/${mine.id}/image?device=phone&theme=dark`, { method: "PUT", headers: { cookie: s.su, "content-type": "image/png", "x-forwarded-for": "198.51.100.89" } });
  ok(empty.status === 400, "an upload with nothing in it: 400");

  say("5. Edit the words, hide, reorder");
  const ed = await admin("PATCH", `/screenshots/item/${mine.id}`, { title: "Menu with big photos", caption: "Pick dishes, sizes and add-ons.", alt: "The menu with dish photos." });
  ok(ed.status === 200 && ed.json.shot.title === "Menu with big photos", "the words can be changed");
  ok((await pub("oma")).shots[2].title === "Menu with big photos" && (await pub("oma")).shots[2].caption === "Pick dishes, sizes and add-ons.", "…and the website's data follows");
  ok((await admin("PATCH", `/screenshots/item/${mine.id}`, { title: "" })).status === 400 && (await admin("PATCH", `/screenshots/item/${mine.id}`, {})).status === 400, "an empty title, or nothing to change: 400");
  await admin("PATCH", `/screenshots/item/${mine.id}`, { enabled: false });
  ok((await pub("oma")).shots.length === 2 && (await list("oma")).shots.find((x) => x.id === mine.id).enabled === false, "hidden: not on the website, still in the console");
  await admin("PATCH", `/screenshots/item/${mine.id}`, { enabled: true });
  const [a, b] = first.shots.map((x) => x.id);
  const ro = await admin("PUT", "/screenshots/oma/order", { ids: [mine.id, b, a] });
  ok(ro.status === 200 && ro.json.shots.map((x) => x.id).join() === [mine.id, b, a].join(), "the order can be changed");
  ok((await pub("oma")).shots.map((x) => x.id).join() === [mine.id, b, a].join(), "…and the website follows it");
  ok((await admin("PUT", "/screenshots/oma/order", { ids: [a] })).json.shots.map((x) => x.id).join() === [a, mine.id, b].join(), "a screenshot left out of the list keeps its place after the ones named");
  ok((await admin("PUT", "/screenshots/oma/order", { ids: "a,b" })).status === 400, "something that is not a list of ids: 400");
  ok((await admin("PUT", "/screenshots/oma/order", { ids: [a, a, "zzz", b, mine.id] })).json.shots.map((x) => x.id).join() === [a, b, mine.id].join(), "repeated and unknown ids are ignored");

  say("6. Remove a picture, remove a screenshot");
  const rm = await call("DELETE", `${A}/screenshots/item/${mine.id}/image?device=tablet-portrait&theme=dark`, { cookie: s.su });
  ok(rm.status === 200 && !rm.json.shot.images["tablet-portrait"], "a picture can be removed from its slot");
  ok(filesIn().length === 3, "…its file is gone from storage", `${filesIn().length}`);
  ok((await call("DELETE", `${A}/screenshots/item/${mine.id}/image?device=tablet-portrait&theme=dark`, { cookie: s.su })).status === 404, "removing an empty slot: 404");
  ok(!(await pub("oma")).devices.includes("tablet-portrait"), "a device with no picture left is no longer offered");
  const del = await admin("DELETE", `/screenshots/item/${mine.id}`);
  ok(del.status === 200 && (await list("oma")).shots.length === 2 && filesIn().length === 0, "removing a screenshot removes it and every file it had", `${filesIn().length} files left`);
  ok((await admin("DELETE", `/screenshots/item/${mine.id}`)).status === 404, "removing it again: 404");
  const bi = await admin("DELETE", `/screenshots/item/${b}`);
  ok(bi.status === 200 && (await list("oma")).shots.length === 1, "a screenshot that came with the website can be removed too");
  ok((await list("oma")).shots.length === 1 && (await pub("oma")).shots.length === 1, "…and it is not copied in again when the list is read again");

  say("7. Limits");
  for (let i = 0; i < 11; i++) await admin("POST", "/screenshots/oma", { title: `Screen ${i + 1}` });
  const over = await admin("POST", "/screenshots/oma", { title: "One too many" });
  ok(over.status === 409 && /12 screenshots at most/.test(over.json.error ?? ""), "an app can have 12 screenshots: the 13th is refused with a reason", over.json.error);

  say("8. An app added in the console, and removing it");
  const made = await admin("POST", "/apps", { name: "Rasoi Pulse Counter", slug: "counter", code: "CNT" });
  ok(made.status === 201 && (await list("counter")).shots.length === 0 && (await pub("counter")) === null, "a new app starts with no screenshots and no section");
  const cs = (await admin("POST", "/screenshots/counter", { title: "Billing" })).json.shot;
  ok((await upload(cs.id, "phone", "light", await picture(1440, 3120))).status === 200 && (await pub("counter")).shots.length === 1 && (await pub("counter")).heading === "CNT on every screen", "…it can have its own, with the heading made from its code");
  ok(filesIn().length === 1, "(one file stored for it)");
  ok((await admin("DELETE", "/apps/counter")).status === 200, "the app is removed");
  ok((await t.raw("appshots").countDocuments({ app: "counter" })) === 0 && filesIn().length === 0, "…and its screenshots and files go with it", `${filesIn().length} files left`);

  say("9. Nothing reaches the website but what should");
  const everything = JSON.stringify(await call("GET", "/api/app-updates/apps").then((r) => r.json));
  ok(!/screens|shots|appshot/i.test(everything), "the list of apps carries no screenshot data (it is only on an app's own page data)");
});

Object.assign(real, builtinBefore);
if (!builtinBefore.oma) delete real.oma;
