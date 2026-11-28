import { DEFAULT_SCREENSHOT_INTRO, SCREENSHOT_DEVICES, SCREENSHOT_LIMITS, SCREENSHOT_THEMES, defaultScreenshotHeading, screenshotCreateSchema, screenshotDeviceSchema, screenshotPatchSchema, screenshotSectionSchema, screenshotThemeSchema } from "@rasoipulse/config-schema";
import { AppModel, AppShotModel } from "@rasoipulse/db";
import { env } from "../../env.js";
import { logger } from "../../logger.js";
import { HttpError } from "../../middleware/error.js";
import { notifyWebsite } from "../site/revalidate.js";
import { putFile, putImage, removeObject } from "../storage/storage.service.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BUILTIN_APP_SHOTS } from "./app-shots-builtin.js";
import { getApp, invalidateApps } from "./app-registry.js";

/**
 * The screenshots on an app's page of the website, managed in the console (App Management → the app's tab → Screenshots).
 * A screenshot is a screen of the app (title, caption, description) with up to six pictures: devices × light / dark. See config-schema/app-screenshots.js.
 * The pictures taken from the real apps by mobile-apps/screenshots live in apps/api/assets/app-screens as source files. The first time an app's list is read they are
 * COPIED INTO THE PLATFORM'S STORAGE — the Cloudflare R2 bucket (or whatever the console's Storage page has configured), never served from a disk — and recorded as
 * the app's screenshots; from then on the console owns the list: anything can be edited, replaced, hidden or removed, and new screenshots added.
 */

/** pictures are stored and removed in the same place the website's own images go */
const IMAGE_CTX = { brandId: "platform", outletId: "website" };

const imageOf = (v) => (v && typeof v.src === "string" && v.src ? v : null);
const slotsOf = (images = {}) => {
  const out = {};
  for (const d of SCREENSHOT_DEVICES) for (const t of SCREENSHOT_THEMES) {
    const v = imageOf(images?.[d]?.[t]);
    if (v) (out[d] ??= {})[t] = v;
  }
  return out;
};

/* ------------------------------------------------------------------ the built-in pictures, copied into storage once */

/** where the source pictures are (they are code, like an icon: only ever read from here to be put into storage) */
const ASSETS = fileURLToPath(new URL("../../../assets/app-screens/", import.meta.url));
/** 2 = the pictures are in the platform's storage (1 was the website's own disk, which this version moves away from) */
export const SEED_VERSION = 2;

/** one source picture → the platform's storage (R2 when that is what the console configured) */
async function storeBuiltIn(fileName) {
  if (!/^[a-z0-9._-]+\.webp$/i.test(String(fileName))) throw new Error(`not a built-in picture name: ${fileName}`);
  const body = await fs.readFile(path.join(ASSETS, path.basename(fileName)));
  const put = await putFile(IMAGE_CTX, { body, contentType: "image/webp", kind: "app-screens", ext: "webp" });
  return { src: put.url, key: put.key };
}

const inFlight = new Map();
const coolingDown = new Map();
const RETRY_AFTER_MS = 60_000;
/** forget that copying failed a moment ago, so the next read tries again at once (the seed script and the tests use this) */
export const retrySeedingNow = (slug) => coolingDown.delete(slug);

/**
 * Copy the built-in pictures of an app into the platform's storage and record them, once per app (safe to run again and from several processes at once: a screenshot
 * is found by its built-in name). Anything an admin removed stays removed. Pictures an earlier version left as paths on the website's disk ("/app-screens/…") are moved
 * into storage too. If storage can't take them (not set up, a picture file missing) nothing is half-recorded as done: it is logged and tried again a minute later.
 */
export function ensureShotsSeeded(slug) {
  if (!inFlight.has(slug)) inFlight.set(slug, seed(slug).finally(() => inFlight.delete(slug)));
  return inFlight.get(slug);
}

