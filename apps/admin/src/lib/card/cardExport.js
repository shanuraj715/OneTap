import { layoutCard, prepareCard, renderCard } from "./cardRenderer";
import { canvasToBlob, downloadBlob, safeFilename } from "./download";

/**
 * Turning a design into something you can print.
 *
 * Everything here draws through the same renderer as the editor preview, at
 * print scale — so an export is the preview, larger. Nothing about the layout
 * is recomputed differently.
 */

const MM_PER_INCH = 25.4;
export const pxPerMmAt = (dpi) => dpi / MM_PER_INCH;

/**
 * Safari on iOS silently hands back a blank canvas past roughly 16.7 million
 * pixels — no exception, no warning, just an empty image after the owner has
 * waited for it. So the DPI is stepped down until the canvas fits, and the
 * caller is told it happened rather than left wondering why the print looks
 * soft.
 */
const MAX_CANVAS_AREA = 16_000_000;

export function fitDpi(widthMm, heightMm, dpi) {
  let d = dpi;
  while (d > 72 && (widthMm / MM_PER_INCH) * d * ((heightMm / MM_PER_INCH) * d) > MAX_CANVAS_AREA) {
    d = Math.floor(d * 0.75);
  }
  return d;
}

const newCanvas = (w, h) => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

/** One card, at print resolution, with no tent or trim marks. */
export async function renderCardFace({ spec, data, dpi, into }) {
  const prepared = await prepareCard({ spec, data });
  const layout = layoutCard(spec, data, prepared);
  const canvas = into ?? document.createElement("canvas");
  renderCard(canvas, { spec, layout, prepared, pxPerMm: pxPerMmAt(dpi) });
  return { canvas, layout, prepared };
}

/* -------------------------------------------------------------------- tent */

/**
 * A table tent is one sheet folded in half so it reads from both sides. Without
 * this the owner's first question after downloading is "how do I make it stand
 * up?", and the answer would otherwise be "design a second card upside down".
 *
 * The top half is rotated 180°, so once the sheet is folded away from the
 * reader both faces are the right way up. `foldGapMm` keeps the crease out of
 * the artwork.
 */
function composeTent(face, spec, dpi) {
  const S = pxPerMmAt(dpi);
  const gap = Math.round(spec.tent.foldGapMm * S);
  const out = newCanvas(face.width, face.height * 2 + gap);
  const ctx = out.getContext("2d");
  if (!ctx) return face;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, out.width, out.height);

  // The reader's side sits below the fold.
  ctx.drawImage(face, 0, face.height + gap);

  if (spec.tent.mode === "duplicate") {
    ctx.drawImage(face, 0, 0);
  } else if (spec.tent.mode === "rotate180") {
    ctx.save();
    ctx.translate(face.width / 2, face.height / 2);
    ctx.rotate(Math.PI);
    ctx.drawImage(face, -face.width / 2, -face.height / 2);
    ctx.restore();
  }
  // "blank" leaves the far side white, for a tent that only faces one way.

  return out;
}

/* --------------------------------------------------------- trim and bleed */

function drawFoldLine(ctx, w, y, S) {
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = Math.max(1, 0.15 * S);
  ctx.setLineDash([4 * S, 3 * S]);
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(w, y);
  ctx.stroke();
  ctx.restore();
}

