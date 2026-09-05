import QRCode from "qrcode";
import { QR_QUIET_MODULES } from "@onetap/config-schema";

/**
 * The QR is drawn from its module matrix rather than from `QRCode.toDataURL`.
 * A baked PNG cannot be restyled — no module shapes, no eye colours, no centre
 * logo — so "fully customisable QR" has to start one level lower, at the
 * matrix. `QRCode.create` gives us exactly that and nothing else.
 *
 * Everything here exists to protect one property: the code still scans. A card
 * that looks beautiful and does not scan has failed completely, and it fails
 * silently — the owner finds out from a customer.
 */

/** Finder patterns are 7×7 and live in three corners. */
const FINDER = 7;

export function buildMatrix(text, ecc = "H") {
  const qr = QRCode.create(text || "https://example.com", { errorCorrectionLevel: ecc });
  return { size: qr.modules.size, get: (r, c) => qr.modules.get(r, c) === 1, version: qr.version };
}

/** Top-left corners of the three finder patterns. */
function finderOrigins(size) {
  return [
    { r: 0, c: 0 },
    { r: 0, c: size - FINDER },
    { r: size - FINDER, c: 0 },
  ];
}

function inFinder(size, r, c) {
  return finderOrigins(size).some((o) => r >= o.r && r < o.r + FINDER && c >= o.c && c < o.c + FINDER);
}

/* ------------------------------------------------------------------ colour */

/** #rgb, #rgba, #rrggbb, #rrggbbaa, or "transparent". */
export function parseColor(value) {
  if (!value || value === "transparent") return null;
  let h = String(value).trim().replace("#", "");
  if (h.length === 3 || h.length === 4) h = h.split("").map((ch) => ch + ch).join("");
  if (h.length !== 6 && h.length !== 8) return null;
  const n = Number.parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return null;
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
    a: h.length === 8 ? Number.parseInt(h.slice(6, 8), 16) / 255 : 1,
  };
}

const channel = (v) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

export function luminance(color) {
  const c = parseColor(color);
  if (!c) return 1;
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Scanners expect dark-on-light. An inverted code fails on a good many phones. */
export const isDarkOn = (fg, bg) => luminance(fg) < luminance(bg);

/* ---------------------------------------------------------------- geometry */

/**
 * Work out the module grid for a given pixel box.
 *
 * Module *edges* are snapped to whole pixels; the module *size* is not. That
 * distinction matters at both ends of the scale:
 *
 *  - Rounding the size instead (floor to a whole number of pixels) throws away
 *    the remainder. At preview resolution — roughly 2 px per module — flooring
 *    1.6 to 1 shrinks the code to 60% of its box, so the preview stops matching
 *    the print, which is the one thing this renderer exists to guarantee.
 *  - Not snapping at all leaves every edge mid-pixel, where it anti-aliases to
 *    grey and the scanner's binarisation has to guess. That is the classic
 *    reason a beautiful printed QR will not scan.
 *
 * Snapping edges gives both: the grid fills the box exactly, and every boundary
 * lands on a pixel. Individual modules vary by a pixel, which no scanner cares
 * about — they sample cell centres.
 */
export function qrGeometry(boxPx, matrixSize, paddingPct) {
  const pad = (Math.max(0, paddingPct) / 100) * boxPx;
  const inner = Math.max(1, boxPx - pad * 2);
  const total = matrixSize + QR_QUIET_MODULES * 2;
  const module = inner / total;
  const edges = new Array(total + 1);
  for (let i = 0; i <= total; i++) edges[i] = Math.round(pad + i * module);
  const quiet = QR_QUIET_MODULES;
  return {
    module,
    total,
    quiet,
    edges,
    /** the code itself, excluding the quiet zone */
    drawnStart: edges[quiet],
    drawnEnd: edges[quiet + matrixSize],
    drawn: edges[quiet + matrixSize] - edges[quiet],
  };
}

/* ---------------------------------------------------------------- painting */

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, rr);
    return;
  }
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export { roundRectPath };

/** A module's four orthogonal neighbours, used by the connected shapes. */
function neighbours(on, size, r, c) {
  return {
    up: r > 0 && on(r - 1, c),
    down: r < size - 1 && on(r + 1, c),
    left: c > 0 && on(r, c - 1),
    right: c < size - 1 && on(r, c + 1),
  };
}

