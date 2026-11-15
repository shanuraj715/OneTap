import { Router, raw } from "express";
import { z } from "zod";
import { IMAGE_RULES } from "@onetap/config-schema";
import { requireOutletContext } from "../../middleware/auth.js";
import { HttpError } from "../../middleware/error.js";
import { putImage, removeObject } from "./storage.service.js";

export const storageRouter = Router();

/*
 * Choosing WHERE images are kept (this server's disk, or an S3-compatible bucket) is the platform's job, not a
 * store owner's: it lives in the platform console — see the `/storage` routes in platform.routes.js. A store
 * only uploads and removes its own pictures here.
 */

/* ------------------------------------------------------------------ uploads */

/**
 * Raw image bytes in the body — any format the server can decode (JPEG, PNG,
 * WebP, AVIF, HEIC/HEIF, GIF, TIFF). The API compresses and re-encodes it per
 * the platform's settings, so nothing about the format or size needs to be
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
