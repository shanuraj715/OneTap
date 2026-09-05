import { Router } from "express";
import { z } from "zod";
import { requireOutletContext, requireUser } from "../../middleware/auth.js";
import { getDesign, resetDesign, saveDesign } from "./qr-cards.service.js";

export const qrCardsRouter = Router();

/**
 * Reads use `table:read` and writes `table:manage` rather than a new
 * permission. The card IS the table's code — whoever may rotate a table's QR
 * and invalidate every printed card is exactly who may redesign it.
 */
qrCardsRouter.get("/design", async (req, res) => {
  const ctx = await requireOutletContext(req, "table:read");
  res.json(await getDesign(ctx));
});

/**
 * `spec` passes through unvalidated here and is parsed in the service, after
 * the size guard. Validating it at this layer would mean zod's string-length
 * cap rejects an over-sized background before anything can say so in words the
 * owner can act on — and would spend the validation on four megabytes about to
 * be thrown away.
 */
const saveBody = z.object({
  name: z.string().min(1).max(60).optional(),
  spec: z.unknown(),
  /** what the client last read; omit only when deliberately forcing an overwrite */
  baseUpdatedAt: z.string().nullable().optional(),
});

qrCardsRouter.put("/design", async (req, res) => {
  const ctx = await requireOutletContext(req, "table:manage");
  const user = requireUser(req);
  res.json(await saveDesign(ctx, saveBody.parse(req.body), String(user._id)));
});

qrCardsRouter.post("/design/reset", async (req, res) => {
  const ctx = await requireOutletContext(req, "table:manage");
  const user = requireUser(req);
  res.json(await resetDesign(ctx, String(user._id)));
});
