import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { APPS_WITH_LIVE, APP_CATALOG, APP_REFRESH, appLiveModeInputSchema, DEFAULT_APP, appCreateSchema, appPagePath, appPatchSchema, appReleaseInputSchema, appSettingsInputSchema, appReleasePatchSchema, codeFromAppName, decideUpdate, slugifyAppName, versionCodeOf, MAX_APK_MB } from "@rasoipulse/config-schema";
import { AppModel, AppReleaseModel, AppSettingModel } from "@rasoipulse/db";
import { env, publicApiUrl } from "../../env.js";
import { logger } from "../../logger.js";
import { HttpError } from "../../middleware/error.js";
import { notifyWebsite } from "../site/revalidate.js";
import { getApp, invalidateApps, isKnownApp, loadApps } from "./app-registry.js";
import { openStoredFile, putLargeFile, removePlatformFile } from "../storage/storage.service.js";
import { deleteShotsOf, publicScreens } from "./app-screenshots.service.js";

/**
 * The staff app's releases: the APK files, the records about them, and the decision "does this phone have to update?". The files live in
 * the platform's storage (console → Storage: this server's disk or the S3/R2 bucket), like every other file; here on disk there is only
 * a scratch folder for uploads in progress. Uploads come in 4 MB pieces (one request each) so a 100 MB file never needs a bigger limit
 * in nginx or Cloudflare, and an interrupted upload can be resumed.
 */

export const CHUNK_SIZE = 4 * 1024 * 1024;
const PLATFORM = "android";
const STALE_UPLOAD_MS = 24 * 60 * 60 * 1000;

/** scratch space for uploads in progress (the finished file goes to the platform storage and is removed from here) */
const root = () => path.resolve(env.APP_RELEASES_DIR || ".app-releases");
const partsDir = () => path.join(root(), ".parts");
const maxBytes = () => Math.min(env.APP_RELEASE_MAX_MB, MAX_APK_MB * 7) * 1024 * 1024;

/** where phones are sent to download: the website's app page */
export const pageUrl = (app = DEFAULT_APP) => `${(env.WEBSITE_URL || "").replace(/\/$/, "")}${appPagePath(app)}`;

/** Which app is asking: the `x-app-id` header (every app sends it); the first OMA builds sent nothing, so that means OMA. */
export const appOfRequest = async (req) => { const id = String(req.header?.("x-app-id") ?? ""); return (await isKnownApp(id)) ? id : DEFAULT_APP; };
const downloadUrl = (r) => `${publicApiUrl}/api/app-updates/download/${r._id ?? r.id}`;

/* ------------------------------------------------------------------ shapes */

