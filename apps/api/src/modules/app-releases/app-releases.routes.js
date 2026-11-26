import { raw, Router } from "express";
import { z } from "zod";
import { OMA_APP } from "@rasoipulse/config-schema";
import { limiter } from "../../middleware/rate-limit.js";
import { HttpError } from "../../middleware/error.js";
import { requireUser } from "../../middleware/auth.js";
import * as svc from "./app-releases.service.js";

/** What the staff app and the website ask — no sign-in: the app checks before anyone has signed in, and the page is public. */
export const appUpdatesRouter = Router();

const checkQuery = z.object({
  app: z.string().max(20).default(OMA_APP),
  platform: z.string().max(20).default("android"),
  versionCode: z.coerce.number().int().min(0).max(10_000_000).default(0),
});

appUpdatesRouter.get("/check", limiter("app-update-check"), async (req, res) => {
  const q = checkQuery.parse(req.query);
  res.set("Cache-Control", "no-store");
  res.json(await svc.checkForUpdate({ app: q.app, versionCode: q.versionCode }));
});

appUpdatesRouter.get("/releases", limiter("app-update-check"), async (_req, res) => {
  res.json(await svc.publicReleases());
});

/** The APK itself. Streamed from disk with Range support, so an interrupted download on a poor connection can continue. */
appUpdatesRouter.get("/download/:id", limiter("app-download"), async (req, res, next) => {
  const { file, filename, release } = await svc.downloadable(req.params.id);
  const range = req.header("range");
  if (!range || /^bytes=0-/.test(range)) svc.countDownload(release._id);
  res.set("Content-Type", "application/vnd.android.package-archive");
  // always ask the server (a withdrawn version must stop being served at once, not after a cache expires)
  res.set("Cache-Control", "no-cache");
  // dotfiles: the folder is ".app-releases" by default, and Express refuses to send anything under a dot-folder unless told it may
  res.download(file, filename, { acceptRanges: true, dotfiles: "allow" }, (err) => {
    if (err && !res.headersSent) next(err);
  });
});

/** The platform console's part (mounted under /api/platform/app-releases — super admin only, checked by the platform router). */
export const appReleasesAdminRouter = Router();

appReleasesAdminRouter.get("/", async (_req, res) => {
  res.json(await svc.listReleases());
});

appReleasesAdminRouter.post("/uploads", limiter("release-upload"), async (req, res) => {
  const body = z.object({ fileName: z.string().min(1).max(200), size: z.number().int() }).parse(req.body);
  res.status(201).json(await svc.startUpload(body, requireUser(req)));
});

appReleasesAdminRouter.put(
  "/uploads/:id/chunks/:index",
  limiter("release-upload"),
  raw({ type: () => true, limit: svc.CHUNK_SIZE + 1024 }),
  async (req, res) => {
    const index = Number(req.params.index);
    if (!Buffer.isBuffer(req.body)) throw new HttpError(400, "Send the piece as the request body.");
    res.json(await svc.putChunk(req.params.id, index, req.body));
  },
);

appReleasesAdminRouter.post("/uploads/:id/complete", limiter("release-upload"), async (req, res) => {
  res.status(201).json({ release: await svc.completeUpload(req.params.id, req.body, requireUser(req)) });
});

// (writes under /api/platform already count against "team-write", app.js)
appReleasesAdminRouter.patch("/:id", async (req, res) => {
  res.json({ release: await svc.updateRelease(req.params.id, req.body, requireUser(req)) });
});

appReleasesAdminRouter.delete("/:id", async (req, res) => {
  await svc.deleteRelease(req.params.id);
  res.status(204).end();
});
