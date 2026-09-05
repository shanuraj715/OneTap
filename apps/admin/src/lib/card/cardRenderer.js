import {
  QR_COMFORTABLE_MM,
  QR_LOGO_WARN_PCT,
  QR_MIN_CONTRAST,
  QR_MIN_MM,
  QR_QUIET_MODULES,
  interpolateCardText,
  isRiskyEyePairing,
} from "@onetap/config-schema";
import { applyTextStyle, ensureFonts, transformText } from "./cardFonts.js";
import { drawIcon, hasIcon } from "./cardIcons.js";
import { contrastRatio, isDarkOn, paintQr, parseColor, roundRectPath, buildMatrix } from "./qrMatrix.js";

/**
 * One renderer, two surfaces: a live preview at roughly 3.6 px/mm and a print
 * export at 11.8. They have to agree exactly, and the naive approach — lay out
 * at whatever scale you are painting at — does not, because `measureText` is
 * not linear in font size. Hinting and rounding mean a line that just fits on
 * screen wraps in the print, and nobody finds out until the cards arrive.
 *
 * So the work is split three ways:
 *
 *   prepareCard  async — loads fonts, decodes images, builds the QR matrix
 *   layoutCard   sync  — all geometry in MILLIMETRES, measured once against a
 *                        scratch context pinned at LAYOUT_PPMM
 *   paintCard    sync  — multiplies that layout by the target scale and draws
 *
 * Because layout never sees the output scale, preview and export are identical
 * by construction rather than by luck.
 */

/** The canonical measuring scale. Any fixed value works; it must never vary. */
export const LAYOUT_PPMM = 8;

let scratch = null;
function measureCtx() {
  if (!scratch) {
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 8;
    scratch = canvas.getContext("2d");
  }
  return scratch;
}

/* ------------------------------------------------------------------ prepare */

/**
 * Only `data:` sources are accepted. Drawing a remotely-hosted image taints the
 * canvas, and a tainted canvas throws on `toBlob` — so the failure would land
 * at the very end, on export, after all the design work. Refusing the source up
 * front turns that into a message next to the picker.
 */
/**
 * Decoded images, keyed by their data URL.
 *
 * The editor re-renders on every keystroke and slider tick, and a background
 * photo is a megabyte of base64 — decoding it afresh each time makes dragging a
 * slider visibly stutter. The key is the URL itself, so changing the image
 * naturally misses the cache.
 */
const decoded = new Map();
const DECODE_CACHE_MAX = 12;

function loadImage(src) {
  if (!src || !src.startsWith("data:")) return Promise.resolve(null);
  const hit = decoded.get(src);
  if (hit) return hit;

  const promise = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

  // Bounded, oldest-out. Without this, every photo an owner tries in a session
  // stays in memory for as long as the tab is open.
  if (decoded.size >= DECODE_CACHE_MAX) decoded.delete(decoded.keys().next().value);
  decoded.set(src, promise);
  return promise;
}

export async function prepareCard({ spec, data = {} }) {
  const warnings = [];

  const pairs = spec.blocks
    .filter((b) => b.enabled && b.kind === "text")
    .map((b) => ({ fontId: b.text.fontId, weight: b.text.weight }));
  const fontWarnings = pairs.length ? await ensureFonts(pairs) : [];
  warnings.push(...fontWarnings);

  const qrBlock = spec.blocks.find((b) => b.enabled && b.kind === "qr");
  const logoSrc = qrBlock?.qr.logo || "";

  const [background, logo, ...blockImages] = await Promise.all([
    loadImage(spec.background.kind === "image" ? spec.background.image : ""),
    loadImage(logoSrc),
    ...spec.blocks.filter((b) => b.enabled && b.kind === "image").map((b) => loadImage(b.image.src)),
  ]);

  const images = new Map();
  spec.blocks
    .filter((b) => b.enabled && b.kind === "image")
    .forEach((b, i) => images.set(b.id, blockImages[i] ?? null));

  if (spec.background.kind === "image" && spec.background.image && !background) {
    warnings.push("The background image could not be read. Upload it again.");
  }
  if (logoSrc && !logo) {
    warnings.push("The QR centre logo could not be read. Upload it again.");
  }

  // Error correction is forced to H whenever a logo covers part of the code.
  // The stored value is left alone so a design saved before the logo was added
  // still round-trips unchanged — this is a render-time decision, not an edit.
  const ecc = logo ? "H" : (qrBlock?.qr.ecc ?? "H");
  const url = data.url || "https://example.com/t/preview?k=preview";
  const matrix = buildMatrix(url, ecc);

  return { background, logo, images, matrix, ecc, url, warnings };
}

