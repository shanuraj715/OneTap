                                                               
import { permissionsForRole,                            } from "@rasoipulse/config-schema";
import { userFromToken } from "../modules/auth/auth.service.js";
import { outletAccess } from "../modules/outlets/outlet-cache.js";
import { assertStoreEnabled } from "../modules/platform/plan.service.js";
import { HttpError } from "./error.js";

export const SESSION_COOKIE = "rasoipulse_session";

                
                                                             
                     
                       
                     
                             
     
   
 

/** The sign-in token the staff app sends: `Authorization: Bearer <token>` (it has no browser cookie jar). */
export const bearerToken = (req) => /^Bearer\s+(\S+)$/i.exec(req.header("authorization") ?? "")?.[1];

/**
 * Attaches req.user when the session is valid — the browser's session cookie, or (for the staff app) a Bearer token. It is the
 * same session either way: one table, the same expiry, signing out drops it. Never rejects — routes decide.
 */
export async function authenticate(req         , _res          , next              )                {
  const cookieToken = (req.cookies                                      )?.[SESSION_COOKIE];
  let user = await userFromToken(cookieToken);
  if (!user) {
    const bearer = bearerToken(req);
    if (bearer) user = await userFromToken(bearer);
  }
  if (user) req.user = user;
  next();
}

export function requireUser(req         )          {
  if (!req.user) throw new HttpError(401, "Sign in to continue");
  return req.user;
}

/** Platform-only routes — the super admin who runs Rasoi Pulse, not a store's owner. */
export function requireSuperAdmin(req         )          {
  const user = requireUser(req);
  if (!user.isSuperAdmin) throw new HttpError(403, "Only a platform superadmin can do this");
  return user;
}

const PAUSED = "Your access to this store is paused. Please contact the store owner.";

function membershipFor(user         , brandId        )                    {
  return user.memberships.find((m) => m.brandId === brandId) ?? null;
}

/**
 * The outlets a person is limited to in a store: null = every outlet (owners, the platform admin, and anyone not mapped to particular
 * outlets), otherwise the list of outlet ids they were mapped to when their account was made or later edited.
 */
export function allowedOutletIds(user, brandId) {
  if (user.isSuperAdmin) return null;
  const ids = membershipFor(user, brandId)?.outletIds ?? [];
  return ids.length > 0 ? ids.map(String) : null;
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
    (req.header("x-rasoipulse-outlet") ?? "") ||
    (typeof req.query.outletId === "string" ? req.query.outletId : "");
  if (!outletId) throw new HttpError(400, "No outlet selected");

  const outlet = await outletAccess(outletId); // { brandId, blocked } — remembered briefly, dropped when the outlet changes
  if (!outlet) throw new HttpError(404, "Outlet not found");

  const membership = membershipFor(user, outlet.brandId);
  if (!user.isSuperAdmin) {
    if (!membership) throw new HttpError(403, "You don't have access to this restaurant");
    if (membership.blockedAt) throw new HttpError(403, PAUSED);
    if (membership.outletIds.length > 0 && !membership.outletIds.includes(outletId)) {
      throw new HttpError(403, "You don't have access to this outlet");
    }
    // A store the platform has switched off turns its whole team away.
    await assertStoreEnabled(outlet.brandId);
    // The platform super admin still gets in — that's how a blocked outlet is
    // inspected, unblocked or deleted.
    if (outlet.blocked) throw new HttpError(403, "This outlet is blocked — your store is over its plan's outlet limit.");
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
export async function requireBrandContext(req         , permission             )                      {
  const user = requireUser(req);
  const brandId = req.header("x-rasoipulse-brand") ?? user.memberships[0]?.brandId;
  if (!brandId) throw new HttpError(400, "No brand selected");

  const membership = membershipFor(user, brandId);
  if (!user.isSuperAdmin && !membership) throw new HttpError(403, "You don't have access to this brand");
  if (!user.isSuperAdmin && membership.blockedAt) throw new HttpError(403, PAUSED);
  // A store the platform has switched off turns its whole team away (the super admin still gets in).
  if (!user.isSuperAdmin) await assertStoreEnabled(brandId);

  if (permission) {
    const role = effectiveRole(user, membership);
    if (!role || !permissionsForRole(role).includes(permission)) {
      throw new HttpError(403, `Your role can't do this (${permission})`);
    }
  }
  return { brandId };
}
