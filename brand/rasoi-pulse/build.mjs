// Makes every variant of the Rasoi Pulse artwork (a chef's hat with a heartbeat) — SVG + PNG — from the vector outlines in artwork.json,
// which were traced from the two original images in source/. Also the web favicon and the app icons: Rasoi Pulse OMA (staff app) and Rasoi Pulse KDA (kitchen display app), each the same artwork + its 3-letter code.
//   node brand/rasoi-pulse/build.mjs        (uses `sharp` from apps/api's installed packages)
//
// THE FAMILY RULE: every Rasoi Pulse product uses this same artwork. What tells them apart:
//   the brand / website → the artwork alone      an app (OMA, KDA, and later ones) → the artwork a little smaller + the app's code under it
// An app is told apart at a glance by its tile colour (OMA navy, KDA deep teal). To add the next app: add its code, tile colour and any new letters to APPS / GLYPHS and run this again.
import { createRequire } from "node:module";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const sharp = createRequire(join(HERE, "../../apps/api/package.json"))("sharp");
const art = JSON.parse(readFileSync(join(HERE, "artwork.json"), "utf8"));
// tile = the colour of the app's icon tile and of the Android adaptive-icon background (written as a plain colour: K is defined below)
const APPS = {
  oma: { code: "OMA", label: "Rasoi Pulse OMA", tile: "#10111b" }, // navy
  kda: { code: "KDA", label: "Rasoi Pulse KDA", tile: "#0b2e2b" }, // deep teal: a kitchen's colour, and nothing else in the family uses it
};

/* ---------------------------------------------------------------- colours (from the two original images) */
const K = { navy: "#10111b", cream: "#fcf3e2", orange: "#ff9008", mint: "#79f9bb", maroon: "#6d0a19", red: "#be112d", wine: "#901e30", white: "#ffffff" };
const same = (c) => ({ hat: c, pulse: c, dot: c });
const PALETTE = {
  dark: { hat: K.cream, pulse: K.orange, dot: K.mint }, // the original dark image
  light: { hat: K.maroon, pulse: K.red, dot: K.wine }, // the original light image
};

/* ---------------------------------------------------------------- the artwork, placed in a 512 box */
const AS = 512 / art.size;
const [bx0, by0, bx1, by1] = art.bboxAll, bcx = (bx0 + bx1) / 2, bcy = (by0 + by1) / 2;
/** hat + heartbeat + dot in the colours `c`. `bold` = the favicon drawing: no pleat slits, no dot, a thicker heartbeat (small details vanish at 16 px). */
const layers = (c, { bold = false } = {}) =>
  `<path d="${bold ? art.hatSolid : art.hat}" fill="${c.hat}" fill-rule="evenodd"/>` +
  `<path d="${art.pulse}" fill="${c.pulse}" fill-rule="evenodd"${bold ? ` stroke="${c.pulse}" stroke-width="30" stroke-linejoin="round"` : ""}/>` +
  (bold ? "" : `<path d="${art.dot}" fill="${c.dot}" fill-rule="evenodd"/>`);
const place = (m, cx, cy, s) => `<g transform="translate(${cx} ${cy}) scale(${s * AS}) translate(${-bcx} ${-bcy})">${m}</g>`;

/* ---------------------------------------------------------------- the letters of the app code: the same thick round stroke as the heartbeat */
const stroke = (d, c, w) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const GLYPHS = {
  O: [88, (c, w) => `<ellipse cx="44" cy="50" rx="32" ry="38" fill="none" stroke="${c}" stroke-width="${w}"/>`],
  M: [100, (c, w) => stroke("M12 88V12L50 60L88 12V88", c, w)],
  A: [92, (c, w) => stroke("M14 88L46 12L78 88M29 66H63", c, w)],
  K: [92, (c, w) => stroke("M18 12V88M80 12L20 56M38 44L82 88", c, w)],
  D: [100, (c, w) => stroke("M16 12V88H42C70 88 88 72 88 50C88 28 70 12 42 12H16Z", c, w)],
};
const word = (code, c) => {
  const total = [...code].reduce((n, ch) => n + GLYPHS[ch][0], 0) + 14 * (code.length - 1);
  let x = 0;
  const parts = [...code].map((ch) => { const [w, f] = GLYPHS[ch]; const g = `<g transform="translate(${x} 0)">${f(c, 24)}</g>`; x += w + 14; return g; });
  return `<g transform="translate(256 410) scale(.92) translate(${-total / 2} -50)">${parts.join("")}</g>`;
};