async function seed(slug) {
  const app = await getApp(slug);
  if (!app || app.shotsSeedVersion >= SEED_VERSION) return;
  if (Date.now() < (coolingDown.get(slug) ?? 0)) return;
  const builtin = BUILTIN_APP_SHOTS[slug] ?? [];
  try {
    let order = 0;
    for (const b of builtin) {
      order += 10;
      const row = await AppShotModel.findOne({ app: slug, builtInName: b.name });
      if (!row) {
        const stored = [];
        try {
          const images = {};
          for (const [device, byTheme] of Object.entries(b.images ?? {})) for (const [theme, im] of Object.entries(byTheme)) {
            const f = await storeBuiltIn(im.file);
            stored.push(f.key);
            (images[device] ??= {})[theme] = { ...f, width: im.width, height: im.height };
          }
          await AppShotModel.create({ app: slug, builtInName: b.name, title: b.title, caption: b.caption ?? "", alt: b.alt ?? "", order, enabled: true, images });
        } catch (e) {
          for (const k of stored) await removeObject(IMAGE_CTX, k); // nothing is left behind by a screenshot that didn't get recorded
          if (e?.code === 11000) continue; // another process recorded it first
          throw e;
        }
      } else {
        // pictures recorded by the earlier version as paths on the website's disk: put them in storage and point at them
        const images = row.images ?? {};
        let moved = false;
        for (const [device, byTheme] of Object.entries(images)) for (const [theme, im] of Object.entries(byTheme ?? {})) {
          if (!im || im.key || typeof im.src !== "string" || !im.src.startsWith("/app-screens/")) continue;
          const f = await storeBuiltIn(path.basename(im.src));
          images[device][theme] = { ...im, ...f };
          moved = true;
        }
        if (moved) await AppShotModel.updateOne({ _id: row._id }, { $set: { images } });
      }
    }
    await AppModel.updateOne({ slug }, { $set: { shotsSeeded: true, shotsSeedVersion: SEED_VERSION } });
    invalidateApps();
  } catch (e) {
    coolingDown.set(slug, Date.now() + RETRY_AFTER_MS);
    logger.warn({ err: e, app: slug }, "could not copy the built-in screenshots into storage; will try again in a minute");
  }
}

/* ------------------------------------------------------------------ what the website reads */

/**
 * The section for an app's page, or null when there is nothing to show (switched off, or no screenshot has a picture). Only shown screenshots with at least one
 * picture; the devices listed are the ones that have a picture somewhere. No internal fields.
 */
export async function publicScreens(slug) {
  await ensureShotsSeeded(slug);
  const app = await getApp(slug);
  if (!app || !app.shotsEnabled) return null;
  const rows = await AppShotModel.find({ app: slug, enabled: true }).sort({ order: 1, createdAt: 1 }).lean();
  const shots = rows
    .map((r) => ({
      id: String(r._id),
      title: r.title,
      caption: r.caption ?? "",
      alt: r.alt ?? "",
      images: Object.fromEntries(Object.entries(slotsOf(r.images)).map(([d, byTheme]) => [d, Object.fromEntries(Object.entries(byTheme).map(([t, v]) => [t, { src: v.src, width: v.width ?? 0, height: v.height ?? 0 }]))])),
    }))
    .filter((s) => Object.keys(s.images).length);
  if (!shots.length) return null;
  const devices = SCREENSHOT_DEVICES.filter((d) => shots.some((s) => s.images[d]));
  const defaultDevice = devices.includes(app.shotsDefaultDevice) ? app.shotsDefaultDevice : devices[0];
  return { heading: app.shotsHeading || defaultScreenshotHeading(app.code), intro: app.shotsIntro || DEFAULT_SCREENSHOT_INTRO, defaultDevice, devices, shots };
}

/* ------------------------------------------------------------------ what the console reads */

const adminShape = (r) => ({
  id: String(r._id),
  title: r.title,
  caption: r.caption ?? "",
  alt: r.alt ?? "",
  enabled: r.enabled !== false,
  builtIn: Boolean(r.builtInName),
  order: r.order ?? 0,
  images: Object.fromEntries(Object.entries(slotsOf(r.images)).map(([d, byTheme]) => [d, Object.fromEntries(Object.entries(byTheme).map(([t, v]) => [t, { src: v.src, width: v.width ?? 0, height: v.height ?? 0, uploaded: Boolean(v.key) }]))])),
  updatedAt: r.updatedAt ?? null,
});