function paintModule(ctx, style, x, y, w, h, n) {
  const m = Math.min(w, h);
  switch (style) {
    case "dot":
      // Tangent, not inset. Shrinking the dots so they visibly separate looks
      // tidier and measurably hurts decoding: adjacent dark modules stop
      // touching, which thins the timing pattern and pushes the whole code
      // towards the light side of the scanner's threshold.
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, m * 0.5, 0, Math.PI * 2);
      ctx.fill();
      return;
    case "rounded":
      roundRectPath(ctx, x, y, w, h, m * 0.3);
      ctx.fill();
      return;
    case "diamond":
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h / 2);
      ctx.lineTo(x + w / 2, y + h);
      ctx.lineTo(x, y + h / 2);
      ctx.closePath();
      ctx.fill();
      return;
    case "classy": {
      // Round only the corners with no neighbour on either adjoining side, so
      // runs of modules fuse into smooth shapes and isolated ones stay round.
      const r = m * 0.45;
      ctx.beginPath();
      const tl = !n.up && !n.left ? r : 0;
      const tr = !n.up && !n.right ? r : 0;
      const br = !n.down && !n.right ? r : 0;
      const bl = !n.down && !n.left ? r : 0;
      if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, [tl, tr, br, bl]);
      else ctx.rect(x, y, w, h);
      ctx.fill();
      return;
    }
    default:
      ctx.fillRect(x, y, w, h);
  }
}

/** Merge consecutive modules into one rounded bar — the bar-h / bar-v styles. */
function paintRuns(ctx, on, size, geo, vertical, skip) {
  const { edges, quiet, module: m } = geo;
  for (let a = 0; a < size; a++) {
    let run = 0;
    for (let b = 0; b <= size; b++) {
      const r = vertical ? b : a;
      const c = vertical ? a : b;
      const lit = b < size && on(r, c) && !skip(r, c);
      if (lit) {
        run += 1;
        continue;
      }
      if (run > 0) {
        const startB = b - run;
        const along0 = edges[quiet + startB];
        const along1 = edges[quiet + startB + run];
        const across0 = edges[quiet + a];
        const across1 = edges[quiet + a + 1];
        const x = vertical ? across0 : along0;
        const y = vertical ? along0 : across0;
        const w = vertical ? across1 - across0 : along1 - along0;
        const h = vertical ? along1 - along0 : across1 - across0;
        roundRectPath(ctx, x, y, w, h, m * 0.42);
        ctx.fill();
        run = 0;
      }
    }
  }
}

