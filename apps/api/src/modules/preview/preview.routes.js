import { Router } from "express";
import { requireOutletContext } from "../../middleware/auth.js";
import { HttpError } from "../../middleware/error.js";
import { createPreviewSession, getPreviewSession } from "../../realtime/preview.js";

export const previewRouter = Router();

/**
 * Open a live menu-layout preview session for the current outlet. The editor
 * calls this once, shows the returned URL, then streams its working layout over
 * the /preview WebSocket. Menu layout is a storefront-appearance concern, so
 * the same permission the config patch uses gates this.
 */
previewRouter.post("/", async (req, res) => {
  const ctx = await requireOutletContext(req, "appearance:update");
  const layout = req.body?.layout ?? {};
  const session = createPreviewSession({ outletId: ctx.outletId, brandId: ctx.brandId, layout });
  res.status(201).json({ id: session.id });
});

/**
 * Public: the current snapshot, so the preview page has something to render
 * before its WebSocket connects (and a clean 404 when the session is gone).
 */
previewRouter.get("/:id", (req, res) => {
  const session = getPreviewSession(req.params.id);
  if (!session) {
    throw new HttpError(404, "This preview link has expired — reopen the preview from the Menu layout editor.");
  }
  res.json({ outletId: session.outletId, layout: session.layout, updatedAt: session.updatedAt });
});