export async function listScreenshots(slug) {
  await ensureShotsSeeded(slug);
  const app = await getApp(slug);
  if (!app) throw new HttpError(404, "That app doesn't exist.");
  const rows = await AppShotModel.find({ app: slug }).sort({ order: 1, createdAt: 1 }).lean();
  return {
    section: { enabled: app.shotsEnabled, heading: app.shotsHeading, intro: app.shotsIntro, defaultDevice: app.shotsDefaultDevice, usualHeading: defaultScreenshotHeading(app.code), usualIntro: DEFAULT_SCREENSHOT_INTRO },
    limits: { ...SCREENSHOT_LIMITS },
    shots: rows.map(adminShape),
  };
}

/** How many screenshots an app has (for the console's list of apps). */
export async function shotCounts() {
  const rows = await AppShotModel.aggregate([{ $group: { _id: "$app", n: { $sum: 1 }, shown: { $sum: { $cond: ["$enabled", 1, 0] } } } }]);
  return Object.fromEntries(rows.map((r) => [r._id, { total: r.n, shown: r.shown }]));
}

/* ------------------------------------------------------------------ changing them */

const changed = () => notifyWebsite();
const bad = (parsed, fallback) => new HttpError(400, parsed.error.issues[0]?.message ?? fallback);
const byId = async (id) => {
  if (!/^[a-f\d]{24}$/i.test(String(id))) throw new HttpError(404, "That screenshot doesn't exist.");
  const row = await AppShotModel.findById(id);
  if (!row) throw new HttpError(404, "That screenshot doesn't exist.");
  return row;
};

export async function saveSection(slug, input, user) {
  const app = await getApp(slug);
  if (!app) throw new HttpError(404, "That app doesn't exist.");
  const parsed = screenshotSectionSchema.safeParse(input ?? {});
  if (!parsed.success) throw bad(parsed, "Check the section's words.");
  const b = parsed.data;
  if (!Object.keys(b).length) throw new HttpError(400, "Nothing to change.");
  const set = { updatedBy: String(user?._id ?? "") };
  if (b.enabled !== undefined) set.shotsEnabled = b.enabled;
  if (b.heading !== undefined) set.shotsHeading = b.heading;
  if (b.intro !== undefined) set.shotsIntro = b.intro;
  if (b.defaultDevice !== undefined) set.shotsDefaultDevice = b.defaultDevice;
  await ensureShotsSeeded(slug);
  await AppModel.updateOne({ slug }, { $set: set });
  invalidateApps();
  changed();
  return listScreenshots(slug);
}

export async function createShot(slug, input, user) {
  const app = await getApp(slug);
  if (!app) throw new HttpError(404, "That app doesn't exist.");
  const parsed = screenshotCreateSchema.safeParse(input ?? {});
  if (!parsed.success) throw bad(parsed, "Check the screenshot's words.");
  await ensureShotsSeeded(slug);
  const count = await AppShotModel.countDocuments({ app: slug });
  if (count >= SCREENSHOT_LIMITS.shotsPerApp) throw new HttpError(409, `An app can have ${SCREENSHOT_LIMITS.shotsPerApp} screenshots at most. Remove one first.`);
  const last = await AppShotModel.findOne({ app: slug }).sort({ order: -1 }).select("order").lean();
  const row = await AppShotModel.create({ app: slug, ...parsed.data, order: (last?.order ?? 0) + 10, enabled: true, images: {}, createdBy: String(user?._id ?? ""), updatedBy: String(user?._id ?? "") });
  changed();
  return { shot: adminShape(row.toObject()) };
}

export async function updateShot(id, input, user) {
  const row = await byId(id);
  const parsed = screenshotPatchSchema.safeParse(input ?? {});
  if (!parsed.success) throw bad(parsed, "Check the screenshot's words.");
  if (!Object.keys(parsed.data).length) throw new HttpError(400, "Nothing to change.");
  Object.assign(row, parsed.data, { updatedBy: String(user?._id ?? "") });
  await row.save();
  changed();
  return { shot: adminShape(row.toObject()) };
}

