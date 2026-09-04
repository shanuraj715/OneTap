import { Router, raw } from "express";
import { z } from "zod";
import { IMAGE_RULES, storageProviderSchema } from "@onetap/config-schema";
import { requireOutletContext, requireUser } from "../../middleware/auth.js";
import { HttpError } from "../../middleware/error.js";
import {
  getStorageConfig,
  putImage,
  removeObject,
  resetStorageConfig,
  saveStorageConfig,
  testStorageConfig,
} from "./storage.service.js";

export const storageRouter = Router();

/* ------------------------------------------------------------ admin config */

storageRouter.get("/config", async (req, res) => {
  const ctx = await requireOutletContext(req, "storage-config:read");
  res.json(await getStorageConfig(ctx));
});

const saveBody = z.object({
  provider: storageProviderSchema,
  values: z.record(z.string(), z.string().nullable()),
});

storageRouter.put("/config", async (req, res) => {
  const ctx = await requireOutletContext(req, "storage-config:manage");
  const user = requireUser(req);
  const { provider, values } = saveBody.parse(req.body);
  await saveStorageConfig(ctx, provider, values, String(user._id));
  res.json(await getStorageConfig(ctx));
});

storageRouter.delete("/config", async (req, res) => {
  const ctx = await requireOutletContext(req, "storage-config:manage");
  await resetStorageConfig(ctx);
  res.json(await getStorageConfig(ctx));
});

storageRouter.post("/config/test", async (req, res) => {
  const ctx = await requireOutletContext(req, "storage-config:manage");
  try {
    res.json(await testStorageConfig(ctx));
  } catch (err) {
    // A bad key or an unreachable bucket is the point of this endpoint — report it,
    // don't 500.
    throw new HttpError(400, err instanceof Error ? err.message : "Storage test failed");
  }
});

/* ------------------------------------------------------------------ uploads */

/**
 * Raw image bytes in the body, `Content-Type` says the format. The admin has
 * already downscaled the picture on a canvas, so this is small and there is no
 * decode step here — dimensions ride along as query params.
 */
storageRouter.post(
  "/upload",
  raw({ type: IMAGE_RULES.acceptedTypes, limit: IMAGE_RULES.maxBytes + 1024 }),
  async (req, res) => {
    const ctx = await requireOutletContext(req, "menu:update");
    const body = Buffer.isBuffer(req.body) ? req.body : null;
    if (!body) throw new HttpError(415, "Send the image bytes with an image/jpeg, image/png or image/webp Content-Type.");

    const result = await putImage(ctx, {
      body,
      contentType: req.get("content-type")?.split(";")[0]?.trim() ?? "",
      width: Number(req.query.w) || undefined,
      height: Number(req.query.h) || undefined,
      kind: typeof req.query.kind === "string" ? req.query.kind : "menu-items",
    });
    res.status(201).json(result);
  },
);

const deleteBody = z.object({ key: z.string().min(1) });

storageRouter.delete("/object", async (req, res) => {
  const ctx = await requireOutletContext(req, "menu:update");
  const { key } = deleteBody.parse(req.body);
  // Only ever delete inside this outlet's own prefix.
  if (!key.startsWith(`${ctx.brandId}/${ctx.outletId}/`)) throw new HttpError(403, "Not your file");
  await removeObject(ctx, key);
  res.status(204).end();
});
