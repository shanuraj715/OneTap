import { Router } from "express";
import { dbState } from "@onetap/db";

export const healthRouter         = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "onetap-api",
    env: process.env.NODE_ENV ?? "development",
    db: dbState(),
    time: new Date().toISOString(),
  });
});