/* ------------------------------------------------------------------- layout */

function wrapLines(mctx, text, style, maxWidthMm, sizeMm) {
  applyTextStyle(mctx, style, sizeMm * LAYOUT_PPMM);
  const maxW = maxWidthMm * LAYOUT_PPMM;
  const width = (s) => mctx.measureText(s).width;

  const out = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }

    const wrapped = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (!line || width(candidate) <= maxW) {
        line = candidate;
        continue;
      }
      wrapped.push(line);
      line = word;
    }
    if (line) wrapped.push(line);

    // A single unbreakable run — a long URL, say — still has to fit, so break
    // it by character. Only lines that are still too wide reach this.
    for (const l of wrapped) {
      if (width(l) <= maxW || l.length < 2) {
        out.push(l);
        continue;
      }
      let cur = "";
      for (const ch of l) {
        if (cur && width(cur + ch) > maxW) {
          out.push(cur);
          cur = ch;
        } else {
          cur += ch;
        }
      }
      if (cur) out.push(cur);
    }
  }

  if (out.length <= style.maxLines) return out;
  const kept = out.slice(0, style.maxLines);
  let last = `${kept[kept.length - 1]}…`;
  while (last.length > 1 && width(last) > maxW) last = `${last.slice(0, -2)}…`;
  kept[kept.length - 1] = last;
  return kept;
}

const shortEdge = (spec) => Math.min(spec.size.widthMm, spec.size.heightMm);

/**
 * Everything in millimetres. `pct` resolves the spec's percentages against the
 * short edge, which is what lets one template render at A7 and A4 unchanged.
 */
export function layoutCard(spec, data = {}, prepared = null) {
  const mctx = measureCtx();
  const { widthMm, heightMm } = spec.size;
  const short = shortEdge(spec);
  const pct = (v) => (v / 100) * short;

  const padL = (spec.padLeftPct / 100) * widthMm;
  const padR = (spec.padRightPct / 100) * widthMm;
  const padT = (spec.padTopPct / 100) * heightMm;
  const padB = (spec.padBottomPct / 100) * heightMm;
  const contentX = padL;
  const contentY = padT;
  const contentW = Math.max(1, widthMm - padL - padR);
  const contentH = Math.max(1, heightMm - padT - padB);

  const blocks = spec.blocks.filter((b) => b.enabled);
  const items = [];

  for (const block of blocks) {
    const align = block.align ?? spec.align;
    const gap = block.gapPct ?? spec.gapPct;
    const base = { block, align, gapMm: pct(gap) };

    if (block.kind === "text") {
      const raw = interpolateCardText(block.text.content, data);
      const content = transformText(raw, block.text.transform);
      if (!content) {
        // A token that resolved to nothing leaves an empty block; drawing it
        // would leave a gap where the owner sees a line they never wrote.
        continue;
      }
      const sizeMm = pct(block.text.sizePct);
      const wrapW = (block.text.widthPct / 100) * contentW - (block.text.chip ? pct(block.text.chipPadXPct) * 2 : 0);
      const lines = wrapLines(mctx, content, block.text, Math.max(1, wrapW), sizeMm);
      const lineH = sizeMm * block.text.lineHeight;
      applyTextStyle(mctx, block.text, sizeMm * LAYOUT_PPMM);
      const textW = Math.max(0, ...lines.map((l) => mctx.measureText(l).width / LAYOUT_PPMM));
      const chipPadX = block.text.chip ? pct(block.text.chipPadXPct) : 0;
      const chipPadY = block.text.chip ? pct(block.text.chipPadYPct) : 0;
      items.push({
        ...base,
        lines,
        sizeMm,
        lineH,
        textW,
        chipPadX,
        chipPadY,
        w: Math.min(contentW, textW + chipPadX * 2),
        h: lines.length * lineH + chipPadY * 2,
      });
      continue;
    }

    if (block.kind === "qr") {
      const size = pct(block.qr.sizePct);
      items.push({ ...base, w: size, h: size });
      continue;
    }

    if (block.kind === "image") {
      const img = prepared?.images.get(block.id) ?? null;
      if (!img) continue;
      const w = (block.image.widthPct / 100) * contentW;
      const ratio = block.image.aspect ?? img.naturalWidth / img.naturalHeight;
      items.push({ ...base, w, h: w / (ratio || 1), img });
      continue;
    }

    if (block.kind === "icon") {
      const names = block.icon.names.filter(hasIcon);
      if (names.length === 0) continue;
      const size = pct(block.icon.sizePct);
      const badge = block.icon.style === "plain" ? 0 : size * 0.42;
      const gapX = pct(block.icon.gapPct);
      items.push({
        ...base,
        names,
        iconSize: size,
        badge,
        gapX,
        w: names.length * (size + badge) + (names.length - 1) * gapX,
        h: size + badge,
      });
      continue;
    }

    if (block.kind === "divider") {
      items.push({ ...base, w: (block.divider.widthPct / 100) * contentW, h: pct(block.divider.thicknessPct) });
      continue;
    }

    items.push({ ...base, w: contentW, h: pct(block.spacer.heightPct) });
  }

  const gaps = items.slice(1).reduce((sum, it) => sum + it.gapMm, 0);
  const stackH = items.reduce((sum, it) => sum + it.h, 0) + gaps;
  const slack = contentH - stackH;

  let cursor = contentY;
  let extraPerGap = 0;
  if (spec.justify === "center") cursor += Math.max(0, slack) / 2;
  else if (spec.justify === "end") cursor += Math.max(0, slack);
  else if (spec.justify === "between" && items.length > 1 && slack > 0) extraPerGap = slack / (items.length - 1);

  for (const [i, it] of items.entries()) {
    if (i > 0) cursor += it.gapMm + extraPerGap;
    it.y = cursor;
    it.x =
      it.align === "left"
        ? contentX
        : it.align === "right"
          ? contentX + contentW - it.w
          : contentX + (contentW - it.w) / 2;
    cursor += it.h;
  }

  const layout = {
    widthMm,
    heightMm,
    shortMm: short,
    contentX,
    contentY,
    contentW,
    contentH,
    items,
    stackH,
    overflow: stackH > contentH + 0.01,
  };
  layout.warnings = layoutWarnings(spec, layout, prepared);
  return layout;
}