function drawCutLine(ctx, x, y, w, h, S) {
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = Math.max(1, 0.12 * S);
  ctx.setLineDash([2.5 * S, 2 * S]);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function drawCropMarks(ctx, x, y, w, h, S) {
  ctx.save();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = Math.max(1, 0.1 * S);
  const len = 4 * S;
  const off = 1.5 * S;
  const corners = [
    [x, y, -1, -1],
    [x + w, y, 1, -1],
    [x, y + h, -1, 1],
    [x + w, y + h, 1, 1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * off, cy);
    ctx.lineTo(cx + sx * (off + len), cy);
    ctx.moveTo(cx, cy + sy * off);
    ctx.lineTo(cx, cy + sy * (off + len));
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * A finished card: tent-folded if asked for, with bleed, crop marks and a cut
 * line as configured.
 *
 * Bleed is produced by drawing the card scaled up to cover the full sheet and
 * then the true-size card on top. The stretch is one or two percent and shows
 * only outside the trim, which is the part that gets cut off — and unlike
 * filling the margin with a flat colour, it works for a photographic
 * background too.
 */
export async function renderPrintable({ spec, data, dpi }) {
  const effectiveDpi = fitDpi(
    spec.size.widthMm + spec.print.bleedMm * 2,
    (spec.tent.enabled ? spec.size.heightMm * 2 + spec.tent.foldGapMm : spec.size.heightMm) + spec.print.bleedMm * 2,
    dpi,
  );
  const S = pxPerMmAt(effectiveDpi);

  const { canvas: face, layout } = await renderCardFace({ spec, data, dpi: effectiveDpi });
  const art = spec.tent.enabled ? composeTent(face, spec, effectiveDpi) : face;

  const bleed = Math.round(spec.print.bleedMm * S);
  const marks = spec.print.cropMarks ? Math.round(6 * S) : 0;
  const pad = bleed + marks;

  if (pad === 0 && !spec.print.cutLine) {
    return { canvas: art, dpi: effectiveDpi, steppedDown: effectiveDpi !== dpi, layout };
  }

  const out = newCanvas(art.width + pad * 2, art.height + pad * 2);
  const ctx = out.getContext("2d");
  if (!ctx) return { canvas: art, dpi: effectiveDpi, steppedDown: effectiveDpi !== dpi, layout };

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, out.width, out.height);

  if (bleed > 0) {
    ctx.drawImage(art, marks, marks, art.width + bleed * 2, art.height + bleed * 2);
  }
  ctx.drawImage(art, pad, pad);

  if (spec.print.cutLine) drawCutLine(ctx, pad, pad, art.width, art.height, S);
  if (spec.print.cropMarks) drawCropMarks(ctx, pad, pad, art.width, art.height, S);
  if (spec.tent.enabled) {
    drawFoldLine(ctx, out.width, pad + face.height + Math.round(spec.tent.foldGapMm * S) / 2, S);
  }

  return { canvas: out, dpi: effectiveDpi, steppedDown: effectiveDpi !== dpi, layout };
}

/* ------------------------------------------------------------------ sheets */

export const SHEETS = {
  a4: { id: "a4", label: "A4", widthMm: 210, heightMm: 297 },
  a3: { id: "a3", label: "A3", widthMm: 297, heightMm: 420 },
  letter: { id: "letter", label: "US Letter", widthMm: 216, heightMm: 279 },
};

/**
 * How many cards fit, and where they go.
 *
 * The grid is fitted to the whole sheet and then centred, rather than being
 * fitted inside a fixed margin. That distinction decides whether the commonest
 * case works at all: A6 is exactly a quarter of A4, so reserving even an 8mm
 * margin drops four cards per sheet to one. Fitting first and centring
 * afterwards gives four, and hands back whatever margin is genuinely spare.
 *
 * `gapMm` defaults to 0 for the same reason — cards that share a cut line are
 * how anyone actually guillotines a sheet. Raise it when cutting by hand.
 */
export function sheetPlan({ spec, sheet, gapMm = 0 }) {
  const cardW = spec.size.widthMm + spec.print.bleedMm * 2;
  const cardH = (spec.tent.enabled ? spec.size.heightMm * 2 + spec.tent.foldGapMm : spec.size.heightMm) + spec.print.bleedMm * 2;
  const cols = Math.max(0, Math.floor((sheet.widthMm + gapMm) / (cardW + gapMm)));
  const rows = Math.max(0, Math.floor((sheet.heightMm + gapMm) / (cardH + gapMm)));
  const blockW = cols > 0 ? cols * cardW + (cols - 1) * gapMm : 0;
  const blockH = rows > 0 ? rows * cardH + (rows - 1) * gapMm : 0;
  return {
    cols,
    rows,
    perSheet: cols * rows,
    cardW,
    cardH,
    gapMm,
    offsetXMm: (sheet.widthMm - blockW) / 2,
    offsetYMm: (sheet.heightMm - blockH) / 2,
  };
}

/**
 * One image per printed page, with a different table's card in every slot.
 *
 * Cards are drawn into the page one at a time and the scratch canvas is reused,
 * because holding forty 8-megapixel bitmaps at once is how a browser tab runs
 * out of memory halfway through a print run.
 */
export async function buildSheets({ spec, data, tables, dpi, sheet, gapMm = 0, onProgress }) {
  const plan = sheetPlan({ spec, sheet, gapMm });
  if (plan.perSheet === 0) {
    throw new Error(`A ${spec.size.widthMm}×${spec.size.heightMm}mm card doesn't fit on ${sheet.label}. Use a bigger sheet or a smaller card.`);
  }

  const effectiveDpi = fitDpi(sheet.widthMm, sheet.heightMm, dpi);
  const S = pxPerMmAt(effectiveDpi);
  const pages = [];
  const scratch = document.createElement("canvas");

  for (let start = 0; start < tables.length; start += plan.perSheet) {
    const slice = tables.slice(start, start + plan.perSheet);
    const page = newCanvas(sheet.widthMm * S, sheet.heightMm * S);
    const ctx = page.getContext("2d");
    if (!ctx) break;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, page.width, page.height);

    for (const [i, table] of slice.entries()) {
      const col = i % plan.cols;
      const row = Math.floor(i / plan.cols);
      const x = (plan.offsetXMm + col * (plan.cardW + plan.gapMm)) * S;
      const y = (plan.offsetYMm + row * (plan.cardH + plan.gapMm)) * S;

      const cardData = { ...data, table: table.number, zone: table.zone ?? "", seats: String(table.seats ?? ""), url: table.url };
      const { canvas } = await renderCardFace({ spec, data: cardData, dpi: effectiveDpi, into: scratch });
      const art = spec.tent.enabled ? composeTent(canvas, spec, effectiveDpi) : canvas;

      ctx.drawImage(art, x, y);
      if (spec.print.cutLine) drawCutLine(ctx, x, y, art.width, art.height, S);
      if (spec.tent.enabled) {
        drawFoldLine(ctx, page.width, y + canvas.height + Math.round(spec.tent.foldGapMm * S) / 2, S);
      }
      onProgress?.(start + i + 1, tables.length);
    }

    pages.push(page);
  }

  return { pages, plan, dpi: effectiveDpi, steppedDown: effectiveDpi !== dpi };
}

/* ------------------------------------------------------------- delivering */

export async function downloadCanvas(canvas, filename) {
  downloadBlob(await canvasToBlob(canvas, "image/png"), filename);
}

export { safeFilename };

/**
 * Hand the pages to the browser's own print dialog, sized in millimetres so
 * "actual size" really is actual size. A card printed at 96% scans fine and
 * then does not fit the stand the owner bought.
 */
export function openPrintWindow(pages, sheet, title) {
  const win = window.open("", "_blank");
  if (!win) {
    throw new Error("Your browser blocked the print window. Allow pop-ups for this site and try again.");
  }
  const imgs = pages
    .map((c) => `<img src="${c.toDataURL("image/png")}" style="width:${sheet.widthMm}mm;height:${sheet.heightMm}mm;display:block;page-break-after:always" />`)
    .join("");

  win.document.write(
    `<!doctype html><html><head><title>${title}</title><style>
      @page { size: ${sheet.widthMm}mm ${sheet.heightMm}mm; margin: 0 }
      html,body { margin:0; padding:0; background:#fff }
      img { width:${sheet.widthMm}mm; height:${sheet.heightMm}mm }
      @media print { img { page-break-after: always } }
    </style></head><body>${imgs}</body></html>`,
  );
  win.document.close();
  // The images are data URLs, but the window still needs a tick to lay them
  // out — printing immediately gives blank pages in Safari.
  win.onload = () => setTimeout(() => win.print(), 250);
}