/** every uploaded file a screenshot holds (the ones that ship with the website have no `key`) */
const keysOf = (images = {}) => SCREENSHOT_DEVICES.flatMap((d) => SCREENSHOT_THEMES.map((t) => images?.[d]?.[t]?.key)).filter(Boolean);

export async function deleteShot(id) {
  const row = await byId(id);
  const keys = keysOf(row.images);
  await row.deleteOne();
  for (const k of keys) await removeObject(IMAGE_CTX, k);
  changed();
  return { ok: true };
}

/** put the screenshots in this order: `ids` lists every id of the app (a missing one keeps its place after them) */
export async function reorderShots(slug, ids, user) {
  if (!(await getApp(slug))) throw new HttpError(404, "That app doesn't exist.");
  if (!Array.isArray(ids) || ids.some((x) => typeof x !== "string")) throw new HttpError(400, "Send the ids of the screenshots, in the order you want.");
  const rows = await AppShotModel.find({ app: slug }).sort({ order: 1, createdAt: 1 }).select("_id").lean();
  const have = rows.map((r) => String(r._id));
  const wanted = ids.filter((x, i) => have.includes(x) && ids.indexOf(x) === i);
  const order = [...wanted, ...have.filter((x) => !wanted.includes(x))];
  await AppShotModel.bulkWrite(order.map((x, i) => ({ updateOne: { filter: { _id: x }, update: { $set: { order: (i + 1) * 10, updatedBy: String(user?._id ?? "") } } } })));
  changed();
  return listScreenshots(slug);
}

/** Store a picture (resized and re-encoded like every image the platform stores) in one slot of a screenshot; the picture that was there is removed from storage. */
export async function setImage(id, device, theme, body, user) {
  const d = screenshotDeviceSchema.safeParse(device);
  const t = screenshotThemeSchema.safeParse(theme);
  if (!d.success) throw bad(d, "Choose a device.");
  if (!t.success) throw bad(t, "Choose light or dark.");
  const row = await byId(id);
  if (!body?.length) throw new HttpError(400, "Send the picture as the request body.");
  const put = await putImage(IMAGE_CTX, { body, kind: "app-screens" });
  const old = row.images?.[d.data]?.[t.data]?.key;
  await AppShotModel.updateOne({ _id: row._id }, { $set: { [`images.${d.data}.${t.data}`]: { src: put.url, key: put.key, width: put.width, height: put.height }, updatedBy: String(user?._id ?? "") } });
  if (old && old !== put.key) await removeObject(IMAGE_CTX, old);
  changed();
  const fresh = await AppShotModel.findById(row._id).lean();
  return { shot: adminShape(fresh) };
}

export async function removeImage(id, device, theme, user) {
  const d = screenshotDeviceSchema.safeParse(device);
  const t = screenshotThemeSchema.safeParse(theme);
  if (!d.success) throw bad(d, "Choose a device.");
  if (!t.success) throw bad(t, "Choose light or dark.");
  const row = await byId(id);
  if (!imageOf(row.images?.[d.data]?.[t.data])) throw new HttpError(404, "There is no picture in that place.");
  const key = row.images[d.data][t.data].key;
  await AppShotModel.updateOne({ _id: row._id }, { $unset: { [`images.${d.data}.${t.data}`]: "" }, $set: { updatedBy: String(user?._id ?? "") } });
  if (key) await removeObject(IMAGE_CTX, key);
  changed();
  const fresh = await AppShotModel.findById(row._id).lean();
  return { shot: adminShape(fresh) };
}

/** an app that is being removed takes its screenshots (and the pictures that were uploaded for them) with it */
export async function deleteShotsOf(slug) {
  const rows = await AppShotModel.find({ app: slug }).lean();
  await AppShotModel.deleteMany({ app: slug });
  for (const r of rows) for (const k of keysOf(r.images)) await removeObject(IMAGE_CTX, k).catch((e) => logger.warn({ err: e }, "could not remove a screenshot file"));
}
