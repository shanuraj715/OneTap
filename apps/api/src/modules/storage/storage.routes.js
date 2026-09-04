import { Router, raw } from "express";
import { z } from "zod";
import { IMAGE_RULES, imageProcessingSchema, storageProviderSchema } from "@onetap/config-schema";
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
  provider: storageProviderSchema.optional(),
  values: z.record(z.string(), z.string().nullable()).optional(),
  processing: imageProcessingSchema.partial().optional(),
});

storageRouter.put("/config", async (req, res) => {
  const ctx = await requireOutletContext(req, "storage-config:manage");
  const user = requireUser(req);
  const body = saveBody.parse(req.body);
  if (!body.provider && !body.processing) throw new HttpError(400, "Nothing to save");
  await saveStorageConfig(ctx, body, String(user._id));
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
 * Raw image bytes in the body — any format the server can decode (JPEG, PNG,
 * WebP, AVIF, HEIC/HEIF, GIF, TIFF). The API compresses and re-encodes it per
 * the outlet's settings, so nothing about the format or size needs to be
 * negotiated with the client.
 */
storageRouter.post(
  "/upload",
  raw({ type: () => true, limit: IMAGE_RULES.maxUploadBytes + 4096 }),
  async (req, res) => {
    const ctx = await requireOutletContext(req, "menu:update");
    const body = Buffer.isBuffer(req.body) ? req.body : null;
    if (!body?.length) throw new HttpError(400, "Send the image bytes as the request body.");

    const result = await putImage(ctx, {
      body,
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
