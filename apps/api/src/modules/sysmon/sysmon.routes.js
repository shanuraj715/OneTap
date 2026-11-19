import { Router } from "express";
import { z } from "zod";
import { folderScanState, processSnapshot, serverHistory, serverSnapshot, startFolderScan } from "./monitor.js";
import { limiter } from "../../middleware/rate-limit.js";

/**
 * The Server page's data. Mounted by the platform router, so only the platform
 * owner can read it. Nothing here is cached by browsers or proxies.
 */
export const sysmonRouter = Router();
// reading the machine (processes, disk) costs the machine something: a person watching the page stays far below this
sysmonRouter.use(limiter("report"));

sysmonRouter.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

/** The live picture: CPU, memory, disk, network, API, and the 0–10 health score. */
sysmonRouter.get("/", async (_req, res) => {
  res.json(await serverSnapshot());
});

/** Just the health score and what's wrong — a light call for the dashboard's tile. */
sysmonRouter.get("/health", async (_req, res) => {
  const s = await serverSnapshot();
  res.json({ at: s.at, hostname: s.machine.hostname, health: s.health });
});

/** The last N minutes (default 30) of readings, for the charts. */
sysmonRouter.get("/history", async (req, res) => {
  const { minutes } = z.object({ minutes: z.coerce.number().int().min(1).max(60).default(30) }).parse(req.query);
  res.json(await serverHistory(minutes));
});

/** The busiest processes, and the apps pm2 runs. */
sysmonRouter.get("/processes", async (_req, res) => {
  res.json(await processSnapshot());
});

/** Which folders use the most disk: the last scan, if any. */
sysmonRouter.get("/folders", (_req, res) => {
  res.json(folderScanState());
});

/** Start a scan in the background (it can take a while); poll GET /folders. */
sysmonRouter.post("/folders/scan", limiter("export"), (_req, res) => {
  res.status(202).json(startFolderScan());
});
