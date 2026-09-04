import { charsFor, PAPER,                                  } from "@onetap/config-schema";
import { renderBlocks,                  } from "./render.js";

/**
 * ESC/POS command bytes. Every thermal receipt printer worth buying speaks this,
 * EPSON's TM series being the reference implementation.
 */
const ESC = 0x1b;
const GS = 0x1d;

const INIT = Buffer.from([ESC, 0x40]);
const ALIGN = (a                      ) =>
  Buffer.from([ESC, 0x61, a === "center" ? 1 : a === "right" ? 2 : 0]);
const BOLD = (on         ) => Buffer.from([ESC, 0x45, on ? 1 : 0]);
const FEED = (lines        ) => Buffer.from([ESC, 0x64, Math.max(0, Math.min(255, lines))]);
/** Partial cut, feeding the paper clear of the printhead first. */
const CUT = Buffer.from([GS, 0x56, 0x42, 0x00]);
/** Kick the cash drawer on pin 2 — the near-universal wiring. */
const DRAWER = Buffer.from([ESC, 0x70, 0x00, 0x19, 0xfa]);
/** Code page 0 (PC437). Deliberate: we never emit ₹, which has no glyph here. */
const CODEPAGE = Buffer.from([ESC, 0x74, 0x00]);

/**
 * `GS ! n` — character magnification. The low nibble is height, the high nibble
 * width, both 0-7 meaning 1x-8x. Doubling the width halves the columns, which is
 * why the layout below re-wraps large blocks.
 */
const MAGNIFY                            = {
  sm: 0x00, // 1x1
  md: 0x00, // 1x1
  lg: 0x11, // 2x2
  xl: 0x22, // 3x3
};
const SIZE = (s           ) => Buffer.from([GS, 0x21, MAGNIFY[s]]);

/** How many columns a magnified block actually gets. */
const widthFactor = (s           )         => (MAGNIFY[s] >> 4) + 1;

/**
 * `GS v 0` raster bit image. The data is packed rows, MSB first, 1 = burn a dot.
 * The admin produces this on a canvas; converting a JPEG here would mean pulling
 * in a native image library for something the browser does for free.
 */
function raster(width        , height        , data        )         {
  const bytesPerRow = Math.ceil(width / 8);
  const expected = bytesPerRow * height;
  if (data.length < expected) {
    // A truncated bitmap would print as garbage for the rest of the slip.
    return Buffer.alloc(0);
  }
  const header = Buffer.from([
    GS,
    0x76,
    0x30,
    0x00, // normal density
    bytesPerRow & 0xff,
    (bytesPerRow >> 8) & 0xff,
    height & 0xff,
    (height >> 8) & 0xff,
  ]);
  return Buffer.concat([header, data.subarray(0, expected)]);
}

/**
 * `GS ( k` — the printer's own QR encoder. Four commands: pick the model, set
 * the module size, set the error correction, store the payload, then print it.
 *
 * Letting the printhead draw the QR beats sending it as a raster: it comes out
 * at the printer's true resolution, so it still scans after the thermal paper
 * has been in a warm kitchen all day.
 */
function qrCode(text        , moduleSize = 6)         {
  const data = Buffer.from(text, "utf8");
  if (!data.length || data.length > 2000) return Buffer.alloc(0);

  const len = data.length + 3;
  return Buffer.concat([
    Buffer.from([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]), // model 2
    Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, moduleSize]), // module size
    Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]), // error correction M
    Buffer.from([GS, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, 0x50, 0x30]),
    data,
    Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]), // print it
  ]);
}

/** PC437 has no ₹, no smart quotes and no Devanagari. Degrade, never garble. */
function toCp437(s        )         {
  const cleaned = s
    .replace(/₹/g, "Rs.")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    // Anything still outside ASCII has no glyph on the printhead.
    .replace(/[^\x20-\x7E\n]/g, "?");
  return Buffer.from(cleaned, "ascii");
}

const pad = (s        , n        ) => (s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length));

function align(s        , a                      , n        )         {
  if (s.length >= n) return s.slice(0, n);
  if (a === "center") return " ".repeat(Math.floor((n - s.length) / 2)) + s;
  if (a === "right") return " ".repeat(n - s.length) + s;
  return s;
}

/** Re-wrap a line that a magnified font no longer fits. */
function refit(line        , cols        )           {
  if (line.length <= cols) return [line];
  const out           = [];
  let rest = line.trimEnd();
  while (rest.length > cols) {
    let cut = rest.lastIndexOf(" ", cols);
    if (cut <= 0) cut = cols;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) out.push(rest);
  return out;
}

;                               
                     
                       
 

/**
 * Turn a rendered document into the bytes a thermal printer expects.
 *
 * Only the LOGO and the magnified text differ from the plain-text render — the
 * content itself comes from the same `renderBlocks` call, so what the admin
 * previews is what the kitchen tears off.
 */
export function toEscPos(input             , opts                = {})         {
  const { template } = input;
  const baseCols = charsFor(template);
  const parts           = [INIT, CODEPAGE];

  for (const { block, lines } of renderBlocks(input, false)) {
    if (block.key === "logo") {
      const r = template.logoRaster;
      if (r?.data) {
        const dots = PAPER[template.paperWidth].dots;
        // Never send a bitmap wider than the printhead — the printer would
        // wrap it into an unreadable second band.
        if (r.width <= dots) {
          parts.push(ALIGN(block.align), raster(r.width, r.height, Buffer.from(r.data, "base64")));
        }
      }
      if (block.rule) parts.push(ALIGN("left"), toCp437("-".repeat(baseCols) + "\n"));
      continue;
    }

    if (block.key === "qr") {
      const payload = block.text.trim();
      if (payload) parts.push(ALIGN(block.align), qrCode(payload), toCp437("\n"));
      if (block.rule) parts.push(ALIGN("left"), toCp437("-".repeat(baseCols) + "\n"));
      continue;
    }

    const cols = Math.floor(baseCols / widthFactor(block.size));

    parts.push(ALIGN("left"), SIZE(block.size), BOLD(block.bold));
    for (const line of lines) {
      for (const fitted of refit(line, cols)) {
        parts.push(toCp437(align(fitted, block.align, cols).trimEnd() + "\n"));
      }
    }
    parts.push(BOLD(false), SIZE("md"));

    if (block.rule) parts.push(toCp437("-".repeat(baseCols) + "\n"));
  }

  parts.push(ALIGN("left"), FEED(template.feedLines));
  if (opts.openDrawer) parts.push(DRAWER);
  if (opts.cutAfter) parts.push(CUT);

  return Buffer.concat(parts);
}

/**
 * EPSON's ePOS-Print takes XML over HTTP rather than raw bytes. Wrapping the
 * ESC/POS we already built keeps one code path for the document itself.
 */
export function toEposXml(bytes        )         {
  return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
<s:Body>
<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">
<command>${bytes.toString("base64")}</command>
</epos-print>
</s:Body>
</s:Envelope>`;
}

export { pad };
