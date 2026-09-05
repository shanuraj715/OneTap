import { CARD_SPEC_MAX_BYTES, defaultQrCardSpec, qrCardSpecSchema } from "@onetap/config-schema";
import { QrCardDesignModel, tenantFilter } from "@onetap/db";
import { HttpError } from "../../middleware/error.js";

/**
 * Parse on the way out, exactly like `withDefaults` in outlets.service.js. A
 * design saved before a styling knob existed has no key for it, and the editor
 * reading `spec.border.style` would crash rather than get a default. This means
 * adding a knob needs no migration and no backfill.
 */
function shape(doc) {
  return {
    name: doc.name ?? "Table card",
    spec: qrCardSpecSchema.parse(doc.spec ?? {}),
    // The optimistic-concurrency token. Several managers share one design, and
    // a blind overwrite would silently discard someone else's afternoon.
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
}

/**
 * The outlet's card design, creating nothing. A brand-new outlet has no
 * document yet and gets the library's starting point — writing a row on a GET
 * would mean every outlet anyone ever glanced at owns a design forever.
 */
export async function getDesign(ctx) {
  const doc = await QrCardDesignModel.findOne(tenantFilter(ctx)).lean();
  if (!doc) return { name: "Table card", spec: defaultQrCardSpec(), updatedAt: null };
  return shape(doc);
}

/**
 * Replace the whole spec.
 *
 * A PATCH would mean re-declaring some sixty optional fields and then deciding
 * what a partial `blocks` array means. The editor holds the entire design in a
 * draft anyway, so sending all of it is both simpler and the only shape that
 * can express "delete a block".
 */
export async function saveDesign(ctx, input, userId) {
  // Size is checked BEFORE parsing, and deliberately so. Backgrounds, logos and
  // image blocks all embed as data URLs (a canvas that drew a remote image is
  // tainted and cannot be exported), so an over-sized document is the likeliest
  // way this route fails. Parse first and zod's own string-length cap fires
  // instead, and the owner gets a schema dump about a maximum character count
  // where they needed "your photo is too big". Measuring first also avoids
  // validating four megabytes we are about to reject.
  const bytes = Buffer.byteLength(JSON.stringify(input.spec ?? {}), "utf8");
  if (bytes > CARD_SPEC_MAX_BYTES) {
    throw new HttpError(
      413,
      `This design is ${(bytes / 1_048_576).toFixed(1)}MB, over the ${(CARD_SPEC_MAX_BYTES / 1_048_576).toFixed(1)}MB limit. ` +
        "Use a smaller background photo or logo.",
    );
  }

  const spec = qrCardSpecSchema.parse(input.spec);

  const existing = await QrCardDesignModel.findOne(tenantFilter(ctx)).lean();

  // Optimistic concurrency. `baseUpdatedAt` is what the client last read; if the
  // stored row has moved on, someone else saved in between.
  if (existing && input.baseUpdatedAt) {
    const stored = new Date(existing.updatedAt).toISOString();
    if (stored !== input.baseUpdatedAt) {
      throw new HttpError(409, "Someone else saved this card design while you were editing. Reload to see their version.");
    }
  }

  const doc = await QrCardDesignModel.findOneAndUpdate(
    tenantFilter(ctx),
    {
      $set: { name: input.name ?? "Table card", spec, updatedBy: userId ?? null },
      // findOneAndUpdate with upsert bypasses the `save` hook, so the tenant
      // plugin's guardSave never runs on an insert. brandId/outletId have to be
      // written explicitly or the new row lands unscoped.
      $setOnInsert: { brandId: ctx.brandId, outletId: ctx.outletId },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();

  return shape(doc);
}

/** Start over from the library's default. */
export async function resetDesign(ctx, userId) {
  return saveDesign(ctx, { name: "Table card", spec: defaultQrCardSpec() }, userId);
}