function paintEye(ctx, geo, origin, style, ballStyle, frameColor, ballColor) {
  const { edges, quiet, module: m } = geo;
  const x = edges[quiet + origin.c];
  const y = edges[quiet + origin.r];
  const s = edges[quiet + origin.c + FINDER] - x;

  ctx.fillStyle = frameColor;
  // The frame is a 7×7 ring one module thick. Stroked rather than filled-and-
  // knocked-out so it composites correctly over a photographic background.
  ctx.lineWidth = m;
  ctx.strokeStyle = frameColor;
  const inset = m / 2;
  if (style === "circle") {
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s / 2, s / 2 - inset, 0, Math.PI * 2);
    ctx.stroke();
  } else if (style === "rounded") {
    roundRectPath(ctx, x + inset, y + inset, s - m, s - m, m * 1.8);
    ctx.stroke();
  } else if (style === "leaf") {
    // Three rounded corners and one square — the corner pointing outward stays
    // square so the three eyes still read as a matched set.
    const r = m * 2.2;
    const sq = origin.r === 0 && origin.c === 0 ? "tl" : origin.r === 0 ? "tr" : "bl";
    const radii = [sq === "tl" ? 0 : r, sq === "tr" ? 0 : r, r, sq === "bl" ? 0 : r];
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") ctx.roundRect(x + inset, y + inset, s - m, s - m, radii);
    else ctx.rect(x + inset, y + inset, s - m, s - m);
    ctx.stroke();
  } else {
    ctx.strokeRect(x + inset, y + inset, s - m, s - m);
  }

  // The 3×3 ball, inset two modules from the frame.
  const bx = x + m * 2;
  const by = y + m * 2;
  const bs = m * 3;
  ctx.fillStyle = ballColor;
  if (ballStyle === "circle") {
    ctx.beginPath();
    ctx.arc(bx + bs / 2, by + bs / 2, bs / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (ballStyle === "rounded") {
    roundRectPath(ctx, bx, by, bs, bs, bs * 0.3);
    ctx.fill();
  } else if (ballStyle === "diamond") {
    ctx.beginPath();
    ctx.moveTo(bx + bs / 2, by);
    ctx.lineTo(bx + bs, by + bs / 2);
    ctx.lineTo(bx + bs / 2, by + bs);
    ctx.lineTo(bx, by + bs / 2);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(bx, by, bs, bs);
  }
}

/**
 * Paint a styled QR into a square box at (x, y).
 *
 * `logo` is an already-decoded image; loading is the caller's job because this
 * has to stay synchronous — the same call has to serve a live preview and a
 * 300dpi export, and those must agree exactly.
 */
export function paintQr(ctx, { x, y, size, matrix, style, logo }) {
  ctx.save();
  ctx.translate(x, y);

  // A blurred QR is an unscannable QR, and a shadow set for an earlier block
  // would otherwise still be in effect.
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  if (style.plate) {
    ctx.fillStyle = style.plateColor;
    roundRectPath(ctx, 0, 0, size, size, (style.plateRadiusPct / 100) * size);
    ctx.fill();
  }

  const geo = qrGeometry(size, matrix.size, style.paddingPct);
  const { edges, quiet, module: m } = geo;
  const ex = (i) => edges[quiet + i];

  // Modules are painted onto the plate, not onto whatever is behind the card,
  // so an unplated QR still needs its own ground for the quiet zone to exist.
  if (!style.plate && style.background && style.background !== "transparent") {
    ctx.fillStyle = style.background;
    ctx.fillRect(0, 0, size, size);
  }

  // The knockout behind a centre logo, snapped out to whole module boundaries.
  // A partially-covered module is worse than a fully-covered one: the scanner
  // reads a grey cell as a coin flip instead of a known erasure.
  let hole = null;
  if (logo) {
    const logoPx = (style.logoSizePct / 100) * geo.drawn;
    const padded = logoPx * (1 + style.logoPadPct / 100);
    const half = Math.ceil(padded / 2 / m);
    const centre = Math.floor(matrix.size / 2);
    hole = {
      r0: Math.max(0, centre - half),
      r1: Math.min(matrix.size - 1, centre + half),
      c0: Math.max(0, centre - half),
      c1: Math.min(matrix.size - 1, centre + half),
      logoPx,
    };
  }
  const skip = (r, c) => Boolean(hole && r >= hole.r0 && r <= hole.r1 && c >= hole.c0 && c <= hole.c1);

  // A gradient across the modules, built over the drawn area so every module
  // takes its colour from the same ramp regardless of paint order.
  let fill = style.color;
  if (style.gradient && style.gradient.stops?.length >= 2) {
    const g = style.gradient;
    let grad;
    const cx = geo.drawnStart + geo.drawn / 2;
    const cy = cx;
    if (g.kind === "radial") {
      grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, geo.drawn / 2);
    } else {
      const rad = ((g.angle - 90) * Math.PI) / 180;
      const half = geo.drawn / 2;
      grad = ctx.createLinearGradient(
        cx - Math.cos(rad) * half, cy - Math.sin(rad) * half,
        cx + Math.cos(rad) * half, cy + Math.sin(rad) * half,
      );
    }
    for (const stop of g.stops) grad.addColorStop(Math.min(1, Math.max(0, stop.at / 100)), stop.color);
    fill = grad;
  }

  ctx.fillStyle = fill;
  const on = (r, c) => matrix.get(r, c);
  const isBody = (r, c) => !inFinder(matrix.size, r, c) && !skip(r, c);

  if (style.moduleStyle === "bar-h" || style.moduleStyle === "bar-v") {
    paintRuns(ctx, on, matrix.size, geo, style.moduleStyle === "bar-v", (r, c) => !isBody(r, c));
  } else {
    for (let r = 0; r < matrix.size; r++) {
      for (let c = 0; c < matrix.size; c++) {
        if (!on(r, c) || !isBody(r, c)) continue;
        paintModule(
          ctx,
          style.moduleStyle,
          ex(c),
          ex(r),
          ex(c + 1) - ex(c),
          ex(r + 1) - ex(r),
          style.moduleStyle === "classy" ? neighbours((rr, cc) => on(rr, cc) && isBody(rr, cc), matrix.size, r, c) : null,
        );
      }
    }
  }

  const eyeColor = style.eyeColor ?? style.color;
  const ballColor = style.eyeBallColor ?? eyeColor;
  for (const o of finderOrigins(matrix.size)) {
    paintEye(ctx, geo, o, style.eyeFrame, style.eyeBall, eyeColor, ballColor);
  }

  if (logo && hole) {
    const hx = ex(hole.c0);
    const hy = ex(hole.r0);
    ctx.fillStyle = style.plate ? style.plateColor : style.background;
    ctx.fillRect(hx, hy, ex(hole.c1 + 1) - hx, ex(hole.r1 + 1) - hy);

    const lw = hole.logoPx;
    const centre = geo.drawnStart + geo.drawn / 2;
    const lx = centre - lw / 2;
    const ly = centre - lw / 2;
    ctx.save();
    if (style.logoShape === "circle") {
      ctx.beginPath();
      ctx.arc(lx + lw / 2, ly + lw / 2, lw / 2, 0, Math.PI * 2);
      ctx.clip();
    } else if (style.logoShape === "rounded") {
      roundRectPath(ctx, lx, ly, lw, lw, lw * 0.18);
      ctx.clip();
    }
    // `contain`, so a wide logo is never stretched into a different shape.
    const ratio = logo.width / logo.height;
    const dw = ratio >= 1 ? lw : lw * ratio;
    const dh = ratio >= 1 ? lw / ratio : lw;
    ctx.drawImage(logo, lx + (lw - dw) / 2, ly + (lw - dh) / 2, dw, dh);
    ctx.restore();
  }

  ctx.restore();
}
