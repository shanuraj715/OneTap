                                                               
import { permissionsForRole,                            } from "@onetap/config-schema";
import { OutletModel,                                                   } from "@onetap/db";
import { userFromToken } from "../modules/auth/auth.service.js";
import { HttpError } from "./error.js";

export const SESSION_COOKIE = "onetap_session";

                
                                                             
                     
                       
                     
                             
     
   
 

/** Attaches req.user when the session cookie is valid. Never rejects — routes decide. */
export async function authenticate(req         , _res          , next              )                {
  const token = (req.cookies                                      )?.[SESSION_COOKIE];
  const user = await userFromToken(token);
  if (user) req.user = user;
  next();
}

export function requireUser(req         )          {
  if (!req.user) throw new HttpError(401, "Sign in to continue");
  return req.user;
}

function membershipFor(user         , brandId        )                    {
  return user.memberships.find((m) => m.brandId === brandId) ?? null;
}

function effectiveRole(user         , membership                   )              {
  return user.isSuperAdmin ? "super_admin" : (membership?.role ?? null);
}

/**
 * The tenant context for a write. The outlet id comes from the client, but the
 * brand and the right to touch it come from the SESSION — a forged header buys
 * nothing.
 */
export async function requireOutletContext(
  req         ,
  permission             ,
)                         {
  const user = requireUser(req);

  const outletId =
    (req.header("x-onetap-outlet") ?? "") ||
    (typeof req.query.outletId === "string" ? req.query.outletId : "");
  if (!outletId) throw new HttpError(400, "No outlet selected");

  const outlet = await OutletModel.findOne({ _id: outletId }, null, { allowGlobalQuery: true }).lean();
  if (!outlet) throw new HttpError(404, "Outlet not found");

  const membership = membershipFor(user, outlet.brandId);
  if (!user.isSuperAdmin) {
    if (!membership) throw new HttpError(403, "You don't have access to this restaurant");
    if (membership.outletIds.length > 0 && !membership.outletIds.includes(outletId)) {
      throw new HttpError(403, "You don't have access to this outlet");
    }
  }

  if (permission) {
    const role = effectiveRole(user, membership);
    if (!role || !permissionsForRole(role).includes(permission)) {
      throw new HttpError(403, `Your role can't do this (${permission})`);
    }
  }

  const ctx                = { brandId: outlet.brandId, outletId };
  req.tenant = ctx;
  return ctx;
}

/** Brand-level context, for things that aren't outlet-specific (users, billing). */
export function requireBrandContext(req         , permission             )                      {
  const user = requireUser(req);
  const brandId = req.header("x-onetap-brand") ?? user.memberships[0]?.brandId;
  if (!brandId) throw new HttpError(400, "No brand selected");

  const membership = membershipFor(user, brandId);
  if (!user.isSuperAdmin && !membership) throw new HttpError(403, "You don't have access to this brand");

  if (permission) {
    const role = effectiveRole(user, membership);
    if (!role || !permissionsForRole(role).includes(permission)) {
      throw new HttpError(403, `Your role can't do this (${permission})`);
    }
  }
  return { brandId };
}