/* ----------------------------------------------------------------- warnings */

/**
 * Everything that would make a card fail in the owner's hand rather than on
 * their screen. Pure, so the editor can run it on every keystroke without
 * painting anything.
 */
export function layoutWarnings(spec, layout, prepared) {
  const out = [];
  const qrItem = layout.items.find((it) => it.block.kind === "qr");

  if (layout.overflow) {
    out.push({
      level: "error",
      text: "The design is taller than the card — the bottom will be cut off. Reduce a text size, the QR size, or the padding.",
    });
  }

  if (!qrItem) {
    out.push({ level: "error", text: "This card has no QR block, so there is nothing to scan." });
  } else {
    const qr = qrItem.block.qr;
    const boxMm = qrItem.h;

    if (boxMm < QR_MIN_MM) {
      out.push({
        level: "error",
        text: `The QR is ${boxMm.toFixed(0)}mm across. Below ${QR_MIN_MM}mm most phones struggle from across a table.`,
      });
    } else if (boxMm < QR_COMFORTABLE_MM) {
      out.push({
        level: "warn",
        text: `The QR is ${boxMm.toFixed(0)}mm across. ${QR_COMFORTABLE_MM}mm or more scans far more reliably in low light.`,
      });
    }

    // The real predictor of a print failing to scan is the size of one module,
    // not the size of the code. A dense URL at high error correction can push
    // a perfectly large QR under the printable limit.
    if (prepared?.matrix) {
      const innerMm = boxMm * (1 - (qr.paddingPct / 100) * 2);
      const moduleMm = innerMm / (prepared.matrix.size + QR_QUIET_MODULES * 2);
      if (moduleMm < 0.4) {
        out.push({
          level: "error",
          text: `Each QR square would print at ${moduleMm.toFixed(2)}mm. Under 0.4mm an office printer blurs them together. Make the QR bigger.`,
        });
      } else if (moduleMm < 0.5) {
        out.push({
          level: "warn",
          text: `Each QR square prints at ${moduleMm.toFixed(2)}mm — close to the limit for a home or office printer.`,
        });
      }
    }

    const backing = qr.plate ? qr.plateColor : qr.background;
    const moduleColors = qr.gradient?.stops?.length ? qr.gradient.stops.map((s) => s.color) : [qr.color];
    // Every stop is checked, not just the first: a ramp from near-black to a
    // pale accent scans at one end of the code and not at the other.
    for (const color of moduleColors) {
      if (contrastRatio(color, backing) < QR_MIN_CONTRAST) {
        out.push({
          level: "error",
          text: `The QR colour ${color} is too close to its background to scan reliably. Darken it, or turn the light backing plate on.`,
        });
        break;
      }
    }
    if (moduleColors.some((c) => !isDarkOn(c, backing))) {
      out.push({
        level: "warn",
        text: "This QR is light on a dark background. Many phone cameras only read dark codes on a light ground.",
      });
    }

    // The three finder patterns are checked separately, and they matter more
    // than the modules do: a scanner locates the code by those squares before
    // it reads a single bit. Tint them too close to the plate and the code is
    // not "hard to read", it is invisible — which is exactly how a card with
    // perfectly good modules fails.
    for (const [label, color] of [
      ["corner squares", qr.eyeColor],
      ["corner centres", qr.eyeBallColor],
    ]) {
      if (color && contrastRatio(color, backing) < QR_MIN_CONTRAST) {
        out.push({
          level: "error",
          text: `The QR's ${label} are ${color}, too close to the background for a phone to find the code. Use a darker colour.`,
        });
      }
    }

    // A rounded plate clips its own corners. The code is square, so it only
    // fits inside the plate's inscribed square — at a full circle that is 70.7%
    // of the diameter, needing ~14.6% padding. Less, and the corner modules
    // hang off the plate onto whatever is behind it.
    if (qr.plate && qr.plateRadiusPct > 8) {
      const needed = 14.65 * (qr.plateRadiusPct / 50);
      if (qr.paddingPct < needed - 0.5) {
        out.push({
          level: "warn",
          text: `The code's corners spill outside the rounded plate. Raise the QR padding to about ${Math.ceil(needed)}%, or square off the plate corners.`,
        });
      }
    }

    // Frame and centre must agree about how round they are. Mismatched pairs
    // were the only thing that failed across 84 tested combinations, and they
    // fail outright rather than degrading — so this is an error, not a nudge.
    if (isRiskyEyePairing(qr.eyeFrame, qr.eyeBall)) {
      out.push({
        level: "error",
        text: `A ${qr.eyeBall} centre inside a ${qr.eyeFrame} corner stops phones recognising the code. Set the centre to rounded, or match it to the corner shape.`,
      });
    }

    if (qr.logo && qr.logoSizePct > QR_LOGO_WARN_PCT) {
      out.push({
        level: "warn",
        text: `The centre logo covers ${qr.logoSizePct}% of the code. Error correction repairs errors at half the rate it repairs known gaps, so past about ${QR_LOGO_WARN_PCT}% the margin for a smudge disappears.`,
      });
    }
  }

  const url = String(prepared?.url ?? "");
  if (/localhost|127\.0\.0\.1|192\.168\./.test(url)) {
    out.push({
      level: "error",
      text: "These codes point at a local address that only works on this computer. Set STOREFRONT_ORIGIN on the server before printing.",
    });
  }

  for (const w of prepared?.warnings ?? []) out.push({ level: "warn", text: w });
  return out;
}