/** The whole drawing on the 512 box. `label` = the app icon (artwork higher and smaller, the code under it). `scale` shrinks it all about the middle. */
const compose = (c, textColor, { label = false, bold = false, scale = 1, app = APPS.oma } = {}) => {
  const body = label ? place(layers(c), 256, 200, 0.74) + word(app.code, textColor) : place(layers(c, { bold }), 256, 256, bold ? 1.2 : 1);
  return scale === 1 ? body : `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${body}</g>`;
};
const svgDoc = (inner, defs = "") => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${defs ? `<defs>${defs}</defs>` : ""}${inner}</svg>\n`;
const inner = (svg) => svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

/* ---------------------------------------------------------------- the colour styles */
// tiles: `tile` colour + the artwork colours `c`; `cut` = ONE colour: the artwork is cut out of the tile
const TILES = {
  "multi-dark": { tile: K.navy, c: PALETTE.dark, text: K.cream }, // = the original dark image
  "multi-red": { tile: K.red, c: { hat: K.cream, pulse: K.orange, dot: K.mint }, text: K.cream },
  "duo-navy": { tile: K.navy, c: same(K.cream), text: K.cream }, // two colours
  "duo-red": { tile: K.red, c: same(K.cream), text: K.cream },
  "mono-black": { cut: K.navy }, "mono-white": { cut: K.white }, "mono-red": { cut: K.red },
};
// transparent background
const MARKS = {
  "multi-light": { c: PALETTE.light, text: K.maroon }, // = the original light image
  "multi-dark": { c: PALETTE.dark, text: K.cream }, // for dark backgrounds
  "duo-light": { c: { hat: K.navy, pulse: K.red, dot: K.navy }, text: K.navy },
  "duo-dark": { c: { hat: K.cream, pulse: K.orange, dot: K.cream }, text: K.cream },
  "mono-black": { c: same(K.navy), text: K.navy }, "mono-white": { c: same(K.white), text: K.white }, "mono-red": { c: same(K.red), text: K.red },
};
const SHAPES = ["rounded", "square", "circle"];
const RX = 120; // the original dark image's corner radius (23.4%)
const shapeEl = (shape, fill) => (shape === "circle" ? `<circle cx="256" cy="256" r="256" fill="${fill}"/>` : shape === "rounded" ? `<rect width="512" height="512" rx="${RX}" fill="${fill}"/>` : `<rect width="512" height="512" fill="${fill}"/>`);

function tileSvg(style, shape, { id = "t", ...o } = {}) {
  const t = TILES[style];
  // an app's own tile colour replaces the family navy (the brand logo and the favicon keep navy)
  const tile = o.app && t.tile === K.navy ? o.app.tile : t.tile;
  if (t.cut) { // the artwork and the code are cut out of a one-colour tile
    const black = compose(same("#000"), "#000", o);
    return svgDoc(`<g mask="url(#${id}k)">${shapeEl(shape, t.cut)}</g>`, `<mask id="${id}k" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512"><rect width="512" height="512" fill="#fff"/>${black}</mask>`);
  }
  return svgDoc(shapeEl(shape, tile) + compose(t.c, t.text, o));
}
const markSvg = (style, o = {}) => svgDoc(compose(MARKS[style].c, MARKS[style].text, o));

