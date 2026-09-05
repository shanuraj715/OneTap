/**
 * Card icons, drawn as canvas paths on a 24×24 grid.
 *
 * Not an icon font: a canvas asked for a glyph from a font that has not loaded
 * renders a box, silently, the same way card text does — except a missing icon
 * is invisible rather than merely wrong. Not remote SVGs either, since drawing
 * one taints the canvas and makes the whole card un-exportable.
 *
 * So they are hand-written path data, stroked in the block's own colour at the
 * block's own weight, which also means they inherit the design rather than
 * fighting it.
 */

const ICONS = {
  wifi: {
    stroke: ["M4.5 12.4a11 11 0 0 1 15 0", "M1.3 8.9a16 16 0 0 1 21.4 0", "M7.8 15.9a6.5 6.5 0 0 1 8.4 0", "M12 19.5h.01"],
  },
  phone: {
    stroke: [
      "M21 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 1.1 4.2 2 2 0 0 1 3.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L7.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z",
    ],
  },
  whatsapp: {
    stroke: ["M12 2.8a9.2 9.2 0 0 0-7.9 13.9L2.8 21.2l4.6-1.3A9.2 9.2 0 1 0 12 2.8z"],
    fill: [
      "M9.4 8.2c.2-.5.5-.5.7-.5h.6c.2 0 .5 0 .7.5l.8 1.9c.1.2 0 .4-.1.5l-.5.6c-.2.2-.3.3-.1.6a7 7 0 0 0 2.7 2.4c.3.1.5.1.6 0l.6-.7c.2-.2.3-.2.6-.1l1.8.9c.3.1.4.3.4.5v.6c0 .4-.4 1.2-1.6 1.2-2 0-4-1-5.6-2.6a9 9 0 0 1-2.3-4c-.2-1 .2-1.8.7-2.3z",
    ],
  },
  instagram: {
    stroke: ["M7 2.8h10A4.2 4.2 0 0 1 21.2 7v10A4.2 4.2 0 0 1 17 21.2H7A4.2 4.2 0 0 1 2.8 17V7A4.2 4.2 0 0 1 7 2.8z", "M12 7.9a4.1 4.1 0 1 1 0 8.2 4.1 4.1 0 0 1 0-8.2z", "M17.4 6.6h.01"],
  },
  facebook: {
    stroke: ["M17.5 2.8h-2.6a4.6 4.6 0 0 0-4.6 4.6v2.7H7.4v3.6h2.9v7.5h3.7v-7.5h2.9l.7-3.6h-3.6V7.6c0-.6.4-1 1-1h2.5z"],
  },
  location: {
    stroke: ["M19.5 10.3c0 5.6-7.5 11.2-7.5 11.2S4.5 15.9 4.5 10.3a7.5 7.5 0 0 1 15 0z", "M12 12.9a2.8 2.8 0 1 1 0-5.6 2.8 2.8 0 0 1 0 5.6z"],
  },
  clock: {
    stroke: ["M12 2.8a9.2 9.2 0 1 1 0 18.4 9.2 9.2 0 0 1 0-18.4z", "M12 6.6V12l3.6 2.1"],
  },
  star: {
    stroke: ["M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.4l6.5-.9z"],
  },
  heart: {
    stroke: ["M20.4 5.1a5.3 5.3 0 0 0-7.5 0L12 6l-.9-.9a5.3 5.3 0 1 0-7.5 7.5l.9.9 7.5 7.4 7.5-7.4.9-.9a5.3 5.3 0 0 0 0-7.5z"],
  },
  leaf: {
    stroke: ["M11 20.5A7.5 7.5 0 0 1 9.7 5.7C15.6 4.5 17.2 4 19.3 1.5c1 2.1 2.1 4.4 2.1 8.4 0 5.8-5 10.6-10.4 10.6z", "M2.4 22c0-3.2 2-5.7 5.4-6.4"],
  },
  chilli: {
    stroke: ["M15.8 7.4c2.4 3.6 1.7 8.4-1.8 11.2s-8.6 2.8-11.4 1.2c3.4-.3 5.6-1.9 6.9-4.6", "M15.8 7.4c-1.4-.6-2.4-1.9-2.4-3.6 1.9 0 3.2.7 3.9 2.1.8-.7 1.9-.9 3-.5-.6 1.6-2.2 2.5-4.5 2z"],
  },
  cup: {
    stroke: ["M3.4 8.4h13.2v8.2a4.4 4.4 0 0 1-4.4 4.4H7.8a4.4 4.4 0 0 1-4.4-4.4z", "M16.6 10h1.3a3 3 0 0 1 0 6h-1.3", "M7 5.3V2.8", "M11 5.3V2.8"],
  },
  utensils: {
    stroke: ["M3.4 2.6v6.1a2.4 2.4 0 0 0 2.4 2.4h2.4a2.4 2.4 0 0 0 2.4-2.4V2.6", "M6.9 2.6v18.8", "M20.6 2.6a5 5 0 0 0-4 4.9v4.6c0 .9.7 1.6 1.6 1.6h2.4z", "M20.6 13.7v7.7"],
  },
  scan: {
    stroke: ["M3.2 7.6V5.3a2.1 2.1 0 0 1 2.1-2.1h2.3", "M16.4 3.2h2.3a2.1 2.1 0 0 1 2.1 2.1v2.3", "M20.8 16.4v2.3a2.1 2.1 0 0 1-2.1 2.1h-2.3", "M7.6 20.8H5.3a2.1 2.1 0 0 1-2.1-2.1v-2.3", "M3.2 12h17.6"],
  },
  "arrow-down": {
    stroke: ["M12 3.4v17.2", "M19.4 13.2L12 20.6l-7.4-7.4"],
  },
  sparkle: {
    stroke: ["M12 2.6l2 6.2 6.2 2-6.2 2-2 6.2-2-6.2-6.2-2 6.2-2z", "M19 16.4l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"],
  },
};

export const hasIcon = (name) => Object.hasOwn(ICONS, name);

/**
 * Draw one icon into a `size` × `size` box at (x, y).
 *
 * `strokeWidth` is in the same pixel space as `size`, so callers scale it with
 * the card rather than passing a fixed hairline that vanishes at 300dpi.
 */
export function drawIcon(ctx, name, x, y, size, { color, strokeWidth }) {
  const icon = ICONS[name];
  if (!icon) return;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  // Scaled back into the 24-grid so the caller can think in card pixels.
  ctx.lineWidth = (strokeWidth * 24) / size;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  for (const d of icon.stroke ?? []) ctx.stroke(new Path2D(d));
  for (const d of icon.fill ?? []) ctx.fill(new Path2D(d));

  ctx.restore();
}