const adminShape = (r) => ({
  id: String(r._id),
  app: r.app,
  platform: r.platform,
  version: r.version,
  versionCode: r.versionCode,
  notes: r.notes ?? "",
  force: Boolean(r.force),
  status: r.status,
  fileName: r.file?.name ?? "",
  size: r.file?.size ?? 0,
  sha256: r.file?.sha256 ?? "",
  downloads: r.downloads ?? 0,
  downloadUrl: downloadUrl(r),
  publishedAt: r.publishedAt ?? null,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

/** what a phone or the website may see: no internal fields */
const publicShape = (r) => ({
  id: String(r._id ?? r.id),
  version: r.version,
  versionCode: r.versionCode,
  notes: r.notes ?? "",
  force: Boolean(r.force),
  publishedAt: r.publishedAt ?? null,
  size: r.file?.size ?? r.size ?? 0,
  sha256: r.file?.sha256 ?? r.sha256 ?? "",
  downloadUrl: downloadUrl(r),
});

const publishedOf = async (app = DEFAULT_APP) => AppReleaseModel.find({ app, platform: PLATFORM, status: "published" }).sort({ versionCode: -1 }).lean();

/* ------------------------------------------------------------------ the phone's question */

/** The answer to "is there a newer version than build `versionCode`?" — what the app shows at start. Public. */
export async function checkForUpdate({ app = DEFAULT_APP, versionCode }) {
  if (!(await isKnownApp(app))) throw new HttpError(404, "That app doesn't exist.");
  const releases = await publishedOf(app);
  const d = decideUpdate(versionCode, releases);
  return {
    updateAvailable: d.updateAvailable,
    force: d.force,
    latest: d.latest ? publicShape(d.latest) : null,
    whatsNew: d.whatsNew,
    pageUrl: pageUrl(app),
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Refuses the app's sign-in when this build is too old AND a newer release is marked "force" — the second wall behind the app's own
 * screen: an old build that skips the check still can't get in. A request with no build number (the dashboard, an old app) is let through.
 */
export async function assertAppCurrent(req) {
  const app = await appOfRequest(req);
  // the build number: `x-app-version-code` (every app); the first OMA builds sent `x-oma-version-code`
  const code = Number.parseInt(String(req.header("x-app-version-code") ?? req.header("x-oma-version-code") ?? ""), 10);
  if (!(code > 0)) return;
  const d = decideUpdate(code, await publishedOf(app));
  if (d.updateAvailable && d.force) {
    throw new HttpError(426, "This version of the app is out of date. Please update the app to continue.", { code: "update_required", pageUrl: pageUrl(app), latest: d.latest ? publicShape(d.latest) : null });
  }
}

/** For the website's app page: the newest release and the history. Public. */
export async function publicReleases({ app = DEFAULT_APP, limit = 20 } = {}) {
  const meta = await getApp(app);
  if (!meta) throw new HttpError(404, "That app doesn't exist.");
  const releases = await publishedOf(app);
  return { latest: releases[0] ? publicShape(releases[0]) : null, releases: releases.slice(0, limit).map(publicShape), pageUrl: pageUrl(app), app: { ...publicApp(meta), listed: meta.isPublic }, screens: await publicScreens(app) };
}

/** An app as the website and the phones may read it (no internal fields). */
const publicApp = (a) => ({ id: a.slug, slug: a.slug, code: a.code, name: a.name, tagline: a.tagline, audience: a.audience, description: a.description, usesRefreshInterval: a.usesRefreshInterval });

/** Is this app in the website's public list? (The console's choice: App Management → Public / Private.) */
export async function isListed(app) {
  return Boolean((await getApp(app))?.isPublic);
}

/**
 * Every PUBLIC app with its newest published version — for the website's /apps page. A private app (the Admin app, say) is not in this list at
 * all; its own page (/apps/<slug>) still opens for anyone who has the link, so a team can download it. Public.
 */
export async function publicApps() {
  const apps = [];
  for (const a of (await loadApps()).filter((x) => x.isPublic)) {
    const [latest] = await publishedOf(a.slug);
    apps.push({ ...publicApp(a), listed: true, page: appPagePath(a.slug), latest: latest ? publicShape(latest) : null });
  }
  return { apps };
}

/* ------------------------------------------------------------------ downloads */

/** The file of a PUBLISHED release, or a 404. */
export async function downloadable(id) {
  if (!/^[a-f\d]{24}$/i.test(String(id))) throw new HttpError(404, "That download doesn't exist.");
  const r = await AppReleaseModel.findOne({ _id: id, status: "published" }).lean();
  if (!r?.file?.key) throw new HttpError(404, "That download isn't available.");
  return { filename: `rasoi-pulse-${r.app ?? DEFAULT_APP}-${r.version}.apk`, release: r };
}

/** The file of a release from the platform storage (a disk path, or a stream from the bucket); 404 when it has gone missing. */
export async function openRelease(release, range) {
  const src = await openStoredFile({ key: release.file.key, range });
  if (!src) {
    logger.error({ id: String(release._id), key: release.file.key }, "app release file is missing from the storage");
    throw new HttpError(404, "That download isn't available right now.");
  }
  return src;
}

export const countDownload = (id) => void AppReleaseModel.updateOne({ _id: id }, { $inc: { downloads: 1 } }).catch(() => undefined);

/* ------------------------------------------------------------------ the console */

export async function listReleases(app = DEFAULT_APP) {
  const meta = await getApp(app);
  if (!meta) throw new HttpError(404, "That app doesn't exist.");
  const rows = await AppReleaseModel.find({ app, platform: PLATFORM }).sort({ versionCode: -1 }).lean();
  const published = rows.filter((r) => r.status === "published");
  // "apps older than this must update": the newest published release that is forced
  const forcedBelow = published.filter((r) => r.force).sort((a, b) => b.versionCode - a.versionCode)[0] ?? null;
  return {
    releases: rows.map(adminShape),
    latest: published[0] ? adminShape(published[0]) : null,
    forcedBelow: forcedBelow ? { version: forcedBelow.version, versionCode: forcedBelow.versionCode } : null,
    pageUrl: pageUrl(app),
    app: { ...publicApp(meta), listed: meta.isPublic, builtIn: meta.builtIn },
    chunkSize: CHUNK_SIZE,
    maxBytes: maxBytes(),
  };
}

export async function updateRelease(id, patch, user) {
  const body = appReleasePatchSchema.parse(patch);
  const r = await AppReleaseModel.findById(id);
  if (!r) throw new HttpError(404, "Release not found");
  if (body.notes !== undefined) r.notes = body.notes;
  if (body.force !== undefined) r.force = body.force;
  if (body.status !== undefined && body.status !== r.status) {
    r.status = body.status;
    if (body.status === "published" && !r.publishedAt) r.publishedAt = new Date();
  }
  r.updatedBy = String(user._id);
  await r.save();
  notifyWebsite();
  return adminShape(r.toObject());
}

export async function deleteRelease(id) {
  const r = await AppReleaseModel.findById(id);
  if (!r) throw new HttpError(404, "Release not found");
  const key = r.file?.key;
  await r.deleteOne();
  if (key) await removePlatformFile(key);
  notifyWebsite();
}

/* ------------------------------------------------------------------ uploads (4 MB pieces) */

const uploads = new Map(); // id → { id, app, name, size, chunks, received:Set, by, at }
const chunkCount = (size) => Math.ceil(size / CHUNK_SIZE);
const metaFile = (id) => path.join(partsDir(), `${id}.json`);
const partFile = (id) => path.join(partsDir(), `${id}.part`);
const validId = (id) => /^[a-f\d]{24}$/.test(String(id));

async function loadUpload(id) {
  if (!validId(id)) throw new HttpError(404, "That upload doesn't exist (or it was cleared). Start it again.");
  const known = uploads.get(id);
  if (known) return known;
  try {
    const m = JSON.parse(await fsp.readFile(metaFile(id), "utf8"));
    const u = { ...m, received: new Set(m.received ?? []) };
    uploads.set(id, u);
    return u;
  } catch {
    throw new HttpError(404, "That upload doesn't exist (or it was cleared). Start it again.");
  }
}

const saveMeta = (u) => fsp.writeFile(metaFile(u.id), JSON.stringify({ ...u, received: [...u.received] }));

async function clearStaleUploads() {
  try {
    for (const name of await fsp.readdir(partsDir())) {
      const f = path.join(partsDir(), name);
      const st = await fsp.stat(f);
      if (Date.now() - st.mtimeMs > STALE_UPLOAD_MS) {
        await fsp.rm(f, { force: true });
        uploads.delete(name.split(".")[0]);
      }
    }
  } catch { /* nothing to clear */ }
}

export async function startUpload({ fileName, size, app = DEFAULT_APP }, user) {
  if (!(await isKnownApp(app))) throw new HttpError(400, "Choose which app this file is for.");
  const name = String(fileName ?? "").trim();
  if (!/^[\w.\- ()]{1,120}\.apk$/i.test(name)) throw new HttpError(400, "Choose an .apk file.");
  if (!Number.isInteger(size) || size < 1024) throw new HttpError(400, "That file is empty or too small to be an app.");
  if (size > maxBytes()) throw new HttpError(413, `That file is too big. The most allowed is ${Math.round(maxBytes() / 1024 / 1024)} MB.`);
  await fsp.mkdir(partsDir(), { recursive: true });
  await clearStaleUploads();
  const id = randomBytes(12).toString("hex");
  const u = { id, app, name, size, chunks: chunkCount(size), received: new Set(), by: String(user._id), at: Date.now() };
  uploads.set(id, u);
  await saveMeta(u);
  return { uploadId: id, chunkSize: CHUNK_SIZE, chunks: u.chunks };
}

/** One piece, written at its place in the file (so a repeated piece just rewrites the same bytes). */
export async function putChunk(id, index, body) {
  const u = await loadUpload(id);
  if (!Number.isInteger(index) || index < 0 || index >= u.chunks) throw new HttpError(400, "That piece number isn't part of this file.");
  const expected = index < u.chunks - 1 ? CHUNK_SIZE : u.size - (u.chunks - 1) * CHUNK_SIZE;
  if (!Buffer.isBuffer(body) || body.length !== expected) throw new HttpError(400, `Piece ${index + 1} should be ${expected} bytes but ${Buffer.isBuffer(body) ? body.length : 0} arrived. Try again.`);
  const handle = await fsp.open(partFile(id), fs.constants.O_RDWR | fs.constants.O_CREAT, 0o640);
  try {
    await handle.write(body, 0, body.length, index * CHUNK_SIZE);
  } finally {
    await handle.close();
  }
  u.received.add(index);
  await saveMeta(u);
  return { received: u.received.size, of: u.chunks };
}

/** Is this really an Android package? A zip file with an AndroidManifest.xml in it. (Not a signature check — a sanity check.) */
export async function inspectApk(file) {
  const handle = await fsp.open(file, "r");
  try {
    const { size } = await handle.stat();
    const head = Buffer.alloc(4);
    await handle.read(head, 0, 4, 0);
    if (head.readUInt32LE(0) !== 0x04034b50) return { ok: false, why: "That file isn't an APK (it isn't a zip archive)." };
    const tailLen = Math.min(size, 66 * 1024);
    const tail = Buffer.alloc(tailLen);
    await handle.read(tail, 0, tailLen, size - tailLen);
    let eocd = -1;
    for (let i = tailLen - 22; i >= 0; i--) if (tail.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) return { ok: false, why: "That file looks damaged: the archive has no end." };
    const entries = tail.readUInt16LE(eocd + 10);
    const cdSize = tail.readUInt32LE(eocd + 12);
    const cdOffset = tail.readUInt32LE(eocd + 16);
    if (cdSize > 32 * 1024 * 1024 || cdOffset + cdSize > size) return { ok: false, why: "That file looks damaged: its contents list is wrong." };
    const cd = Buffer.alloc(cdSize);
    await handle.read(cd, 0, cdSize, cdOffset);
    const names = [];
    for (let pos = 0, n = 0; n < entries && pos + 46 <= cd.length; n++) {
      if (cd.readUInt32LE(pos) !== 0x02014b50) break;
      const nameLen = cd.readUInt16LE(pos + 28);
      const extraLen = cd.readUInt16LE(pos + 30);
      const commentLen = cd.readUInt16LE(pos + 32);
      names.push(cd.toString("utf8", pos + 46, pos + 46 + nameLen));
      pos += 46 + nameLen + extraLen + commentLen;
    }
    if (!names.includes("AndroidManifest.xml")) return { ok: false, why: "That zip file isn't an Android app (no AndroidManifest.xml inside)." };
    return { ok: true };
  } finally {
    await handle.close();
  }
}

const sha256Of = (file) => new Promise((resolve, reject) => {
  const h = createHash("sha256");
  fs.createReadStream(file).on("data", (c) => h.update(c)).on("end", () => resolve(h.digest("hex"))).on("error", reject);
});

/** All pieces are in: check the file, store it under its fingerprint and record the release (a draft, or published straight away). */
export async function completeUpload(id, input, user) {
  const body = appReleaseInputSchema.parse(input);
  const u = await loadUpload(id);
  const missing = [...Array(u.chunks).keys()].filter((i) => !u.received.has(i));
  if (missing.length) throw new HttpError(409, `${missing.length} piece${missing.length === 1 ? "" : "s"} of the file didn't arrive. Upload again to resume.`, { code: "upload_incomplete", missing: missing.slice(0, 50) });
  const part = partFile(id);
  const stat = await fsp.stat(part).catch(() => null);
  if (!stat || stat.size !== u.size) throw new HttpError(409, "The uploaded file is not the size it should be. Start the upload again.", { code: "upload_incomplete" });

  const versionCode = versionCodeOf(body.version);
  // the file was uploaded FOR an app; the version the admin types must be that app's (a different `app` in the body is a mistake)
  const app = (await isKnownApp(u.app)) ? u.app : DEFAULT_APP;
  if (body.app && body.app !== app) throw new HttpError(400, `This file was uploaded for ${(await getApp(app))?.name ?? app}, not ${(await getApp(body.app))?.name ?? body.app}.`);
  if (await AppReleaseModel.exists({ app, platform: PLATFORM, versionCode })) throw new HttpError(409, `Version ${body.version} (build ${versionCode}) already exists. Each build number can be used once.`);
  const apk = await inspectApk(part);
  if (!apk.ok) throw new HttpError(400, apk.why);

  const sha256 = await sha256Of(part);
  // the finished file goes to the platform storage (disk or bucket). If that fails the pieces stay here, so nothing has to be sent again
  const key = `app-releases/${app}/${body.version}-${randomBytes(6).toString("hex")}.apk`;
  await putLargeFile({ key, filePath: part, size: u.size, sha256, contentType: "application/vnd.android.package-archive" });
  await fsp.rm(part, { force: true });
  await fsp.rm(metaFile(id), { force: true });
  uploads.delete(id);

  return recordRelease({ app, body, versionCode, name: u.name, size: u.size, key, sha256, user });
}

/** Save the record of a release whose file is already in the platform storage; if saving fails the stored file is removed again. */
async function recordRelease({ app, body, versionCode, name, size, key, sha256, user }) {
  let r;
  try {
    r = await AppReleaseModel.create({
      app, platform: PLATFORM, version: body.version, versionCode, notes: body.notes, force: body.force,
      status: body.publish ? "published" : "draft", publishedAt: body.publish ? new Date() : null,
      file: { name, key, size, sha256 }, createdBy: String(user._id), updatedBy: String(user._id),
    });
  } catch (e) {
    await removePlatformFile(key);
    if (e?.code === 11000) throw new HttpError(409, `Version ${body.version} already exists.`);
    throw e;
  }
  if (body.publish) notifyWebsite();
  return adminShape(r.toObject());
}

/**
 * Add a release from an APK file that is already on this machine (the same checks and the same storage as the console's upload, which sends the file in pieces).
 * Used by apps/api/src/scripts/publish-app-release.js when the file is too big to push through a browser session or the admin isn't at the console.
 */
export async function publishReleaseFromFile({ app, filePath, fileName, version, notes = "", force = false, publish = false }, user) {
  const body = appReleaseInputSchema.parse({ version, notes, force, publish });
  if (!(await isKnownApp(app))) throw new HttpError(404, "That app doesn't exist.");
  const stat = await fsp.stat(filePath).catch(() => null);
  if (!stat?.isFile() || !stat.size) throw new HttpError(400, "The file isn't there.");
  if (stat.size > maxBytes()) throw new HttpError(413, `That file is too big (the limit is ${Math.round(maxBytes() / 1024 / 1024)} MB).`);
  const versionCode = versionCodeOf(body.version);
  if (await AppReleaseModel.exists({ app, platform: PLATFORM, versionCode })) throw new HttpError(409, `Version ${body.version} (build ${versionCode}) already exists. Each build number can be used once.`);
  const apk = await inspectApk(filePath);
  if (!apk.ok) throw new HttpError(400, apk.why);
  const sha256 = await sha256Of(filePath);
  const key = `app-releases/${app}/${body.version}-${randomBytes(6).toString("hex")}.apk`;
  await putLargeFile({ key, filePath, size: stat.size, sha256, contentType: "application/vnd.android.package-archive" });
  return recordRelease({ app, body, versionCode, name: fileName ?? path.basename(filePath), size: stat.size, key, sha256, user });
}

/* ------------------------------------------------------------------ how often an app asks for new data */

/**
 * Every app request carries `x-app-id`, and every answer to it carries the app's refresh interval (see middleware/app-refresh.js), so the
 * numbers are read from here on every request. They live in memory for a few seconds: a change made in the console is seen at once by this
 * process (the cache is cleared on save) and within SETTINGS_TTL_MS by any other.
 */
const SETTINGS_TTL_MS = 15_000;
let settingsCache = { at: 0, map: /** @type {Record<string, number>} */ ({}) };

async function loadRefreshSeconds() {
  const rows = await AppSettingModel.find().lean();
  const map = {};
  for (const r of rows) map[r.app] = r.refreshSeconds;
  settingsCache = { at: Date.now(), map };
  return map;
}

/** Seconds between this app's asks for new data: the console's number, else the default. Never throws (a failing database must not stop a request). */
export async function refreshSecondsOf(app) {
  try {
    const map = Date.now() - settingsCache.at < SETTINGS_TTL_MS ? settingsCache.map : await loadRefreshSeconds();
    return map[app] ?? APP_REFRESH.default;
  } catch (e) {
    logger.warn({ err: e }, "could not read the app refresh settings; using what was known");
    return settingsCache.map[app] ?? APP_REFRESH.default;
  }
}

/** The console's list: every app with its words, whether it is public, its refresh interval (and whether that is the default), and its releases. */
export async function listAppSettings() {
  const map = await loadRefreshSeconds();
  const [apps, rows, releases] = await Promise.all([
    loadApps({ fresh: true }),
    AppSettingModel.find().lean(),
    AppReleaseModel.aggregate([{ $group: { _id: "$app", releases: { $sum: 1 }, downloads: { $sum: "$downloads" }, published: { $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] } }, latest: { $max: { $cond: [{ $eq: ["$status", "published"] }, "$versionCode", null] } } } }]),
  ]);
  const stamp = Object.fromEntries(rows.map((r) => [r.app, r.updatedAt]));
  const stats = Object.fromEntries(releases.map((r) => [r._id, r]));
  const latestRows = await AppReleaseModel.find({ status: "published" }).select("app version versionCode").sort({ versionCode: -1 }).lean();
  const latestOf = new Map();
  for (const r of latestRows) if (!latestOf.has(r.app)) latestOf.set(r.app, r.version);
  return {
    limits: { ...APP_REFRESH },
    settings: apps.map((a) => ({
      app: a.slug,
      code: a.code,
      name: a.name,
      tagline: a.tagline,
      audience: a.audience,
      description: a.description,
      builtIn: a.builtIn,
      // public = in the website's list of apps; `publicByDefault` is what a built-in app is when nothing was chosen (kept for the older console)
      public: a.isPublic,
      publicByDefault: a.builtIn ? APP_CATALOG[a.slug]?.listed !== false : false,
      usesRefreshInterval: a.usesRefreshInterval,
      // how the app gets new data: "websocket" (the live connection first, the timer as the backup) or "polling" (the timer only); only OMA, KDA and RDA can listen
      supportsLive: APPS_WITH_LIVE.includes(a.slug),
      liveMode: a.liveMode,
      pageUrl: pageUrl(a.slug),
      refreshSeconds: map[a.slug] ?? APP_REFRESH.default,
      // "the default" is about the number, not about whether it was ever saved: an admin who typed 8 is on the default too
      isDefault: (map[a.slug] ?? APP_REFRESH.default) === APP_REFRESH.default,
      updatedAt: stamp[a.slug] ?? a.updatedAt ?? null,
      releases: stats[a.slug]?.releases ?? 0,
      published: stats[a.slug]?.published ?? 0,
      downloads: stats[a.slug]?.downloads ?? 0,
      latestVersion: latestOf.get(a.slug) ?? null,
    })),
  };
}

const settingOf = async (app) => (await listAppSettings()).settings.find((x) => x.app === app);

/* ------------------------------------------------------------------ live connection or polling */

/** Who wants to know when an app's live mode changes (the realtime hub: it lets the app's open connections go when the app is switched to polling). */
const liveModeListeners = new Set();
export const onAppLiveModeChange = (fn) => { liveModeListeners.add(fn); return () => liveModeListeners.delete(fn); };

/**
 * Choose how an app gets new data: the live connection first ("websocket", the default) or no live connection at all ("polling"). Either way the app asks on its
 * Refresh interval when the live connection is not up, so polling is always the backup. Only the apps that can listen (OMA, KDA, RDA) have the choice.
 * Switching to "polling" lets that app's open connections go at once (they start asking on the timer straight away).
 */
export async function setAppLiveMode(app, input, user) {
  const meta = await getApp(app);
  if (!meta) throw new HttpError(404, "That app doesn't exist.");
  if (!APPS_WITH_LIVE.includes(app)) throw new HttpError(400, `${meta.name} doesn't use a live connection, so there is nothing to choose.`);
  const parsed = appLiveModeInputSchema.safeParse(input ?? {});
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Choose how the app gets new data.");
  const previous = meta.liveMode;
  await AppModel.updateOne({ slug: app }, { $set: { liveMode: parsed.data.liveMode, updatedBy: String(user?._id ?? "") } });
  invalidateApps();
  if (previous !== parsed.data.liveMode) for (const fn of liveModeListeners) { try { fn(app, parsed.data.liveMode, previous); } catch (e) { logger.warn({ err: e }, "live mode listener failed"); } }
  return { setting: await settingOf(app) };
}

/** Make an app public (listed on the website) or private (not listed; its page still opens for anyone with the link). */
export async function setAppVisibility(app, isPublic, user) {
  if (!(await isKnownApp(app))) throw new HttpError(404, "That app doesn't exist.");
  if (typeof isPublic !== "boolean") throw new HttpError(400, "Say whether the app is public (true) or private (false).");
  await AppModel.updateOne({ slug: app }, { $set: { isPublic, updatedBy: String(user?._id ?? "") } });
  invalidateApps();
  notifyWebsite(); // the website's list and home page change at once, not in five minutes
  return { setting: await settingOf(app) };
}

export async function saveAppSettings(app, input, user) {
  if (!(await isKnownApp(app))) throw new HttpError(404, "That app doesn't exist.");
  const parsed = appSettingsInputSchema.safeParse(input);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Check the refresh interval.");
  await AppSettingModel.findOneAndUpdate({ app }, { $set: { refreshSeconds: parsed.data.refreshSeconds, updatedBy: String(user?._id ?? "") } }, { upsert: true, new: true });
  settingsCache = { at: 0, map: {} }; // the next request reads the new number
  return { setting: await settingOf(app) };
}

/* ------------------------------------------------------------------ adding, editing and removing apps (the console) */

/** Add an app: a name (and optionally an address, a code, the words for its page); it starts PRIVATE unless told otherwise. */
export async function createApp(input, user) {
  const parsed = appCreateSchema.safeParse(input ?? {});
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Check the app's details.");
  const b = parsed.data;
  const slug = b.slug ?? slugifyAppName(b.name);
  if (slug.length < 2) throw new HttpError(400, "The name needs letters or numbers so an address can be made from it. Type an address yourself.");
  const code = b.code ?? codeFromAppName(b.name);
  if (!/^[A-Z0-9]{2,5}$/.test(code)) throw new HttpError(400, "Give the app a code of 2 to 5 letters or numbers.");
  if (await getApp(slug)) throw new HttpError(409, `There is already an app at the address “${slug}”. Choose another address.`);
  const last = (await loadApps({ fresh: true })).at(-1);
  try {
    await AppModel.create({
      slug, name: b.name, code, tagline: b.tagline, audience: b.audience, description: b.description, isPublic: b.isPublic, usesRefreshInterval: b.usesRefreshInterval,
      builtIn: false, sortOrder: (last?.sortOrder ?? 0) + 10, createdBy: String(user?._id ?? ""), updatedBy: String(user?._id ?? ""),
    });
  } catch (e) {
    if (e?.code === 11000) throw new HttpError(409, `There is already an app at the address “${slug}”. Choose another address.`);
    throw e;
  }
  invalidateApps();
  notifyWebsite();
  return { setting: await settingOf(slug) };
}

/** Change an app's words (and whether it uses the refresh interval). The address and the built-in sign-in rules never change. */
export async function updateApp(slug, input, user) {
  if (!(await isKnownApp(slug))) throw new HttpError(404, "That app doesn't exist.");
  const parsed = appPatchSchema.safeParse(input ?? {});
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Check the app's details.");
  const set = { ...parsed.data, updatedBy: String(user?._id ?? "") };
  if (!Object.keys(parsed.data).length) throw new HttpError(400, "Nothing to change.");
  await AppModel.updateOne({ slug }, { $set: set });
  invalidateApps();
  notifyWebsite();
  return { setting: await settingOf(slug) };
}

/**
 * Remove an app added in the console. A built-in app can't be removed (the code knows it), and an app that still has versions can't either:
 * remove or withdraw those first, so no download is lost by accident.
 */
export async function deleteApp(slug) {
  const app = await getApp(slug);
  if (!app) throw new HttpError(404, "That app doesn't exist.");
  if (app.builtIn) throw new HttpError(400, `${app.name} ships with Rasoi Pulse and can't be removed. You can make it private instead.`);
  const n = await AppReleaseModel.countDocuments({ app: slug });
  if (n > 0) throw new HttpError(409, `${app.name} still has ${n} version${n === 1 ? "" : "s"}. Delete them first (App Management → its Versions), then remove the app.`);
  await deleteShotsOf(slug);
  await AppModel.deleteOne({ slug });
  await AppSettingModel.deleteOne({ app: slug });
  invalidateApps();
  settingsCache = { at: 0, map: {} };
  notifyWebsite();
  return { ok: true };
}
