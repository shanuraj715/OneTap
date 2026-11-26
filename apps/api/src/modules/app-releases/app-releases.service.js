import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { OMA_APP, appReleaseInputSchema, appReleasePatchSchema, decideUpdate, versionCodeOf, MAX_APK_MB } from "@rasoipulse/config-schema";
import { AppReleaseModel } from "@rasoipulse/db";
import { env, publicApiUrl } from "../../env.js";
import { logger } from "../../logger.js";
import { HttpError } from "../../middleware/error.js";
import { notifyWebsite } from "../site/revalidate.js";
import { openStoredFile, putLargeFile, removePlatformFile } from "../storage/storage.service.js";

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
export const pageUrl = () => `${(env.WEBSITE_URL || "").replace(/\/$/, "")}/app`;
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

const publishedOf = async (app = OMA_APP) => AppReleaseModel.find({ app, platform: PLATFORM, status: "published" }).sort({ versionCode: -1 }).lean();

/* ------------------------------------------------------------------ the phone's question */

/** The answer to "is there a newer version than build `versionCode`?" — what the app shows at start. Public. */
export async function checkForUpdate({ app = OMA_APP, versionCode }) {
  const releases = await publishedOf(app);
  const d = decideUpdate(versionCode, releases);
  return {
    updateAvailable: d.updateAvailable,
    force: d.force,
    latest: d.latest ? publicShape(d.latest) : null,
    whatsNew: d.whatsNew,
    pageUrl: pageUrl(),
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Refuses the app's sign-in when this build is too old AND a newer release is marked "force" — the second wall behind the app's own
 * screen: an old build that skips the check still can't get in. A request with no build number (the dashboard, an old app) is let through.
 */
export async function assertAppCurrent(req) {
  const code = Number.parseInt(String(req.header("x-oma-version-code") ?? ""), 10);
  if (!(code > 0)) return;
  const d = decideUpdate(code, await publishedOf());
  if (d.updateAvailable && d.force) {
    throw new HttpError(426, "This version of the app is out of date. Please update the app to continue.", { code: "update_required", pageUrl: pageUrl(), latest: d.latest ? publicShape(d.latest) : null });
  }
}

/** For the website's app page: the newest release and the history. Public. */
export async function publicReleases({ app = OMA_APP, limit = 20 } = {}) {
  const releases = await publishedOf(app);
  return { latest: releases[0] ? publicShape(releases[0]) : null, releases: releases.slice(0, limit).map(publicShape), pageUrl: pageUrl() };
}

/* ------------------------------------------------------------------ downloads */

/** The file of a PUBLISHED release, or a 404. */
export async function downloadable(id) {
  if (!/^[a-f\d]{24}$/i.test(String(id))) throw new HttpError(404, "That download doesn't exist.");
  const r = await AppReleaseModel.findOne({ _id: id, status: "published" }).lean();
  if (!r?.file?.key) throw new HttpError(404, "That download isn't available.");
  return { filename: `rasoi-pulse-oma-${r.version}.apk`, release: r };
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

export async function listReleases() {
  const rows = await AppReleaseModel.find({ app: OMA_APP, platform: PLATFORM }).sort({ versionCode: -1 }).lean();
  const published = rows.filter((r) => r.status === "published");
  // "apps older than this must update": the newest published release that is forced
  const forcedBelow = published.filter((r) => r.force).sort((a, b) => b.versionCode - a.versionCode)[0] ?? null;
  return {
    releases: rows.map(adminShape),
    latest: published[0] ? adminShape(published[0]) : null,
    forcedBelow: forcedBelow ? { version: forcedBelow.version, versionCode: forcedBelow.versionCode } : null,
    pageUrl: pageUrl(),
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

const uploads = new Map(); // id → { id, name, size, chunks, received:Set, by, at }
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

export async function startUpload({ fileName, size }, user) {
  const name = String(fileName ?? "").trim();
  if (!/^[\w.\- ()]{1,120}\.apk$/i.test(name)) throw new HttpError(400, "Choose an .apk file.");
  if (!Number.isInteger(size) || size < 1024) throw new HttpError(400, "That file is empty or too small to be an app.");
  if (size > maxBytes()) throw new HttpError(413, `That file is too big. The most allowed is ${Math.round(maxBytes() / 1024 / 1024)} MB.`);
  await fsp.mkdir(partsDir(), { recursive: true });
  await clearStaleUploads();
  const id = randomBytes(12).toString("hex");
  const u = { id, name, size, chunks: chunkCount(size), received: new Set(), by: String(user._id), at: Date.now() };
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
  if (await AppReleaseModel.exists({ app: OMA_APP, platform: PLATFORM, versionCode })) throw new HttpError(409, `Version ${body.version} (build ${versionCode}) already exists. Each build number can be used once.`);
  const apk = await inspectApk(part);
  if (!apk.ok) throw new HttpError(400, apk.why);

  const sha256 = await sha256Of(part);
  // the finished file goes to the platform storage (disk or bucket). If that fails the pieces stay here, so nothing has to be sent again
  const key = `app-releases/${OMA_APP}/${body.version}-${randomBytes(6).toString("hex")}.apk`;
  await putLargeFile({ key, filePath: part, size: u.size, sha256, contentType: "application/vnd.android.package-archive" });
  await fsp.rm(part, { force: true });
  await fsp.rm(metaFile(id), { force: true });
  uploads.delete(id);

  let r;
  try {
    r = await AppReleaseModel.create({
      app: OMA_APP, platform: PLATFORM, version: body.version, versionCode, notes: body.notes, force: body.force,
      status: body.publish ? "published" : "draft", publishedAt: body.publish ? new Date() : null,
      file: { name: u.name, key, size: u.size, sha256 }, createdBy: String(user._id), updatedBy: String(user._id),
    });
  } catch (e) {
    await removePlatformFile(key);
    if (e?.code === 11000) throw new HttpError(409, `Version ${body.version} already exists.`);
    throw e;
  }
  if (body.publish) notifyWebsite();
  return adminShape(r.toObject());
}
