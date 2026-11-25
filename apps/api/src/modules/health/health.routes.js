import { Router } from "express";
import { dbState } from "@rasoipulse/db";

export const healthRouter         = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "rasoipulse-api",
    env: process.env.NODE_ENV ?? "development",
    db: dbState(),
    time: new Date().toISOString(),
  });
});