/* ---------------------------------------------------------------- files */
const SIZES = [1024, 512, 256, 192, 128, 64, 48, 32];
const out = (...p) => join(HERE, ...p);
const png = (svg, size) => sharp(Buffer.from(svg), { density: Math.max(72, (72 * size) / 512) }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
const files = [];
const write = (path, data) => { mkdirSync(dirname(out(path)), { recursive: true }); writeFileSync(out(path), data); files.push(path); };
for (const d of ["favicon", "logo", "oma-app-icon", "kda-app-icon", "source"]) rmSync(out(d), { recursive: true, force: true });
const IMAGES = "/private/tmp/claude-501/-Users-shanu-raj-Raj-Gazab-Momos/04b5269f-6be5-4e77-a7b8-73a9c95b0058/images";
mkdirSync(out("source"), { recursive: true });
copyFileSync(`${IMAGES}/42.png`, out("source/rasoi-pulse-original-dark.png"));
copyFileSync(`${IMAGES}/43.png`, out("source/rasoi-pulse-original-light.png"));

/* ===== 1. THE RASOI PULSE LOGO (the artwork alone): tiles and transparent marks ===== */
for (const style of Object.keys(TILES)) for (const shape of SHAPES) {
  const svg = tileSvg(style, shape);
  write(`logo/svg/tile/rasoi-pulse-tile-${style}-${shape}.svg`, svg);
  for (const s of SIZES) write(`logo/png/tile/rasoi-pulse-tile-${style}-${shape}-${s}.png`, await png(svg, s));
}
for (const style of Object.keys(MARKS)) {
  const svg = markSvg(style);
  write(`logo/svg/mark/rasoi-pulse-mark-${style}.svg`, svg);
  for (const s of [1024, 512, 256, 128, 64]) write(`logo/png/mark/rasoi-pulse-mark-${style}-${s}.png`, await png(svg, s));
}

/* ===== 2. THE WEB FAVICON (the bold drawing: no slits, no dot, thicker heartbeat) ===== */
const fav = tileSvg("multi-dark", "rounded", { id: "f", bold: true });
write("favicon/favicon.svg", fav);
const favPng = {};
const full = tileSvg("multi-dark", "rounded", { id: "g" }); // at 48 px and up the full artwork (pleat slits, dot) is clear
for (const s of [16, 32, 48, 64]) { favPng[s] = await png(s >= 48 ? full : fav, s); write(`favicon/favicon-${s}.png`, favPng[s]); }
const ico = (() => {
  const sizes = [16, 32, 48], head = Buffer.alloc(6 + 16 * sizes.length);
  head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
  let offset = head.length;
  sizes.forEach((s, i) => { const o = 6 + 16 * i; head[o] = s; head[o + 1] = s; head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6); head.writeUInt32LE(favPng[s].length, o + 8); head.writeUInt32LE(offset, o + 12); offset += favPng[s].length; });
  return Buffer.concat([head, ...sizes.map((s) => favPng[s])]);
})();
write("favicon/favicon.ico", ico);
// 180 px and up: the full drawing
write("favicon/apple-touch-icon-180.png", await png(tileSvg("multi-dark", "square", { id: "a" }), 180));
write("favicon/web-app-192.png", await png(tileSvg("multi-dark", "rounded", { id: "b" }), 192));
write("favicon/web-app-512.png", await png(tileSvg("multi-dark", "rounded", { id: "c" }), 512));
write("favicon/web-app-maskable-512.png", await png(tileSvg("multi-dark", "square", { id: "d", scale: 0.85 }), 512));
for (const style of Object.keys(TILES)) { // the favicon in the other colour styles
  const svg = tileSvg(style, "rounded", { id: "v", bold: true });
  write(`favicon/variants/favicon-${style}.svg`, svg);
  for (const s of [16, 32, 48, 180]) write(`favicon/variants/favicon-${style}-${s}.png`, await png(svg, s));
}