/* -------------------------------------------------------------------- paint */

function paintBackground(ctx, spec, prepared, S, w, h) {
  const bg = spec.background;
  const radius = (spec.size.cornerRadiusPct / 100) * Math.min(w, h);

  ctx.save();
  if (radius > 0) {
    roundRectPath(ctx, 0, 0, w, h, radius);
    ctx.clip();
  }

  // An "image" background with nothing in it falls back to the gradient, then
  // to the flat colour — which is what lets a photo template ship in the
  // library looking finished, and improve when a picture is added.
  const img = bg.kind === "image" ? prepared?.background : null;
  if (img) {
    ctx.globalAlpha = bg.imageOpacity / 100;
    if (bg.imageFit === "tile") {
      const pattern = ctx.createPattern(img, "repeat");
      ctx.fillStyle = pattern ?? bg.color;
      ctx.fillRect(0, 0, w, h);
    } else {
      const scale =
        bg.imageFit === "contain"
          ? Math.min(w / img.naturalWidth, h / img.naturalHeight)
          : Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      if (bg.imageFit === "contain") {
        ctx.fillStyle = bg.color;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    }
    ctx.globalAlpha = 1;
  } else if (bg.kind === "gradient" || (bg.kind === "image" && bg.gradient)) {
    const g = bg.gradient;
    if (g?.stops?.length >= 2) {
      let grad;
      if (g.kind === "radial") {
        grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 1.4);
      } else {
        const rad = ((g.angle - 90) * Math.PI) / 180;
        const half = Math.max(w, h) / 2;
        grad = ctx.createLinearGradient(
          w / 2 - Math.cos(rad) * half, h / 2 - Math.sin(rad) * half,
          w / 2 + Math.cos(rad) * half, h / 2 + Math.sin(rad) * half,
        );
      }
      for (const stop of g.stops) grad.addColorStop(Math.min(1, Math.max(0, stop.at / 100)), stop.color);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = bg.color;
    }
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, w, h);
  }

  if (bg.scrimOpacity > 0) {
    ctx.globalAlpha = bg.scrimOpacity / 100;
    ctx.fillStyle = bg.scrimColor;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  if (spec.border.enabled && spec.border.widthPct > 0) {
    const inset = (spec.border.insetPct / 100) * Math.min(spec.size.widthMm, spec.size.heightMm) * S;
    const lw = (spec.border.widthPct / 100) * Math.min(spec.size.widthMm, spec.size.heightMm) * S;
    ctx.save();
    ctx.strokeStyle = spec.border.color;
    ctx.lineWidth = lw;
    if (spec.border.style === "dashed") ctx.setLineDash([lw * 4, lw * 3]);
    else if (spec.border.style === "dotted") ctx.setLineDash([lw, lw * 2]);
    if (spec.border.style === "double") {
      for (const off of [0, lw * 2.2]) {
        roundRectPath(
          ctx, inset + lw / 2 + off, inset + lw / 2 + off,
          w - (inset + lw / 2 + off) * 2, h - (inset + lw / 2 + off) * 2,
          (spec.border.radiusPct / 100) * Math.min(w, h),
        );
        ctx.stroke();
      }
    } else {
      roundRectPath(
        ctx, inset + lw / 2, inset + lw / 2,
        w - inset * 2 - lw, h - inset * 2 - lw,
        (spec.border.radiusPct / 100) * Math.min(w, h),
      );
      ctx.stroke();
    }
    ctx.restore();
  }
}

