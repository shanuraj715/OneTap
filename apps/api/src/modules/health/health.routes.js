import { Router } from "express";
import { dbState } from "@rasoipulse/db";
import { APP_VERSION } from "../../version.js";

export const healthRouter         = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "rasoipulse-api",
    version: APP_VERSION,
    env: process.env.NODE_ENV ?? "development",
    db: dbState(),
    time: new Date().toISOString(),
  });
});