/* ===== 3. THE APP ICONS (the artwork + the app's code), one folder per app ===== */
const stackedOf = {}; // each app's Android layers stacked, for the picture at the end
for (const [key, APP] of Object.entries(APPS)) {
  const dir = `${key}-app-icon`, P = `rasoi-pulse-${key}`, o = { label: true, app: APP };
  for (const style of Object.keys(TILES)) for (const shape of SHAPES) {
    const svg = tileSvg(style, shape, o);
    write(`${dir}/svg/app-icon/${P}-app-icon-${style}-${shape}.svg`, svg);
    for (const s of SIZES) write(`${dir}/png/app-icon/${P}-app-icon-${style}-${shape}-${s}.png`, await png(svg, s));
  }
  for (const style of Object.keys(MARKS)) { // without a tile
    const svg = markSvg(style, o);
    write(`${dir}/svg/no-tile/${P}-no-tile-${style}.svg`, svg);
    for (const s of [1024, 512, 256, 128, 64]) write(`${dir}/png/no-tile/${P}-no-tile-${style}-${s}.png`, await png(svg, s));
  }
  // Android adaptive icon: two layers the phone stacks and crops to its own shape (the drawing stays inside the safe zone)
  const AD = 0.62;
  const bg = svgDoc(`<rect width="512" height="512" fill="${APP.tile}"/>`);
  const fg = markSvg("multi-dark", { ...o, scale: AD }), mono = markSvg("mono-black", { ...o, scale: AD });
  write(`${dir}/android-adaptive/LAYER-background-no-icon.svg`, bg);
  write(`${dir}/android-adaptive/LAYER-foreground-icon.svg`, fg);
  write(`${dir}/android-adaptive/LAYER-monochrome-for-themed-icons.svg`, mono);
  write(`${dir}/android-adaptive/LAYER-background-no-icon-1024.png`, await png(bg, 1024));
  write(`${dir}/android-adaptive/LAYER-foreground-icon-1024.png`, await png(fg, 1024));
  write(`${dir}/android-adaptive/LAYER-monochrome-for-themed-icons-1024.png`, await png(mono, 1024));
  const stacked = (shape) => svgDoc(`${shapeEl(shape, APP.tile)}${inner(fg)}`);
  write(`${dir}/android-adaptive/PREVIEW-both-layers-circle-1024.png`, await png(stacked("circle"), 1024));
  write(`${dir}/android-adaptive/PREVIEW-both-layers-rounded-1024.png`, await png(stacked("rounded"), 1024));
  stackedOf[key] = stacked;
  // the same file names and sizes as mobile-apps/<app>/assets (the favicon.png there is the brand favicon)
  write(`${dir}/expo-drop-in/icon.png`, await png(tileSvg("multi-dark", "square", { ...o, id: "e" }), 1024));
  write(`${dir}/expo-drop-in/splash-icon.png`, await png(markSvg("multi-light", { ...o, scale: 1.05 }), 1024));
  write(`${dir}/expo-drop-in/favicon.png`, favPng[48]);
  write(`${dir}/expo-drop-in/android-icon-foreground.png`, await png(fg, 512));
  write(`${dir}/expo-drop-in/android-icon-background.png`, await png(bg, 512));
  write(`${dir}/expo-drop-in/android-icon-monochrome.png`, await png(mono, 432));
}
const OMA = { label: true, app: APPS.oma }, KDA = { label: true, app: APPS.kda };

