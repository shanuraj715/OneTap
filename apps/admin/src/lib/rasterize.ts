export interface LogoRaster {
  width: number;
  height: number;
  /** base64 of packed rows, MSB first, 1 = burn a dot */
  data: string;
}

export interface RasterResult {
  raster: LogoRaster;
  /** a preview of exactly what the printer will burn */
  previewUrl: string;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Needed to read pixels back off the canvas for a remotely-hosted logo.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load that image. Check the URL, or upload the file instead."));
    img.src = url;
  });
}

/**
 * Turn a logo into the 1-bit bitmap a thermal printer actually takes.
 *
 * A receipt printer has no colours and no greys — it either burns a dot or it
 * doesn't. So the logo is scaled to the printhead's dot width and every pixel is
 * decided against a threshold. High-contrast line art survives this well; a
 * photograph does not, which is why the preview shows the real result rather
 * than the original image.
 *
 * Done in the browser on purpose: the canvas is right here, the threshold slider
 * can show its effect live, and the server never needs an image library.
 */
export async function rasterizeLogo(
  url: string,
  maxDots: number,
  threshold: number,
  widthPct = 100,
): Promise<RasterResult> {
  const img = await loadImage(url);

  const target = Math.max(8, Math.round((maxDots * widthPct) / 100));
  // Packing is byte-aligned per row, so a multiple of 8 wastes no dots.
  const width = Math.max(8, Math.min(maxDots, Math.floor(target / 8) * 8));
  const height = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * width));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("This browser could not prepare the image");

  // Transparency prints as nothing, so flatten onto white first.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const { data: px } = ctx.getImageData(0, 0, width, height);
  const bytesPerRow = width / 8;
  const packed = new Uint8Array(bytesPerRow * height);
  const preview = ctx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = px[i + 3]! / 255;
      // Composite against white so a semi-transparent logo doesn't go solid.
      const r = px[i]! * a + 255 * (1 - a);
      const g = px[i + 1]! * a + 255 * (1 - a);
      const b = px[i + 2]! * a + 255 * (1 - a);
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const black = luma < threshold;

      if (black) packed[y * bytesPerRow + (x >> 3)]! |= 0x80 >> (x & 7);

      const p = i;
      const v = black ? 0 : 255;
      preview.data[p] = v;
      preview.data[p + 1] = v;
      preview.data[p + 2] = v;
      preview.data[p + 3] = 255;
    }
  }

  ctx.putImageData(preview, 0, 0);

  let binary = "";
  for (const byte of packed) binary += String.fromCharCode(byte);

  return {
    raster: { width, height, data: btoa(binary) },
    previewUrl: canvas.toDataURL("image/png"),
  };
}

/** Read an uploaded file as a data: URL so it travels with the template. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });
}
