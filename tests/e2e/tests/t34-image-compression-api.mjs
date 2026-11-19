// T34 — Picture compression on upload: very high-quality photos are made small on the server (no browser).
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t34-image-compression-api",
  title: "Pictures are compressed and optimised on the server when uploaded — size, shape, rotation, privacy, limits and settings",
  area: "storage",
  browser: false,
  fresh: false,
  summary: "Runs suites/image-compression.mjs: its own in-memory API. Real image files are generated and uploaded through POST /api/storage/upload, then the stored file is fetched back and inspected. A 24-megapixel JPEG at quality 95 (~19 MB) becomes a ~300 KB WebP of 1600 px on its long side; a photo the phone saved sideways comes out upright; hidden metadata (author, camera, location) is stripped; a small picture is never enlarged; a logo keeps its transparent background; very grainy detail that quality alone can't shrink under the 400 KB target is made smaller (not below 640 px) until it fits; a 225-megapixel 'pixel bomb' is shrunk safely in well under 10 s and the server stays healthy; a picture over 268 megapixels, a non-image, an empty body and a file over 30 MB are refused; people not signed in or without menu rights can't upload; five 19 MB photos at once all succeed; and the platform's compression settings (size, quality, format, target KB) are what the next upload follows — only the platform owner can change them, within the allowed ranges.",
  expect: [
    "A very high-quality photo is stored as a small WebP (long side 1600 px, under the 400 KB target) that can be fetched from the returned address; the answer reports its real size and the original's.",
    "Phone photos saved sideways come out upright; hidden metadata is removed from the stored file.",
    "Small pictures are not enlarged; a transparent logo stays transparent; the kind of picture decides its folder.",
    "If lowering quality can't reach the size target, the picture is reduced in size (never below 640 px, shape kept) until it does.",
    "A pixel bomb is handled quickly and safely; over-the-ceiling pictures, non-images, empty and over-30-MB uploads get clear refusals (413 / 415 / 400 / 413).",
    "Five big uploads at once all succeed and the server stays healthy.",
    "The platform's compression settings are applied to the next upload; only the platform owner can change them, within the allowed ranges.",
  ],
  expectNot: [
    "A stored picture must NOT keep the uploader's hidden metadata (author, camera, location).",
    "A picture must NOT be stored larger than the target while there is room to make it smaller.",
    "A tiny file that expands into hundreds of megapixels must NOT stall or crash the server.",
    "Someone not signed in, or without menu rights, must NOT be able to upload.",
    "The uploader must NOT be able to choose the stored file's name or folder outside the store's own.",
  ],
};

export const run = (d) => runSuite(d, "image-compression.mjs");
