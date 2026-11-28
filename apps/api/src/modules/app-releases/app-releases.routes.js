import { raw, Router } from "express";
import { z } from "zod";
import { DEFAULT_APP } from "@rasoipulse/config-schema";
import { limiter } from "../../middleware/rate-limit.js";
import { HttpError } from "../../middleware/error.js";
import { requireUser } from "../../middleware/auth.js";
import * as svc from "./app-releases.service.js";

/** What the staff app and the website ask — no sign-in: the app checks before anyone has signed in, and the page is public. */
export const appUpdatesRouter = Router();

/** An app's id as written in a request: a plain address like "oma" or "rasoi-pulse-pos". Whether such an app exists is the service's question (404 / 400). */
const appId = z.string().trim().min(1).max(40).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "That isn't an app address.").default(DEFAULT_APP);

const checkQuery = z.object({
  app: appId,
  platform: z.string().max(20).default("android"),
  versionCode: z.coerce.number().int().min(0).max(10_000_000).default(0),
});

appUpdatesRouter.get("/check", limiter("app-update-check"), async (req, res) => {
  const q = checkQuery.parse(req.query);
  res.set("Cache-Control", "no-store");
  res.json(await svc.checkForUpdate({ app: q.app, versionCode: q.versionCode }));
});

const appQuery = z.object({ app: appId });

/** One app's published versions (newest first) — what its page on the website shows. */
appUpdatesRouter.get("/releases", limiter("app-update-check"), async (req, res) => {
  res.json(await svc.publicReleases({ app: appQuery.parse(req.query).app }));
});

/** Every app, each with its newest published version — the website's /apps page. */
appUpdatesRouter.get("/apps", limiter("app-update-check"), async (_req, res) => {
  res.json(await svc.publicApps());
});

/** The APK itself. Streamed from disk with Range support, so an interrupted download on a poor connection can continue. */
appUpdatesRouter.get("/download/:id", limiter("app-download"), async (req, res, next) => {
  const { filename, release } = await svc.downloadable(req.params.id);
  const range = req.header("range");
  const src = await svc.openRelease(release, range);
  if (!range || /^bytes=0-/.test(range)) svc.countDownload(release._id);
  // always ask the server (a withdrawn version must stop being served at once, not after a cache expires)
  res.set("Cache-Control", "no-cache");
  if (src.kind === "local") {
    res.set("Content-Type", "application/vnd.android.package-archive");
    // dotfiles: the storage folder may sit under a dot-folder, and Express refuses to send those unless told it may
    res.download(src.path, filename, { acceptRanges: true, dotfiles: "allow" }, (err) => {
      if (err && !res.headersSent) next(err);
    });
    return;
  }
  // from the bucket: passed through as it comes (a Range request gets its 206 the same way, so an interrupted download can resume)
  res.status(src.status);
  res.attachment(filename);
  res.set("Content-Type", "application/vnd.android.package-archive");
  res.set("Accept-Ranges", "bytes");
  for (const h of ["content-length", "content-range"]) if (src.headers[h]) res.set(h, src.headers[h]);
  src.stream.on("error", () => res.destroy());
  src.stream.pipe(res);
});

/** The platform console's part (mounted under /api/platform/app-releases — super admin only, checked by the platform router). */
export const appReleasesAdminRouter = Router();

/** How often each app asks the server for new data (seconds) — one number per app. */
appReleasesAdminRouter.get("/settings", async (_req, res) => {
  res.json(await svc.listAppSettings());
});

appReleasesAdminRouter.put("/settings/:app", async (req, res) => {
  res.json(await svc.saveAppSettings(req.params.app, req.body ?? {}, requireUser(req)));
});

/** Public or private: is the app in the website's list of apps? (A private app's page still opens for anyone with the link.) */
appReleasesAdminRouter.put("/visibility/:app", async (req, res) => {
  res.json(await svc.setAppVisibility(req.params.app, req.body?.public, requireUser(req)));
});

/** Add an app (App Management → Add an app), change its words, or remove it. The address of an app never changes once it exists. */
appReleasesAdminRouter.post("/apps", async (req, res) => {
  res.status(201).json(await svc.createApp(req.body ?? {}, requireUser(req)));
});

appReleasesAdminRouter.patch("/apps/:slug", async (req, res) => {
  res.json(await svc.updateApp(req.params.slug, req.body ?? {}, requireUser(req)));
});

appReleasesAdminRouter.delete("/apps/:slug", async (req, res) => {
  res.json(await svc.deleteApp(req.params.slug));
});

appReleasesAdminRouter.get("/", async (req, res) => {
  res.json(await svc.listReleases(appQuery.parse(req.query).app));
});

appReleasesAdminRouter.post("/uploads", limiter("release-upload"), async (req, res) => {
  const body = z.object({ fileName: z.string().min(1).max(200), size: z.number().int(), app: appId }).parse(req.body);
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
