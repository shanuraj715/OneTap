import { RiderModel, tenantFilter } from "@rasoipulse/db";
import { HttpError } from "../../middleware/error.js";
import { assertStoreEnabled, requireFeature } from "../platform/plan.service.js";
import { readRiderToken } from "./rider-auth.js";

/**
 * Who a rider's token belongs to, if they are still allowed in — the ONE check behind every rider route AND the rider app's live
 * connection (realtime/hub.js). The token is signed and stateless, so each use re-reads the rider: still on the list, still switched on,
 * PIN not reset since the token was made, store on, Delivery in the plan.  → { rider, ctx } or throws 401 / 403.
 */
export async function riderFromToken(token) {
  const t = readRiderToken(token);
  if (!t) throw new HttpError(401, "Sign in to continue");
  const rider = await RiderModel.findOne(tenantFilter({ brandId: t.brandId, outletId: t.outletId }, { _id: t.riderId })).lean();
  if (!rider || !rider.loginPhone || (rider.pinVersion ?? 0) !== t.pinVersion) throw new HttpError(401, "Sign in to continue");
  if (!rider.isActive) throw new HttpError(403, "Your login is switched off. Ask your manager.");
  await assertStoreEnabled(rider.brandId);
  await requireFeature(rider.brandId, "delivery", "Delivery");
  return { rider, ctx: { brandId: rider.brandId, outletId: rider.outletId } };
}