/* ===== one picture of everything ===== */
const nest = (svg, x, y, size, id) => `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 512 512">${inner(svg).replace(/id="(\w+)"/g, `id="${id}$1"`).replace(/url\(#(\w+)\)/g, `url(#${id}$1)`)}</svg>`;
const cell = 190, gap = 20, pad = 30, rowH = cell + 56, W = pad * 2 + 6 * (cell + gap) - gap, H = 100 + 5 * rowH + 60;
const txt = (t, x, y, d) => `<text x="${x}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="${d ? "#d9d3cb" : "#3a3631"}" text-anchor="middle">${t}</text>`;
const panel = (col, row, span = 1) => `<rect x="${pad + col * (cell + gap) - 10}" y="${100 + row * rowH - 14}" width="${span * (cell + gap) - gap + 20}" height="${rowH - 8}" rx="16" fill="${K.navy}"/>`;
let sheet = `<rect width="${W}" height="${H}" fill="#F5F4F0"/><text x="${pad}" y="52" font-family="Helvetica, Arial, sans-serif" font-size="28" font-weight="700" fill="${K.navy}">Rasoi Pulse — logo · web favicon · OMA and KDA app icons</text>${panel(4, 0, 2)}${panel(5, 1)}${panel(4, 3, 2)}${panel(5, 4)}`;
let n = 0;
const put = (svg, col, row, name, d = false) => { sheet += nest(svg, pad + col * (cell + gap), 100 + row * rowH, cell, `p${n++}`) + txt(name, pad + col * (cell + gap) + cell / 2, 100 + row * rowH + cell + 22, d); };
put(tileSvg("multi-dark", "rounded"), 0, 0, "logo · original dark");
put(markSvg("multi-light"), 1, 0, "logo · original light");
put(markSvg("duo-light"), 2, 0, "logo · duo-light");
put(markSvg("mono-black"), 3, 0, "logo · mono-black");
put(markSvg("multi-dark"), 4, 0, "logo · multi-dark", true);
put(markSvg("mono-white"), 5, 0, "logo · mono-white", true);
["multi-dark", "multi-red", "duo-navy", "duo-red", "mono-black"].forEach((k, i) => put(tileSvg(k, "rounded", OMA), i, 1, `OMA app icon · ${k}`));
put(tileSvg("mono-white", "rounded", OMA), 5, 1, "OMA · mono-white", true);
SHAPES.forEach((s, i) => put(tileSvg("multi-dark", s, OMA), i, 2, `OMA · ${s}`));
put(stackedOf.oma("circle"), 3, 2, "OMA Android: both layers");
put(fav, 4, 2, "web favicon (bold)");
put(tileSvg("multi-red", "rounded", { bold: true }), 5, 2, "favicon · multi-red");
["multi-light", "duo-light", "mono-black", "mono-red"].forEach((k, i) => put(markSvg(k, OMA), i, 3, `OMA no tile · ${k}`));
["multi-dark", "duo-dark"].forEach((k, i) => put(markSvg(k, OMA), 4 + i, 3, `OMA no tile · ${k}`, true));
// KDA, the kitchen display app: its own tile colour, the same artwork
put(tileSvg("multi-dark", "rounded", KDA), 0, 4, "KDA app icon · multi-dark");
put(tileSvg("multi-dark", "square", KDA), 1, 4, "KDA · square");
put(tileSvg("multi-dark", "circle", KDA), 2, 4, "KDA · circle");
put(stackedOf.kda("circle"), 3, 4, "KDA Android: both layers");
put(tileSvg("duo-navy", "rounded", KDA), 4, 4, "KDA · duo");
put(tileSvg("mono-white", "rounded", KDA), 5, 4, "KDA · mono-white", true);
sheet += [48, 32, 24, 16].map((s, i) => nest(fav, pad + i * 70, 100 + 5 * rowH - 10, s, `z${i}`)).join("") + txt("favicon at 48 · 32 · 24 · 16 px", pad + 330, 100 + 5 * rowH + 24, false);
const preview = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${sheet}</svg>`;
writeFileSync(out("preview.svg"), preview);
writeFileSync(out("preview.png"), await sharp(Buffer.from(preview), { density: 96 }).png().toBuffer());
console.log(`wrote ${files.length} files + preview`);