const SHADOWS = {
  soft: { blur: 0.55, dx: 0, dy: 0.18, color: "rgba(0,0,0,0.45)" },
  hard: { blur: 0.08, dx: 0.12, dy: 0.14, color: "rgba(0,0,0,0.7)" },
};

function clearShadow(ctx) {
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

/**
 * Draw a laid-out card. `pxPerMm` is the only scale input: a preview passes
 * `cssWidth · devicePixelRatio / widthMm`, an export passes `dpi / 25.4`.
 */
export function paintCard(ctx, spec, layout, prepared, pxPerMm) {
  const S = pxPerMm;
  const X = (mm) => mm * S;
  const w = X(layout.widthMm);
  const h = X(layout.heightMm);

  ctx.save();
  ctx.clearRect(0, 0, w, h);
  paintBackground(ctx, spec, prepared, S, w, h);

  for (const it of layout.items) {
    const { block } = it;
    clearShadow(ctx);

    if (block.kind === "text") {
      const st = block.text;
      ctx.globalAlpha = st.opacity / 100;

      if (st.chip) {
        ctx.fillStyle = st.chipColor;
        roundRectPath(ctx, X(it.x), X(it.y), X(it.w), X(it.h), (st.chipRadiusPct / 100) * X(it.h));
        ctx.fill();
      }

      const shadow = SHADOWS[st.shadow];
      if (shadow) {
        ctx.shadowColor = shadow.color;
        ctx.shadowBlur = X(shadow.blur * it.sizeMm);
        ctx.shadowOffsetX = X(shadow.dx * it.sizeMm);
        ctx.shadowOffsetY = X(shadow.dy * it.sizeMm);
      }

      applyTextStyle(ctx, st, X(it.sizeMm));
      ctx.fillStyle = st.color;
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = it.align === "left" ? "left" : it.align === "right" ? "right" : "center";

      const innerX =
        it.align === "left"
          ? it.x + it.chipPadX
          : it.align === "right"
            ? it.x + it.w - it.chipPadX
            : it.x + it.w / 2;

      it.lines.forEach((line, i) => {
        // Baseline sits at ~78% down the line box, which keeps a mixed-case
        // line optically centred without measuring every font's metrics.
        const baseline = it.y + it.chipPadY + i * it.lineH + it.lineH * 0.78;
        ctx.fillText(line, X(innerX), X(baseline));
      });

      ctx.globalAlpha = 1;
      clearShadow(ctx);
      continue;
    }

    if (block.kind === "qr") {
      paintQr(ctx, {
        x: X(it.x),
        y: X(it.y),
        size: X(it.w),
        matrix: prepared.matrix,
        style: block.qr,
        logo: prepared.logo,
      });
      continue;
    }

    if (block.kind === "image") {
      ctx.save();
      ctx.globalAlpha = block.image.opacity / 100;
      const radius = (block.image.radiusPct / 100) * Math.min(X(it.w), X(it.h));
      if (radius > 0) {
        roundRectPath(ctx, X(it.x), X(it.y), X(it.w), X(it.h), radius);
        ctx.clip();
      }
      if (block.image.fit === "cover") {
        const scale = Math.max(X(it.w) / it.img.naturalWidth, X(it.h) / it.img.naturalHeight);
        const dw = it.img.naturalWidth * scale;
        const dh = it.img.naturalHeight * scale;
        ctx.drawImage(it.img, X(it.x) + (X(it.w) - dw) / 2, X(it.y) + (X(it.h) - dh) / 2, dw, dh);
      } else {
        ctx.drawImage(it.img, X(it.x), X(it.y), X(it.w), X(it.h));
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      continue;
    }

    if (block.kind === "icon") {
      const size = X(it.iconSize);
      const badge = X(it.badge);
      let x = X(it.x);
      for (const name of it.names) {
        if (badge > 0) {
          ctx.fillStyle = block.icon.badgeColor;
          if (block.icon.style === "circle") {
            ctx.beginPath();
            ctx.arc(x + (size + badge) / 2, X(it.y) + (size + badge) / 2, (size + badge) / 2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            roundRectPath(ctx, x, X(it.y), size + badge, size + badge, (size + badge) * 0.24);
            ctx.fill();
          }
        }
        drawIcon(ctx, name, x + badge / 2, X(it.y) + badge / 2, size, {
          color: block.icon.color,
          strokeWidth: (block.icon.strokePct / 100) * size,
        });
        x += size + badge + X(it.gapX);
      }
      continue;
    }

    if (block.kind === "divider") {
      const d = block.divider;
      ctx.save();
      ctx.strokeStyle = d.color;
      ctx.lineWidth = X(it.h);
      if (d.style === "dashed") ctx.setLineDash([X(it.h) * 4, X(it.h) * 3]);
      else if (d.style === "dotted") {
        ctx.setLineDash([0.1, X(it.h) * 2.4]);
        ctx.lineCap = "round";
      }
      const y = X(it.y) + X(it.h) / 2;
      if (d.style === "double") {
        const off = X(it.h) * 1.6;
        for (const dy of [-off, off]) {
          ctx.beginPath();
          ctx.moveTo(X(it.x), y + dy);
          ctx.lineTo(X(it.x + it.w), y + dy);
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.moveTo(X(it.x), y);
        ctx.lineTo(X(it.x + it.w), y);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  ctx.restore();
}

/* ------------------------------------------------------------- convenience */

/**
 * Size a canvas and draw one card into it. Used by the preview, the template
 * gallery and the exporter, so all three go through the same path.
 */
export function renderCard(canvas, { spec, layout, prepared, pxPerMm }) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  canvas.width = Math.round(layout.widthMm * pxPerMm);
  canvas.height = Math.round(layout.heightMm * pxPerMm);
  paintCard(ctx, spec, layout, prepared, pxPerMm);
  return ctx;
}

/** Convenience for callers that just want a finished card from a spec. */
export async function drawCard(canvas, { spec, data, pxPerMm }) {
  const prepared = await prepareCard({ spec, data });
  const layout = layoutCard(spec, data, prepared);
  renderCard(canvas, { spec, layout, prepared, pxPerMm });
  return { prepared, layout };
}

export { contrastRatio, parseColor };
