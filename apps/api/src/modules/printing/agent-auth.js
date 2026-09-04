import { createHmac } from "node:crypto";
import { OutletModel,                    } from "@onetap/db";
import { env } from "../../env.js";
import { safeEqual } from "../../lib/crypto.js";
import { HttpError } from "../../middleware/error.js";

/**
 * A print agent runs on a machine we don't control, so it gets its own
 * credential rather than a staff session: a signed `outletId.agentId.signature`
 * string shown once in the admin.
 *
 * It is derived, not stored — rotating `ENCRYPTION_KEY` invalidates every agent
 * token at once, and there is no table of long-lived secrets to leak.
 */
export function agentToken(outletId        , agentId        )         {
  const sig = createHmac("sha256", env.ENCRYPTION_KEY)
    .update(`agent|${outletId}|${agentId}`)
    .digest("base64url")
    .slice(0, 32);
  return `${outletId}.${agentId}.${sig}`;
}

;                               
                     
                  
 

export async function verifyAgentToken(token        )                         {
  const parts = token.split(".");
  const [outletId, agentId, sig] = parts;
  if (parts.length !== 3 || !outletId || !agentId || !sig) {
    throw new HttpError(401, "Malformed agent token");
  }

  const expected = agentToken(outletId, agentId).split(".")[2] ?? "";
  if (!safeEqual(sig, expected)) throw new HttpError(401, "Invalid agent token");

  const outlet = await OutletModel.findOne({ _id: outletId }, null, { allowGlobalQuery: true }).lean();
  if (!outlet) throw new HttpError(401, "Unknown outlet");

  return { ctx: { brandId: outlet.brandId, outletId: String(outlet._id) }, agentId };
}
